"use client"

import { FormEvent, useEffect, useRef, useState } from "react"

type Clip = {
  id: string
  title: string
  viralScore: number
  reason: string
  hashtags: string[]
  startSec: number
  endSec: number
  status: string
  downloadUrl: string | null
}

type Project = {
  id: string
  status: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED"
  stage: string
  progress: number
  error?: string | null
  language?: string | null
  clips: Clip[]
}

const styles = [
  { id: "neon", label: "Neon" },
  { id: "clean", label: "Clean" },
  { id: "pop", label: "Pop" },
  { id: "cinema", label: "Cinema" },
  { id: "minimal", label: "Minimal" },
]

const stageLabels: Record<string, string> = {
  queued: "Na fila",
  downloading: "Baixando vídeo",
  transcribing: "Transcrevendo",
  analyzing: "Analisando melhores momentos",
  rendering: "Cortando, reenquadrando e legendando",
  completed: "Pronto",
  failed: "Falhou",
}

export default function Home() {
  const [mode, setMode] = useState<"upload" | "link">("upload")
  const [file, setFile] = useState<File | null>(null)
  const [url, setUrl] = useState("")
  const [captionStyle, setCaptionStyle] = useState("neon")
  const [project, setProject] = useState<Project | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const eventSourceRef = useRef<EventSource | null>(null)

  async function refreshProject(projectId: string) {
    const response = await fetch("/api/projects/" + projectId, { cache: "no-store" })
    if (!response.ok) throw new Error("Não foi possível atualizar o projeto.")
    const data = await response.json()
    setProject(data)
    return data as Project
  }

  function subscribe(projectId: string) {
    eventSourceRef.current?.close()
    const source = new EventSource("/api/projects/" + projectId + "/events")
    eventSourceRef.current = source

    source.onmessage = async (event) => {
      const data = JSON.parse(event.data)
      setProject((current) => current ? { ...current, ...data } : current)
      if (data.status === "COMPLETED" || data.status === "FAILED") {
        await refreshProject(projectId)
        source.close()
      }
    }

    source.onerror = () => {
      source.close()
    }
  }

  useEffect(() => () => eventSourceRef.current?.close(), [])

  async function createFromLink() {
    const response = await fetch("/api/projects/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, captionStyle }),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.error || "Falha ao importar link.")
    return String(data.projectId)
  }

  function createFromUpload() {
    return new Promise<string>((resolve, reject) => {
      if (!file) return reject(new Error("Escolha um vídeo."))
      const form = new FormData()
      form.append("file", file)
      form.append("captionStyle", captionStyle)

      const xhr = new XMLHttpRequest()
      xhr.open("POST", "/api/projects/upload")
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          setUploadProgress(Math.round((event.loaded / event.total) * 100))
        }
      }
      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText)
          if (xhr.status >= 200 && xhr.status < 300) resolve(String(data.projectId))
          else reject(new Error(data.error || "Falha no upload."))
        } catch {
          reject(new Error("Resposta inválida do servidor."))
        }
      }
      xhr.onerror = () => reject(new Error("Falha de rede no upload."))
      xhr.send(form)
    })
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setMessage("")
    setUploadProgress(0)
    try {
      const projectId = mode === "upload" ? await createFromUpload() : await createFromLink()
      const initial = await refreshProject(projectId)
      setProject(initial)
      subscribe(projectId)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao criar projeto.")
    } finally {
      setBusy(false)
    }
  }

  async function retry() {
    if (!project) return
    setBusy(true)
    setMessage("")
    try {
      const response = await fetch("/api/projects/" + project.id + "/retry", { method: "POST" })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Não foi possível tentar novamente.")
      await refreshProject(project.id)
      subscribe(project.id)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao tentar novamente.")
    } finally {
      setBusy(false)
    }
  }

  async function updateTitle(clipId: string, title: string) {
    const response = await fetch("/api/clips/" + clipId, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    })
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.error || "Falha ao editar título.")
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-6 md:px-8 md:py-10">
      <header className="mb-14 flex items-center justify-between border-b border-white/10 pb-5">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--acid)] font-black text-black">DS</div>
          <div>
            <div className="font-bold tracking-tight">DS Clips</div>
            <div className="text-[10px] uppercase tracking-[.2em] text-white/40">AI Video Studio</div>
          </div>
        </div>
        <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/50">Pipeline v1</span>
      </header>

      <section className="mx-auto mb-12 max-w-4xl text-center">
        <div className="mb-5 inline-flex rounded-full border border-white/10 bg-white/[.03] px-3 py-1.5 text-[10px] uppercase tracking-[.18em] text-white/60">
          vídeo longo → cortes verticais reais
        </div>
        <h1 className="text-5xl font-black tracking-[-.055em] md:text-7xl">
          Cole. Envie. <span className="text-[var(--acid)]">Corte.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-white/50 md:text-base">
          O worker baixa ou recebe seu vídeo, transcreve com Whisper, escolhe momentos com Claude,
          reenquadra em 9:16, queima legendas palavra por palavra e entrega MP4.
        </p>
      </section>

      <div className="grid gap-5 lg:grid-cols-[.9fr_1.1fr]">
        <form onSubmit={submit} className="rounded-3xl border border-white/10 bg-white/[.025] p-5 shadow-2xl shadow-black/30 md:p-7">
          <div className="mb-6 flex gap-2 rounded-xl border border-white/10 bg-black/20 p-1">
            <button type="button" onClick={() => setMode("upload")} className={"flex-1 rounded-lg px-4 py-2.5 text-sm " + (mode === "upload" ? "bg-white text-black" : "text-white/50")}>Enviar vídeo</button>
            <button type="button" onClick={() => setMode("link")} className={"flex-1 rounded-lg px-4 py-2.5 text-sm " + (mode === "link" ? "bg-white text-black" : "text-white/50")}>Colar link</button>
          </div>

          {mode === "upload" ? (
            <label className="mb-5 flex min-h-52 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-black/15 p-6 text-center transition hover:border-[var(--acid)]/50">
              <input className="hidden" type="file" accept="video/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              <div className="mb-3 grid h-12 w-12 place-items-center rounded-xl bg-[var(--acid)]/10 text-[var(--acid)]">↑</div>
              <strong>{file ? file.name : "Escolha ou arraste um vídeo"}</strong>
              <span className="mt-2 text-xs text-white/40">MP4, MOV, WEBM e outros formatos suportados pelo FFmpeg</span>
            </label>
          ) : (
            <div className="mb-5 rounded-2xl border border-white/10 bg-black/15 p-5">
              <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-white/40">URL do vídeo</label>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm outline-none focus:border-[var(--acid)]/50"
                placeholder="https://youtube.com/watch?v=..."
                type="url"
                required={mode === "link"}
              />
              <p className="mt-2 text-xs text-white/35">YouTube, Vimeo e Google Drive compatíveis com yt-dlp.</p>
            </div>
          )}

          <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-white/40">Estilo da legenda</label>
          <select value={captionStyle} onChange={(e) => setCaptionStyle(e.target.value)} className="mb-5 w-full rounded-xl border border-white/10 bg-[#0a0d12] px-4 py-3 text-sm outline-none">
            {styles.map((style) => <option key={style.id} value={style.id}>{style.label}</option>)}
          </select>

          {mode === "upload" && uploadProgress > 0 && uploadProgress < 100 && (
            <div className="mb-5">
              <div className="mb-2 flex justify-between text-xs text-white/45"><span>Upload</span><span>{uploadProgress}%</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-white/5"><div className="h-full bg-[var(--acid)] transition-all" style={{ width: uploadProgress + "%" }} /></div>
            </div>
          )}

          <button disabled={busy || (mode === "upload" ? !file : !url)} className="w-full rounded-xl bg-[var(--acid)] px-5 py-3.5 font-bold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40">
            {busy ? "Enviando..." : "Gerar clipes reais"}
          </button>
          {message && <p className="mt-4 rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-200">{message}</p>}
        </form>

        <section className="rounded-3xl border border-white/10 bg-[#0b0f15]/90 p-5 md:p-7">
          {!project ? (
            <div className="flex min-h-[32rem] flex-col items-center justify-center text-center text-white/35">
              <div className="mb-4 grid h-16 w-16 place-items-center rounded-2xl border border-white/10 bg-white/[.03] text-2xl">✦</div>
              <strong className="text-white/70">Seu projeto aparece aqui</strong>
              <p className="mt-2 max-w-sm text-sm leading-6">Acompanhe download, transcrição, análise, corte, reenquadramento e legendas em tempo real.</p>
            </div>
          ) : (
            <div>
              <div className="mb-6 flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-[.16em] text-white/35">Projeto</div>
                  <div className="mt-1 font-mono text-xs text-white/60">{project.id}</div>
                </div>
                <span className={"rounded-full px-3 py-1 text-xs " + (project.status === "COMPLETED" ? "bg-[var(--acid)]/10 text-[var(--acid)]" : project.status === "FAILED" ? "bg-red-500/10 text-red-300" : "bg-cyan-400/10 text-cyan-300")}>{project.status}</span>
              </div>

              <div className="mb-2 flex justify-between text-sm"><span>{stageLabels[project.stage] ?? project.stage}</span><span className="font-mono text-white/45">{project.progress}%</span></div>
              <div className="mb-7 h-2 overflow-hidden rounded-full bg-white/5"><div className="h-full bg-gradient-to-r from-[var(--acid)] to-cyan-300 transition-all duration-500" style={{ width: project.progress + "%" }} /></div>

              {project.status === "FAILED" && (
                <div className="mb-6 rounded-2xl border border-red-400/20 bg-red-500/10 p-4">
                  <strong className="text-red-200">Processamento falhou</strong>
                  <p className="mt-2 text-sm leading-6 text-red-100/70">{project.error || "Erro desconhecido."}</p>
                  <button onClick={retry} disabled={busy} className="mt-3 rounded-lg bg-white px-3 py-2 text-xs font-bold text-black">Tentar novamente</button>
                </div>
              )}

              {project.clips.length > 0 ? (
                <div className="space-y-4">
                  {project.clips.map((clip) => (
                    <article key={clip.id} className="rounded-2xl border border-white/10 bg-white/[.025] p-4">
                      <div className="grid gap-4 md:grid-cols-[190px_1fr]">
                        <div className="aspect-[9/16] max-h-80 overflow-hidden rounded-xl bg-black">
                          {clip.downloadUrl ? <video className="h-full w-full object-cover" controls preload="metadata" src={clip.downloadUrl} /> : null}
                        </div>
                        <div className="min-w-0">
                          <div className="mb-3 flex items-center gap-2">
                            <span className="rounded-full bg-[var(--acid)]/10 px-2 py-1 text-xs font-bold text-[var(--acid)]">{clip.viralScore}/100</span>
                            <span className="text-xs text-white/35">{Math.round(clip.endSec - clip.startSec)}s</span>
                          </div>
                          <input
                            defaultValue={clip.title}
                            onBlur={async (e) => {
                              try { await updateTitle(clip.id, e.target.value) }
                              catch (error) { setMessage(error instanceof Error ? error.message : "Falha ao editar título.") }
                            }}
                            className="w-full border-b border-transparent bg-transparent pb-2 text-lg font-bold outline-none focus:border-white/15"
                          />
                          <p className="mt-3 text-sm leading-6 text-white/45">{clip.reason}</p>
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {(Array.isArray(clip.hashtags) ? clip.hashtags : []).map((tag) => <span key={tag} className="text-xs text-cyan-300/70">{tag}</span>)}
                          </div>
                          {clip.downloadUrl && (
                            <a className="mt-5 inline-flex rounded-lg bg-white px-3 py-2 text-xs font-bold text-black" href={clip.downloadUrl}>Baixar MP4</a>
                          )}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : project.status !== "FAILED" ? (
                <div className="rounded-2xl border border-white/10 bg-white/[.02] p-8 text-center text-sm text-white/35">Processamento em andamento. Os clipes aparecerão aqui quando forem renderizados.</div>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
