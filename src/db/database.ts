import Dexie, { Table } from 'dexie'
import type { Card, Character, Link, Chapter, Book } from '@/types'

export class AppDatabase extends Dexie {
  books!: Table<Book, string>
  cards!: Table<Card, string>
  characters!: Table<Character, string>
  links!: Table<Link, string>
  chapters!: Table<Chapter, string>

  constructor() {
    super('novel-outline-db')
    this.version(1).stores({
      cards: 'id, createdAt, characterId, stage, order',
      characters: 'id, name, mentionCount',
      links: 'id, cardAId, cardBId, confirmed, hidden',
      chapters: 'id, index, nodeId',
    })
    this.version(2).stores({
      books: 'id, title, createdAt',
      cards: 'id, createdAt, characterId, stage, order, bookId',
      characters: 'id, name, mentionCount',
      links: 'id, cardAId, cardBId, confirmed, hidden',
      chapters: 'id, index, nodeId',
    })
  }
}

// 测试时可注入内存版；生产用持久化实例
export let db: AppDatabase = new AppDatabase()

export function setDatabase(instance: AppDatabase) {
  db = instance
}
