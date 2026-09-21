import { db } from "@/lib/db"
import { newRedis } from "@/lib/redis"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  const encoder = new TextEncoder()
  const subscriber = newRedis()
  const channel = `project:${id}`

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
      }

      const project = await db.project.findUnique({ where: { id } })
      if (!project) {
        send({ status: "FAILED", stage: "missing", progress: 0, error: "Projeto não encontrado." })
        controller.close()
        await subscriber.quit()
        return
      }

      send({
        projectId: id,
        status: project.status,
        stage: project.stage,
        progress: project.progress,
        error: project.error,
      })

      await subscriber.subscribe(channel)
      subscriber.on("message", (_channel, message) => {
        try { send(JSON.parse(message)) } catch { send({ message }) }
      })

      request.signal.addEventListener("abort", async () => {
        try { await subscriber.unsubscribe(channel) } catch {}
        try { await subscriber.quit() } catch {}
        try { controller.close() } catch {}
      })
    },
    async cancel() {
      try { await subscriber.unsubscribe(channel) } catch {}
      try { await subscriber.quit() } catch {}
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
    },
  })
}
