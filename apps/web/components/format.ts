export const fmtBss = (x: number | null | undefined, digits = 3): string => (x === null || x === undefined ? '—' : (x >= 0 ? '+' : '') + x.toFixed(digits))
export const fmtPct = (x: number | null | undefined, digits = 0): string => (x === null || x === undefined ? '—' : `${(x * 100).toFixed(digits)}%`)
export const fmtInt = (x: number | null | undefined): string => (x === null || x === undefined ? '—' : x.toLocaleString('en-GB'))
export const fmtP = (p: number): string => `${Math.round(p * 100)}%`
export const fmtDate = (d: string | Date | null | undefined): string => {
  if (!d) return '—'
  const date = typeof d === 'string' ? new Date(`${d.slice(0, 10)}T00:00:00Z`) : d
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}
export const fmtPValue = (p: number | null | undefined): string => (p === null || p === undefined ? '—' : p < 0.001 ? '<0.001' : p.toFixed(3))
export const kindLabel = (k: string): string =>
  ({ HUMAN: 'Human', AGENT: 'Agent', REFERENCE_MODEL: 'Reference model', BASELINE: 'Baseline' })[k] ?? k
