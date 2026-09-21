import type { ViralMoment } from "../schemas"
import type { MomentRankingProvider, RankingInput } from "./llm"

const hookTerms = [
  "como", "por que", "segredo", "erro", "melhor", "nunca", "ninguém",
  "atenção", "importante", "verdade", "problema", "resultado", "dica",
  "dinheiro", "aprendi", "descobri", "funciona", "evite", "pare"
]

function tokenize(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9áàâãéêíóôõúç\s]/gi, " ").split(/\s+/).filter(Boolean)
}

function scoreText(text: string, duration: number) {
  const words = tokenize(text)
  const unique = new Set(words)
  const hookHits = words.filter((w) => hookTerms.includes(w)).length
  const question = /\?/.test(text) ? 1 : 0
  const exclamation = /!/.test(text) ? 1 : 0
  const density = Math.min(1, words.length / Math.max(1, duration * 2.2))
  const diversity = words.length ? unique.size / words.length : 0
  const idealDuration = 1 - Math.min(1, Math.abs(duration - 42) / 42)

  const raw =
    45 +
    Math.min(18, hookHits * 4) +
    question * 6 +
    exclamation * 3 +
    density * 10 +
    diversity * 10 +
    idealDuration * 8

  return Math.max(0, Math.min(100, Math.round(raw)))
}

function titleFrom(text: string) {
  const clean = text.replace(/\s+/g, " ").trim()
  if (!clean) return "Momento selecionado"
  return clean.length <= 82 ? clean : clean.slice(0, 79).trimEnd() + "..."
}

function hashtags(text: string) {
  const words = tokenize(text)
  const counts = new Map<string, number>()
  for (const word of words) {
    if (word.length < 5) continue
    counts.set(word, (counts.get(word) ?? 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => "#" + word.replace(/[^a-z0-9áàâãéêíóôõúç]/gi, ""))
}

export class LocalMomentRankingProvider implements MomentRankingProvider {
  async rank(input: RankingInput): Promise<ViralMoment[]> {
    const lines = input.transcriptText.split("\n").map((line) => line.trim()).filter(Boolean)
    const segments = lines.map((line) => {
      const match = line.match(/^\[(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)\]\s*(.*)$/)
      if (!match) return null
      return { start: Number(match[1]), end: Number(match[2]), text: match[3] }
    }).filter((v): v is { start: number; end: number; text: string } => Boolean(v))

    const candidates: ViralMoment[] = []
    for (let i = 0; i < segments.length; i++) {
      let text = ""
      const start = segments[i].start
      let end = segments[i].end

      for (let j = i; j < segments.length; j++) {
        const seg = segments[j]
        end = seg.end
        text += (text ? " " : "") + seg.text
        const duration = end - start

        if (duration >= 20 && duration <= 90) {
          candidates.push({
            start,
            end,
            title: titleFrom(text),
            viralScore: scoreText(text, duration),
            reason: "Score heurístico calculado a partir de duração, densidade de fala, diversidade lexical, presença de gancho/pergunta e sinais de ênfase. Não é previsão de viralização.",
            hashtags: hashtags(text),
          })
        }
        if (duration > 90) break
      }
    }

    const sorted = candidates.sort((a, b) => b.viralScore - a.viralScore)
    const selected: ViralMoment[] = []
    for (const candidate of sorted) {
      const overlaps = selected.some((s) => !(candidate.end <= s.start || candidate.start >= s.end))
      if (!overlaps) selected.push(candidate)
      if (selected.length >= input.maxClips) break
    }
    if (!selected.length) throw new Error("Transcrição curta demais para formar clipes de 20 a 90 segundos.")
    return selected
  }
}
