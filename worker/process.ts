import fs from "node:fs/promises"
import path from "node:path"
import { spawn } from "node:child_process"
import Anthropic from "@anthropic-ai/sdk"
import { db } from "../src/lib/db"
import { updateProgress } from "../src/lib/progress"
import { projectDir, ensureProjectDir } from "../src/lib/storage"
import { ViralMoment, ViralMomentsSchema } from "../src/lib/schemas"

type TranscriptWord = { word: string; start: number; end: number }
type TranscriptSegment = { start: number; end: number; text: string; words: TranscriptWord[] }
type Transcript = { language: string; duration: number; segments: TranscriptSegment[] }

function run(command: string, args: string[], cwd?: string) {
  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"] })
    let stdout = ""
    let stderr = ""
    child.stdout.on("data", (d) => { stdout += d.toString() })
    child.stderr.on("data", (d) => { stderr += d.toString() })
    child.on("error", reject)
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr })
      else reject(new Error(command + " falhou (code " + code + "): " + stderr.slice(-4000)))
    })
  })
}

async function ffprobeDuration(file: string) {
  const { stdout } = await run("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    file,
  ])
  const duration = Number(stdout.trim())
  if (!Number.isFinite(duration) || duration <= 0) throw new Error("Duração do vídeo inválida.")
  return duration
}

async function downloadSource(projectId: string, url: string) {
  const dir = await ensureProjectDir(projectId)
  const template = path.join(dir, "source.%(ext)s")
  await run("yt-dlp", [
    "--no-playlist",
    "--restrict-filenames",
    "--merge-output-format", "mp4",
    "-f", "bv*+ba/b",
    "-o", template,
    url,
  ], dir)
  const names = await fs.readdir(dir)
  const found = names.find((name) => /^source\.(mp4|mkv|webm|mov|m4v)$/i.test(name))
  if (!found) throw new Error("yt-dlp terminou, mas o arquivo de vídeo não foi encontrado.")
  return path.join(dir, found)
}

async function transcribe(inputVideo: string, projectId: string): Promise<Transcript> {
  const dir = projectDir(projectId)
  const audioPath = path.join(dir, "audio.wav")
  const transcriptPath = path.join(dir, "transcript.json")

  await run("ffmpeg", [
    "-y", "-i", inputVideo,
    "-vn", "-ac", "1", "-ar", "16000",
    "-c:a", "pcm_s16le",
    audioPath,
  ], dir)

  await run("python3", [
    path.join(process.cwd(), "scripts", "transcribe.py"),
    audioPath,
    transcriptPath,
    process.env.WHISPER_MODEL ?? "small",
    process.env.WHISPER_COMPUTE_TYPE ?? "int8",
  ], dir)

  return JSON.parse(await fs.readFile(transcriptPath, "utf8")) as Transcript
}

function transcriptChunks(transcript: Transcript) {
  const chunks: TranscriptSegment[][] = []
  let current: TranscriptSegment[] = []
  let chars = 0

  for (const segment of transcript.segments) {
    const cost = segment.text.length + 40
    if (current.length && chars + cost > 12000) {
      chunks.push(current)
      current = []
      chars = 0
    }
    current.push(segment)
    chars += cost
  }
  if (current.length) chunks.push(current)
  return chunks
}

