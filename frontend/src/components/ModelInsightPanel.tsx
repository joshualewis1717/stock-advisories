import type { FormEvent } from 'react'

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

type ModelInsightPanelProps = {
  symbol: string
  insight: ModelInsight | null
  isLoading: boolean
  isTraining: boolean
  trainingSymbols: string
  trainingMessage: string | null
  onTrainingSymbolsChange: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void>
}

const panelClassName =
  'relative overflow-hidden rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(11,20,34,0.82),rgba(6,12,23,0.66))] p-6 shadow-[0_30px_90px_rgba(2,6,23,0.55),0_12px_34px_rgba(2,6,23,0.35)] backdrop-blur-3xl before:pointer-events-none before:absolute before:inset-0 before:bg-[linear-gradient(140deg,rgba(255,255,255,0.06),rgba(255,255,255,0.012)_38%,rgba(255,255,255,0))]'

const rankClassName = {
  'Strong Buy': 'border-emerald-300/25 bg-emerald-400/10 text-emerald-200',
  Buy: 'border-cyan-300/25 bg-cyan-400/10 text-cyan-200',
  Hold: 'border-blue-300/25 bg-blue-400/10 text-blue-200',
  Caution: 'border-amber-300/25 bg-amber-400/10 text-amber-200',
  Avoid: 'border-rose-300/25 bg-rose-400/10 text-rose-200',
} as const

export function ModelInsightPanel({
  symbol,
  insight,
  isLoading,
  isTraining,
  trainingSymbols,
  trainingMessage,
  onTrainingSymbolsChange,
  onSubmit,
}: ModelInsightPanelProps) {
  const topFeatures = Object.entries(insight?.feature_values ?? {}).slice(0, 4)
  const rankTone =
    insight?.rank && insight.rank in rankClassName
      ? rankClassName[insight.rank as keyof typeof rankClassName]
      : 'border-white/10 bg-white/5 text-slate-200'

  return (
    <section className={panelClassName}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,420px)]">
        <div className="grid gap-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="m-0 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                Neural Ranker
              </p>
              <h2 className="mt-2 font-['Space_Grotesk',_'Avenir_Next',_sans-serif] text-3xl leading-none font-semibold tracking-[-0.04em] text-slate-50">
                Holistic stock score
              </h2>
            </div>
            <p className="m-0 text-sm text-slate-400">PyTorch view for {symbol}</p>
          </div>

          {isLoading ? (
            <div className="grid min-h-[260px] place-items-center">
              <div
                className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-300/12 border-t-cyan-300"
                aria-hidden="true"
              />
              <p className="m-0 text-slate-400">Scoring stock with the neural model...</p>
            </div>
          ) : insight?.trained ? (
            <div className="grid gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={`inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${rankTone}`}
                >
                  {insight.rank ?? 'Unranked'}
                </span>
                <span className="text-sm text-slate-400">
                  Confidence: {insight.confidence ?? 'Unknown'}
                </span>
                <span className="text-sm text-slate-400">
                  Horizon: {insight.prediction_horizon_days ?? '--'} days
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricTile
                  label="Holistic Score"
                  value={formatNumber(insight.holistic_score, 1)}
                />
                <MetricTile
                  label="Model Score"
                  value={formatNumber(insight.model_score, 1)}
                />
                <MetricTile
                  label="Predicted Return"
                  value={formatPercent(insight.predicted_return_percent)}
                />
                <MetricTile
                  label="Momentum Adj."
                  value={formatSignedNumber(insight.momentum_adjustment, 2)}
                />
              </div>

              <div className="grid gap-3 lg:grid-cols-2">
                <div className="rounded-[24px] border border-white/10 bg-slate-950/45 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                    Keyword Signal
                  </p>
                  <div className="mt-3 grid gap-2 text-sm text-slate-300">
                    <span>
                      Average slope:{' '}
                      {formatSignedNumber(insight.keyword_signal?.average_slope, 4)}
                    </span>
                    <span>
                      Up vs down:{' '}
                      {(insight.keyword_signal?.up_count ?? 0).toString()} /{' '}
                      {(insight.keyword_signal?.down_count ?? 0).toString()}
                    </span>
                    <span>
                      Score adjustment:{' '}
                      {formatSignedNumber(insight.keyword_signal?.adjustment, 2)}
                    </span>
                  </div>
                </div>

                <div className="rounded-[24px] border border-white/10 bg-slate-950/45 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                    Model Inputs
                  </p>
                  {topFeatures.length ? (
                    <div className="mt-3 grid gap-2 text-sm text-slate-300">
                      {topFeatures.map(([name, value]) => (
                        <span key={name}>
                          {name}: {value.toFixed(2)}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-slate-400">No feature breakdown available.</p>
                  )}
                </div>
              </div>

              <p className="m-0 text-sm text-slate-400">
                Trained on: {insight.training_symbols.join(', ') || 'No recorded symbols'}
              </p>
            </div>
          ) : (
            <div className="grid min-h-[260px] place-items-center rounded-[24px] border border-white/8 bg-white/3 px-6 text-center">
              <p className="m-0 max-w-xl text-sm text-slate-400">
                {insight?.error ??
                  'Train the PyTorch model with a list of stocks to generate a holistic rank and projected return.'}
              </p>
            </div>
          )}
        </div>

        <form
          className="rounded-[28px] border border-white/10 bg-slate-950/40 p-5"
          onSubmit={onSubmit}
        >
          <div className="grid gap-4">
            <div>
              <p className="m-0 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                Train Model
              </p>
              <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-50">
                Train on a stock basket
              </h3>
            </div>

            <label className="grid gap-2">
              <span className="text-sm text-slate-300">
                Comma-separated stock symbols used to train the neural network.
              </span>
              <textarea
                className="min-h-[180px] rounded-3xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/40"
                name="trainingSymbols"
                onChange={(event) => onTrainingSymbolsChange(event.target.value)}
                placeholder="NVDA, AAPL, MSFT, AMZN, GOOGL, META"
                value={trainingSymbols}
              />
            </label>

            <button
              className="inline-flex items-center justify-center rounded-full border border-cyan-300/30 bg-cyan-300/12 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:border-cyan-200/40 hover:bg-cyan-300/18 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isTraining}
              type="submit"
            >
              {isTraining ? 'Training model...' : 'Train PyTorch model'}
            </button>

            <p className="m-0 text-sm text-slate-400">
              {trainingMessage ??
                'Training uses rolling price windows from each symbol and saves the model on the backend.'}
            </p>
          </div>
        </form>
      </div>
    </section>
  )
}

function MetricTile({ label, value }: { label: string; value: string }) {
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

function formatNumber(value: number | undefined, digits = 2) {
  if (value === undefined || Number.isNaN(value)) {
    return '--'
  }

  return value.toFixed(digits)
}

function formatSignedNumber(value: number | undefined, digits = 2) {
  if (value === undefined || Number.isNaN(value)) {
    return '--'
  }

  return `${value >= 0 ? '+' : ''}${value.toFixed(digits)}`
}

function formatPercent(value: number | undefined) {
  if (value === undefined || Number.isNaN(value)) {
    return '--'
  }

  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}
