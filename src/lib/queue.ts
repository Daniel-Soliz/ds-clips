import { Queue } from "bullmq"
import { redis } from "./redis"

export const PROCESS_QUEUE = "dsclips-processing"
export const processQueue = new Queue(PROCESS_QUEUE, { connection: redis })

export async function enqueueProject(projectId: string) {
  return processQueue.add(
    "process-project",
    { projectId },
    {
      jobId: projectId,
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: true,
      removeOnFail: true,
    },
  )
}
