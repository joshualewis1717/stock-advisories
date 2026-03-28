import type { PropsWithChildren } from 'react'

export function Layout({ children }: PropsWithChildren) {
  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <img className="brand__logo" src="/favicon.jpg" alt="Trend Grave logo" />
          <div>
            <p className="topbar__title">Trend Grave</p>
          </div>
        </div>
      </header>

      {children}
    </main>
  )
}
