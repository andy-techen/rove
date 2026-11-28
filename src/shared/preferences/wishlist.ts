import { SONG_NAME_MAX_LENGTH, SONG_NOTE_MAX_LENGTH } from '../constants'

// Songs the singer wants to try later, kept in userData/wishlist.json. Unlike songs,
// a wishlist item has no folder until the singer starts it.

export interface WishlistItem {
  id: string
  name: string
  artist?: string
  /** The singer's own reminder: what to practise, the key, who it's for. */
  note?: string
  addedAt: number
}

export const WISHLIST_CHANNELS = {
  list: 'wishlist:list',
  add: 'wishlist:add',
  remove: 'wishlist:remove',
  update: 'wishlist:update'
} as const

/** A name or artist as stored: trimmed and capped, or '' when there's nothing usable. */
export function cleanText(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().slice(0, SONG_NAME_MAX_LENGTH) : ''
}

/** A song or wishlist note as stored: trimmed and capped, or '' when there's nothing usable. */
export function cleanNote(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().slice(0, SONG_NOTE_MAX_LENGTH) : ''
}

/** The stored wishlist, keeping only well-formed items. */
export function parseWishlist(raw: unknown): WishlistItem[] {
  if (!Array.isArray(raw)) return []
  const items: WishlistItem[] = []
  for (const entry of raw) {
    const e = entry as Partial<WishlistItem> | null
    const name = cleanText(e?.name)
    if (!e || typeof e.id !== 'string' || !e.id || !name) continue
    const artist = cleanText(e.artist)
    const note = cleanNote(e.note)
    items.push({
      id: e.id,
      name,
      ...(artist && { artist }),
      ...(note && { note }),
      addedAt: typeof e.addedAt === 'number' ? e.addedAt : 0
    })
  }
  return items
}
