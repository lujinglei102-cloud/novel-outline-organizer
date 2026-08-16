import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Navbar } from '@/components/Navbar'
import { CardsPage } from '@/routes/CardsPage'
import { SortPage } from '@/routes/SortPage'
import { OutlinePage } from '@/routes/OutlinePage'
import { ExportPage } from '@/routes/ExportPage'

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-white text-ink-900">
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
                  页面不存在，<a className="underline" href="/cards">返回首页</a>
                </div>
              }
            />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
