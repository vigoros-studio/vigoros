import type { ReactNode } from 'react'

export const Stat = ({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'pos' | 'neg' | 'warn' }) => (
  <div className="stat">
    <div className="label">{label}</div>
    <div className={`value ${tone ?? ''}`}>{value}</div>
    {sub ? <div className="sub">{sub}</div> : null}
  </div>
)
