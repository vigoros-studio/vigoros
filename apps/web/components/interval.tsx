/** BSS point estimate with its interval on a fixed axis. Zero (the prior) is marked. */
export const Interval = ({ point, lower, upper, min = -0.15, max = 0.15 }: { point: number | null; lower: number | null; upper: number | null; min?: number; max?: number }) => {
  if (point === null) return <div className="interval" aria-hidden />
  const x = (v: number) => `${((Math.min(max, Math.max(min, v)) - min) / (max - min)) * 100}%`
  const lo = lower ?? point
  const hi = upper ?? point
  return (
    <div className="interval" role="img" aria-label={`Brier skill ${point.toFixed(3)}, interval ${lo.toFixed(3)} to ${hi.toFixed(3)}`}>
      <div className="axis" />
      <div className="zero" style={{ left: x(0) }} />
      <div className="band" style={{ left: x(lo), width: `calc(${x(hi)} - ${x(lo)})` }} />
      <div className="point" style={{ left: x(point) }} />
    </div>
  )
}
