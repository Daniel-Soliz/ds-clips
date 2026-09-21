import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { enqueueProject } from "@/lib/queue"
import { CaptionStyleSchema } from "@/lib/schemas"
import { writeUpload } from "@/lib/storage"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const form = await request.formData()
    const file = form.get("file")
    const captionStyleRaw = String(form.get("captionStyle") ?? "neon")
    const captionStyle = CaptionStyleSchema.parse(captionStyleRaw)
    const rightsAccepted = String(form.get("rightsAccepted") ?? "false") === "true"
    if (!rightsAccepted) return NextResponse.json({ error: "Confirme que você possui os direitos ou licença para usar este vídeo." }, { status: 400 })

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Arquivo de vídeo ausente." }, { status: 400 })
    }
    if (!file.type.startsWith("video/")) {
      return NextResponse.json({ error: "Formato inválido. Envie um vídeo." }, { status: 400 })
    }

    const maxBytes = Number(process.env.MAX_UPLOAD_MB ?? 500) * 1024 * 1024
    if (file.size > maxBytes) {
      return NextResponse.json({ error: "Arquivo acima do limite permitido." }, { status: 413 })
    }

    const project = await db.project.create({
      data: {
        inputType: "UPLOAD",
        originalName: file.name,
        captionStyle,
        rightsAcceptedAt: new Date(),
        stage: "uploading",
        progress: 0,
      },
    })

    const originalPath = await writeUpload(project.id, file)
    await db.project.update({
      where: { id: project.id },
      data: { originalPath, stage: "queued", progress: 1 },
    })

    await enqueueProject(project.id)
    return NextResponse.json({ projectId: project.id })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha no upload."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
