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
 * A fixture shaped like /bunni. Bunni's interface files (manifest, tools, mock runner, templates)
 * are copied read-only from the real folder when present, otherwise the contract tests are skipped.
 * Nothing here touches the real folder.
 */
const REAL =
  process.env['BUNNI_ROOT_REAL'] ?? path.join(process.env['HOME'] ?? '', 'Desktop', 'bunni')
const hasInterface = existsSync(path.join(REAL, 'production', 'interface', 'mock_run.py'))

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
    'production/jobs/inbox',
    'production/jobs/outbox',
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
  if (hasInterface) {
    cpSync(path.join(REAL, 'production', 'interface'), path.join(root, 'production', 'interface'), {
      recursive: true,
    })
    cpSync(path.join(REAL, 'production', 'templates'), path.join(root, 'production', 'templates'), {
      recursive: true,
    })
    for (const f of ['02-visual-anchor.md'])
      if (existsSync(path.join(REAL, 'production', f)))
        cpSync(path.join(REAL, 'production', f), path.join(root, 'production', f))
    // Real master references so the simulated runner can hash them; the fixture's own stubs are replaced.
    for (const f of ['master/front.png', 'master/3-4.png'])
      if (existsSync(path.join(REAL, f))) cpSync(path.join(REAL, f), path.join(root, f))
    writeFileSync(path.join(root, 'production', 'jobs', 'events.jsonl'), '')
  } else {
    mkdirSync(path.join(root, 'production', 'interface'), { recursive: true })
    writeFileSync(
      path.join(root, 'production', 'interface', 'bunni.manifest.json'),
      JSON.stringify({ canon_version: '2.0' }),
    )
  }
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
  it("creates the next episode with a brief in Bunni's template and never touches references", () => {
    const root = fixture()
    const guard = new PathGuard(root)
    const before = readFileSync(path.join(root, 'master', 'front.png'))
    const created = runJob(guard, policy, {
      job: 'episode.create',
      taskId: 't',
      runId: null,
      requestedBy: 'x',
      input: { slug: 'nugget-meeting', brief: 'A brief.', script, approvalId: 'apr_test' },
    })
    expect(created.status).toBe('ok')
    const out = (created as { output: { episode: string; canonVersion: string } }).output
    expect(out.episode).toBe('EP001-nugget-meeting')
    expect(out.canonVersion).toBe('2.0')
    const brief = readFileSync(
      path.join(root, 'production', 'episodes', out.episode, 'brief.md'),
      'utf8',
    )
    for (const h of [
      '## One-line',
      '## Hook (first 1.5 seconds)',
      '## Shot list',
      '## Production risks',
      '## Success metric',
    ])
      expect(brief).toContain(h)
    expect(brief).toContain('apr_test')
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

  it.skipIf(!hasInterface)(
    "places plan-only keyframe jobs in Bunni's inbox in her schema and reads her outbox",
    () => {
      const root = fixture()
      const guard = new PathGuard(root)
      const created = runJob(guard, policy, {
        job: 'episode.create',
        taskId: 't',
        runId: null,
        requestedBy: 'x',
        input: { slug: 'nugget-meeting', brief: 'A brief.', script },
      })
      const episode = (created as { output: { episode: string } }).output.episode
      const packaged = runJob(guard, policy, {
        job: 'episode.package',
        taskId: 't',
        runId: null,
        requestedBy: 'x',
        input: { episode, approvalId: 'apr_test' },
      })
      expect(packaged.status).toBe('ok')
      const out = (
        packaged as {
          output: {
            jobs: { status: string; simulated: boolean; creditsSpent: number; shot: string }[]
            estimate: { basis: string; credits: number }
            canonVersion: string
          }
        }
      ).output
      expect(out.jobs).toHaveLength(2)
      expect(out.jobs.map((j) => j.shot)).toEqual(['01', '02'])
      for (const j of out.jobs) {
        expect(j.status).toBe('awaiting_approval')
        expect(j.creditsSpent).toBe(0)
        expect(j.simulated).toBe(true)
      }
      const processed = readdirSync(path.join(root, 'production', 'jobs', 'processing'))
      const job = JSON.parse(
        readFileSync(
          path.join(root, 'production', 'jobs', 'processing', processed[0] ?? ''),
          'utf8',
        ),
      ) as Record<string, unknown>
      expect(job['canon_version']).toBe('2.0')
      expect(
        (job['approval'] as { paid_generation_allowed: boolean }).paid_generation_allowed,
      ).toBe(false)
      expect(job['type']).toBe('keyframe')
      expect(JSON.stringify(job)).not.toContain('Bunni, the same canonical')
      const events = readFileSync(path.join(root, 'production', 'jobs', 'events.jsonl'), 'utf8')
        .trim()
        .split('\n')
      expect(events.length).toBeGreaterThan(2)
      expect(
        events.every(
          (l) => (JSON.parse(l) as { data: { simulated?: boolean } }).data.simulated === true,
        ),
      ).toBe(true)
      expect(out.estimate.basis).toContain('verified')
      expect(out.estimate.credits).toBe(2 * 2 + 2 * 5)
    },
  )

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
