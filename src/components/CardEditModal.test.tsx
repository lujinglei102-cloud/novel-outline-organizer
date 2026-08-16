import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { CardEditModal } from '@/components/CardEditModal'

describe('CardEditModal', () => {
  it('新建模式显示标题和空内容', () => {
    render(<CardEditModal onSave={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText('新建灵感卡片')).toBeInTheDocument()
    expect(screen.getByTestId('card-content-input')).toHaveValue('')
  })

  it('编辑模式回填初始内容', () => {
    render(
      <CardEditModal
        initial={{
          id: 'c1',
          content: '已有内容',
          createdAt: 0,
          updatedAt: 0,
          stage: 'pre',
        }}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    expect(screen.getByText('编辑灵感卡片')).toBeInTheDocument()
    expect(screen.getByTestId('card-content-input')).toHaveValue('已有内容')
  })

  it('空内容时保存按钮禁用', () => {
    render(<CardEditModal onSave={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByTestId('card-save-btn')).toBeDisabled()
  })

  it('输入内容后保存按钮可用', () => {
    render(<CardEditModal onSave={vi.fn()} onCancel={vi.fn()} />)
    fireEvent.change(screen.getByTestId('card-content-input'), { target: { value: '新灵感' } })
    expect(screen.getByTestId('card-save-btn')).not.toBeDisabled()
  })

  it('保存时回调返回输入内容', () => {
    const onSave = vi.fn()
    render(<CardEditModal onSave={onSave} onCancel={vi.fn()} />)
    fireEvent.change(screen.getByTestId('card-content-input'), { target: { value: '测试灵感' } })
    fireEvent.click(screen.getByTestId('card-save-btn'))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ content: '测试灵感' }))
  })

  it('内容超过500字被截断', () => {
    render(<CardEditModal onSave={vi.fn()} onCancel={vi.fn()} />)
    const long = 'a'.repeat(600)
    fireEvent.change(screen.getByTestId('card-content-input'), { target: { value: long } })
    expect(screen.getByTestId('card-content-input')).toHaveValue('a'.repeat(500))
  })

  it('点遮罩触发取消', () => {
    const onCancel = vi.fn()
    render(<CardEditModal onSave={vi.fn()} onCancel={onCancel} />)
    fireEvent.click(screen.getByTestId('card-edit-modal'))
    expect(onCancel).toHaveBeenCalledOnce()
  })
})
