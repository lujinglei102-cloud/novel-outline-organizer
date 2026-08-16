import { db } from './database'
import type { Card, Stage } from '@/types'

export function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export async function getAllCards(): Promise<Card[]> {
  return db.cards.toArray()
}

export async function addCard(input: {
  title: string
  content: string
  characterId?: string
  stage?: Stage
}): Promise<Card> {
  const now = Date.now()
  const card: Card = {
    id: genId(),
    title: input.title.slice(0, 100),
    content: input.content.slice(0, 500),
    createdAt: now,
    updatedAt: now,
    characterId: input.characterId,
    stage: input.stage ?? 'none',
    emotion: 0,
    intensity: 1,
  }
  await db.cards.put(card)
  return card
}

export async function updateCard(
  id: string,
  patch: Partial<Pick<Card, 'title' | 'content' | 'characterId' | 'stage' | 'emotion' | 'intensity' | 'order'>>,
): Promise<void> {
  const update: Record<string, unknown> = { updatedAt: Date.now() }
  if (patch.title !== undefined) update.title = patch.title.slice(0, 100)
  if (patch.content !== undefined) update.content = patch.content.slice(0, 500)
  if (patch.characterId !== undefined) update.characterId = patch.characterId
  if (patch.stage !== undefined) update.stage = patch.stage
  if (patch.emotion !== undefined) update.emotion = patch.emotion
  if (patch.intensity !== undefined) update.intensity = patch.intensity
  if (patch.order !== undefined) update.order = patch.order
  await db.cards.update(id, update)
}

export async function deleteCard(id: string): Promise<void> {
  await db.cards.delete(id)
}

export async function getCard(id: string): Promise<Card | undefined> {
  return db.cards.get(id)
}
