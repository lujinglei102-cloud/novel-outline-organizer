import 'fake-indexeddb/auto'
import { beforeEach, describe, it, expect } from 'vitest'
import { AppDatabase, setDatabase } from '@/db/database'
import { useBookStore } from '@/stores/bookStore'
import { useCardStore } from '@/stores/cardStore'

beforeEach(async () => {
  const db = new AppDatabase()
  setDatabase(db)
  await db.books.clear()
  await db.cards.clear()
  useBookStore.setState({ books: [], currentBookId: null })
  useCardStore.setState({ cards: [], filterCharacterId: null, filterBookId: null })
})

describe('bookStore', () => {
  it('create 后书籍列表包含新书', async () => {
    const book = await useBookStore.getState().create('新书A')
    expect(useBookStore.getState().books).toHaveLength(1)
    expect(useBookStore.getState().books[0].title).toBe('新书A')
    expect(book.title).toBe('新书A')
  })

  it('rename 更新书名', async () => {
    const book = await useBookStore.getState().create('原名')
    await useBookStore.getState().rename(book.id, '改后')
    expect(useBookStore.getState().books[0].title).toBe('改后')
  })

  it('remove 删除书籍', async () => {
    const book = await useBookStore.getState().create('待删')
    await useBookStore.getState().remove(book.id)
    expect(useBookStore.getState().books).toHaveLength(0)
  })

  it('setCurrent 设置当前书籍', async () => {
    const book = await useBookStore.getState().create('当前')
    useBookStore.getState().setCurrent(book.id)
    expect(useBookStore.getState().currentBookId).toBe(book.id)
  })

  it('loadAll 从 DB 读取持久化数据', async () => {
    await useBookStore.getState().create('持久化书籍')
    useBookStore.setState({ books: [] })
    await useBookStore.getState().loadAll()
    expect(useBookStore.getState().books).toHaveLength(1)
    expect(useBookStore.getState().books[0].title).toBe('持久化书籍')
  })

  it('cardStore 的 bookFilter 正确过滤', async () => {
    const book1 = await useBookStore.getState().create('书1')
    const book2 = await useBookStore.getState().create('书2')
    await useCardStore.getState().create({ title: '卡A', content: 'A', bookId: book1.id })
    await useCardStore.getState().create({ title: '卡B', content: 'B', bookId: book2.id })
    useCardStore.getState().setBookFilter(book1.id)
    const visible = useCardStore.getState().visibleCards()
    expect(visible).toHaveLength(1)
    expect(visible[0].title).toBe('卡A')
  })
})
