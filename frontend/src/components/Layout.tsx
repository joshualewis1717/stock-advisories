import type { PropsWithChildren } from 'react'

export function Layout({ children }: PropsWithChildren) {
  return (
    <main className="grid gap-6">
      <header className="flex items-center justify-between">
        <div className="inline-flex items-center gap-4">
          <img
            className="h-11 w-11 rounded-[14px] border border-white/16 object-cover shadow-[0_14px_28px_rgba(2,6,23,0.36),inset_0_1px_0_rgba(255,255,255,0.08)]"
            src="/favicon.jpg"
            alt="Trend Grave logo"
          />
          <div>
            <p className="m-0 text-base font-bold uppercase tracking-[0.06em] text-slate-50">
              Trend Grave
            </p>
          </div>
        </div>
      </header>

      {children}
    </main>
  )
}
