import { db } from './database'
import type { Link } from '@/types'

export async function getAllLinks(): Promise<Link[]> {
  return db.links.orderBy('id').toArray()
}

export async function putLinks(list: Link[]): Promise<void> {
  await db.transaction('rw', db.links, async () => {
    await db.links.clear()
    await db.links.bulkPut(list)
  })
}

export async function toggleLinkConfirmed(id: string): Promise<void> {
  const row = await db.links.get(id)
  if (!row) return
  await db.links.update(id, { confirmed: !row.confirmed })
}

export async function toggleLinkHidden(id: string): Promise<void> {
  const row = await db.links.get(id)
  if (!row) return
  await db.links.update(id, { hidden: !row.hidden })
}

export async function toggleLinkResolved(id: string): Promise<void> {
  const row = await db.links.get(id)
  if (!row) return
  await db.links.update(id, { resolved: !row.resolved })
}
