import type { FormEvent } from 'react'

type StockInputProps = {
  symbol: string
  isLoading: boolean
  onSymbolChange: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

export function StockInput({
  symbol,
  isLoading,
  onSymbolChange,
  onSubmit,
}: StockInputProps) {
  return (
    <form
      className="grid h-full gap-5 rounded-[24px] bg-[linear-gradient(180deg,rgba(8,15,27,0.94),rgba(5,10,20,0.82))] p-5 sm:p-6"
      onSubmit={onSubmit}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-cyan-200">
            Stock Lookup
          </p>
          <h2 className="mt-2 font-['Space_Grotesk',_'Avenir_Next',_sans-serif] text-2xl leading-none font-semibold tracking-[-0.04em] text-slate-50">
            Analyze a ticker
          </h2>
        </div>
        <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
          {isLoading ? 'Loading' : 'Ready'}
        </div>
      </div>

      <label className="sr-only" htmlFor="symbol">
        Stock symbol
      </label>

      <div className="rounded-[22px] border border-white/10 bg-slate-950/70 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <div className="flex items-center gap-3 border-b border-white/8 px-2 pb-3">
          <span className="h-2.5 w-2.5 rounded-full bg-cyan-300" />
          <span className="text-xs uppercase tracking-[0.18em] text-slate-500">
            Enter a ticker
          </span>
        </div>

        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <input
            id="symbol"
            className="min-w-0 flex-1 rounded-2xl border border-white/8 bg-white/4 px-4 py-4 text-lg uppercase text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-300/30 focus:ring-2 focus:ring-cyan-300/20"
            type="text"
            value={symbol}
            onChange={(event) => onSymbolChange(event.target.value.toUpperCase())}
            placeholder="NVDA"
            autoComplete="off"
          />
          <button
            className="rounded-2xl bg-linear-to-r from-cyan-400 via-blue-500 to-violet-500 px-6 py-4 font-bold text-slate-950 shadow-[0_16px_40px_rgba(34,211,238,0.22)] transition hover:-translate-y-px disabled:cursor-wait disabled:opacity-80"
            type="submit"
            disabled={isLoading}
          >
            {isLoading ? 'Loading...' : 'Load dashboard'}
          </button>
        </div>
      </div>

      <p className="text-sm leading-6 text-slate-400">
        The main chart shows price history. The smaller cards below show
        related keyword signals and predicted lifespan.
      </p>
    </form>
  )
}
