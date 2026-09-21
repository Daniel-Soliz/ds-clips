import fs from "node:fs/promises"
import path from "node:path"
import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { DATA_DIR } from "@/lib/storage"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const clip = await db.clip.findUnique({ where: { id } })
  if (!clip?.outputPath) return NextResponse.json({ error: "Arquivo não encontrado." }, { status: 404 })

  const resolved = path.resolve(clip.outputPath)
  const root = path.resolve(DATA_DIR)
  if (!resolved.startsWith(root + path.sep)) {
    return NextResponse.json({ error: "Caminho inválido." }, { status: 403 })
  }

  try {
    const data = await fs.readFile(resolved)
    return new Response(data, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="ds-clip-${clip.id}.mp4"`,
        "Cache-Control": "private, max-age=3600",
      },
    })
  } catch {
    return NextResponse.json({ error: "Arquivo ausente no storage." }, { status: 404 })
  }
}
