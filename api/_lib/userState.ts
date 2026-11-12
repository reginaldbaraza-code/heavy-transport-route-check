import { Redis } from '@upstash/redis'
import { isAppUserId } from './users.js'
import { isStateFieldKey, type StateFieldKey } from './storageKeys.js'

export type StateBackend = 'redis' | 'memory'

type UserHash = Record<string, string>

const memoryStore = new Map<string, UserHash>()
let redisClient: Redis | null | undefined
let memoryWarningLogged = false

function redisKey(userId: string) {
  return `htr:user:${userId}`
}

function readRedisEnv() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  return { url, token }
}

export function resolveBackend(): StateBackend {
  return readRedisEnv() ? 'redis' : 'memory'
}

function getRedis(): Redis | null {
  if (redisClient !== undefined) return redisClient
  const env = readRedisEnv()
  if (!env) {
    redisClient = null
    if (!memoryWarningLogged) {
      memoryWarningLogged = true
      console.warn('[api/state] No Redis env (KV_REST_API_* / UPSTASH_REDIS_REST_*); using in-memory store.')
    }
    return null
  }
  redisClient = new Redis({ url: env.url, token: env.token })
  return redisClient
}

/** Test helper — reset module singletons between unit tests. */
export function resetUserStateForTests() {
  memoryStore.clear()
  redisClient = undefined
  memoryWarningLogged = false
}

export function validateUserId(user: unknown): string | null {
  return isAppUserId(user) ? user : null
}

export function validateStateKey(key: unknown): StateFieldKey | null {
  return isStateFieldKey(key) ? key : null
}

export async function readUserState(userId: string): Promise<{ data: UserHash; backend: StateBackend }> {
  const redis = getRedis()
  if (!redis) {
    const data = { ...(memoryStore.get(userId) || {}) }
    return { data, backend: 'memory' }
  }
  const raw = await redis.hgetall<UserHash>(redisKey(userId))
  const data: UserHash = {}
  if (raw && typeof raw === 'object') {
    for (const [field, value] of Object.entries(raw)) {
      if (typeof value === 'string') data[field] = value
      else if (value != null) data[field] = typeof value === 'string' ? value : JSON.stringify(value)
    }
  }
  return { data, backend: 'redis' }
}

export async function writeUserStateField(
  userId: string,
  key: StateFieldKey,
  value: unknown,
): Promise<{ backend: StateBackend; updatedAt: string }> {
  // Always JSON.stringify so string scalars (e.g. sample mode) round-trip via JSON.parse.
  const serialized = JSON.stringify(value)
  const updatedAt = new Date().toISOString()
  const redis = getRedis()
  if (!redis) {
    const current = memoryStore.get(userId) || {}
    current[key] = serialized
    memoryStore.set(userId, current)
    return { backend: 'memory', updatedAt }
  }
  await redis.hset(redisKey(userId), { [key]: serialized })
  return { backend: 'redis', updatedAt }
}
