import type { ViralMoment } from "../schemas"

export type RankingInput = {
  transcriptText: string
  maxClips: number
}

export interface MomentRankingProvider {
  rank(input: RankingInput): Promise<ViralMoment[]>
}
