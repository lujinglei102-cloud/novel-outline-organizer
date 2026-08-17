import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { OfflineBanner } from '@/components/OfflineBanner'

describe('OfflineBanner - PRD 12.1 离线提示', () => {
  const originalOnLine = Object.getOwnPropertyDescriptor(navigator, 'onLine')

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    if (originalOnLine) {
      Object.defineProperty(navigator, 'onLine', originalOnLine)
    }
  })

  it('在线时不显示横幅', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
    const { container } = render(<OfflineBanner />)
    expect(container.firstChild).toBeNull()
  })

  it('离线时显示「当前离线，数据保存在本地」横幅', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    render(<OfflineBanner />)
    expect(screen.getByText(/当前离线/)).toBeInTheDocument()
    expect(screen.getByText(/数据保存在本地/)).toBeInTheDocument()
  })

  it('在线状态变化时横幅动态显示/隐藏', () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
    const { container } = render(<OfflineBanner />)
    expect(container.firstChild).toBeNull()

    // 触发 offline 事件
    act(() => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
      window.dispatchEvent(new Event('offline'))
      vi.advanceTimersByTime(0)
    })
    expect(screen.getByText(/当前离线/)).toBeInTheDocument()

    // 触发 online 事件
    act(() => {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true })
      window.dispatchEvent(new Event('online'))
      vi.advanceTimersByTime(0)
    })
    expect(screen.queryByText(/当前离线/)).not.toBeInTheDocument()
  })

  it('离线横幅具有合适的无障碍属性', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true })
    render(<OfflineBanner />)
    const banner = screen.getByRole('status')
    expect(banner).toHaveAttribute('aria-live', 'polite')
  })
})
