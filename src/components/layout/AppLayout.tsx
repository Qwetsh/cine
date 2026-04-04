import { Outlet } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { Header } from './Header'

export function AppLayout() {
  return (
    <div className="flex flex-col min-h-dvh bg-[var(--color-bg)]">
      <Header />
      <main className="flex-1 pb-20 overflow-x-hidden">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
