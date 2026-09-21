import { NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { enqueueProject } from "@/lib/queue"
import { CaptionStyleSchema } from "@/lib/schemas"

export const runtime = "nodejs"

const BodySchema = z.object({
  url: z.string().url(),
  captionStyle: CaptionStyleSchema.default("neon"),
})

export async function POST(request: Request) {
  try {
    const body = BodySchema.parse(await request.json())
    const url = new URL(body.url)
    if (!["http:", "https:"].includes(url.protocol)) {
      return NextResponse.json({ error: "URL inválida." }, { status: 400 })
    }

    const project = await db.project.create({
      data: {
        inputType: "URL",
        sourceUrl: body.url,
        captionStyle: body.captionStyle,
        stage: "queued",
        progress: 1,
      },
    })
    await enqueueProject(project.id)
    return NextResponse.json({ projectId: project.id })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao importar link."
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
