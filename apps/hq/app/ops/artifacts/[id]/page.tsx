import { artifacts } from '@vigoros/db'
import { eq } from 'drizzle-orm'
import { notFound, redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { founder } from '@/lib/session'

export const dynamic = 'force-dynamic'

export default async function ArtifactPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await founder())) redirect('/login')
  const { id } = await params
  const [a] = await db().select().from(artifacts).where(eq(artifacts.id, id))
  if (!a) notFound()
  return (
    <main>
      <p className="quiet">
        <a href="/ops">← operations</a>
        {a.workflowId ? (
          <>
            {' '}
            · <a href={`/ops/workflows/${a.workflowId}`}>workflow</a>
          </>
        ) : null}
      </p>
      <h1>{a.title}</h1>
      <p className="quiet">
        {a.kind} · produced by {a.producedBy} · {a.createdAt.toISOString()}
        {a.simulated ? ' · SIMULATED (fake adapter)' : ''}
        {a.path ? ` · ${a.path}` : ''}
        {a.sha256 ? ` · sha256 ${a.sha256.slice(0, 12)}` : ''}
      </p>
      <pre
        style={{
          whiteSpace: 'pre-wrap',
          fontSize: 13,
          lineHeight: 1.5,
          background: '#121214',
          padding: 16,
          borderRadius: 8,
        }}
      >
        {JSON.stringify(a.content, null, 2)}
      </pre>
    </main>
  )
}
