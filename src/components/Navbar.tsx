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
  return (
    <header className="border-b border-ink-300 cyber-surface">
      <div className="mx-auto flex h-14 max-w-6xl flex-wrap items-center justify-between gap-2 px-4">
        <div className="flex items-center gap-6">
          <button
            onClick={() => navigate('/cards')}
            className="text-base font-bold text-ink-900 hover:text-ink-700 neon-text"
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
        <div className="text-xs text-ink-400">
          {cardsCount > 0 ? `卡片数：${cardsCount}` : '欢迎创作 · 记录第一个灵感'}
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
