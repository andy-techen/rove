import { execFileSync } from 'node:child_process'
import { promises as fs } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import {
  CATALOG_GENRES,
  CATALOG_LANGUAGES,
  CATALOG_SONG_TYPES,
  isGenre,
  isLanguage,
  isSongType
} from '../../src/shared/catalog'
import { addSong, AddRequest, AddResult } from './add'
import { cachedFetchJson } from './http'
import { ArtistPick, importArtist } from './importArtists'
import { finishWrite, openCatalog, removeSong, reviewList } from './store'

// Curation commands for the song catalog. The SQLite file is the source of truth; see
// docs/plans/catalog.md. Run through npm: `npm run catalog:add -- "Title" "Artist" --lang en`.

const ROOT = resolve(import.meta.dirname, '../..')
const CATALOG = join(ROOT, 'resources/catalog/catalog.sqlite')
const CACHE = join(import.meta.dirname, '.cache')

const USAGE = `Usage:
  catalog:add -- "<title>" "<artist>" [--lang ${CATALOG_LANGUAGES.join('|')}]
      [--type ${CATALOG_SONG_TYPES.join('|')}] [--genre <genre>] [--tags a,b]
      [--alias <name>]... [--isrc <ISRC> | --mbid <id>] [--refresh]
  catalog:add -- --file <list.txt> [same options, applied to every line]
      one song per line: "<title> — <artist>" (em dash or tab)
  catalog:import -- --artists <list.txt> [--count 5] [--refresh]
      adds each artist's most played songs (Deezer), pinned by ISRC; one per line:
      "<deezer artist id> <lang> <type> [genre]   # name"
  catalog:remove -- <id>
  catalog:review
  catalog:setup        show catalog changes as SQL in git diff`

async function main(argv: string[]): Promise<void> {
  const [command, ...rest] = argv
  switch (command) {
    case 'add':
      return add(rest)
    case 'import':
      return importArtists(rest)
    case 'remove':
      return remove(rest)
    case 'review':
      return review()
    case 'setup':
      return setup()
    default:
      throw new UsageError(command ? `Unknown command "${command}".` : 'No command.')
  }
}

async function add(args: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      lang: { type: 'string' },
      type: { type: 'string', default: 'solo' },
      genre: { type: 'string' },
      tags: { type: 'string' },
      alias: { type: 'string', multiple: true },
      isrc: { type: 'string' },
      mbid: { type: 'string' },
      file: { type: 'string' },
      refresh: { type: 'boolean', default: false }
    }
  })
  const shared = {
    language: optional(values.lang, isLanguage, '--lang', CATALOG_LANGUAGES),
    songType: required(values.type, isSongType, '--type', CATALOG_SONG_TYPES),
    genre: optional(values.genre, isGenre, '--genre', CATALOG_GENRES),
    tags: (values.tags ?? '')
      .split(',')
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean),
    aliases: values.alias ?? []
  }

  let requests: AddRequest[]
  if (values.file) {
    if (values.isrc || values.mbid)
      throw new UsageError('--isrc and --mbid pin one song, not a file.')
    const lines = (await fs.readFile(values.file, 'utf8')).split('\n')
    requests = lines.flatMap((line) => {
      const [title, artist] = line.split(/\t| — /).map((part) => part.trim())
      return title && artist ? [{ ...shared, title, artist, isrc: null, mbid: null }] : []
    })
  } else {
    const [title, artist] = positionals
    if (!title || !artist) throw new UsageError('Give a title and an artist.')
    requests = [{ ...shared, title, artist, isrc: values.isrc ?? null, mbid: values.mbid ?? null }]
  }

  const db = openCatalog(CATALOG)
  const fetchJson = cachedFetchJson(CACHE, values.refresh)
  try {
    for (const request of requests) print(await addSong(db, request, fetchJson))
  } finally {
    finishWrite(db)
    db.close()
  }
}

