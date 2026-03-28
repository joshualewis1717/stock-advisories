import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from './ui/chart'

type StockPoint = {
  date: string
  close: number
}

type StockPriceChartProps = {
  symbol: string
  companyName: string | null
  price: number | null
  changePercent: number | null
  data: StockPoint[]
  isLoading: boolean
  error: string | null
}

const chartConfig = {
  close: {
    label: 'Close',
    color: '#67e8f9',
  },
} satisfies ChartConfig

const panelClassName =
  'relative min-w-0 overflow-hidden rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(11,20,34,0.82),rgba(6,12,23,0.66))] p-6 shadow-[0_30px_90px_rgba(2,6,23,0.55),0_12px_34px_rgba(2,6,23,0.35)] backdrop-blur-3xl before:pointer-events-none before:absolute before:inset-0 before:bg-[linear-gradient(140deg,rgba(255,255,255,0.06),rgba(255,255,255,0.012)_38%,rgba(255,255,255,0))]'

export function StockPriceChart({
  symbol,
  companyName,
  price,
  changePercent,
  data,
  isLoading,
  error,
}: StockPriceChartProps) {
  const hasData = data.length > 1
  const changeTone =
    changePercent === null
      ? 'text-slate-400'
      : changePercent >= 0
        ? 'text-emerald-300'
        : 'text-rose-300'

  return (
    <section className={panelClassName}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="m-0 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
            Stock Price
          </p>
          <h2 className="mt-2 font-['Space_Grotesk',_'Avenir_Next',_sans-serif] text-3xl leading-none font-semibold tracking-[-0.04em] text-slate-50">
            {companyName ?? symbol}
          </h2>
          <p className="mt-2 text-sm text-slate-400">{symbol}</p>
        </div>

        <div className="grid gap-1 text-left lg:text-right">
          <span className="text-4xl font-semibold tracking-[-0.05em] text-slate-50">
            {price === null ? '--' : `$${price.toFixed(2)}`}
          </span>
          <span className={`text-sm font-medium ${changeTone}`}>
            {changePercent === null
              ? 'Awaiting data'
              : `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}% over 3 months`}
          </span>
        </div>
      </div>

      {isLoading ? (
        <div className="grid min-h-[360px] place-items-center">
          <div
            className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-300/12 border-t-cyan-300"
            aria-hidden="true"
          />
          <p className="m-0 text-slate-400">Loading stock price history...</p>
        </div>
      ) : error ? (
        <div className="grid min-h-[360px] place-items-center">
          <p className="m-0 text-slate-400">{error}</p>
        </div>
      ) : hasData ? (
        <ChartContainer className="h-[360px] w-full" config={chartConfig}>
          <LineChart
            accessibilityLayer
            data={data}
            margin={{ top: 16, right: 16, left: -8, bottom: 0 }}
          >
            <CartesianGrid
              vertical={false}
              stroke="rgba(148,163,184,0.16)"
              strokeDasharray="3 3"
            />
            <XAxis
              axisLine={false}
              dataKey="date"
              minTickGap={32}
              tickFormatter={formatDate}
              tickLine={false}
              tickMargin={12}
              tick={{ fill: '#94a3b8', fontSize: 12 }}
            />
            <YAxis
              axisLine={false}
              dataKey="close"
              domain={['dataMin - 5', 'dataMax + 5']}
              tickFormatter={(value) => `$${value}`}
              tickLine={false}
              tickMargin={10}
              tick={{ fill: '#94a3b8', fontSize: 12 }}
              width={54}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  indicator="dot"
                  labelFormatter={(label) => formatDate(String(label))}
                  formatter={(value) => `$${value}`}
                />
              }
              cursor={{
                stroke: 'rgba(103,232,249,0.3)',
                strokeWidth: 1,
                strokeDasharray: '4 4',
              }}
            />
            <Line
              activeDot={{
                r: 5,
                fill: '#a78bfa',
                stroke: '#0f172a',
                strokeWidth: 2,
              }}
              dataKey="close"
              dot={false}
              stroke="var(--color-close)"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={3}
              type="monotone"
            />
          </LineChart>
        </ChartContainer>
      ) : (
        <div className="grid min-h-[360px] place-items-center">
          <p className="m-0 text-slate-400">
            Stock price history will appear here after a successful search.
          </p>
        </div>
      )}
    </section>
  )
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
