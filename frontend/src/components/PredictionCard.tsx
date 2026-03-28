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

export function PredictionCard({
  keyword,
  predictionDays,
  direction,
  isLoading,
  error,
}: PredictionCardProps) {
  if (isLoading) {
    return (
      <section className="panel prediction-panel panel--centered">
        <div className="spinner" aria-hidden="true" />
        <p className="panel-message">Fetching prediction data...</p>
      </section>
    )
  }

  if (error) {
    return (
      <section className="panel prediction-panel panel--error">
        <p className="panel-kicker">Prediction</p>
        <h2>No result</h2>
        <p className="panel-message">{error}</p>
      </section>
    )
  }

  if (predictionDays === null || direction === null) {
    return (
      <section className="panel prediction-panel">
        <p className="panel-kicker">Prediction</p>
        <h2>Run a search</h2>
        <p className="panel-message">
          Enter a keyword above to estimate its remaining lifespan.
        </p>
      </section>
    )
  }

  return (
    <section className="panel prediction-panel">
      <div className="panel-heading">
        <div>
          <p className="panel-kicker">Prediction</p>
          <h2>{keyword}</h2>
        </div>
        <span className={`trend-badge trend-badge--${direction}`}>
          {directionCopy[direction]}
        </span>
      </div>

      <div className="prediction-metric">
        <span className="prediction-metric__value">{predictionDays}</span>
        <span className="prediction-metric__label">predicted lifespan (days)</span>
      </div>
    </section>
  )
}
