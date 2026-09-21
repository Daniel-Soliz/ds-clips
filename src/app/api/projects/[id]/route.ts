import { NextResponse } from "next/server"
import { db } from "@/lib/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const project = await db.project.findUnique({
    where: { id },
    include: { clips: { orderBy: { viralScore: "desc" } } },
  })
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 })

  return NextResponse.json({
    ...project,
    clips: project.clips.map((clip) => ({
      ...clip,
      downloadUrl: clip.outputPath ? `/api/clips/${clip.id}/file` : null,
    })),
  })
}
