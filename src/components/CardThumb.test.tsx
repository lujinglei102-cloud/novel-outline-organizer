import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { CardThumb } from '@/components/CardThumb'
import type { Card } from '@/types'

const baseCard: Card = {
  id: 'c1',
  title: '初遇场景',
  content: '这是一条灵感卡片内容，用于测试缩略显示',
  createdAt: Date.now() - 60000,
  updatedAt: Date.now() - 60000,
  stage: 'mid',
}

describe('CardThumb', () => {
  it('渲染卡片标题', () => {
    render(<CardThumb card={baseCard} />)
    expect(screen.getByText('初遇场景')).toBeInTheDocument()
  })

  it('正文截断显示', () => {
    render(<CardThumb card={baseCard} />)
    expect(screen.getByText(/这是一条灵感卡片内容/)).toBeInTheDocument()
  })

  it('无正文时只显示标题', () => {
    render(<CardThumb card={{ ...baseCard, content: '' }} />)
    expect(screen.getByText('初遇场景')).toBeInTheDocument()
    expect(screen.queryByText(/这是一条灵感/)).not.toBeInTheDocument()
  })

  it('显示阶段标签', () => {
    render(<CardThumb card={baseCard} />)
    expect(screen.getByText('[中期]')).toBeInTheDocument()
  })

  it('显示角色标签', () => {
    render(<CardThumb card={baseCard} characterName="沈知行" />)
    expect(screen.getByText('#沈知行')).toBeInTheDocument()
  })

  it('点击触发回调', () => {
    const onClick = vi.fn()
    render(<CardThumb card={baseCard} onClick={onClick} />)
    fireEvent.click(screen.getByTestId('card-thumb'))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('双击触发回调', () => {
    const onDoubleClick = vi.fn()
    render(<CardThumb card={baseCard} onDoubleClick={onDoubleClick} />)
    fireEvent.doubleClick(screen.getByTestId('card-thumb'))
    expect(onDoubleClick).toHaveBeenCalledOnce()
  })

  it('未分类不显示阶段标签', () => {
    render(<CardThumb card={{ ...baseCard, stage: 'none' }} />)
    expect(screen.queryByText(/\[/)).not.toBeInTheDocument()
  })
})
