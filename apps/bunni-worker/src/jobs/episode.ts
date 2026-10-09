import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { EpisodeScript, type BunniJobInput, type BunniJobOutput } from '@vigoros/contracts'
import { ACCESSORY_TO_JOB, CREDITS, CREDITS_BASIS, EXPRESSION_TO_JOB, readManifest } from '../canon'
import type { PathGuard } from '../guard'

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

const two = (n: number) => String(n).padStart(2, '0')

/** Creates the next EPnnn-slug directory with a brief in Bunni's episode template, the script, and her standard subfolders. */
export const episodeCreate = (
  guard: PathGuard,
  input: BunniJobInput<'episode.create'>,
): BunniJobOutput<'episode.create'> => {
  const manifest = readManifest(guard)
  const script = EpisodeScript.parse(input.script)
  const episode = `EP${String(nextEpisodeNumber(guard)).padStart(3, '0')}-${input.slug}`
  const dir = guard.writePath(episode, '.')
  if (existsSync(dir)) throw new Error(`episode ${episode} already exists`)
  const ep = episode.slice(0, 5)
  const shotRows = script.beats.map(
    (b) =>
      `| ${two(b.beat)} | ~4 s | low camera, 9:16 | ${b.action} | ${b.line ? `"${b.line}"` : ''} | IDENTITY + ${b.expression === 'neutral' ? 'default face' : `expressions/${b.expression}`}${script.outfit !== 'default' ? ` + outfits/${script.outfit}` : ''} | seedance_2_0_mini |`,
  )
  const brief = [
    `# ${ep}: ${script.title}`,
    '',
    `Canon ${manifest.canon_version}. Created by Vigoros Studio${input.approvalId ? ` after founder approval ${input.approvalId}` : ''}. Plan-only until paid generation is authorised.`,
    '',
    '## One-line',
    script.logline,
    '',
    '## Storyline beat',
    input.brief,
    '',
    '## Hook (first 1.5 seconds)',
    script.hook,
    '',
    '## Script',
    ...script.beats.map(
      (b) => `${two(b.beat)}. [${b.expression}] ${b.action}${b.line ? `\n    > "${b.line}"` : ''}`,
    ),
    '',
    '## Reference plan',
    `| Element | Reference |\n|---|---|\n| Identity | IDENTITY pack |\n| Outfit | ${script.outfit} |\n| Accessory | ${script.accessory} |\n| Expressions | ${[...new Set(script.beats.map((b) => b.expression))].join(', ')} |\n| Setting | ${script.setting} |`,
    '',
    '## Shot list',
    '| Shot | Length | Framing | Action | Dialogue / text | Keyframe refs | Video model |',
    '|---|---|---|---|---|---|---|',
    ...shotRows,
    '',
    '## Audio',
    `Voice: pending production/voice-selection/DECISION.md. Caption: ${script.caption}`,
    '',
    '## Audience participation',
    `Comment prompt via caption. Hashtags: ${script.hashtags.join(' ')}`,
    '',
    '## Production risks',
    'Paws tapping props read as hands (A8). Outfit continuity across shots. See QC checklist section A.',
    '',
    '## Success metric',
    'Set by the Performance Analyst measurement plan attached to this episode in Vigoros.',
    '',
  ].join('\n')
  const files = [
    write(guard, episode, 'brief.md', brief),
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
        '',
        ...script.beats.map(
          (b) => `${b.beat}. [${b.expression}] ${b.action}${b.line ? `\n   > "${b.line}"` : ''}`,
        ),
        '',
        `**Caption:** ${script.caption}`,
        '',
      ].join('\n'),
    ),
  ]
  for (const sub of ['prompts', 'keyframes', 'renders', 'qc'])
    mkdirSync(guard.writePath(episode, sub), { recursive: true })
  return {
    episode,
    dir: path.relative(guard.root, dir),
    files,
    canonVersion: manifest.canon_version,
  }
}

/**
 * One plan-only keyframe job per beat, in Bunni's job schema, dropped into her inbox and run
 * through her own simulated runner (zero cost, every event flagged simulated). Bunni prepends
 * her anchor; we send scene text only. Results come from her outbox.
 */
