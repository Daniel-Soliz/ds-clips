import { Worker } from "bullmq"
import { PROCESS_QUEUE } from "../src/lib/queue"
import { redis } from "../src/lib/redis"
import { processProject } from "./process"

const worker = new Worker(
  PROCESS_QUEUE,
  async (job) => {
    const projectId = String(job.data.projectId)
    console.log("[worker] iniciando projeto", projectId, "tentativa", job.attemptsMade + 1)
    const result = await processProject(projectId)
    console.log("[worker] projeto concluído", projectId, result)
    return result
  },
  { connection: redis, concurrency: 1, lockDuration: 30 * 60 * 1000 },
)

worker.on("failed", (job, error) => {
  console.error("[worker] job falhou", job ? job.id : "sem-job", error)
})
worker.on("completed", (job) => {
  console.log("[worker] job concluído", job.id)
})

async function shutdown() {
  await worker.close()
  await redis.quit()
  process.exit(0)
}

process.on("SIGTERM", shutdown)
process.on("SIGINT", shutdown)

console.log("[worker] DS Clips worker online")
