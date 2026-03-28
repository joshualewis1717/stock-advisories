import { useState } from 'react'
import type { FormEvent } from 'react'
import { KeywordPredictionGrid } from './components/KeywordPredictionGrid'
import { Layout } from './components/Layout'
import { StockInput } from './components/StockInput'
import { StockPriceChart } from './components/StockPriceChart'

type StockPoint = {
  date: string
  close: number
}

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

type StockDashboardResponse = {
  symbol: string
  company_name: string
  price: number
  change_percent: number
  stock_data: StockPoint[]
  keywords: KeywordPrediction[]
  error?: string
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function toNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function toStringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function normalizeTrendPoints(value: unknown): KeywordTrendPoint[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((entry) => {
    if (!isRecord(entry)) {
      return []
    }

    const date = toStringValue(entry.date)
    const pointValue =
      toNumber(entry.value) ??
      toNumber(entry.close) ??
      toNumber(entry.interest) ??
      toNumber(entry.score)

    if (!date || pointValue === undefined) {
      return []
    }

    return [{ date, value: pointValue }]
  })
}

function normalizeStockPoints(value: unknown): StockPoint[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((entry) => {
    if (!isRecord(entry)) {
      return []
    }

    const date = toStringValue(entry.date)
    const close = toNumber(entry.close) ?? toNumber(entry.value)

    if (!date || close === undefined) {
      return []
    }

    return [{ date, close }]
  })
}

function normalizeKeywordPrediction(value: unknown): KeywordPrediction | null {
  if (!isRecord(value)) {
    return null
  }

  const keyword =
    toStringValue(value.keyword) ??
    toStringValue(value.name) ??
    toStringValue(value.term)

  if (!keyword) {
    return null
  }

  const direction =
    value.direction === 'up' || value.direction === 'down' || value.direction === 'flat'
      ? value.direction
      : null

  const featuresSource = isRecord(value.features) ? value.features : value

  const peak = toNumber(featuresSource.peak)
  const mean = toNumber(featuresSource.mean)
  const std = toNumber(featuresSource.std)
  const slope = toNumber(featuresSource.slope)

  return {
    keyword,
    direction,
    error: toStringValue(value.error),
    features:
      peak === undefined &&
      mean === undefined &&
      std === undefined &&
      slope === undefined
        ? undefined
        : { peak: peak ?? 0, mean: mean ?? 0, std: std ?? 0, slope: slope ?? 0 },
    data: normalizeTrendPoints(
      value.data ?? value.chart_data ?? value.trend_data ?? value.history,
    ),
  }
}

function normalizeKeywords(value: unknown): KeywordPrediction[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.flatMap((entry) => {
    const keyword = normalizeKeywordPrediction(entry)
    return keyword ? [keyword] : []
  })
}

function normalizeDashboardResponse(payload: unknown): StockDashboardResponse | null {
  if (!isRecord(payload)) {
    return null
  }

  const symbol = toStringValue(payload.symbol)
  if (!symbol) {
    return null
  }

  return {
    symbol,
    company_name: toStringValue(payload.company_name) ?? symbol,
    price: toNumber(payload.price) ?? 0,
    change_percent: toNumber(payload.change_percent) ?? 0,
    stock_data: normalizeStockPoints(payload.stock_data),
    keywords: normalizeKeywords(payload.keywords),
    error: toStringValue(payload.error),
  }
}

function App() {
  const [symbol, setSymbol] = useState('NVDA')
  const [result, setResult] = useState<StockDashboardResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedSymbol = symbol.trim().toUpperCase()
    if (!trimmedSymbol) {
      setError('Enter a stock symbol to analyze.')
      setResult(null)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `${API_BASE_URL}/stock-dashboard?symbol=${encodeURIComponent(trimmedSymbol)}`,
      )

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}.`)
      }

      const payload = normalizeDashboardResponse(await response.json())

      if (!payload) {
        throw new Error('The backend returned an invalid response.')
      }

      if (payload.error) {
        setResult(null)
        setError(payload.error)
        return
      }

      if (!payload.stock_data?.length) {
        setResult(null)
        setError('No stock price history was returned for that symbol.')
        return
      }

      setResult(payload)
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : 'Unable to fetch stock dashboard data.'

      setResult(null)
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  const displaySymbol = result?.symbol ?? symbol.trim().toUpperCase()

  return (
    <Layout>
      <section className="relative overflow-hidden rounded-[32px] border border-white/12 bg-[linear-gradient(180deg,rgba(7,13,24,0.9),rgba(6,12,22,0.72))] px-6 py-7 shadow-[0_34px_100px_rgba(2,6,23,0.58),0_12px_34px_rgba(2,6,23,0.35)] backdrop-blur-3xl before:pointer-events-none before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),transparent_28%),radial-gradient(circle_at_85%_20%,rgba(168,85,247,0.12),transparent_24%),linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.012)_38%,rgba(255,255,255,0))] sm:px-8 sm:py-8 lg:px-10 lg:py-10">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.3fr)_420px]">
          <div className="grid gap-6">
            <div className="flex flex-col items-start gap-4">
              <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/8 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-200">
                Stock Signal Dashboard
              </span>
              <h1 className="max-w-[13ch] font-['Space_Grotesk',_'Avenir_Next',_sans-serif] text-4xl leading-[0.95] font-semibold tracking-[-0.05em] text-slate-50 sm:text-6xl">
                Track a stock and the ideas moving around it.
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
                Enter a ticker to load recent price action from yfinance, then
                inspect six related trend signals underneath.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {['NVDA', 'AAPL', 'TSLA', 'PLTR', 'MSFT'].map((sample) => (
                <button
                  key={sample}
                  type="button"
                  onClick={() => setSymbol(sample)}
                  className="rounded-full border border-white/10 bg-slate-950/50 px-3 py-1.5 text-sm text-slate-300 transition hover:border-cyan-300/30 hover:bg-cyan-300/8 hover:text-cyan-100"
                >
                  {sample}
                </button>
              ))}
            </div>
          </div>

          <div className="lg:pl-2">
            <div className="h-full rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-2xl">
              <StockInput
                isLoading={isLoading}
                onSubmit={handleSubmit}
                onSymbolChange={setSymbol}
                symbol={symbol}
              />
            </div>
          </div>
        </div>
      </section>

      <StockPriceChart
        changePercent={result?.change_percent ?? null}
        companyName={result?.company_name ?? null}
        data={result?.stock_data ?? []}
        error={error}
        isLoading={isLoading}
        price={result?.price ?? null}
        symbol={displaySymbol}
      />

      <KeywordPredictionGrid
        error={error}
        isLoading={isLoading}
        keywords={result?.keywords ?? []}
        symbol={displaySymbol}
      />
    </Layout>
  )
}

export default App
