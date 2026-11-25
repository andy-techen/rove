import type { Command } from '../../state/commands/commands'

/** The dialog's sections, in sidebar order. */
export const SECTIONS = ['voice', 'settings', 'shortcuts'] as const

export type Section = (typeof SECTIONS)[number]

const BY_COMMAND: Partial<Record<Command, Section>> = {
  voice: 'voice',
  settings: 'settings',
  shortcuts: 'shortcuts'
}

/** The section a menu command opens, if it opens one. */
export function sectionFor(command: Command): Section | null {
  return BY_COMMAND[command] ?? null
}
