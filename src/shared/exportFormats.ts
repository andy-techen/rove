// What both processes need to agree on for exporting a mix (mp4: the mix as a video, with a picture).

export const EXPORT_FORMATS = ['wav', 'mp3', 'mp4'] as const
export type ExportFormat = (typeof EXPORT_FORMATS)[number]

export const EXPORT_CHANNELS = {
  choose: 'export:choosePath',
  write: 'export:write',
  reveal: 'export:reveal',
  share: 'export:share'
} as const
