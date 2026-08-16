import { create } from 'zustand'
import type { Card, Stage } from '@/types'
import { getAllCards, addCard, updateCard, deleteCard } from '@/db/cardRepo'

interface CardState {
  cards: Card[]
  loading: boolean
  filterCharacterId: string | null
  loadAll: () => Promise<void>
  create: (input: { content: string; characterId?: string; stage?: Stage }) => Promise<Card>
  edit: (
    id: string,
    patch: Partial<Pick<Card, 'content' | 'characterId' | 'stage' | 'emotion' | 'intensity' | 'order'>>,
  ) => Promise<void>
  remove: (id: string) => Promise<void>
  setFilter: (characterId: string | null) => void
  visibleCards: () => Card[]
}

export const useCardStore = create<CardState>((set, get) => ({
  cards: [],
  loading: false,
  filterCharacterId: null,
  loadAll: async () => {
    set({ loading: true })
    const cards = await getAllCards()
    set({ cards, loading: false })
  },
  create: async (input) => {
    const card = await addCard(input)
    set({ cards: [card, ...get().cards] })
    return card
  },
  edit: async (id, patch) => {
    await updateCard(id, patch)
    set({
      cards: get().cards.map((c) => (c.id === id ? { ...c, ...patch, updatedAt: Date.now() } : c)),
    })
  },
  remove: async (id) => {
    await deleteCard(id)
    set({ cards: get().cards.filter((c) => c.id !== id) })
  },
  setFilter: (characterId) => set({ filterCharacterId: characterId }),
  visibleCards: () => {
    const { cards, filterCharacterId } = get()
    const filtered = filterCharacterId
      ? cards.filter((c) => c.characterId === filterCharacterId)
      : cards
    return [...filtered].sort((a, b) => b.createdAt - a.createdAt)
  },
}))
