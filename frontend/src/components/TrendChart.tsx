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
    <section className="panel chart-panel">
      <div className="panel-heading">
        <div>
          <p className="panel-kicker">Google Trends</p>
          <h2>Historical interest</h2>
        </div>
      </div>

      {isLoading ? (
        <div className="chart-state">
          <div className="spinner" aria-hidden="true" />
          <p className="panel-message">Loading chart...</p>
        </div>
      ) : hasData ? (
        <div className="chart-wrap">
          <svg
            className="chart-svg"
            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
            role="img"
            aria-label={`Historical Google Trends data for ${keyword}`}
          >
            <ChartGrid />
            <polyline
              className="chart-line"
              fill="none"
              points={buildPoints(data)}
            />
            {data.map((point, index) => {
              const { x, y } = getPointPosition(point.value, index, data)

              return (
                <circle
                  key={`${point.date}-${point.value}`}
                  className="chart-dot"
                  cx={x}
                  cy={y}
                  r="3.5"
                />
              )
            })}
          </svg>

          <div className="chart-axis">
            <span>{formatDate(data[0].date)}</span>
            <span>{formatDate(data[data.length - 1].date)}</span>
          </div>
        </div>
      ) : (
        <div className="chart-state">
          <p className="panel-message">
            Historical trend data will appear here after a successful search.
          </p>
        </div>
      )}
    </section>
  )
}

function ChartGrid() {
  return (
    <g className="chart-grid" aria-hidden="true">
      {[0, 1, 2, 3].map((line) => {
        const y = PADDING + ((CHART_HEIGHT - PADDING * 2) / 3) * line

        return (
          <line
            key={line}
            x1={PADDING}
            y1={y}
            x2={CHART_WIDTH - PADDING}
            y2={y}
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
