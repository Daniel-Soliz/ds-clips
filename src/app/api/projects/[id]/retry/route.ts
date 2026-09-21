import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { enqueueProject } from "@/lib/queue"

export const runtime = "nodejs"

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const project = await db.project.findUnique({ where: { id } })
  if (!project) return NextResponse.json({ error: "Projeto não encontrado." }, { status: 404 })

  await db.project.update({
    where: { id },
    data: { status: "QUEUED", stage: "queued", progress: 1, error: null },
  })
  await enqueueProject(id)
  return NextResponse.json({ ok: true })
}
