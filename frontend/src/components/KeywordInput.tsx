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
    <form className="keyword-form" onSubmit={onSubmit}>
      <label className="field-label" htmlFor="keyword">
        Keyword
      </label>
      <div className="input-row">
        <input
          id="keyword"
          className="keyword-input"
          type="text"
          value={keyword}
          onChange={(event) => onKeywordChange(event.target.value)}
          placeholder="Enter a trend, meme, artist, or product"
          autoComplete="off"
        />
        <button className="submit-button" type="submit" disabled={isLoading}>
          {isLoading ? 'Analyzing...' : 'Predict'}
        </button>
      </div>
    </form>
  )
}
