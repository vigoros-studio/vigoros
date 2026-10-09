import {
  agents,
  approvals,
  artifacts,
  companies,
  events,
  runs,
  tasks,
  workflows,
} from '@vigoros/db'
import { insertTask, instruct, resolveApproval, setPaused } from '@vigoros/ops'
import { desc, eq } from 'drizzle-orm'
import { QUEUES, boss, stopBoss } from './boss'
import { db } from './db'
import { env } from './env'
import { seed } from './seed'
import { runTurn } from './turn'
import { verify } from './verify'
import { advance, startEpisodeWorkflow, tick } from './workflow'

const [cmd, ...rest] = process.argv.slice(2)

const main = async () => {
  const d = db()
  switch (cmd) {
    case 'seed': {
      console.log(
        JSON.stringify(
          await seed({
            bunniRoot: process.env['BUNNI_ROOT'] ?? '',
            dailyCapUsd: env().COMPANY_DAILY_CAP_USD,
          }),
          null,
          2,
        ),
      )
      break
    }
    case 'task': {
      const [kind, roleKey, title, json] = rest
      if (!kind || !roleKey || !title)
        throw new Error('usage: task <kind> <role-key> "<title>" [json-input]')
      const [owner] = await d.select().from(agents).where(eq(agents.roleKey, roleKey))
      if (!owner) throw new Error(`no agent with role ${roleKey}; run seed first`)
      console.log(
        (
          await insertTask(d, {
            kind,
            title,
            ownerAgentId: owner.id,
            requestedBy: 'founder',
            input: json ? JSON.parse(json) : {},
            capUsd: 1,
          })
        ).id,
      )
      break
    }
    case 'instruct': {
      const [roleKey, ...words] = rest
      const [owner] = roleKey
        ? await d.select().from(agents).where(eq(agents.roleKey, roleKey))
        : []
      if (!owner) throw new Error('usage: instruct <role-key> <text>')
      console.log(await instruct(d, owner.id, words.join(' ')))
      break
    }
    case 'workflow': {
      const [focus, guidance] = rest
      const [bunni] = await d.select().from(agents).where(eq(agents.roleKey, 'trend-researcher'))
      if (!bunni?.characterId) throw new Error('seed first')
      console.log(
        await startEpisodeWorkflow({
          characterId: bunni.characterId,
          startedBy: 'founder',
          title: (focus ?? 'Episode').slice(0, 80),
          input: {
            focus: focus ?? 'relatable daily-life comedy',
            guidance: guidance ?? '',
            returnCount: 1,
          },
          capUsd: 3,
        }),
      )
      break
    }
    case 'advance': {
      await advance(rest[0] ?? '')
      console.log('ok')
      break
    }
    case 'tick': {
      console.log(JSON.stringify(await tick()))
      await stopBoss()
      break
    }
    case 'turn': {
      await runTurn(rest[0] ?? '')
      console.log('ok')
      break
    }
    case 'approve':
    case 'reject': {
      await resolveApproval(d, rest[0] ?? '', cmd === 'approve' ? 'approved' : 'rejected', rest[1])
      console.log(cmd)
      break
    }
    case 'pause':
    case 'resume': {
      const [c] = await d.select().from(companies).limit(1)
      if (!c) throw new Error('seed first')
      await setPaused(d, c.id, cmd === 'pause', rest[0])
      console.log(cmd)
      break
    }
    case 'status': {
      const [c] = await d.select().from(companies)
      const flows = await d
        .select({
          id: workflows.id,
          title: workflows.title,
          status: workflows.status,
          step: workflows.step,
          simulated: workflows.simulated,
          spent: workflows.spentUsd,
        })
        .from(workflows)
        .orderBy(desc(workflows.createdAt))
        .limit(5)
      const open = await d
        .select({
          id: tasks.id,
          step: tasks.step,
          kind: tasks.kind,
          status: tasks.status,
          title: tasks.title,
          turns: tasks.turns,
        })
        .from(tasks)
        .orderBy(desc(tasks.createdAt))
        .limit(25)
      const pending = await d
        .select({ id: approvals.id, headline: approvals.headline, status: approvals.status })
        .from(approvals)
        .orderBy(desc(approvals.createdAt))
        .limit(5)
      const recent = await d
        .select({ seq: events.seq, caption: events.caption })
        .from(events)
        .orderBy(desc(events.seq))
        .limit(12)
      console.log(
        JSON.stringify(
          {
            company: { paused: c?.paused, cap: c?.dailyCapUsd },
            workflows: flows,
            tasks: open,
            approvals: pending,
            events: recent,
          },
          null,
          2,
        ),
      )
      break
    }
    case 'audit': {
      // Invariants the phase 1 report relies on.
      const allRuns = await d
        .select({
          taskId: runs.taskId,
          status: runs.status,
          adapter: runs.adapter,
          cost: runs.costUsd,
        })
        .from(runs)
      const perTask = new Map<string, number>()
      for (const r of allRuns)
        perTask.set(r.taskId, (perTask.get(r.taskId) ?? 0) + (r.status === 'succeeded' ? 1 : 0))
      const dupes = [...perTask.entries()].filter(([, n]) => n > 1)
      const spend = allRuns.reduce((a, r) => a + r.cost, 0)
      const adapters = [...new Set(allRuns.map((r) => r.adapter))]
      const sim = await d.select({ n: artifacts.simulated }).from(artifacts)
      console.log(
        JSON.stringify(
          {
            runs: allRuns.length,
            tasksWithMultipleSuccessfulRuns: dupes,
            totalSpendUsd: spend,
            adaptersUsed: adapters,
            artifacts: sim.length,
            simulatedArtifacts: sim.filter((a) => a.n).length,
          },
          null,
          2,
        ),
      )
      break
    }
    case 'verify': {
      const checks = await verify()
      for (const c of checks) console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}  (${c.detail})`)
      if (checks.some((c) => !c.ok)) process.exitCode = 1
      break
    }
    case 'queues': {
      const b = await boss()
      for (const q of Object.values(QUEUES))
        console.log(q, JSON.stringify(await b.getQueueStats(q)))
      await stopBoss()
      break
    }
    default:
      console.log(
        'commands: seed | task | instruct | workflow | advance | tick | turn | approve | reject | pause | resume | status | audit | verify | queues',
      )
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
