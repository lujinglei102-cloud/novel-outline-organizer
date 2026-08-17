import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Navbar } from '@/components/Navbar'
import { CardsPage } from '@/routes/CardsPage'
import { SortPage } from '@/routes/SortPage'
import { OutlinePage } from '@/routes/OutlinePage'
import { ExportPage } from '@/routes/ExportPage'

// 开发模式下 base=/，生产模式下 base=/novel-outline-organizer/
// HashRouter 的 basename 不需要尾部斜杠
const basename = import.meta.env.BASE_URL.replace(/\/$/, '')

export default function App() {
  return (
    <HashRouter basename={basename || '/'}>
      <div className="min-h-screen relative z-10 text-ink-800">
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
      </div>
    </HashRouter>
  )
}
