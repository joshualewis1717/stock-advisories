import { useState } from 'react'
import type { FormEvent } from 'react'
import { KeywordInput } from './components/KeywordInput'
import { Layout } from './components/Layout'
import { PredictionCard } from './components/PredictionCard'
import { TrendChart } from './components/TrendChart'

type TrendPoint = {
  date: string
  value: number
}

type PredictionResponse = {
  keyword: string
  prediction_days: number
  features: {
    slope: number
  }
  data: Array<Record<string, string | number | boolean | null>>
  error?: string
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

function App() {
  const [keyword, setKeyword] = useState('brat summer')
  const [result, setResult] = useState<PredictionResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const chartData = result ? normalizeChartData(result) : []
  const direction = result ? getTrendDirection(result.features.slope) : null

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedKeyword = keyword.trim()
    if (!trimmedKeyword) {
      setError('Enter a keyword to analyze.')
      setResult(null)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `${API_BASE_URL}/predict?keyword=${encodeURIComponent(trimmedKeyword)}`,
      )

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}.`)
      }

      const payload = (await response.json()) as PredictionResponse

      if (payload.error) {
        setResult(null)
        setError(payload.error)
        return
      }

      if (!payload.data?.length) {
        setResult(null)
        setError('No trend data was returned for that keyword.')
        return
      }

      setResult(payload)
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : 'Unable to fetch prediction data.'

      setResult(null)
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Layout>
      <section className="relative overflow-hidden rounded-[28px] border border-white/12 bg-[linear-gradient(180deg,rgba(8,15,27,0.78),rgba(8,15,27,0.58))] p-8 shadow-[0_30px_90px_rgba(2,6,23,0.55),0_12px_34px_rgba(2,6,23,0.35)] backdrop-blur-3xl before:pointer-events-none before:absolute before:inset-0 before:bg-[linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.012)_38%,rgba(255,255,255,0))] sm:p-10">
        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-cyan-300">
              Trend Grave Dashboard
            </span>
            <h1 className="mt-3 max-w-[12ch] font-['Space_Grotesk',_'Avenir_Next',_sans-serif] text-4xl leading-none font-semibold tracking-[-0.04em] text-slate-50 sm:text-6xl">
              Predict whether a trend still has room to run.
            </h1>
            <p className="mt-4 max-w-2xl text-base text-slate-400 sm:text-lg">
            Search a keyword, fetch the FastAPI model output, and inspect the
            recent Google Trends history in one place.
            </p>
          </div>

          <KeywordInput
            keyword={keyword}
            isLoading={isLoading}
            onKeywordChange={setKeyword}
            onSubmit={handleSubmit}
          />
        </div>
      </section>

      <section className="grid items-stretch gap-6 lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
        <PredictionCard
          direction={direction}
          error={error}
          isLoading={isLoading}
          keyword={result?.keyword ?? keyword.trim()}
          predictionDays={result?.prediction_days ?? null}
        />

        <TrendChart
          data={chartData}
          isLoading={isLoading}
          keyword={result?.keyword ?? keyword.trim()}
        />
      </section>
    </Layout>
  )
}

function normalizeChartData(result: PredictionResponse): TrendPoint[] {
  return result.data
    .map((point) => {
      const rawDate = point.date
      const rawValue = point[result.keyword]

      if (typeof rawDate !== 'string' || typeof rawValue !== 'number') {
        return null
      }

      return {
        date: rawDate,
        value: rawValue,
      }
    })
    .filter((point): point is TrendPoint => point !== null)
}

function getTrendDirection(slope: number) {
  if (slope > 0.15) {
    return 'up'
  }

  if (slope < -0.15) {
    return 'down'
  }

  return 'flat'
}

export default App
