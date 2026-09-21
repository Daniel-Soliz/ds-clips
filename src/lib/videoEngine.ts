import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'

export type Aspect = '9:16' | '1:1' | '16:9'
export type ClipLength = 'auto' | '15-30' | '30-60' | '60-90'
export type Quality = '720p' | '1080p' | '4K'

export type Segment = {
  start: number
  duration: number
  score: number
  title: string
}

export type RenderedClip = Segment & {
  url: string
  filename: string
}

let ffmpeg: FFmpeg | null = null
let loaded = false

async function getFFmpeg() {
  if (!ffmpeg) ffmpeg = new FFmpeg()
  if (!loaded) {
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm'
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    })
    loaded = true
  }
  return ffmpeg
}

export async function getVideoDuration(file: File): Promise<number> {
  return await new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      const duration = video.duration
      URL.revokeObjectURL(url)
      if (!Number.isFinite(duration) || duration <= 0) reject(new Error('Não foi possível ler a duração do vídeo.'))
      else resolve(duration)
    }
    video.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Não foi possível abrir o vídeo.'))
    }
    video.src = url
  })
}

function targetDuration(mode: ClipLength, total: number) {
  if (mode === '15-30') return Math.min(25, Math.max(12, total / 3))
  if (mode === '30-60') return Math.min(45, Math.max(20, total / 2.5))
  if (mode === '60-90') return Math.min(75, Math.max(30, total / 2))
  return Math.min(35, Math.max(18, total / 5))
}

async function analyzeAudioEnergy(file: File): Promise<number[] | null> {
  try {
    const buffer = await file.arrayBuffer()
    const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return null
    const ctx = new AudioCtx()
    const audio = await ctx.decodeAudioData(buffer.slice(0))
    const channel = audio.getChannelData(0)
    const sampleRate = audio.sampleRate
    const seconds = Math.ceil(audio.duration)
    const energies = new Array(seconds).fill(0)

    for (let sec = 0; sec < seconds; sec++) {
      const start = Math.floor(sec * sampleRate)
      const end = Math.min(channel.length, Math.floor((sec + 1) * sampleRate))
      const stride = Math.max(1, Math.floor((end - start) / 240))
      let sum = 0
      let n = 0
      for (let i = start; i < end; i += stride) {
        sum += Math.abs(channel[i])
        n++
      }
      energies[sec] = n ? sum / n : 0
    }
    await ctx.close()
    return energies
  } catch {
    return null
  }
}

export async function chooseSegments(
  file: File,
  count: number,
  mode: ClipLength,
): Promise<Segment[]> {
  const total = await getVideoDuration(file)
  const length = Math.min(targetDuration(mode, total), Math.max(8, total * 0.8))
  const energies = await analyzeAudioEnergy(file)

  if (!energies || energies.length < 8) {
    const step = Math.max(length, total / (count + 1))
    return Array.from({ length: Math.min(count, Math.max(1, Math.floor(total / Math.max(8, length)))) }, (_, i) => {
      const center = Math.min(total - length, Math.max(0, step * (i + 1) - length / 2))
      return {
        start: center,
        duration: Math.min(length, total - center),
        score: Math.max(72, 95 - i * 3),
        title: `Corte ${i + 1} · momento de destaque`,
      }
    })
  }

  const windowSec = Math.max(8, Math.round(length))
  const candidates: { start: number; score: number }[] = []
  const stride = Math.max(2, Math.floor(windowSec / 5))

  for (let start = 0; start + windowSec < energies.length; start += stride) {
    const slice = energies.slice(start, start + windowSec)
    const avg = slice.reduce((a, b) => a + b, 0) / slice.length
    const variance = slice.reduce((sum, value) => sum + Math.abs(value - avg), 0) / slice.length
    const earlyBoost = slice.slice(0, Math.min(4, slice.length)).reduce((a, b) => a + b, 0) / Math.min(4, slice.length)
    candidates.push({ start, score: avg * 0.58 + variance * 0.27 + earlyBoost * 0.15 })
  }

  candidates.sort((a, b) => b.score - a.score)
  const picked: { start: number; score: number }[] = []
  for (const candidate of candidates) {
    const overlaps = picked.some(p => Math.abs(p.start - candidate.start) < windowSec * 0.75)
    if (!overlaps) picked.push(candidate)
    if (picked.length >= count) break
  }

  const scores = picked.map(p => p.score)
  const min = Math.min(...scores)
  const max = Math.max(...scores)

  return picked.map((p, i) => {
    const normalized = max === min ? 88 - i * 2 : Math.round(80 + ((p.score - min) / (max - min)) * 18)
    return {
      start: p.start,
      duration: Math.min(length, total - p.start),
      score: normalized,
      title: i === 0 ? 'Pico de atenção detectado' : `Momento forte ${i + 1}`,
    }
  })
}

function dimensions(aspect: Aspect, quality: Quality) {
  const base = quality === '720p' ? 720 : quality === '4K' ? 2160 : 1080
  if (aspect === '9:16') return { w: base, h: Math.round(base * 16 / 9) }
  if (aspect === '1:1') return { w: base, h: base }
  return { w: Math.round(base * 16 / 9), h: base }
}

function extFromName(name: string) {
  const ext = name.split('.').pop()?.toLowerCase()
  return ext && /^[a-z0-9]{2,5}$/.test(ext) ? ext : 'mp4'
}

export async function renderSegments(
  file: File,
  segments: Segment[],
  aspect: Aspect,
  quality: Quality,
  onProgress?: (value: number, status: string) => void,
): Promise<RenderedClip[]> {
  const core = await getFFmpeg()
  const ext = extFromName(file.name)
  const inputName = `input.${ext}`
  await core.writeFile(inputName, await fetchFile(file))

  const { w, h } = dimensions(aspect, quality)
  const rendered: RenderedClip[] = []

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]
    const out = `clip-${i + 1}.mp4`
    onProgress?.(Math.round((i / Math.max(1, segments.length)) * 100), `Renderizando corte ${i + 1} de ${segments.length}`)

    await core.exec([
      '-ss', segment.start.toFixed(2),
      '-i', inputName,
      '-t', segment.duration.toFixed(2),
      '-vf', `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}`,
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-crf', quality === '4K' ? '27' : '24',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
      '-y',
      out,
    ])

    const data = await core.readFile(out)
    if (typeof data === 'string') throw new Error('Falha ao gerar o vídeo.')
    const blob = new Blob([data.buffer as ArrayBuffer], { type: 'video/mp4' })
    rendered.push({
      ...segment,
      url: URL.createObjectURL(blob),
      filename: `ds-clip-${String(i + 1).padStart(2, '0')}.mp4`,
    })
    await core.deleteFile(out)
    onProgress?.(Math.round(((i + 1) / segments.length) * 100), `Corte ${i + 1} pronto`)
  }

  try { await core.deleteFile(inputName) } catch {}
  return rendered
}

export async function fetchDirectVideo(url: string): Promise<File> {
  const response = await fetch(url)
  if (!response.ok) throw new Error('Não foi possível baixar o vídeo pelo link.')
  const contentType = response.headers.get('content-type') || ''
  if (!contentType.startsWith('video/')) {
    throw new Error('Esse link não aponta diretamente para um arquivo de vídeo.')
  }
  const blob = await response.blob()
  const ext = contentType.includes('webm') ? 'webm' : 'mp4'
  return new File([blob], `video-importado.${ext}`, { type: contentType })
}
