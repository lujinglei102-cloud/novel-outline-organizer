import { db } from './database'
import type { Chapter } from '@/types'
import { genId } from './cardRepo'

export async function getAllChapters(): Promise<Chapter[]> {
  return db.chapters.orderBy('index').toArray()
}

export async function putChapters(list: Chapter[]): Promise<void> {
  await db.transaction('rw', db.chapters, async () => {
    await db.chapters.clear()
    await db.chapters.bulkPut(list)
  })
}

export async function addChapter(init: Omit<Chapter, 'id'>): Promise<Chapter> {
  const ch: Chapter = { id: genId(), ...init }
  await db.chapters.put(ch)
  return ch
}

export async function updateChapter(
  id: string,
  patch: Partial<Pick<Chapter, 'title' | 'conflict' | 'cardIds' | 'nodeId' | 'index'>>,
): Promise<void> {
  await db.chapters.update(id, patch as any)
}

export async function deleteChapter(id: string): Promise<void> {
  await db.chapters.delete(id)
}
