import type { Session } from '@/api/types'

/** The server writes dates as "yyyy.MM.dd-HH:mm" (DatabaseServer utils.get_date). */
export function parseServerDate(value: string | null | undefined): Date | null {
  const match = /^(\d{4})\.(\d{2})\.(\d{2})-(\d{2}):(\d{2})/.exec(value ?? '')
  if (!match) {
    return null
  }
  const [year, month, day, hour, minute] = match.slice(1).map(Number)
  return new Date(year, month - 1, day, hour, minute)
}

const dateTimeFormat = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
const dateFormat = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' })

export function formatDateTime(value: string | null | undefined): string {
  const date = parseServerDate(value)
  return date ? dateTimeFormat.format(date) : (value ?? '')
}

export function formatDate(value: string | null | undefined): string {
  const date = parseServerDate(value)
  return date ? dateFormat.format(date) : (value ?? '')
}

export function formatIsoDateTime(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : dateTimeFormat.format(date)
}

export function formatNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: decimals }).format(value)
}

/** "45 s", "2 min 05 s", "1 h 05 min", "3 d 2 h": the two largest units that matter. */
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.round(totalSeconds)
  if (seconds < 60) {
    return `${seconds} s`
  }
  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)} min ${String(seconds % 60).padStart(2, '0')} s`
  }
  if (seconds < 86400) {
    return `${Math.floor(seconds / 3600)} h ${String(Math.floor((seconds % 3600) / 60)).padStart(2, '0')} min`
  }
  return `${Math.floor(seconds / 86400)} d ${Math.floor((seconds % 86400) / 3600)} h`
}

export type SessionStatus = 'active' | 'open' | 'closed'

export function sessionStatus(session: Pick<Session, 'id' | 'endDate'>, activeId: string | undefined): SessionStatus {
  if (session.endDate) {
    return 'closed'
  }
  return session.id === activeId ? 'active' : 'open'
}

export function shortId(id: string): string {
  return id.slice(0, 8)
}

export function displayName(info: { name: string | null } | null | undefined, id: string): string {
  return info?.name?.trim() || `#${shortId(id)}`
}
