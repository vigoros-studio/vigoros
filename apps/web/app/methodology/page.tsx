import fs from 'node:fs'
import path from 'node:path'
import type { Metadata } from 'next'
import { marked } from 'marked'

export const metadata: Metadata = { title: 'Methodology' }

/** Copied from docs/methodology.md by the prebuild step, so the doc stays the single source. */
const load = (): string => fs.readFileSync(path.join(process.cwd(), 'content', 'methodology.md'), 'utf8')

export default function MethodologyPage() {
  const md = load().replace(/^# .*\n/, '')
  const html = marked.parse(md, { async: false }) as string
  return (
    <section className="section wrap">
      <p className="label" style={{ marginBottom: 20 }}>Methodology</p>
      <h1 style={{ maxWidth: '18ch' }}>Every score is produced by these rules.</h1>
      <p className="lede measure" style={{ marginTop: 24 }}>
        Versioned, published before code, never changed silently. If a definition changes, every historical record is recomputed and
        both results stay visible.
      </p>
      <article className="prose" style={{ marginTop: 56 }} dangerouslySetInnerHTML={{ __html: html }} />
    </section>
  )
}
