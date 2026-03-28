import { useState } from 'react'
import type { FormEvent } from 'react'
import { KeywordPredictionGrid } from './components/KeywordPredictionGrid'
import { Layout } from './components/Layout'
import { ModelInsightPanel } from './components/ModelInsightPanel'
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
  model_insight: ModelInsight | null
  error?: string
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

type ModelInsight = {
  trained: boolean
  error?: string
  prediction_horizon_days?: number
  predicted_return_percent?: number
  model_score?: number
  holistic_score?: number
  rank?: string
  confidence?: string
  momentum_adjustment?: number
  training_symbols: string[]
  keyword_signal?: {
    average_slope: number
    up_count: number
    down_count: number
    adjustment: number
  }
  feature_values?: Record<string, number>
}

type TrainModelResponse = {
  status?: string
  error?: string
  sample_count?: number
  symbols?: string[]
  pytorch_available?: boolean
  metrics?: {
    training_loss?: number
    validation_loss?: number
    validation_mae?: number
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function toNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function toStringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function toBooleanValue(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
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

function normalizeModelInsight(value: unknown): ModelInsight | null {
  if (!isRecord(value)) {
    return null
  }

  const trainingSymbols = Array.isArray(value.training_symbols)
    ? value.training_symbols.flatMap((entry) =>
        typeof entry === 'string' && entry.trim() ? [entry] : [],
      )
    : []

  const keywordSignal = isRecord(value.keyword_signal)
    ? {
        average_slope: toNumber(value.keyword_signal.average_slope) ?? 0,
        up_count: toNumber(value.keyword_signal.up_count) ?? 0,
        down_count: toNumber(value.keyword_signal.down_count) ?? 0,
        adjustment: toNumber(value.keyword_signal.adjustment) ?? 0,
      }
    : undefined

  const featureValues = isRecord(value.feature_values)
    ? Object.fromEntries(
        Object.entries(value.feature_values).flatMap(([key, entryValue]) => {
          const numericValue = toNumber(entryValue)
          return numericValue === undefined ? [] : [[key, numericValue]]
        }),
      )
    : undefined

  return {
    trained: toBooleanValue(value.trained) ?? false,
    error: toStringValue(value.error),
    prediction_horizon_days: toNumber(value.prediction_horizon_days),
    predicted_return_percent: toNumber(value.predicted_return_percent),
    model_score: toNumber(value.model_score),
    holistic_score: toNumber(value.holistic_score),
    rank: toStringValue(value.rank),
    confidence: toStringValue(value.confidence),
    momentum_adjustment: toNumber(value.momentum_adjustment),
    training_symbols: trainingSymbols,
    keyword_signal: keywordSignal,
    feature_values: featureValues,
  }
}

function normalizeTrainModelResponse(value: unknown): TrainModelResponse {
  if (!isRecord(value)) {
    return { error: 'The backend returned an invalid training response.' }
  }

  const symbols = Array.isArray(value.symbols)
    ? value.symbols.flatMap((entry) =>
        typeof entry === 'string' && entry.trim() ? [entry] : [],
      )
    : undefined

  const metrics = isRecord(value.metrics)
    ? {
        training_loss: toNumber(value.metrics.training_loss),
        validation_loss: toNumber(value.metrics.validation_loss),
        validation_mae: toNumber(value.metrics.validation_mae),
      }
    : undefined

  return {
    status: toStringValue(value.status),
    error: toStringValue(value.error),
    sample_count: toNumber(value.sample_count),
    symbols,
    pytorch_available: toBooleanValue(value.pytorch_available),
    metrics,
  }
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
    model_insight: normalizeModelInsight(payload.model_insight),
    error: toStringValue(payload.error),
  }
}

function App() {
  const [symbol, setSymbol] = useState('NVDA')
  const [result, setResult] = useState<StockDashboardResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [trainingSymbols, setTrainingSymbols] = useState(
    'NVDA, AAPL, MSFT, AMZN, GOOGL, META, TSLA, PLTR',
  )
  const [trainingMessage, setTrainingMessage] = useState<string | null>(null)
  const [isTraining, setIsTraining] = useState(false)

  async function loadDashboard(trimmedSymbol: string) {
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedSymbol = symbol.trim().toUpperCase()
    if (!trimmedSymbol) {
      setError('Enter a stock symbol to analyze.')
      setResult(null)
      return
    }

    await loadDashboard(trimmedSymbol)
  }

  async function handleTrainModel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const symbols = trainingSymbols
      .split(',')
      .map((entry) => entry.trim().toUpperCase())
      .filter(Boolean)

    if (symbols.length < 2) {
      setTrainingMessage('Enter at least two stock symbols to train the model.')
      return
    }

    setIsTraining(true)
    setTrainingMessage(null)

    try {
      const response = await fetch(`${API_BASE_URL}/train-model`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          symbols,
        }),
      })

      const payload = normalizeTrainModelResponse(await response.json())

      if (!response.ok) {
        throw new Error(payload.error ?? `Training failed with status ${response.status}.`)
      }

      if (payload.error) {
        throw new Error(payload.error)
      }

      const trainedCount = payload.sample_count ?? 0
      const validationMae = payload.metrics?.validation_mae
      setTrainingMessage(
        validationMae === undefined
          ? `Model trained on ${trainedCount} samples.`
          : `Model trained on ${trainedCount} samples with validation MAE ${validationMae.toFixed(2)}.`,
      )

      const currentSymbol = result?.symbol ?? symbol.trim().toUpperCase()
      if (currentSymbol) {
        await loadDashboard(currentSymbol)
      }
    } catch (trainingError) {
      setTrainingMessage(
        trainingError instanceof Error
          ? trainingError.message
          : 'Unable to train the PyTorch model.',
      )
    } finally {
      setIsTraining(false)
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

      <ModelInsightPanel
        insight={result?.model_insight ?? null}
        isLoading={isLoading}
        isTraining={isTraining}
        onSubmit={handleTrainModel}
        onTrainingSymbolsChange={setTrainingSymbols}
        symbol={displaySymbol}
        trainingMessage={trainingMessage}
        trainingSymbols={trainingSymbols}
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
