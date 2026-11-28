import { MS_PER_SEC, SEC_PER_MIN } from '@shared/units'

// Spans for "3 days ago", in milliseconds.
export const MINUTE = SEC_PER_MIN * MS_PER_SEC
export const HOUR = 60 * MINUTE
export const DAY = 24 * HOUR
export const WEEK = 7 * DAY
