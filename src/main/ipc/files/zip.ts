import { open, readFile, rm, rename } from 'node:fs/promises'
import { crc32 } from 'node:zlib'
import { t } from '@shared/copy'

// A minimal zip: files stored as they are (audio barely compresses), UTF-8 names, no
// ZIP64. Enough for a song file, and any unzip tool can open one to look inside.
// Format: https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT

const LOCAL_SIG = 0x04034b50
const CENTRAL_SIG = 0x02014b50
const END_SIG = 0x06054b50
const LOCAL_SIZE = 30
const CENTRAL_SIZE = 46
const END_SIZE = 22
const MAX_COMMENT = 0xffff
const VERSION = 20
const UTF8_NAMES = 0x0800
const ENCRYPTED = 0x0001
const STORED = 0
// Without ZIP64, sizes and offsets are 32-bit.
const MAX_ZIP_BYTES = 0xffffffff
// 1 January 1980, the earliest date a zip can hold, as DOS time and date.
const DOS_TIME = 0
const DOS_DATE = (1 << 5) | 1

export interface ZipSource {
  /** The name inside the archive ("audio/take-001.wav"). */
  name: string
  /** The file on disk to store under that name. */
  source: string
}

export interface ZipEntry {
  name: string
  size: number
  crc: number
  method: number
  flags: number
  localOffset: number
}

export interface ZipReader {
  entries: ZipEntry[]
  /** The entry's bytes, checked against its CRC. */
  read(entry: ZipEntry): Promise<Buffer>
  close(): Promise<void>
}

const notZip = (): Error => new Error(t('songFile.notASong'))

function localHeader(name: Buffer, crc: number, size: number): Buffer {
  const b = Buffer.alloc(LOCAL_SIZE)
  b.writeUInt32LE(LOCAL_SIG, 0)
  b.writeUInt16LE(VERSION, 4)
  b.writeUInt16LE(UTF8_NAMES, 6)
  b.writeUInt16LE(STORED, 8)
  b.writeUInt16LE(DOS_TIME, 10)
  b.writeUInt16LE(DOS_DATE, 12)
  b.writeUInt32LE(crc, 14)
  b.writeUInt32LE(size, 18)
  b.writeUInt32LE(size, 22)
  b.writeUInt16LE(name.length, 26)
  return Buffer.concat([b, name])
}

function centralHeader(name: Buffer, crc: number, size: number, offset: number): Buffer {
  const b = Buffer.alloc(CENTRAL_SIZE)
  b.writeUInt32LE(CENTRAL_SIG, 0)
  b.writeUInt16LE(VERSION, 4)
  b.writeUInt16LE(VERSION, 6)
  b.writeUInt16LE(UTF8_NAMES, 8)
  b.writeUInt16LE(STORED, 10)
  b.writeUInt16LE(DOS_TIME, 12)
  b.writeUInt16LE(DOS_DATE, 14)
  b.writeUInt32LE(crc, 16)
  b.writeUInt32LE(size, 20)
  b.writeUInt32LE(size, 24)
  b.writeUInt16LE(name.length, 28)
  b.writeUInt32LE(offset, 42)
  return Buffer.concat([b, name])
}

function endRecord(count: number, size: number, offset: number): Buffer {
  const b = Buffer.alloc(END_SIZE)
  b.writeUInt32LE(END_SIG, 0)
  b.writeUInt16LE(count, 8)
  b.writeUInt16LE(count, 10)
  b.writeUInt32LE(size, 12)
  b.writeUInt32LE(offset, 16)
  return b
}

/**
 * Writes the files into a zip at `target`. It's written beside the target and renamed,
 * so a failed write never leaves half a file under the chosen name.
 */
export async function writeZip(target: string, files: ZipSource[]): Promise<void> {
  const tmp = `${target}.rove-partial`
  const out = await open(tmp, 'w')
  try {
    const central: Buffer[] = []
    let offset = 0
    for (const file of files) {
      const name = Buffer.from(file.name, 'utf8')
      const data = await readFile(file.source)
      const crc = crc32(data)
      const header = localHeader(name, crc, data.length)
      if (offset + header.length + data.length > MAX_ZIP_BYTES)
        throw new Error(t('songFile.tooLarge'))
      central.push(centralHeader(name, crc, data.length, offset))
      await out.write(header)
      await out.write(data)
      offset += header.length + data.length
    }
    const directory = Buffer.concat(central)
    await out.write(directory)
    await out.write(endRecord(files.length, directory.length, offset))
    await out.close()
    await rename(tmp, target)
  } catch (error) {
    await out.close().catch(() => {})
    await rm(tmp, { force: true })
    throw error
  }
}

/** Opens a zip and lists its entries; entries are read one at a time, on request. */
export async function readZip(file: string): Promise<ZipReader> {
  const handle = await open(file, 'r')
  const readAt = async (position: number, length: number): Promise<Buffer> => {
    const buffer = Buffer.alloc(length)
    const { bytesRead } = await handle.read(buffer, 0, length, position)
    if (bytesRead !== length) throw notZip()
    return buffer
  }
  try {
    const { size } = await handle.stat()
    if (size < END_SIZE) throw notZip()
    // The end record sits at the very end, unless a comment follows it.
    const tailLength = Math.min(size, END_SIZE + MAX_COMMENT)
    const tail = await readAt(size - tailLength, tailLength)
    let end = -1
    for (let i = tail.length - END_SIZE; i >= 0; i--) {
      if (tail.readUInt32LE(i) === END_SIG) {
        end = i
        break
      }
    }
    if (end < 0) throw notZip()
    const count = tail.readUInt16LE(end + 10)
    const dirSize = tail.readUInt32LE(end + 12)
    const dirOffset = tail.readUInt32LE(end + 16)
    if (dirOffset + dirSize > size) throw notZip()
    const dir = await readAt(dirOffset, dirSize)

    const entries: ZipEntry[] = []
    let at = 0
    for (let i = 0; i < count; i++) {
      if (at + CENTRAL_SIZE > dir.length || dir.readUInt32LE(at) !== CENTRAL_SIG) throw notZip()
      const nameLength = dir.readUInt16LE(at + 28)
      const extraLength = dir.readUInt16LE(at + 30)
      const commentLength = dir.readUInt16LE(at + 32)
      const nameEnd = at + CENTRAL_SIZE + nameLength
      if (nameEnd > dir.length) throw notZip()
      entries.push({
        flags: dir.readUInt16LE(at + 8),
        method: dir.readUInt16LE(at + 10),
        crc: dir.readUInt32LE(at + 16),
        size: dir.readUInt32LE(at + 24),
        name: dir.toString('utf8', at + CENTRAL_SIZE, nameEnd),
        localOffset: dir.readUInt32LE(at + 42)
      })
      at = nameEnd + extraLength + commentLength
    }

    return {
      entries,
      read: async (entry) => {
        // Rove only writes stored, unencrypted entries; anything else isn't one of ours.
        if (entry.method !== STORED || entry.flags & ENCRYPTED) throw notZip()
        const local = await readAt(entry.localOffset, LOCAL_SIZE)
        if (local.readUInt32LE(0) !== LOCAL_SIG) throw notZip()
        const start =
          entry.localOffset + LOCAL_SIZE + local.readUInt16LE(26) + local.readUInt16LE(28)
        if (start + entry.size > size) throw notZip()
        const data = await readAt(start, entry.size)
        if (crc32(data) !== entry.crc) throw notZip()
        return data
      },
      close: () => handle.close()
    }
  } catch (error) {
    await handle.close()
    throw error
  }
}
