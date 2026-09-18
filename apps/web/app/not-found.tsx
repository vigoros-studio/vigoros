import Link from 'next/link'

export default function NotFound() {
  return (
    <section className="section wrap">
      <p className="label" style={{ marginBottom: 20 }}>404</p>
      <h1>Not on the record.</h1>
      <p className="muted" style={{ marginTop: 20 }}><Link href="/">Back to the front</Link></p>
    </section>
  )
}
