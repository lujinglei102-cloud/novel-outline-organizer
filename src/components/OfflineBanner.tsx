import { useEffect, useState } from 'react'

/**
 * 离线提示横幅
 * PRD 12.1: 网络离线时顶部导航栏出现灰色条「当前离线，数据保存在本地」
 */
export function OfflineBanner() {
  const [online, setOnline] = useState<boolean>(navigator.onLine)

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  if (online) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="offline-banner"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 60,
        background: 'rgb(107 114 128 / 0.95)',
        color: '#fff',
        fontSize: '12px',
        padding: '6px 12px',
        textAlign: 'center',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
      }}
    >
      <span aria-hidden="true" style={{ marginRight: 6 }}>⚠️</span>
      当前离线，数据保存在本地
    </div>
  )
}