function chunkPrompt(chunk: TranscriptSegment[], maxClips: number) {
  const lines = chunk.map((s) => "[" + s.start.toFixed(2) + "-" + s.end.toFixed(2) + "] " + s.text.trim()).join("\n")
  return "<transcricao>\n" + lines + "\n</transcricao>\n\n" +
    "Selecione até " + maxClips + " trechos que funcionem como clipes curtos fortes para redes sociais.\n" +
    "Retorne SOMENTE JSON, um array com objetos exatamente neste formato:\n" +
    '[{"start":12.3,"end":48.9,"title":"...","viralScore":92,"reason":"...","hashtags":["#tema"]}]\n\n' +
    "Regras obrigatórias:\n" +
    "- cada clipe deve durar entre 20 e 90 segundos;\n" +
    "- comece e termine em fronteiras de frases presentes na transcrição;\n" +
    "- não corte no meio de palavra;\n" +
    "- escolha trechos compreensíveis isoladamente;\n" +
    "- priorize gancho forte, opinião clara, surpresa, emoção, utilidade ou história com payoff;\n" +
    "- não crie timestamps inexistentes;\n" +
    "- não sobreponha trechos dentro desta resposta;\n" +
    "- viralScore deve ser inteiro entre 0 e 100;\n" +
    "- não use markdown nem comentários fora do JSON."
}

function parseClaudeJson(text: string) {
  const trimmed = text.trim().replace(/^\x60\x60\x60(?:json)?/i, "").replace(/\x60\x60\x60$/, "").trim()
  return ViralMomentsSchema.parse(JSON.parse(trimmed))
}

async function selectMoments(transcript: Transcript) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY não configurada.")
  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5"
  const client = new Anthropic({ apiKey })
  const chunks = transcriptChunks(transcript)
  const candidates: ViralMoment[] = []

  for (let index = 0; index < chunks.length; index++) {
    const prompt = chunkPrompt(chunks[index], 4)
    let lastError: unknown = null

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await client.messages.create({
          model,
          max_tokens: 5000,
          system: "Você é um editor profissional de vídeo curto. Seja rigoroso com timestamps e JSON.",
          messages: [{
            role: "user",
            content: attempt === 1 ? prompt : prompt + "\n\nA tentativa anterior retornou JSON inválido. Corrija estritamente o formato.",
          }],
        })
        const text = response.content.find((block) => block.type === "text")
        if (!text || text.type !== "text") throw new Error("Claude não retornou texto.")
        candidates.push(...parseClaudeJson(text.text))
        lastError = null
        break
      } catch (error) {
        lastError = error
      }
    }
    if (lastError) throw lastError
  }

  const sorted = candidates
    .filter((m) => m.end > m.start && m.end - m.start >= 20 && m.end - m.start <= 90)
    .sort((a, b) => b.viralScore - a.viralScore)

  const selected: ViralMoment[] = []
  const maxClips = Number(process.env.MAX_CLIPS ?? 8)
  for (const moment of sorted) {
    const overlaps = selected.some((s) => !(moment.end <= s.start || moment.start >= s.end))
    if (!overlaps) selected.push(moment)
    if (selected.length >= maxClips) break
  }
  if (!selected.length) throw new Error("A IA não retornou nenhum momento válido.")
  return selected
}

function wordsForMoment(transcript: Transcript, moment: ViralMoment) {
  return transcript.segments
    .flatMap((s) => s.words ?? [])
    .filter((w) => w.end >= moment.start && w.start <= moment.end)
    .map((w) => ({
      word: w.word,
      start: Math.max(0, w.start - moment.start),
      end: Math.max(0, w.end - moment.start),
    }))
}

async function writeAss(projectId: string, clipIndex: number, words: ReturnType<typeof wordsForMoment>, style: string) {
  const output = path.join(projectDir(projectId), "clip-" + clipIndex + ".ass")
  await run("python3", [
    path.join(process.cwd(), "scripts", "make_ass.py"),
    output,
    style,
    JSON.stringify(words),
  ], projectDir(projectId))
  return output
}

