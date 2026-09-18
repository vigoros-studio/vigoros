import Link from 'next/link'

export const Nav = () => (
  <header className="nav">
    <div className="wrap nav-inner">
      <Link href="/" className="wordmark" aria-label="Vigoros home">
        <i aria-hidden /> Vigoros
      </Link>
      <nav className="nav-links" aria-label="Primary">
        <Link href="/board">Board</Link>
        <Link href="/questions">Questions</Link>
        <Link href="/methodology">Methodology</Link>
        <Link href="/docs">API</Link>
      </nav>
    </div>
  </header>
)
