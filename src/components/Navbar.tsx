import { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useCardStore } from '@/stores/cardStore'

const stages = [
  { to: '/cards', label: '阶段一 · 灵感卡片' },
  { to: '/sort', label: '阶段二 · 一键梳理' },
  { to: '/outline', label: '阶段三 · 骨架章节' },
  { to: '/export', label: '导出' },
]

export function Navbar() {
  const navigate = useNavigate()
  const cardsCount = useCardStore((s) => s.cards.length)
  const [isLight, setIsLight] = useState(false)

  useEffect(() => {
    setIsLight(document.documentElement.classList.contains('light-mode'))
  }, [])

  const toggleTheme = () => {
    const root = document.documentElement
    const next = !root.classList.contains('light-mode')
    if (next) {
      root.classList.add('light-mode')
      localStorage.setItem('theme-mode', 'light')
    } else {
      root.classList.remove('light-mode')
      localStorage.setItem('theme-mode', 'dark')
    }
    setIsLight(next)
  }

  return (
    <header className="border-b border-ink-300 cyber-surface">
      <div className="mx-auto flex h-14 max-w-6xl flex-wrap items-center justify-between gap-2 px-4">
        <div className="flex items-center gap-6">
          <button
            onClick={() => navigate('/cards')}
            className="text-sm font-bold font-cute text-ink-800 hover:text-ink-600 neon-text"
          >
            小说大纲梳理器
          </button>
          <nav className="hidden gap-3 sm:flex">
            {stages.map((s) => (
              <NavLink
                key={s.to}
                to={s.to}
                className={({ isActive }) =>
                  `text-sm ${isActive ? 'text-ink-900 font-semibold' : 'text-ink-500 hover:text-ink-800'}`
                }
              >
                {s.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-ink-400">
            {cardsCount > 0 ? `卡片数：${cardsCount}` : '欢迎创作 · 记录第一个灵感'}
          </span>
          {/* 主题切换按钮 */}
          <button
            onClick={toggleTheme}
            className="rounded border border-ink-300 px-2 py-1 text-sm hover:bg-ink-200/50"
            title={isLight ? '切换到深色模式' : '切换到浅色模式'}
          >
            {isLight ? '🌙' : '☀️'}
          </button>
        </div>
      </div>
      {/* 移动端底部 tabbar（隐藏在桌面端） */}
      <div className="flex gap-1 border-t border-ink-200 cyber-surface px-2 py-1 sm:hidden">
        {stages.map((s) => (
          <NavLink
            key={s.to}
            to={s.to}
            className={({ isActive }) =>
              `flex-1 rounded px-2 py-1 text-center text-[11px] ${
                isActive ? 'cyber-tab-active' : 'text-ink-400'
              }`
            }
          >
            {s.label.split(' · ')[0]}
          </NavLink>
        ))}
      </div>
    </header>
  )
}
