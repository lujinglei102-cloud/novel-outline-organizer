import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { CardEditModal } from '@/components/CardEditModal'

describe('CardEditModal', () => {
  it('新建模式显示标题和空输入', () => {
    render(<CardEditModal onSave={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText('新建灵感卡片')).toBeInTheDocument()
    expect(screen.getByTestId('card-title-input')).toHaveValue('')
    expect(screen.getByTestId('card-content-input')).toHaveValue('')
  })

  it('编辑模式回填初始标题和正文', () => {
    render(
      <CardEditModal
        initial={{
          id: 'c1',
          title: '已有标题',
          content: '已有正文',
          createdAt: 0,
          updatedAt: 0,
          stage: 'pre',
        }}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    )
    expect(screen.getByText('编辑灵感卡片')).toBeInTheDocument()
    expect(screen.getByTestId('card-title-input')).toHaveValue('已有标题')
    expect(screen.getByTestId('card-content-input')).toHaveValue('已有正文')
  })

  it('空标题时保存按钮禁用', () => {
    render(<CardEditModal onSave={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByTestId('card-save-btn')).toBeDisabled()
  })

  it('输入标题后保存按钮可用', () => {
    render(<CardEditModal onSave={vi.fn()} onCancel={vi.fn()} />)
    fireEvent.change(screen.getByTestId('card-title-input'), { target: { value: '新标题' } })
    expect(screen.getByTestId('card-save-btn')).not.toBeDisabled()
  })

  it('保存时回调返回标题和正文', () => {
    const onSave = vi.fn()
    render(<CardEditModal onSave={onSave} onCancel={vi.fn()} />)
    fireEvent.change(screen.getByTestId('card-title-input'), { target: { value: '测试标题' } })
    fireEvent.change(screen.getByTestId('card-content-input'), { target: { value: '测试正文' } })
    fireEvent.click(screen.getByTestId('card-save-btn'))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ title: '测试标题', content: '测试正文' }))
  })

  it('标题超过100字被截断', () => {
    render(<CardEditModal onSave={vi.fn()} onCancel={vi.fn()} />)
    const long = 'a'.repeat(120)
    fireEvent.change(screen.getByTestId('card-title-input'), { target: { value: long } })
    expect(screen.getByTestId('card-title-input')).toHaveValue('a'.repeat(100))
  })

  it('正文超过500字被截断', () => {
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
