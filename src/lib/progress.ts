import { db } from "./db"
import { redis } from "./redis"

export type ProjectEvent = {
  projectId: string
  status: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED"
  stage: string
  progress: number
  error?: string | null
  message?: string
}

export async function updateProgress(
  projectId: string,
  input: Omit<ProjectEvent, "projectId">,
) {
  const project = await db.project.update({
    where: { id: projectId },
    data: {
      status: input.status,
      stage: input.stage,
      progress: Math.max(0, Math.min(100, input.progress)),
      error: input.error ?? null,
    },
  })

  const event: ProjectEvent = {
    projectId,
    status: project.status,
    stage: project.stage,
    progress: project.progress,
    error: project.error,
    message: input.message,
  }
  await redis.publish(`project:${projectId}`, JSON.stringify(event))
  return project
}