async function renderClip(projectId: string, source: string, moment: ViralMoment, clipIndex: number, transcript: Transcript, style: string) {
  const dir = projectDir(projectId)
  const cut = path.join(dir, "clip-" + clipIndex + "-cut.mp4")
  const silentReframed = path.join(dir, "clip-" + clipIndex + "-visual.mp4")
  const reframed = path.join(dir, "clip-" + clipIndex + "-reframed.mp4")
  const output = path.join(dir, "clip-" + clipIndex + ".mp4")

  await run("ffmpeg", [
    "-y", "-ss", moment.start.toFixed(3), "-i", source,
    "-t", (moment.end - moment.start).toFixed(3),
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
    "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", cut,
  ], dir)

  await run("python3", [path.join(process.cwd(), "scripts", "reframe.py"), cut, silentReframed], dir)

  await run("ffmpeg", [
    "-y", "-i", silentReframed, "-i", cut,
    "-map", "0:v:0", "-map", "1:a:0?",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
    "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", reframed,
  ], dir)

  const ass = await writeAss(projectId, clipIndex, wordsForMoment(transcript, moment), style)
  await run("ffmpeg", [
    "-y", "-i", reframed, "-vf", "ass=" + path.basename(ass),
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
    "-c:a", "copy", "-movflags", "+faststart", output,
  ], dir)

  for (const temp of [cut, silentReframed, reframed, ass]) {
    try { await fs.unlink(temp) } catch {}
  }
  return output
}

export async function processProject(projectId: string) {
  const project = await db.project.findUnique({ where: { id: projectId } })
  if (!project) throw new Error("Projeto não encontrado.")

  const dir = await ensureProjectDir(projectId)
  await db.clip.deleteMany({ where: { projectId } })

  try {
    await updateProgress(projectId, { status: "PROCESSING", stage: "downloading", progress: 5, message: "Preparando fonte" })

    let source = project.originalPath
    if (project.inputType === "URL") {
      if (!project.sourceUrl) throw new Error("URL de origem ausente.")
      source = await downloadSource(projectId, project.sourceUrl)
      await db.project.update({ where: { id: projectId }, data: { originalPath: source } })
    }
    if (!source) throw new Error("Arquivo de origem ausente.")

    const duration = await ffprobeDuration(source)
    const maxDuration = Number(process.env.MAX_VIDEO_MINUTES ?? 120) * 60
    if (duration > maxDuration) throw new Error("Vídeo excede a duração máxima permitida.")
    await db.project.update({ where: { id: projectId }, data: { durationSec: duration } })

    await updateProgress(projectId, { status: "PROCESSING", stage: "transcribing", progress: 20, message: "Extraindo áudio e transcrevendo" })
    const transcript = await transcribe(source, projectId)
    await db.project.update({ where: { id: projectId }, data: { language: transcript.language } })

    await updateProgress(projectId, { status: "PROCESSING", stage: "analyzing", progress: 45, message: "Selecionando melhores momentos" })
    const moments = await selectMoments(transcript)

    for (let i = 0; i < moments.length; i++) {
      const moment = moments[i]
      const baseProgress = 55 + Math.round((i / moments.length) * 40)
      await updateProgress(projectId, {
        status: "PROCESSING",
        stage: "rendering",
        progress: baseProgress,
        message: "Renderizando clipe " + (i + 1) + " de " + moments.length,
      })

      const clip = await db.clip.create({
        data: {
          projectId,
          startSec: moment.start,
          endSec: moment.end,
          title: moment.title,
          viralScore: moment.viralScore,
          reason: moment.reason,
          hashtags: moment.hashtags,
          captionStyle: project.captionStyle,
          status: "PROCESSING",
        },
      })

      try {
        const outputPath = await renderClip(projectId, source, moment, i + 1, transcript, project.captionStyle)
        await db.clip.update({ where: { id: clip.id }, data: { outputPath, status: "READY", error: null } })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        await db.clip.update({ where: { id: clip.id }, data: { status: "FAILED", error: message } })
        throw error
      }
    }

    await updateProgress(projectId, { status: "COMPLETED", stage: "completed", progress: 100, message: "Clipes prontos" })
    return { dir, clips: moments.length }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await updateProgress(projectId, { status: "FAILED", stage: "failed", progress: 100, error: message, message })
    throw error
  }
}
