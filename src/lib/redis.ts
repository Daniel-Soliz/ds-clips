import IORedis from "ioredis"

export const redis = new IORedis(process.env.REDIS_URL ?? "redis://redis:6379", {
  maxRetriesPerRequest: null,
})

export function newRedis() {
  return new IORedis(process.env.REDIS_URL ?? "redis://redis:6379", {
    maxRetriesPerRequest: null,
  })
}
