import { create } from 'zustand'
import type { Book } from '@/types'
import { getAllBooks, addBook, updateBook, deleteBook } from '@/db/bookRepo'

interface BookState {
  books: Book[]
  currentBookId: string | null
  loading: boolean
  loadAll: () => Promise<void>
  create: (title: string) => Promise<Book>
  rename: (id: string, title: string) => Promise<void>
  remove: (id: string) => Promise<void>
  setCurrent: (bookId: string | null) => void
}

export const useBookStore = create<BookState>((set, get) => ({
  books: [],
  currentBookId: null,
  loading: false,
  loadAll: async () => {
    set({ loading: true })
    const books = await getAllBooks()
    set({ books, loading: false })
  },
  create: async (title) => {
    const book = await addBook(title)
    set({ books: [...get().books, book] })
    return book
  },
  rename: async (id, title) => {
    await updateBook(id, title)
    set({
      books: get().books.map((b) => (b.id === id ? { ...b, title, updatedAt: Date.now() } : b)),
    })
  },
  remove: async (id) => {
    await deleteBook(id)
    set({ books: get().books.filter((b) => b.id !== id) })
  },
  setCurrent: (bookId) => set({ currentBookId: bookId }),
}))
