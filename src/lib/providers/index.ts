import type { MomentRankingProvider } from "./llm"
import { AnthropicMomentRankingProvider } from "./anthropic"

export function getMomentRankingProvider(): MomentRankingProvider {
  const provider = (process.env.LLM_PROVIDER ?? "anthropic").toLowerCase()
  if (provider === "anthropic") return new AnthropicMomentRankingProvider()
  throw new Error("LLM_PROVIDER não suportado: " + provider)
}
