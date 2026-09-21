import fs from "node:fs/promises"
import path from "node:path"

export const DATA_DIR = process.env.DATA_DIR ?? "/data"

export function projectDir(projectId: string) {
  return path.join(DATA_DIR, "projects", projectId)
}

export async function ensureProjectDir(projectId: string) {
  const dir = projectDir(projectId)
  await fs.mkdir(dir, { recursive: true })
  return dir
}

export function safeName(name: string) {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180)
  return cleaned || "video.mp4"
}

export async function writeUpload(projectId: string, file: File) {
  const dir = await ensureProjectDir(projectId)
  const filename = safeName(file.name)
  const fullPath = path.join(dir, filename)
  const buffer = Buffer.from(await file.arrayBuffer())
  await fs.writeFile(fullPath, buffer)
  return fullPath
}
