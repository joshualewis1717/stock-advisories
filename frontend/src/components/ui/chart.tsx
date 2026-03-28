import * as React from 'react'
import * as RechartsPrimitive from 'recharts'

export type ChartConfig = {
  [key: string]: {
    label?: string
    color?: string
  }
}

type ChartTooltipPayloadItem = {
  color?: string
  dataKey?: string | number
  name?: string | number
  payload?: unknown
  value?: string | number
}

type ChartTooltipContentProps = {
  active?: boolean
  payload?: ChartTooltipPayloadItem[]
  label?: string | number
  indicator?: 'line' | 'dot'
  labelFormatter?: (
    label: string | number,
    payload: ChartTooltipPayloadItem[],
  ) => React.ReactNode
  formatter?: (
    value: string | number | undefined,
    name: string | number | undefined,
    item: ChartTooltipPayloadItem,
    payload: ChartTooltipPayloadItem[],
    itemPayload: unknown,
  ) => React.ReactNode
}

type ChartContextProps = {
  config: ChartConfig
}

const ChartContext = React.createContext<ChartContextProps | null>(null)

function useChart() {
  const context = React.useContext(ChartContext)

  if (!context) {
    throw new Error('useChart must be used within a ChartContainer.')
  }

  return context
}

export function ChartContainer({
  id,
  className,
  config,
  children,
}: React.ComponentProps<'div'> & {
  config: ChartConfig
  children: React.ComponentProps<
    typeof RechartsPrimitive.ResponsiveContainer
  >['children']
}) {
  const uniqueId = React.useId()
  const chartId = `chart-${id ?? uniqueId.replace(/:/g, '')}`

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-chart={chartId}
        className={className}
        style={buildChartStyle(config)}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer>
          {children}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  )
}

export function ChartTooltip(
  props: React.ComponentProps<typeof RechartsPrimitive.Tooltip>,
) {
  return <RechartsPrimitive.Tooltip {...props} />
}

export function ChartTooltipContent({
  active,
  payload,
  label,
  indicator = 'line',
  labelFormatter,
  formatter,
}: ChartTooltipContentProps) {
  const { config } = useChart()

  if (!active || !payload?.length) {
    return null
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/90 px-3 py-2.5 shadow-2xl backdrop-blur-xl">
      {label ? (
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
          {labelFormatter ? labelFormatter(label, payload) : String(label)}
        </p>
      ) : null}

      <div className="grid gap-2">
        {payload.map((item) => {
          const key = String(item.dataKey ?? item.name ?? 'value')
          const itemConfig = config[key]
          const itemColor = item.color ?? itemConfig?.color ?? '#67e8f9'

          return (
            <div key={key} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span
                  className={
                    indicator === 'dot'
                      ? 'size-2 rounded-full'
                      : 'h-2.5 w-2.5 rounded-sm'
                  }
                  style={{ backgroundColor: itemColor }}
                />
                <span className="text-sm text-slate-300">
                  {itemConfig?.label ?? item.name}
                </span>
              </div>
              <span className="text-sm font-semibold text-slate-100">
                {formatter
                  ? formatter(item.value, item.name, item, payload, item.payload)
                  : String(item.value)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ChartStyle({
  id,
  config,
}: {
  id: string
  config: ChartConfig
}) {
  const colorConfig = Object.entries(config).filter(([, value]) => value.color)

  if (!colorConfig.length) {
    return null
  }

  return (
    <style>
      {colorConfig
        .map(
          ([key, value]) =>
            `[data-chart=${id}] { --color-${key}: ${value.color}; }`,
        )
        .join('\n')}
    </style>
  )
}

function buildChartStyle(config: ChartConfig): React.CSSProperties {
  return Object.entries(config).reduce<React.CSSProperties>(
    (styles, [key, value]) => {
      if (value.color) {
        ;(styles as Record<string, string>)[`--color-${key}`] = value.color
      }

      return styles
    },
    {},
  )
}