async function importArtists(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: {
      artists: { type: 'string' },
      count: { type: 'string', default: '5' },
      refresh: { type: 'boolean', default: false }
    }
  })
  const count = Number(values.count)
  if (!values.artists) throw new UsageError('Give --artists <list.txt>.')
  if (!Number.isInteger(count) || count < 1) throw new UsageError('--count must be 1 or more.')
  const artists = (await fs.readFile(values.artists, 'utf8')).split('\n').flatMap(parseArtist)

  const db = openCatalog(CATALOG)
  const fetchJson = cachedFetchJson(CACHE, values.refresh)
  try {
    for (const { pick, name } of artists) {
      console.log(`\n${name}`)
      await importArtist(db, pick, count, fetchJson, print)
    }
  } finally {
    finishWrite(db)
    db.close()
  }
}

function parseArtist(line: string): { pick: ArtistPick; name: string }[] {
  const [fields, name = ''] = line.split('#').map((part) => part.trim())
  if (!fields) return []
  const [id, lang, type, genre] = fields.split(/\s+/)
  const deezerId = Number(id)
  if (!Number.isInteger(deezerId)) throw new UsageError(`Not a Deezer artist id: "${line}".`)
  return [
    {
      name: name || id,
      pick: {
        deezerId,
        language: required(lang, isLanguage, 'lang', CATALOG_LANGUAGES),
        songType: required(type, isSongType, 'type', CATALOG_SONG_TYPES),
        genre: optional(genre, isGenre, 'genre', CATALOG_GENRES)
      }
    }
  ]
}

function remove(args: string[]): void {
  const id = Number(args[0])
  if (!Number.isInteger(id)) throw new UsageError('Give the id of the song to remove.')
  const db = openCatalog(CATALOG)
  try {
    console.log(removeSong(db, id) ? `Removed #${id}.` : `No song #${id}.`)
    finishWrite(db)
  } finally {
    db.close()
  }
}

function review(): void {
  const db = openCatalog(CATALOG)
  try {
    const rows = reviewList(db)
    if (!rows.length) console.log('Nothing to review.')
    for (const row of rows) {
      console.log(`#${row.id} ${row.title} — ${row.artist}`)
      for (const line of (row.note ?? '').split('\n')) console.log(`    ${line}`)
    }
  } finally {
    db.close()
  }
}

/**
 * Git can't diff a binary file, so teach it to compare SQL dumps instead
 * (.gitattributes maps the catalog to this driver). Git config is per clone.
 */
function setup(): void {
  const git = (...args: string[]): void => {
    execFileSync('git', ['config', ...args], { cwd: ROOT })
  }
  git('diff.sqlite.textconv', `sh -c 'sqlite3 -readonly "$0" .dump'`)
  git('diff.sqlite.cachetextconv', 'true')
  console.log('git diff now shows catalog changes as SQL.')
}

function print(result: AddResult): void {
  if (result.kind === 'skipped') {
    console.log(`Skipped ${result.title} — ${result.artist}: ${result.reason}`)
    return
  }
  const song = `#${result.id} ${result.title} — ${result.artist}`
  if (result.kind === 'added') console.log(`Added ${song}`)
  if (result.kind === 'duplicate') console.log(`Already in the catalog: ${song}`)
  if (result.kind === 'review') {
    console.log(`Needs review: ${song}`)
    for (const line of result.note.split('\n')) console.log(`    ${line}`)
  }
}

function optional<T>(
  value: string | undefined,
  guard: (v: unknown) => v is T,
  flag: string,
  allowed: readonly string[]
): T | null {
  return value === undefined ? null : required(value, guard, flag, allowed)
}

function required<T>(
  value: string | undefined,
  guard: (v: unknown) => v is T,
  flag: string,
  allowed: readonly string[]
): T {
  if (guard(value)) return value
  throw new UsageError(`${flag} must be one of: ${allowed.join(', ')}.`)
}

class UsageError extends Error {}

main(process.argv.slice(2)).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  if (error instanceof UsageError) console.error(`\n${USAGE}`)
  process.exitCode = 1
})
