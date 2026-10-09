import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { PathGuard } from '../guard'
import { runJob } from './index'

/**
 * A fixture shaped like /bunni: the anchor file is copied from the real folder when present
 * (read-only), otherwise a minimal stand-in is written. Nothing here touches the real folder.
 */
const REAL = process.env['BUNNI_ROOT'] ?? path.join(process.env['HOME'] ?? '', 'Desktop', 'bunni')

const fixture = () => {
  const root = mkdtempSync(path.join(tmpdir(), 'bunni-fixture-'))
  for (const d of [
    'master',
    'character',
    'outfits',
    'expressions',
    'accessories',
    'angles',
    'production/episodes',
  ])
    mkdirSync(path.join(root, d), { recursive: true })
  for (const f of [
    'master/front.png',
    'master/3-4.png',
    'outfits/tiny-ceo.png',
    'expressions/judging.png',
    'angles/side.png',
  ])
    writeFileSync(path.join(root, f), 'png')
  const realAnchor = path.join(REAL, 'character', 'bunni-anchor.md')
  if (existsSync(realAnchor)) cpSync(realAnchor, path.join(root, 'character', 'bunni-anchor.md'))
  else
    writeFileSync(
      path.join(root, 'character', 'bunni-anchor.md'),
      '# Bunni — Prompt Anchor\nPaste the block below verbatim.\n\nBunni, the same canonical anthropomorphic bunny character: test anchor.\n\n## Never\nwhiskers, human hair.\n\n## Reference order\n1. master/front.png\n',
    )
  return root
}

const policy = { paidJobsEnabled: false }

const script = {
  title: 'Board meeting about a nugget',
  hook: 'One nugget is missing.',
  logline: 'Bunni convenes an emergency meeting about a missing nugget.',
  outfit: 'tiny-ceo',
  accessory: 'none',
  setting: 'A real kitchen table at night',
  beats: [
    { beat: 1, action: 'Bunni stares at an open nugget box.', line: null, expression: 'judging' },
    {
      beat: 2,
      action: 'She slides a notepad across the table.',
      line: 'We need to talk.',
      expression: 'neutral',
    },
  ],
  caption: 'This feels targeted.',
  hashtags: ['#bunni'],
}

describe('episode jobs', () => {
  it('creates the next episode, packages prompts that obey the anchor rules, and never touches references', () => {
    const root = fixture()
    const guard = new PathGuard(root)
    const before = readFileSync(path.join(root, 'master', 'front.png'))
    const created = runJob(guard, policy, {
      job: 'episode.create',
      taskId: 't',
      runId: null,
      requestedBy: 'x',
      input: { slug: 'nugget-meeting', brief: 'A brief.', script },
    })
    expect(created.status).toBe('ok')
    const episode = (created as { output: { episode: string } }).output.episode
    expect(episode).toBe('EP001-nugget-meeting')

    const packaged = runJob(guard, policy, {
      job: 'episode.package',
      taskId: 't',
      runId: null,
      requestedBy: 'x',
      input: { episode },
    })
    expect(packaged.status).toBe('ok')
    const out = (
      packaged as {
        output: {
          shots: { prompt: string; references: { path: string }[] }[]
          estimate: { basis: string }
        }
      }
    ).output
    expect(out.shots).toHaveLength(2)
    for (const s of out.shots) {
      expect(s.prompt.startsWith('Bunni, the same canonical')).toBe(true)
      expect(s.references.map((r) => r.path).slice(0, 2)).toEqual([
        'master/front.png',
        'master/3-4.png',
      ])
      expect(s.references.length).toBeLessThanOrEqual(3)
      expect(s.references.some((r) => r.path === 'angles/side.png')).toBe(false)
    }
    expect(out.shots[0]?.references[2]?.path).toBe('outfits/tiny-ceo.png')
    expect(out.estimate.basis).toContain('unverified')
    expect(readdirSync(path.join(root, 'production', 'episodes', episode, 'prompts'))).toContain(
      'shot-01.md',
    )
    expect(readFileSync(path.join(root, 'master', 'front.png')).equals(before)).toBe(true)

    const second = runJob(guard, policy, {
      job: 'episode.create',
      taskId: 't',
      runId: null,
      requestedBy: 'x',
      input: { slug: 'again', brief: 'b', script },
    })
    expect((second as { output: { episode: string } }).output.episode).toBe('EP002-again')
  })

  it('refuses paid jobs by configuration and unknown input', () => {
    const guard = new PathGuard(fixture())
    const r = runJob(guard, policy, {
      job: 'render.keyframe',
      taskId: 't',
      runId: null,
      requestedBy: 'x',
      input: { episode: 'EP001-x', shot: 1 },
    })
    expect(r).toMatchObject({ status: 'refused', reason: 'paid_jobs_disabled' })
    const bad = runJob(guard, policy, {
      job: 'episode.create',
      taskId: 't',
      runId: null,
      requestedBy: 'x',
      input: { slug: 'BAD SLUG' },
    })
    expect(bad).toMatchObject({ status: 'refused', reason: 'invalid_input' })
  })
})
