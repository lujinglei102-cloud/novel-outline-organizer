import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Navbar } from '@/components/Navbar'
import { OfflineBanner } from '@/components/OfflineBanner'
import { PWAUpdatePrompt } from '@/components/PWAUpdatePrompt'
import { CardsPage } from '@/routes/CardsPage'
import { SortPage } from '@/routes/SortPage'
import { OutlinePage } from '@/routes/OutlinePage'
import { ExportPage } from '@/routes/ExportPage'

// HashRouter 使用 URL hash（#/cards）进行路由，与 Vite base path 无关。
// basename 必须是 '/'，否则生产环境下会变成 /novel-outline-organizer/cards 导致路由不匹配、页面空白。
export default function App() {
  return (
    <HashRouter basename="/">
      <div className="relative z-10 text-ink-800" style={{ minHeight: '100dvh' }}>
        <OfflineBanner />
        <Navbar />
        <main className="mx-auto max-w-6xl px-4 py-4">
          <Routes>
            <Route path="/" element={<Navigate to="/cards" replace />} />
            <Route path="/cards" element={<CardsPage />} />
            <Route path="/sort" element={<SortPage />} />
            <Route path="/outline" element={<OutlinePage />} />
            <Route path="/export" element={<ExportPage />} />
            <Route
              path="*"
              element={
                <div className="p-10 text-center text-sm text-ink-500">
                  页面不存在，<a className="underline" href="#/cards">返回首页</a>
                </div>
              }
            />
          </Routes>
        </main>
        <PWAUpdatePrompt />
      </div>
    </HashRouter>
  )
}
