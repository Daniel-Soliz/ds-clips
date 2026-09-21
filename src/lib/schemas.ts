import { z } from "zod"

export const captionStyles = ["neon", "clean", "pop", "cinema", "minimal"] as const
export const CaptionStyleSchema = z.enum(captionStyles)

export const ViralMomentSchema = z.object({
  start: z.number().nonnegative(),
  end: z.number().positive(),
  title: z.string().min(3).max(120),
  viralScore: z.number().int().min(0).max(100),
  reason: z.string().min(3).max(500),
  hashtags: z.array(z.string().min(1).max(80)).max(12),
})

export const ViralMomentsSchema = z.array(ViralMomentSchema).min(1)

export type ViralMoment = z.infer<typeof ViralMomentSchema>
