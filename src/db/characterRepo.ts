import { db } from './database'
import type { Character } from '@/types'

export async function getAllCharacters(): Promise<Character[]> {
  return db.characters.orderBy('mentionCount').reverse().toArray()
}

export async function putCharacters(list: Character[]): Promise<void> {
  await db.transaction('rw', db.characters, async () => {
    await db.characters.clear()
    await db.characters.bulkPut(list)
  })
}

export async function updateCharacter(
  id: string,
  patch: Partial<Pick<Character, 'name' | 'representativeDesc' | 'conflictTag'>>,
): Promise<void> {
  await db.characters.update(id, patch as any)
}
