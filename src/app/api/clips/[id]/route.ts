import { NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"

export const runtime = "nodejs"

const UpdateSchema = z.object({ title: z.string().min(1).max(120) })

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  try {
    const body = UpdateSchema.parse(await request.json())
    const clip = await db.clip.update({ where: { id }, data: { title: body.title } })
    return NextResponse.json(clip)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível atualizar."
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
