type TrendPoint = {
  date: string
  value: number
}

type TrendChartProps = {
  data: TrendPoint[]
  isLoading: boolean
  keyword: string
}

const CHART_WIDTH = 720
const CHART_HEIGHT = 320
const PADDING = 24

export function TrendChart({ data, isLoading, keyword }: TrendChartProps) {
  const hasData = data.length > 1

  return (
    <section className="relative min-w-0 overflow-hidden rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(11,20,34,0.82),rgba(6,12,23,0.66))] p-6 shadow-[0_30px_90px_rgba(2,6,23,0.55),0_12px_34px_rgba(2,6,23,0.35)] backdrop-blur-3xl before:pointer-events-none before:absolute before:inset-0 before:bg-[linear-gradient(140deg,rgba(255,255,255,0.06),rgba(255,255,255,0.012)_38%,rgba(255,255,255,0))]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="m-0 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
            Google Trends
          </p>
          <h2 className="mt-2 font-['Space_Grotesk',_'Avenir_Next',_sans-serif] text-3xl leading-none font-semibold tracking-[-0.04em] text-slate-50">
            Historical interest
          </h2>
        </div>
      </div>

      {isLoading ? (
        <div className="grid min-h-[260px] place-items-center">
          <div
            className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-300/12 border-t-cyan-300"
            aria-hidden="true"
          />
          <p className="m-0 text-slate-400">Loading chart...</p>
        </div>
      ) : hasData ? (
        <div className="grid gap-3">
          <svg
            className="h-auto w-full overflow-visible"
            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
            role="img"
            aria-label={`Historical Google Trends data for ${keyword}`}
          >
            <ChartGrid />
            <polyline
              className="stroke-cyan-300 [filter:drop-shadow(0_0_10px_rgba(103,232,249,0.32))]"
              fill="none"
              points={buildPoints(data)}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="3"
            />
            {data.map((point, index) => {
              const { x, y } = getPointPosition(point.value, index, data)

              return (
                <circle
                  key={`${point.date}-${point.value}`}
                  className="fill-violet-400"
                  cx={x}
                  cy={y}
                  r="3.5"
                />
              )
            })}
          </svg>

          <div className="flex justify-between gap-4 text-sm text-slate-400">
            <span>{formatDate(data[0].date)}</span>
            <span>{formatDate(data[data.length - 1].date)}</span>
          </div>
        </div>
      ) : (
        <div className="grid min-h-[260px] place-items-center">
          <p className="m-0 text-slate-400">
            Historical trend data will appear here after a successful search.
          </p>
        </div>
      )}
    </section>
  )
}

function ChartGrid() {
  return (
    <g aria-hidden="true">
      {[0, 1, 2, 3].map((line) => {
        const y = PADDING + ((CHART_HEIGHT - PADDING * 2) / 3) * line

        return (
          <line
            key={line}
            className="stroke-slate-400/20"
            x1={PADDING}
            y1={y}
            x2={CHART_WIDTH - PADDING}
            y2={y}
            strokeWidth="1"
          />
        )
      })}
    </g>
  )
}

function buildPoints(data: TrendPoint[]) {
  return data
    .map((point, index) => {
      const { x, y } = getPointPosition(point.value, index, data)
      return `${x},${y}`
    })
    .join(' ')
}

function getPointPosition(value: number, index: number, data: TrendPoint[]) {
  const maxValue = Math.max(...data.map((point) => point.value), 1)
  const innerWidth = CHART_WIDTH - PADDING * 2
  const innerHeight = CHART_HEIGHT - PADDING * 2
  const x = PADDING + (innerWidth / Math.max(data.length - 1, 1)) * index
  const y = PADDING + innerHeight - (value / maxValue) * innerHeight

  return { x, y }
}

function formatDate(value: string) {
  const parsedDate = new Date(value)

  if (Number.isNaN(parsedDate.getTime())) {
    return value
  }

  return parsedDate.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}
