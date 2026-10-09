import { agents, approvals, companies, events, tasks } from '@vigoros/db'
import { desc, eq } from 'drizzle-orm'
import { QUEUES, boss, stopBoss } from './boss'
import { db } from './db'
import { env } from './env'
import { seed } from './seed'
import { createTask } from './tasks'
import { runTurn } from './turn'

const [cmd, ...rest] = process.argv.slice(2)

const main = async () => {
  switch (cmd) {
    case 'seed': {
      const r = await seed({
        bunniRoot: process.env['BUNNI_ROOT'] ?? '',
        dailyCapUsd: env().COMPANY_DAILY_CAP_USD,
      })
      console.log(JSON.stringify(r, null, 2))
      break
    }
    case 'task': {
      // task <kind> <role-key> "<title>" '<json input>'
      const [kind, roleKey, title, json] = rest
      if (!kind || !roleKey || !title)
        throw new Error('usage: task <kind> <role-key> "<title>" [json-input]')
      const [owner] = await db().select().from(agents).where(eq(agents.roleKey, roleKey))
      if (!owner) throw new Error(`no agent with role ${roleKey}; run seed first`)
      const id = await createTask({
        kind,
        title,
        ownerAgentId: owner.id,
        requestedBy: 'founder',
        input: json ? JSON.parse(json) : {},
        capUsd: 1,
      })
      console.log(id)
      break
    }
    case 'turn': {
      const [taskId] = rest
      if (!taskId) throw new Error('usage: turn <task-id>')
      await runTurn(taskId)
      console.log('ok')
      break
    }
    case 'status': {
      const d = db()
      const [c] = await d.select().from(companies)
      const open = await d
        .select({ id: tasks.id, kind: tasks.kind, status: tasks.status, title: tasks.title })
        .from(tasks)
        .orderBy(desc(tasks.createdAt))
        .limit(20)
      const pending = await d
        .select({ id: approvals.id, headline: approvals.headline })
        .from(approvals)
        .where(eq(approvals.status, 'pending'))
      const recent = await d
        .select({ seq: events.seq, caption: events.caption, at: events.createdAt })
        .from(events)
        .orderBy(desc(events.seq))
        .limit(15)
      console.log(
        JSON.stringify({ company: c, tasks: open, approvals: pending, events: recent }, null, 2),
      )
      break
    }
    case 'pause':
    case 'resume': {
      const paused = cmd === 'pause'
      const [c] = await db()
        .update(companies)
        .set({ paused, pausedReason: paused ? (rest[0] ?? 'founder') : null })
        .returning()
      if (c)
        await (
          await import('./events')
        ).emit({
          kind: paused ? 'company.paused' : 'company.resumed',
          companyId: c.id,
          characterId: null,
          agentId: null,
          departmentId: null,
          taskId: null,
          subject: `companies:${c.id}`,
          caption: paused ? 'Founder paused the company' : 'Founder resumed the company',
          payload: {},
        })
      console.log(paused ? 'paused' : 'resumed')
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
      console.log('commands: seed | task | turn | status | pause | resume | queues')
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
