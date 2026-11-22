// What both processes need to agree on for exporting a mix.

export const EXPORT_FORMATS = ['wav', 'mp3'] as const
export type ExportFormat = (typeof EXPORT_FORMATS)[number]

export const EXPORT_CHANNELS = {
  choose: 'export:choosePath',
  write: 'export:write',
  reveal: 'export:reveal'
} as const
