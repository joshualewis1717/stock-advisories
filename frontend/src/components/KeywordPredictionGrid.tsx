import { CartesianGrid, Line, LineChart, XAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from './ui/chart'

type KeywordTrendPoint = {
  date: string
  value: number
}

type KeywordPrediction = {
  keyword: string
  direction: 'up' | 'down' | 'flat' | null
  error?: string
  features?: {
    peak: number
    mean: number
    std: number
    slope: number
  }
  data: KeywordTrendPoint[]
}

type KeywordPredictionGridProps = {
  symbol: string
  keywords: KeywordPrediction[]
  isLoading: boolean
  error: string | null
}

const panelClassName =
  'relative overflow-hidden rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(11,20,34,0.82),rgba(6,12,23,0.66))] p-6 shadow-[0_30px_90px_rgba(2,6,23,0.55),0_12px_34px_rgba(2,6,23,0.35)] backdrop-blur-3xl before:pointer-events-none before:absolute before:inset-0 before:bg-[linear-gradient(140deg,rgba(255,255,255,0.06),rgba(255,255,255,0.012)_38%,rgba(255,255,255,0))]'

const directionClassName = {
  up: 'border border-emerald-400/20 bg-emerald-500/14 text-emerald-300',
  down: 'border border-rose-400/20 bg-rose-500/14 text-rose-300',
  flat: 'border border-blue-400/20 bg-blue-500/14 text-blue-300',
}

const directionCopy = {
  up: 'Upward',
  down: 'Downward',
  flat: 'Flat',
}

export function KeywordPredictionGrid({
  symbol,
  keywords,
  isLoading,
  error,
}: KeywordPredictionGridProps) {
  return (
    <section className={panelClassName}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="m-0 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
            Related Signals
          </p>
          <h2 className="mt-2 font-['Space_Grotesk',_'Avenir_Next',_sans-serif] text-3xl leading-none font-semibold tracking-[-0.04em] text-slate-50">
            Keyword interest charts
          </h2>
        </div>
        <p className="m-0 text-sm text-slate-400">
          Related to {symbol || 'the selected stock'}
        </p>
      </div>

      {isLoading ? (
        <div className="grid min-h-[280px] place-items-center">
          <div
            className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-300/12 border-t-cyan-300"
            aria-hidden="true"
          />
          <p className="m-0 text-slate-400">Loading related keyword charts...</p>
        </div>
      ) : error ? (
        <div className="grid min-h-[280px] place-items-center">
          <p className="m-0 text-slate-400">{error}</p>
        </div>
      ) : keywords.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {keywords.map((item) => (
            <KeywordPredictionCard key={item.keyword} item={item} />
          ))}
        </div>
      ) : (
        <div className="grid min-h-[280px] place-items-center">
          <p className="m-0 text-slate-400">
            Related keyword charts will appear here after a successful search.
          </p>
        </div>
      )}
    </section>
  )
}

function KeywordPredictionCard({ item }: { item: KeywordPrediction }) {
  const chartConfig = {
    value: {
      label: item.keyword,
      color: '#67e8f9',
    },
  } satisfies ChartConfig

  return (
    <article className="rounded-[24px] border border-white/10 bg-slate-950/45 p-4 backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
            Keyword
          </p>
          <h3 className="mt-1 text-xl font-semibold tracking-[-0.04em] text-slate-50">
            {item.keyword}
          </h3>
        </div>
        {item.direction ? (
          <span
            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${directionClassName[item.direction]}`}
          >
            {directionCopy[item.direction]}
          </span>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <MetricTile
          label="Mean"
          value={formatMetricValue(item.features?.mean)}
        />
        <MetricTile
          label="Std"
          value={formatMetricValue(item.features?.std)}
        />
        <MetricTile
          label="Slope"
          value={formatMetricValue(item.features?.slope, 3)}
        />
      </div>

      {item.error ? (
        <div className="mt-4 grid min-h-[140px] place-items-center rounded-2xl border border-white/8 bg-white/3 px-4 text-center">
          <p className="text-sm text-slate-400">{item.error}</p>
        </div>
      ) : item.data.length > 1 ? (
        <div className="mt-4">
          <ChartContainer className="h-[160px] w-full" config={chartConfig}>
            <LineChart
              accessibilityLayer
              data={item.data}
              margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
            >
              <CartesianGrid
                vertical={false}
                stroke="rgba(148,163,184,0.12)"
                strokeDasharray="3 3"
              />
              <XAxis
                axisLine={false}
                dataKey="date"
                minTickGap={24}
                tickFormatter={formatDate}
                tickLine={false}
                tickMargin={10}
                tick={{ fill: '#94a3b8', fontSize: 11 }}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    indicator="dot"
                    labelFormatter={(label) => formatDate(String(label))}
                  />
                }
                cursor={{
                  stroke: 'rgba(103,232,249,0.24)',
                  strokeWidth: 1,
                  strokeDasharray: '4 4',
                }}
              />
              <Line
                dataKey="value"
                dot={false}
                stroke="var(--color-value)"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                type="monotone"
              />
            </LineChart>
          </ChartContainer>
        </div>
      ) : (
        <div className="mt-4 grid min-h-[140px] place-items-center rounded-2xl border border-white/8 bg-white/3 px-4 text-center">
          <p className="text-sm text-slate-400">Not enough trend data for this keyword.</p>
        </div>
      )}
    </article>
  )
}

function MetricTile({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/3 px-3 py-2.5">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tracking-[-0.03em] text-slate-100">
        {value}
      </p>
    </div>
  )
}

function formatMetricValue(value: number | undefined, digits = 2) {
  if (value === undefined || Number.isNaN(value)) {
    return '--'
  }

  return value.toFixed(digits)
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