export const episodePackage = (
  guard: PathGuard,
  input: BunniJobInput<'episode.package'>,
): BunniJobOutput<'episode.package'> => {
  const manifest = readManifest(guard)
  const scriptPath = guard.readPath(
    path.join('production', 'episodes', input.episode, 'script.json'),
  )
  if (!existsSync(scriptPath)) throw new Error(`episode ${input.episode} has no script.json`)
  const script = EpisodeScript.parse(JSON.parse(readFileSync(scriptPath, 'utf8')))
  const ep = input.episode.slice(0, 5)
  const runner = guard.readPath('production/interface/mock_run.py')
  if (!existsSync(runner)) throw new Error('production/interface/mock_run.py is missing')
  mkdirSync(guard.inboxDir, { recursive: true })

  const jobs: BunniJobOutput<'episode.package'>['jobs'] = []
  const files: string[] = []
  for (const b of script.beats) {
    const shot = two(b.beat)
    const jobId = `${ep.toLowerCase()}-s${shot}-keyframe-${Date.now().toString(36)}`
    const job = {
      job_id: jobId,
      requested_by: 'vigoros:production-manager',
      requested_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
      canon_version: manifest.canon_version,
      type: 'keyframe',
      episode: ep,
      shot,
      /** A cap, not a spend: plan-only jobs spend nothing, but Bunni's runner checks the estimate against the cap first. */
      budget_credits: CREDITS.keyframe,
      max_retries: 0,
      approval: { paid_generation_allowed: false, gate: 'keyframe' },
      inputs: {
        brief_path: `production/episodes/${input.episode}/brief.md`,
        reference_pack: 'IDENTITY',
        outfit: script.outfit,
        accessory: ACCESSORY_TO_JOB[script.accessory] ?? 'none',
        expression: EXPRESSION_TO_JOB[b.expression] ?? 'default',
        scene_text: `${script.setting}. ${b.action}${b.line ? ` She says: "${b.line}".` : ''}`,
        params: { aspect_ratio: '9:16' },
      },
      notes: `Vigoros Studio episode workflow${input.approvalId ? `, founder approval ${input.approvalId}` : ''}. Plan-only.`,
    }
    const inbox = guard.inboxPath(jobId)
    writeFileSync(inbox, JSON.stringify(job, null, 2), 'utf8')
    // Bunni's runner moves the request from inbox to processing while it works, so that is where it ends up.
    files.push(
      path.relative(
        guard.root,
        path.join(guard.root, 'production', 'jobs', 'processing', `${jobId}.json`),
      ),
    )
    const run = spawnSync('python3', ['-I', runner, inbox], {
      cwd: guard.root,
      encoding: 'utf8',
      timeout: 60_000,
    })
    const resultPath = path.join(guard.outboxDir, `${jobId}.result.json`)
    if (run.status !== 0 || !existsSync(resultPath))
      throw new Error(
        `Bunni runner failed for ${jobId}: ${(run.stderr || run.stdout || '').slice(0, 300)}`,
      )
    const result = JSON.parse(readFileSync(resultPath, 'utf8')) as {
      status: string
      next_gate?: string
      message?: string
      credits_spent?: number
      simulated?: boolean
      outputs?: { path: string; kind: string; qc_verdict: string }[]
    }
    files.push(path.relative(guard.root, resultPath))
    jobs.push({
      jobId,
      shot,
      type: 'keyframe',
      status: result.status,
      nextGate: result.next_gate ?? null,
      message: result.message ?? '',
      simulated: result.simulated === true,
      creditsSpent: result.credits_spent ?? 0,
      outputs: (result.outputs ?? []).map((o) => ({
        path: o.path,
        kind: o.kind,
        qcVerdict: o.qc_verdict,
      })),
    })
  }
  const keyframes = script.beats.length
  const videoSeconds = keyframes * 4
  return {
    episode: input.episode,
    canonVersion: manifest.canon_version,
    jobs,
    files,
    estimate: {
      keyframes,
      clips: keyframes,
      videoSeconds,
      credits: keyframes * CREDITS.keyframe + keyframes * CREDITS.clipMini,
      basis: CREDITS_BASIS,
    },
  }
}
