import { app, ipcMain } from 'electron'
import { randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { t } from '@shared/copy'
import {
  WISHLIST_CHANNELS,
  WishlistItem,
  cleanNote,
  cleanText,
  parseWishlist
} from '@shared/wishlist'

const wishlistFile = (): string => path.join(app.getPath('userData'), 'wishlist.json')

async function load(): Promise<WishlistItem[]> {
  try {
    return parseWishlist(JSON.parse(await fs.readFile(wishlistFile(), 'utf8')))
  } catch {
    // No file yet, or one we can't read: start empty.
    return []
  }
}

async function save(items: WishlistItem[]): Promise<void> {
  const tmp = `${wishlistFile()}.tmp`
  await fs.writeFile(tmp, JSON.stringify(items, null, 2))
  await fs.rename(tmp, wishlistFile())
}

/** Newest first, as the Songbook shows them. */
const newestFirst = (items: WishlistItem[]): WishlistItem[] =>
  [...items].sort((a, b) => b.addedAt - a.addedAt)

/** An item with this name, and the artist and note only when they aren't blank. */
function withDetails(
  base: Pick<WishlistItem, 'id' | 'addedAt'>,
  name: string,
  artist: unknown,
  note: unknown
): WishlistItem {
  const cleanArtist = cleanText(artist)
  const cleanedNote = cleanNote(note)
  return {
    id: base.id,
    name,
    ...(cleanArtist && { artist: cleanArtist }),
    ...(cleanedNote && { note: cleanedNote }),
    addedAt: base.addedAt
  }
}

export function registerWishlistIpc(): void {
  ipcMain.handle(WISHLIST_CHANNELS.list, async () => newestFirst(await load()))

  ipcMain.handle(
    WISHLIST_CHANNELS.add,
    async (_e, name: unknown, artist: unknown, note: unknown) => {
      const cleanName = cleanText(name)
      if (!cleanName) throw new Error(t('dialogs.songNameNeeded'))
      const item = withDetails({ id: randomUUID(), addedAt: Date.now() }, cleanName, artist, note)
      const items = [...(await load()), item]
      await save(items)
      return newestFirst(items)
    }
  )

  ipcMain.handle(WISHLIST_CHANNELS.remove, async (_e, id: unknown) => {
    const items = (await load()).filter((item) => item.id !== id)
    await save(items)
    return newestFirst(items)
  })

  ipcMain.handle(
    WISHLIST_CHANNELS.update,
    async (_e, id: unknown, name: unknown, artist: unknown, note: unknown) => {
      const cleanName = cleanText(name)
      if (!cleanName) throw new Error(t('dialogs.songNameNeeded'))
      const items = (await load()).map((item) =>
        item.id === id ? withDetails(item, cleanName, artist, note) : item
      )
      await save(items)
      return newestFirst(items)
    }
  )
}
