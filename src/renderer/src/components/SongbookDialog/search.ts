/** Whether a song or wishlist item matches what the singer typed: name or artist, any case. */
export function matchesSearch(item: { name: string; artist?: string }, query: string): boolean {
  const q = query.trim().toLocaleLowerCase()
  if (!q) return true
  return (
    item.name.toLocaleLowerCase().includes(q) ||
    (item.artist?.toLocaleLowerCase().includes(q) ?? false)
  )
}
