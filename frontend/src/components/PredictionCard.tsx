type PredictionCardProps = {
  keyword: string
  predictionDays: number | null
  direction: 'up' | 'down' | 'flat' | null
  isLoading: boolean
  error: string | null
}

const directionCopy = {
  up: 'Upward trend',
  down: 'Downward trend',
  flat: 'Flat trend',
}

const panelClassName =
  'relative grid gap-4 overflow-hidden rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(11,20,34,0.82),rgba(6,12,23,0.66))] p-6 shadow-[0_30px_90px_rgba(2,6,23,0.55),0_12px_34px_rgba(2,6,23,0.35)] backdrop-blur-3xl before:pointer-events-none before:absolute before:inset-0 before:bg-[linear-gradient(140deg,rgba(255,255,255,0.06),rgba(255,255,255,0.012)_38%,rgba(255,255,255,0))]'

const badgeClassName = {
  up: 'border border-green-400/20 bg-green-500/14 text-green-300',
  down: 'border border-red-400/20 bg-red-500/14 text-red-300',
  flat: 'border border-blue-400/20 bg-blue-500/14 text-blue-300',
}

export function PredictionCard({
  keyword,
  predictionDays,
  direction,
  isLoading,
  error,
}: PredictionCardProps) {
  if (isLoading) {
    return (
      <section className={`${panelClassName} min-h-[260px] place-items-center`}>
        <div
          className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-300/12 border-t-cyan-300"
          aria-hidden="true"
        />
        <p className="m-0 text-slate-400">Fetching prediction data...</p>
      </section>
    )
  }

  if (error) {
    return (
      <section className="relative grid gap-4 overflow-hidden rounded-3xl border border-red-400/28 bg-[linear-gradient(180deg,rgba(54,20,28,0.72),rgba(34,14,19,0.56))] p-6 shadow-[0_30px_90px_rgba(2,6,23,0.55),0_12px_34px_rgba(2,6,23,0.35)] backdrop-blur-3xl">
        <p className="m-0 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
          Prediction
        </p>
        <h2 className="font-['Space_Grotesk',_'Avenir_Next',_sans-serif] text-3xl leading-none font-semibold tracking-[-0.04em] text-slate-50">
          No result
        </h2>
        <p className="m-0 text-slate-400">{error}</p>
      </section>
    )
  }

  if (predictionDays === null || direction === null) {
    return (
      <section className={panelClassName}>
        <p className="m-0 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
          Prediction
        </p>
        <h2 className="font-['Space_Grotesk',_'Avenir_Next',_sans-serif] text-3xl leading-none font-semibold tracking-[-0.04em] text-slate-50">
          Run a search
        </h2>
        <p className="m-0 text-slate-400">
          Enter a keyword above to estimate its remaining lifespan.
        </p>
      </section>
    )
  }

  return (
    <section className={panelClassName}>
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row">
        <div>
          <p className="m-0 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
            Prediction
          </p>
          <h2 className="mt-2 font-['Space_Grotesk',_'Avenir_Next',_sans-serif] text-3xl leading-none font-semibold tracking-[-0.04em] text-slate-50">
            {keyword}
          </h2>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-3.5 py-2 text-sm font-bold ${badgeClassName[direction]}`}
        >
          {directionCopy[direction]}
        </span>
      </div>

      <div className="mt-auto grid gap-1">
        <span className="text-[clamp(3.25rem,8vw,5rem)] leading-none font-bold tracking-[-0.06em] text-slate-50">
          {predictionDays}
        </span>
        <span className="text-slate-400">predicted lifespan (days)</span>
      </div>
    </section>
  )
}
