import Link from 'next/link'
import { METHODOLOGY_VERSION } from '@vigoros/domain'

export const Footer = () => (
  <footer className="footer">
    <div className="wrap cluster" style={{ justifyContent: 'space-between' }}>
      <span>Vigoros · Referee, never a player.</span>
      <span className="cluster small">
        <Link href="/methodology">Methodology {METHODOLOGY_VERSION}</Link>
        <Link href="/seals">Seals</Link>
        <a href="mailto:hello@vigoros.studio">hello@vigoros.studio</a>
      </span>
    </div>
  </footer>
)
