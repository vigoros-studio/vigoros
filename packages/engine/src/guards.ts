import { createHash } from 'node:crypto'

/** A task whose last N outputs hash alike is looping and gets blocked. */
export const fingerprint = (output: unknown): string =>
  createHash('sha256').update(JSON.stringify(output)).digest('hex').slice(0, 16)

export const isLooping = (recentFingerprints: readonly string[], window = 3): boolean => {
  if (recentFingerprints.length < window) return false
  const tail = recentFingerprints.slice(-window)
  return tail.every((f) => f === tail[0])
}

/** Pauses a department after `threshold` failures inside `windowMs`. Pure: feed it timestamps. */
export const breakerOpen = (
  failureTimestamps: readonly number[],
  now: number,
  threshold = 5,
  windowMs = 15 * 60_000,
): boolean => failureTimestamps.filter((t) => now - t <= windowMs).length >= threshold

export interface RoleLimits {
  maxTurnsPerTask: number
  maxChildTasks: number
}

export type LimitVerdict = { ok: true } | { ok: false; reason: 'max_turns' | 'max_children' }

export const checkLimits = (
  limits: RoleLimits,
  turnsSoFar: number,
  childrenSoFar: number,
): LimitVerdict => {
  if (turnsSoFar >= limits.maxTurnsPerTask) return { ok: false, reason: 'max_turns' }
  if (childrenSoFar > limits.maxChildTasks) return { ok: false, reason: 'max_children' }
  return { ok: true }
}
