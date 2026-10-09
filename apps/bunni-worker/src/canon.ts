import { existsSync, readFileSync } from 'node:fs'
import type { PathGuard } from './guard'

/**
 * Bunni's manifest is the contract: canon version, authoritative documents, reference packs.
 * The anchor text is Bunni's; callers send scene text only (interface README, rule 7).
 */
export interface BunniManifest {
  canon_version: string
  canon_date?: string
  authoritative_documents?: Record<string, unknown>
}

export const readManifest = (guard: PathGuard): BunniManifest => {
  const p = guard.readPath('production/interface/bunni.manifest.json')
  if (!existsSync(p))
    throw new Error(
      'production/interface/bunni.manifest.json is missing; the Bunni interface is not installed in this root',
    )
  const m = JSON.parse(readFileSync(p, 'utf8')) as BunniManifest
  if (!m.canon_version) throw new Error('manifest has no canon_version')
  return m
}

/** Vigoros script vocabulary to Bunni job-schema vocabulary. */
export const ACCESSORY_TO_JOB: Record<string, string> = {
  none: 'none',
  sunglasses: 'sunglasses',
  'sunglasses-on-head': 'sunglasses-on-head',
  phone: 'phone',
  'pink-baseball-cap': 'cap',
  'oversized-headphones': 'headphones',
  handbag: 'handbag',
  facemask: 'sleep-mask',
}

export const EXPRESSION_TO_JOB: Record<string, string> = {
  neutral: 'default',
  'happy-ish': 'happy-ish',
  unhinged: 'unhinged',
  sassy: 'sassy',
  tired: 'tired',
  judging: 'judging',
  angry: 'angry',
  excited: 'excited',
  sad: 'sad',
  confused: 'confused',
}

/** Verified credit estimates from production/templates/build_prompts.py (higgsfield generate cost, 2026-10-09, 9:16). */
export const CREDITS = { keyframe: 2.0, clipMini: 5.0, plate: 0.12 } as const
export const CREDITS_BASIS =
  'verified estimates from `higgsfield generate cost` on 2026-10-09 (nano_banana_pro keyframe 2.0, seedance_2_0_mini clip 5.0), per production/templates/build_prompts.py; no call made'
