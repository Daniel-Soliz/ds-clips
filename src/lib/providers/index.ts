import type { MomentRankingProvider } from "./llm"
import { AnthropicMomentRankingProvider } from "./anthropic"
import { LocalMomentRankingProvider } from "./local"

export function getMomentRankingProvider(): MomentRankingProvider {
  const provider = (process.env.LLM_PROVIDER ?? "local").toLowerCase()
  if (provider === "local") return new LocalMomentRankingProvider()
  if (provider === "anthropic") return new AnthropicMomentRankingProvider()
  throw new Error("LLM_PROVIDER não suportado: " + provider)
}
