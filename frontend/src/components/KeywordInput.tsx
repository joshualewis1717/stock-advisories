import type { FormEvent } from 'react'

type KeywordInputProps = {
  keyword: string
  isLoading: boolean
  onKeywordChange: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

export function KeywordInput({
  keyword,
  isLoading,
  onKeywordChange,
  onSubmit,
}: KeywordInputProps) {
  return (
    <form
      className="grid content-center gap-3 rounded-[22px] border border-white/10 bg-[linear-gradient(180deg,rgba(10,19,32,0.82),rgba(6,13,23,0.64))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-2xl"
      onSubmit={onSubmit}
    >
      <label className="text-sm font-semibold text-slate-100" htmlFor="keyword">
        Keyword
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          id="keyword"
          className="min-w-0 flex-1 rounded-2xl border border-white/12 bg-slate-950/70 px-4 py-4 text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none placeholder:text-slate-500 focus:ring-2 focus:ring-cyan-300/30"
          type="text"
          value={keyword}
          onChange={(event) => onKeywordChange(event.target.value)}
          placeholder="Enter a trend, meme, artist, or product"
          autoComplete="off"
        />
        <button
          className="rounded-2xl bg-linear-to-r from-cyan-400 via-blue-500 to-violet-500 px-5 py-4 font-bold text-slate-950 shadow-[0_12px_30px_rgba(34,211,238,0.22)] transition hover:-translate-y-px disabled:cursor-wait disabled:opacity-80"
          type="submit"
          disabled={isLoading}
        >
          {isLoading ? 'Analyzing...' : 'Predict'}
        </button>
      </div>
    </form>
  )
}
