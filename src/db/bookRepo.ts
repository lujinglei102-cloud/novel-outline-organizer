import { db } from './database'
import type { Book } from '@/types'

export function genBookId(): string {
  return `book-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

export async function getAllBooks(): Promise<Book[]> {
  return db.books.toArray()
}

export async function addBook(title: string): Promise<Book> {
  const now = Date.now()
  const book: Book = {
    id: genBookId(),
    title: title.slice(0, 200),
    createdAt: now,
    updatedAt: now,
  }
  await db.books.put(book)
  return book
}

export async function updateBook(id: string, title: string): Promise<void> {
  await db.books.update(id, { title: title.slice(0, 200), updatedAt: Date.now() })
}

export async function deleteBook(id: string): Promise<void> {
  await db.books.delete(id)
}

export async function getBook(id: string): Promise<Book | undefined> {
  return db.books.get(id)
}
