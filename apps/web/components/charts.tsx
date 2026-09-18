/** Inline SVG. No chart library: two small, exact drawings are all a record page needs. */

export const RollingLine = ({ series, height = 160 }: { series: { date: string; bss: number; n: number }[]; height?: number }) => {
  if (series.length < 2) return <p className="faint small">Rolling skill appears after the record spans more days.</p>
  const w = 720
  const h = height
  const pad = { l: 44, r: 8, t: 8, b: 22 }
  const ys = series.map((s) => s.bss)
  const lo = Math.min(-0.02, ...ys)
  const hi = Math.max(0.02, ...ys)
  const x = (i: number) => pad.l + (i / (series.length - 1)) * (w - pad.l - pad.r)
  const y = (v: number) => pad.t + (1 - (v - lo) / (hi - lo)) * (h - pad.t - pad.b)
  const d = series.map((s, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(s.bss).toFixed(1)}`).join(' ')
  const ticks = [lo, 0, hi].filter((v, i, a) => a.indexOf(v) === i)
  const first = series[0]!
  const last = series[series.length - 1]!
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} role="img" aria-label="Rolling 63-day Brier skill score">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} stroke={t === 0 ? 'var(--fg-3)' : 'var(--rule)'} strokeWidth={1} />
          <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--fg-3)" fontFamily="var(--font-mono)">
            {(t >= 0 ? '+' : '') + t.toFixed(2)}
          </text>
        </g>
      ))}
      <path d={d} fill="none" stroke="var(--fg)" strokeWidth={1.4} strokeLinejoin="round" />
      <text x={pad.l} y={h - 6} fontSize={11} fill="var(--fg-3)" fontFamily="var(--font-mono)">{first.date}</text>
      <text x={w - pad.r} y={h - 6} fontSize={11} fill="var(--fg-3)" fontFamily="var(--font-mono)" textAnchor="end">{last.date}</text>
    </svg>
  )
}

export const Calibration = ({ bins, size = 220 }: { bins: { index: number; count: number; meanForecast: number; observedFrequency: number }[]; size?: number }) => {
  const pad = 26
  const s = size
  const sc = (v: number) => pad + v * (s - 2 * pad)
  const maxCount = Math.max(1, ...bins.map((b) => b.count))
  return (
    <svg viewBox={`0 0 ${s} ${s}`} width={s} height={s} role="img" aria-label="Calibration: forecast probability against observed frequency">
      <line x1={sc(0)} y1={sc(1)} x2={sc(1)} y2={sc(0)} stroke="var(--rule-2)" strokeWidth={1} strokeDasharray="3 4" />
      <line x1={sc(0)} y1={sc(1)} x2={sc(1)} y2={sc(1)} stroke="var(--rule)" />
      <line x1={sc(0)} y1={sc(1)} x2={sc(0)} y2={sc(0)} stroke="var(--rule)" />
      {bins
        .filter((b) => b.count > 0)
        .map((b) => (
          <circle
            key={b.index}
            cx={sc(b.meanForecast)}
            cy={sc(1 - b.observedFrequency)}
            r={2.5 + 5 * Math.sqrt(b.count / maxCount)}
            fill="var(--fg)"
            fillOpacity={0.85}
          />
        ))}
      <text x={sc(0)} y={s - 6} fontSize={10} fill="var(--fg-3)" fontFamily="var(--font-mono)">0</text>
      <text x={sc(1)} y={s - 6} fontSize={10} fill="var(--fg-3)" fontFamily="var(--font-mono)" textAnchor="end">1</text>
      <text x={s / 2} y={s - 6} fontSize={10} fill="var(--fg-3)" textAnchor="middle">forecast</text>
      <text x={8} y={sc(0) + 4} fontSize={10} fill="var(--fg-3)" fontFamily="var(--font-mono)">1</text>
      <text transform={`translate(10 ${s / 2}) rotate(-90)`} fontSize={10} fill="var(--fg-3)" textAnchor="middle">observed</text>
    </svg>
  )
}
