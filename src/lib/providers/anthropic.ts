import Anthropic from "@anthropic-ai/sdk"
import { ViralMomentsSchema, type ViralMoment } from "../schemas"
import type { MomentRankingProvider, RankingInput } from "./llm"

function cleanJson(text: string) {
  return text.trim().replace(/^\x60\x60\x60(?:json)?/i, "").replace(/\x60\x60\x60$/, "").trim()
}

export class AnthropicMomentRankingProvider implements MomentRankingProvider {
  private client: Anthropic
  private model: string

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY não configurada.")
    this.client = new Anthropic({ apiKey })
    this.model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5"
  }

  async rank(input: RankingInput): Promise<ViralMoment[]> {
    const basePrompt =
      "<transcricao>\n" + input.transcriptText + "\n</transcricao>\n\n" +
      "Selecione até " + input.maxClips + " trechos que funcionem como clipes curtos fortes para redes sociais.\n" +
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

    let lastError: unknown = null
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await this.client.messages.create({
          model: this.model,
          max_tokens: 5000,
          system: "Você é um editor profissional de vídeo curto. Seja rigoroso com timestamps e JSON.",
          messages: [{
            role: "user",
            content: attempt === 1
              ? basePrompt
              : basePrompt + "\n\nA tentativa anterior retornou JSON inválido. Corrija estritamente o formato.",
          }],
        })
        const block = response.content.find((item) => item.type === "text")
        if (!block || block.type !== "text") throw new Error("O provedor não retornou texto.")
        return ViralMomentsSchema.parse(JSON.parse(cleanJson(block.text)))
      } catch (error) {
        lastError = error
      }
    }
    throw lastError instanceof Error ? lastError : new Error("Falha ao obter ranking válido.")
  }
}
