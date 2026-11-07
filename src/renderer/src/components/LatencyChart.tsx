import { useLayoutEffect, useRef, useState } from 'react'
import type { HistoryPoint } from '../../../shared/types'
import { formatDate, formatDateTime, formatTime } from '../format'

interface Props {
  points: HistoryPoint[]
  from: number
  to: number
  bucketMs: number
}

const HEIGHT = 220
const PAD = { top: 12, right: 12, bottom: 24, left: 52 }

// 1, 2, 5 × 10^n step so axis labels stay round.
function niceStep(v: number): number {
  if (v <= 0) return 25
  const p = 10 ** Math.floor(Math.log10(v))
  const n = v / p
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p
}

export default function LatencyChart({ points, from, to, bucketMs }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(600)
  const [hover, setHover] = useState<HistoryPoint | null>(null)

  useLayoutEffect(() => {
    const el = box.current!
    const ro = new ResizeObserver(() => setWidth(el.clientWidth))
    ro.observe(el)
    setWidth(el.clientWidth)
    return () => ro.disconnect()
  }, [])

  const plotW = Math.max(100, width - PAD.left - PAD.right)
  const plotH = HEIGHT - PAD.top - PAD.bottom
  const peak = Math.max(0, ...points.map((p) => p.latencyMs ?? 0))
  const step = niceStep(peak / 4)
  const max = Math.max(step, Math.ceil(peak / step) * step)
  const x = (t: number) => PAD.left + ((t + bucketMs / 2 - from) / (to - from)) * plotW
  const y = (ms: number) => PAD.top + plotH - (ms / max) * plotH
  const barW = Math.max(2, (bucketMs / (to - from)) * plotW)

  // The line breaks where Monitor was not running or every check in a bucket was DOWN.
  let d = ''
  const isolated: HistoryPoint[] = []
  let run: HistoryPoint[] = []
  const flush = () => {
    if (run.length === 1) isolated.push(run[0])
    run = []
  }
  for (const p of points) {
    const last = run[run.length - 1]
    if (p.latencyMs === null || (last && p.t - last.t > bucketMs * 1.5)) flush()
    if (p.latencyMs === null) continue
    d += `${run.length ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.latencyMs).toFixed(1)}`
    run.push(p)
  }
  flush()

  const yTicks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step)
  const xTicks = Array.from({ length: 5 }, (_, i) => from + ((to - from) * (i + 0.5)) / 5)
  const short = to - from <= 86_400_000

  const onMove = (e: React.MouseEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const t = from + ((e.clientX - rect.left) / rect.width) * (to - from)
    let best: HistoryPoint | null = null
    for (const p of points) if (!best || Math.abs(p.t + bucketMs / 2 - t) < Math.abs(best.t + bucketMs / 2 - t)) best = p
    setHover(best && Math.abs(best.t + bucketMs / 2 - t) <= bucketMs * 2 ? best : null)
  }

  return (
    <div className="chart" ref={box}>
      {points.length === 0 ? (
        <div className="chart-empty">Нет данных за период</div>
      ) : (
        <svg width={width} height={HEIGHT} role="img" aria-label="Время ответа">
          {yTicks.map((v) => (
            <g key={v}>
              <line className="chart-grid" x1={PAD.left} x2={PAD.left + plotW} y1={y(v)} y2={y(v)} />
              <text className="chart-label" x={PAD.left - 8} y={y(v) + 4} textAnchor="end">
                {v >= 1000 ? `${v / 1000} s` : `${v} ms`}
              </text>
            </g>
          ))}
          {xTicks.map((t) => (
            <text key={t} className="chart-label" x={x(t - bucketMs / 2)} y={HEIGHT - 6} textAnchor="middle">
              {short ? formatTime(t) : formatDate(t)}
            </text>
          ))}
          {points
            .filter((p) => p.down > 0)
            .map((p) => (
              <rect
                key={p.t}
                className="chart-down"
                x={x(p.t) - barW / 2}
                y={PAD.top}
                width={barW}
                height={plotH}
                opacity={0.25 + 0.5 * (p.down / p.checks)}
              />
            ))}
          <path className="chart-line" d={d} />
          {/* A bucket without neighbours draws no line segment, so it is shown as a dot. */}
          {isolated.map((p) => (
            <circle key={p.t} className="chart-dot" cx={x(p.t)} cy={y(p.latencyMs!)} r={3} />
          ))}
          {hover && (
            <g>
              <line className="chart-cross" x1={x(hover.t)} x2={x(hover.t)} y1={PAD.top} y2={PAD.top + plotH} />
              {hover.latencyMs !== null && <circle className="chart-dot" cx={x(hover.t)} cy={y(hover.latencyMs)} r={4} />}
            </g>
          )}
          <rect
            x={PAD.left}
            y={PAD.top}
            width={plotW}
            height={plotH}
            fill="transparent"
            onMouseMove={onMove}
            onMouseLeave={() => setHover(null)}
          />
        </svg>
      )}
      {hover && (
        <div
          className="chart-tip"
          style={{ left: Math.min(x(hover.t) + 12, width - 190), top: PAD.top }}
        >
          <strong>{formatDateTime(hover.t)}</strong>
          <span>Среднее: {hover.latencyMs === null ? '—' : `${hover.latencyMs} ms`}</span>
          <span>Проверок: {hover.checks}</span>
          {hover.down > 0 && <span className="chart-tip-down">DOWN: {hover.down}</span>}
        </div>
      )}
    </div>
  )
}
