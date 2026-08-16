import { create } from 'zustand'
import type { Card, Stage } from '@/types'
import { getAllCards, addCard, updateCard, deleteCard } from '@/db/cardRepo'

interface CardState {
  cards: Card[]
  loading: boolean
  filterCharacterId: string | null
  filterBookId: string | null
  loadAll: () => Promise<void>
  create: (input: { title: string; content: string; bookId?: string; characterId?: string; stage?: Stage; emotion?: number; intensity?: number; emotionManual?: boolean; isForeshadow?: boolean }) => Promise<Card>
  edit: (
    id: string,
    patch: Partial<Pick<Card, 'title' | 'content' | 'bookId' | 'characterId' | 'stage' | 'emotion' | 'intensity' | 'emotionManual' | 'order' | 'isForeshadow'>>,
  ) => Promise<void>
  remove: (id: string) => Promise<void>
  setFilter: (characterId: string | null) => void
  setBookFilter: (bookId: string | null) => void
  visibleCards: () => Card[]
}

export const useCardStore = create<CardState>((set, get) => ({
  cards: [],
  loading: false,
  filterCharacterId: null,
  filterBookId: null,
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
  setBookFilter: (bookId) => set({ filterBookId: bookId }),
  visibleCards: () => {
    const { cards, filterCharacterId, filterBookId } = get()
    let filtered = cards
    if (filterBookId) {
      filtered = filtered.filter((c) => c.bookId === filterBookId)
    }
    if (filterCharacterId) {
      filtered = filtered.filter((c) => c.characterId === filterCharacterId)
    }
    return [...filtered].sort((a, b) => b.createdAt - a.createdAt)
  },
}))
