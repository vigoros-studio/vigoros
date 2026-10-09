import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import {
  EpisodeScript,
  type BunniJobInput,
  type BunniJobOutput,
  type ShotPrompt,
} from '@vigoros/contracts'
import { ACCESSORIES, EXPRESSIONS, OUTFITS, readAnchor } from '../canon'
import type { PathGuard } from '../guard'
import { PRICING } from '../pricing'

const nextEpisodeNumber = (guard: PathGuard): number => {
  if (!existsSync(guard.episodesDir)) return 1
  const nums = readdirSync(guard.episodesDir)
    .map((n) => /^EP(\d{3})-/.exec(n)?.[1])
    .filter((n): n is string => Boolean(n))
    .map(Number)
  return nums.length ? Math.max(...nums) + 1 : 1
}

const write = (guard: PathGuard, episode: string, rel: string, content: string): string => {
  const abs = guard.writePath(episode, rel)
  mkdirSync(path.dirname(abs), { recursive: true })
  writeFileSync(abs, content, 'utf8')
  return path.relative(guard.root, abs)
}

/** Creates the next EPnnn-slug directory with the brief and the script. Never touches an existing episode. */
export const episodeCreate = (
  guard: PathGuard,
  input: BunniJobInput<'episode.create'>,
): BunniJobOutput<'episode.create'> => {
  const script = EpisodeScript.parse(input.script)
  const episode = `EP${String(nextEpisodeNumber(guard)).padStart(3, '0')}-${input.slug}`
  const dir = guard.writePath(episode, '.')
  if (existsSync(dir)) throw new Error(`episode ${episode} already exists`)
  const files = [
    write(guard, episode, 'brief.md', `# ${script.title}\n\n${input.brief}\n`),
    write(guard, episode, 'script.json', JSON.stringify(script, null, 2)),
    write(
      guard,
      episode,
      'script.md',
      [
        `# ${script.title}`,
        '',
        `**Hook:** ${script.hook}`,
        `**Logline:** ${script.logline}`,
        `**Outfit:** ${script.outfit}  **Accessory:** ${script.accessory}  **Setting:** ${script.setting}`,
        '',
        ...script.beats.map(
          (b) => `${b.beat}. [${b.expression}] ${b.action}${b.line ? `\n   > "${b.line}"` : ''}`,
        ),
        '',
        `**Caption:** ${script.caption}`,
        `**Hashtags:** ${script.hashtags.join(' ')}`,
        '',
      ].join('\n'),
    ),
  ]
  for (const sub of ['prompts', 'keyframes', 'renders', 'qc'])
    mkdirSync(guard.writePath(episode, sub), { recursive: true })
  return { episode, dir: path.relative(guard.root, dir), files }
}

/**
 * Turns the script into per-shot prompts that obey the anchor's rules mechanically:
 * anchor block first and verbatim, master front and 3/4 always, at most one variation reference,
 * never angles/side.png. Agents never get to reinterpret these rules.
 */
export const episodePackage = (
  guard: PathGuard,
  input: BunniJobInput<'episode.package'>,
): BunniJobOutput<'episode.package'> => {
  const scriptPath = guard.readPath(
    path.join('production', 'episodes', input.episode, 'script.json'),
  )
  if (!existsSync(scriptPath)) throw new Error(`episode ${input.episode} has no script.json`)
  const script = EpisodeScript.parse(JSON.parse(readFileSync(scriptPath, 'utf8')))
  const { anchor, never } = readAnchor(guard)
  const exists = (rel: string) => existsSync(guard.readPath(rel))
  if (!exists('master/front.png') || !exists('master/3-4.png'))
    throw new Error('master references missing')

  const variation = (b: (typeof script.beats)[number]): ShotPrompt['references'][number] | null => {
    const candidates = [
      script.outfit !== 'default' ? `outfits/${script.outfit}.png` : null,
      b.expression !== 'neutral' ? `expressions/${b.expression}.png` : null,
      script.accessory !== 'none' ? `accessories/${script.accessory}.png` : null,
    ].filter((c): c is string => Boolean(c) && exists(String(c)))
    const first = candidates[0]
    return first ? { path: first, role: 'variation' } : null
  }

  const shots: ShotPrompt[] = script.beats.map((b) => {
    const parts = [
      anchor,
      '',
      `Scene: ${script.setting}.`,
      `Outfit: ${OUTFITS[script.outfit] ?? script.outfit}.`,
      ACCESSORIES[script.accessory]
        ? `Accessory: ${ACCESSORIES[script.accessory]}.`
        : 'No extra accessories.',
      `Expression: ${EXPRESSIONS[b.expression] ?? b.expression}.`,
      `Action: ${b.action}`,
      b.line ? `She says: "${b.line}"` : 'She says nothing.',
      '',
      `Never: ${never}`,
    ]
    const refs: ShotPrompt['references'] = [
      { path: 'master/front.png', role: 'master_front' },
      { path: 'master/3-4.png', role: 'master_34' },
    ]
    const v = variation(b)
    if (v) refs.push(v)
    return { shot: b.beat, prompt: parts.join('\n'), references: refs, durationSec: 4 }
  })
  for (const s of shots) {
    if (!s.prompt.startsWith(anchor)) throw new Error('prompt does not start with the anchor')
    if (s.references.some((r) => r.path === 'angles/side.png'))
      throw new Error('side.png used as reference')
    if (s.references.length > 3) throw new Error('too many references')
  }

  const files = shots.map((s) =>
    write(
      guard,
      input.episode,
      `prompts/shot-${String(s.shot).padStart(2, '0')}.md`,
      `# Shot ${s.shot}\n\nReferences: ${s.references.map((r) => `${r.path} (${r.role})`).join(', ')}\nDuration: ${s.durationSec}s\n\n${s.prompt}\n`,
    ),
  )
  files.push(write(guard, input.episode, 'prompts/shots.json', JSON.stringify(shots, null, 2)))

  const videoSeconds = shots.reduce((a, s) => a + (s.durationSec ?? 4), 0)
  const credits =
    shots.length * PRICING.keyframeCredits + videoSeconds * PRICING.videoCreditsPerSecond
  return {
    episode: input.episode,
    shots,
    files,
    estimate: {
      keyframes: shots.length,
      videoSeconds,
      credits,
      usd: Math.round(credits * PRICING.usdPerCredit * 100) / 100,
      basis: PRICING.basis,
    },
  }
}
