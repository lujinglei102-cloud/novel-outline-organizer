import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

/**
 * PWA 更新提示组件
 * 当 Service Worker 检测到新版本时，弹出一个底部横幅
 * 用户可以选择「立即刷新」或「稍后再说」
 */
export function PWAUpdatePrompt() {
  // 仅在生产环境启用（dev 下 devOptions.enabled=false，不会触发）
  const [show, setShow] = useState(false)

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error) {
      console.warn('[PWA] Service Worker 注册失败：', error)
    },
    onRegisteredSW(swUrl, registration) {
      console.log('[PWA] Service Worker 已注册：', swUrl)
      if (registration) {
        // 每小时检查一次更新
        setInterval(() => {
          registration.update().catch((e) => console.warn('[PWA] 更新检查失败：', e))
        }, 60 * 60 * 1000)
      }
    },
  })

  useEffect(() => {
    setShow(needRefresh || offlineReady)
  }, [needRefresh, offlineReady])

  if (!show) return null

  const isUpdate = needRefresh
  const message = isUpdate ? '发现新版本，刷新即可使用最新功能' : '应用已可离线使用'
  const btnText = isUpdate ? '立即刷新' : '知道了'

  const handleClose = async () => {
    if (isUpdate) {
      await updateServiceWorker(true)
    } else {
      setOfflineReady(false)
    }
    setShow(false)
  }

  const onDismiss = () => {
    setNeedRefresh(false)
    setOfflineReady(false)
    setShow(false)
  }

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="PWA 更新提示"
      style={{
        position: 'fixed',
        left: '50%',
        bottom: '20px',
        transform: 'translateX(-50%)',
        zIndex: 100,
        maxWidth: 'calc(100vw - 32px)',
        width: 380,
        background: 'rgb(26 26 46 / 0.95)',
        color: '#fff',
        padding: 14,
        borderRadius: 8,
        boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
        border: '1px solid rgba(167, 139, 250, 0.4)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <span aria-hidden="true" style={{ fontSize: 18 }}>
          {isUpdate ? '🔄' : '✅'}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{message}</div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button
              onClick={onDismiss}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.3)',
                color: '#fff',
                padding: '4px 12px',
                borderRadius: 4,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              稍后
            </button>
            <button
              onClick={handleClose}
              style={{
                background: 'linear-gradient(135deg, #a78bfa, #ec4899)',
                border: 'none',
                color: '#fff',
                padding: '4px 12px',
                borderRadius: 4,
                fontSize: 12,
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              {btnText}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
