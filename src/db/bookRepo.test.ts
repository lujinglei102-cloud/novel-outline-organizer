import 'fake-indexeddb/auto'
import { beforeEach, describe, it, expect } from 'vitest'
import { AppDatabase, setDatabase } from '@/db/database'
import { getAllBooks, addBook, updateBook, deleteBook, getBook } from '@/db/bookRepo'
import { addCard, getAllCards } from '@/db/cardRepo'

let db: AppDatabase

beforeEach(async () => {
  db = new AppDatabase()
  setDatabase(db)
  await db.books.clear()
  await db.cards.clear()
})

describe('bookRepo', () => {
  it('新增书籍并读取', async () => {
    const book = await addBook('追妻火葬场')
    expect(book.id).toBeTruthy()
    expect(book.title).toBe('追妻火葬场')
    const all = await getAllBooks()
    expect(all).toHaveLength(1)
    expect(all[0].id).toBe(book.id)
  })

  it('更新书名', async () => {
    const book = await addBook('原名')
    await updateBook(book.id, '新名')
    const got = await getBook(book.id)
    expect(got?.title).toBe('新名')
  })

  it('删除书籍', async () => {
    const book = await addBook('待删')
    await deleteBook(book.id)
    const all = await getAllBooks()
    expect(all).toHaveLength(0)
  })

  it('卡片可以关联书籍', async () => {
    const book = await addBook('我的小说')
    const card = await addCard({ title: '灵感1', content: '内容', bookId: book.id })
    expect(card.bookId).toBe(book.id)
    const allCards = await getAllCards()
    expect(allCards[0].bookId).toBe(book.id)
  })

  it('不关联书籍的卡片 bookId 为 undefined', async () => {
    const card = await addCard({ title: '无书', content: '内容' })
    expect(card.bookId).toBeUndefined()
  })
})
