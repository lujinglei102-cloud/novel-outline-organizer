import { render, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EmotionCurve } from '@/components/EmotionCurve'

// 把 spy 放到 hoisted 里，保证 vi.mock 工厂能访问到
const spies = vi.hoisted(() => ({
  init: vi.fn(),
  setOption: vi.fn(),
  on: vi.fn(),
  resize: vi.fn(),
  dispose: vi.fn(),
}))

vi.mock('echarts', async (importOriginal) => {
  const actual = (await importOriginal()) as typeof import('echarts')
  return {
    ...actual,
    init: (...args: any[]) => {
      spies.init(...args)
      return {
        on: spies.on,
        setOption: spies.setOption,
        resize: spies.resize,
        dispose: spies.dispose,
      }
    },
  }
})

const initSpy = spies.init
const setOptionSpy = spies.setOption
const onSpy = spies.on
const resizeSpy = spies.resize
const disposeSpy = spies.dispose

// 控制 rAF：默认同步执行回调
let rafCallbacks: (() => void)[] = []
beforeEach(() => {
  rafCallbacks = []
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((cb: () => void) => {
      rafCallbacks.push(cb)
      return rafCallbacks.length
    }),
  )
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  initSpy.mockClear()
  setOptionSpy.mockClear()
  onSpy.mockClear()
  resizeSpy.mockClear()
  disposeSpy.mockClear()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function flushRaf() {
  const cbs = rafCallbacks.slice()
  rafCallbacks = []
  cbs.forEach((cb) => cb())
}

describe('EmotionCurve - 节流', () => {
  it('初始渲染时通过 rAF 调度一次 setOption', () => {
    render(
      <EmotionCurve
        xLabels={['a', 'b', 'c']}
        values={[1, 2, 3]}
        conflictValues={[1, 2, 3]}
      />,
    )
    // rAF 应被调度一次
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1)
    // 在 rAF 触发前 setOption 不应被调用
    expect(setOptionSpy).not.toHaveBeenCalled()
    // flush rAF 后 setOption 应被调用一次
    flushRaf()
    expect(setOptionSpy).toHaveBeenCalledTimes(1)
  })

  it('组件卸载时取消 pending rAF 并 dispose 图表', () => {
    const { unmount } = render(
      <EmotionCurve xLabels={['a']} values={[1]} />,
    )
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1)
    unmount()
    // 卸载应取消 rAF
    expect(cancelAnimationFrame).toHaveBeenCalled()
    // 卸载应 dispose 图表实例
    expect(disposeSpy).toHaveBeenCalledTimes(1)
  })

  it('同一帧内多次 prop 变更只触发一次 setOption', () => {
    const { rerender } = render(
      <EmotionCurve xLabels={['a']} values={[1]} />,
    )
    // 第一次渲染调度一次 rAF（还未 flush）
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1)
    // 在 rAF 未触发前再次更新 props：由于已有 pending，不应再调度新 rAF
    rerender(<EmotionCurve xLabels={['a']} values={[2]} />)
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1)
    rerender(<EmotionCurve xLabels={['a']} values={[3]} />)
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1)
    // flush rAF：setOption 只被调用一次，且使用的是最新值（3）
    flushRaf()
    expect(setOptionSpy).toHaveBeenCalledTimes(1)
    const option = setOptionSpy.mock.calls[0][0]
    expect(option.series[0].data).toEqual([3])
  })
})
