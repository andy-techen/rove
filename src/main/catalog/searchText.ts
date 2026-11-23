/**
 * Every name a singer might type for a song, lowercased and deduplicated, one per line.
 * Search is a substring match on this column, so a query never spans two names.
 */
export function buildSearchText(title: string, artist: string, aliases: readonly string[]): string {
  const names = [title, artist, ...aliases]
    .map((name) => name.normalize('NFKC').trim().toLocaleLowerCase())
    .filter(Boolean)
  return [...new Set(names)].join('\n')
}
