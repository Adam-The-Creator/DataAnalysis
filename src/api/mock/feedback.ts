import { getToken } from '@/auth/tokenStore'
import {
  ageBandOf, headline, INSTRUMENT_DEFINITIONS, scoreAnswers, SMILEY_ITEMS, SUS_ITEMS, susContributions, UEQ_ITEMS,
  UEQ_SCALE_IDS, ueqValues, type Scores,
} from '@/lib/instruments'
import type { Api } from '../contract'
import { ApiError } from '../errors'
import {
  Role, type AdminMessage, type AgeBand, type CsvDialect, type FeedbackCategory, type FeedbackTarget, type InstrumentId,
  type MessageFilters, type PlayerInfo, type QuestionnaireResults, type ResultFilters, type ResultGroup, type RoleValue,
  type SenderRole, type TrendPoint, type UeqScaleId, type UsageNumbers,
} from '../types'
import { createRng } from './generator'
import { getWorld } from './world'

/**
 * STAND-IN for the feedback module of the DatabaseServer (feedback/, routers/feedback.py and routers/admin.py): the
 * same rules, limits, messages and statistics, kept in memory, so the whole feature can be tried in demo mode. Keep it in
 * step with the Python code. The demo has one admin account and some sample submissions of made-up senders.
 */

// --- The same limits as the server's config.py ---

const QUESTIONNAIRE_INTERVAL_MS = 3600_000
const MESSAGE_INTERVAL_MS = 60_000
const MESSAGES_PER_DAY = 20
const MAX_MESSAGES = 500
const MAX_QUESTIONNAIRES = 200
const MESSAGE_MAX_CHARS = 2000
const MIN_GROUP_SIZE = 3
const DAY_MS = 24 * 3600_000

export const DEMO_ADMIN = {
  id: 'demo-admin',
  username: 'admin',
  role: Role.Admin as RoleValue,
  info: { id: 'demo-admin', name: 'Demo Admin', gender: null, age: null, dominantHand: null } as PlayerInfo,
}

const refused = (status: number, detail: string) => new ApiError('http', status, detail)

function humanWait(ms: number): string {
  const seconds = Math.max(1, Math.ceil(ms / 1000))
  if (seconds < 60) return `${seconds} second${seconds !== 1 ? 's' : ''}`
  const minutes = Math.ceil(seconds / 60)
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''}`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  const text = `${hours} hour${hours !== 1 ? 's' : ''}`
  return rest ? `${text} ${rest} minute${rest !== 1 ? 's' : ''}` : text
}

// --- State ---

interface StoredQuestionnaire {
  id: string
  clientId: string
  senderId: string
  role: SenderRole
  ageBand: AgeBand
  target: FeedbackTarget
  instrument: InstrumentId
  version: number
  answers: Record<string, number>
  scores: Scores
  createdMs: number
}

interface StoredMessage {
  id: string
  clientId: string
  senderId: string
  role: SenderRole
  ageBand: AgeBand
  target: FeedbackTarget
  category: FeedbackCategory | null
  text: string
  createdMs: number
  isRead: boolean
}

interface State {
  questionnaires: StoredQuestionnaire[]
  messages: StoredMessage[]
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/** A stable code per sender (the server keeps a random one per account in a table). */
export function pseudonymOf(senderId: string): string {
  let hash = 2166136261
  for (const char of senderId) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
  const random = createRng(hash >>> 0)
  return 'P-' + Array.from({ length: 6 }, () => CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)]).join('')
}

let counter = 0
const nextId = () => `demo-submission-${Date.now().toString(36)}-${++counter}`

/** The most positive answers around a level (1..5 satisfaction), with a little noise. */
function sampleAnswers(instrument: InstrumentId, level: number, random: () => number): Record<string, number> {
  const noisy = () => Math.round(level + (random() - 0.5) * 2)
  const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value))
  if (instrument === 'SUS') {
    return Object.fromEntries(SUS_ITEMS.map((id, i) => [id, clamp((i + 1) % 2 === 1 ? noisy() : 6 - noisy(), 1, 5)]))
  }
  if (instrument === 'UEQ') {
    const leftPositive = new Set([3, 4, 5, 9, 10, 12, 17, 18, 19, 21, 23, 24, 25])
    return Object.fromEntries(UEQ_ITEMS.map((id, i) => {
      const wanted = clamp(noisy() - 3, -3, 3) // satisfaction 1..5 -> -2..+2, noise can reach -3 and +3
      return [id, clamp(leftPositive.has(i + 1) ? 4 - wanted : 4 + wanted, 1, 7)]
    }))
  }
  return Object.fromEntries(SMILEY_ITEMS.map((id) => [id, clamp(noisy(), 1, 5)]))
}

let state: State | null = null

function getState(): State {
  if (state) return state
  const now = Date.now()
  const random = createRng(20261024)
  const questionnaires: StoredQuestionnaire[] = []
  const messages: StoredMessage[] = []

  const add = (n: number, role: SenderRole, target: FeedbackTarget, instrument: InstrumentId, ages: number[], level: number, daysAgo: number[]) => {
    for (let i = 0; i < n; i++) {
      const senderId = `demo-sender-${role}-${target}-${instrument}-${i}`
      for (const days of daysAgo) {
        const answers = sampleAnswers(instrument, level + (random() - 0.5), random)
        questionnaires.push({
          id: nextId(), clientId: nextId(), senderId, role, ageBand: ageBandOf(ages[i % ages.length]), target, instrument,
          version: 1, answers, scores: scoreAnswers(instrument, answers), createdMs: now - (days + random()) * DAY_MS,
        })
      }
    }
  }
  // Players rate the game; the first group answered twice, three weeks apart, so the trend has something to show
  add(6, Role.Player, 'game', 'SUS', [15, 17, 24, 31, 38, 52], 3.8, [21, 1])
  add(5, Role.Player, 'game', 'UEQ', [14, 16, 23, 29, 44], 4, [5])
  add(5, Role.Player, 'game', 'SMILEY', [7, 9, 10, 11, 8], 4.3, [6])
  // Psychologists rate the game and the web app
  add(4, Role.Psychologist, 'game', 'SUS', [41, 36, 52, 47], 3.4, [9])
  add(4, Role.Psychologist, 'game', 'UEQ', [41, 36, 52, 47], 3.6, [9])
  add(5, Role.Psychologist, 'webapp', 'SUS', [41, 36, 52, 47, 33], 4.1, [4])
  add(4, Role.Psychologist, 'webapp', 'UEQ', [41, 36, 52, 47], 3.9, [4])

  const text: [SenderRole, AgeBand, FeedbackTarget, FeedbackCategory, string, number, boolean][] = [
    [Role.Player, 'child', 'game', 'praise', 'I liked drawing the big tree. Can I make it rainbow coloured?', 1, false],
    [Role.Player, 'teen', 'game', 'problem', 'The menu sometimes closes when I change the colour.', 2, false],
    [Role.Player, 'adult', 'game', 'idea', 'It would be nice to save a drawing while I am still drawing and come back to it.', 4, true],
    [Role.Psychologist, 'adult', 'webapp', 'problem', 'The replay is slow with the big drawings on the laptop.', 3, false],
    [Role.Psychologist, 'adult', 'webapp', 'idea', 'A way to add my own notes to a drawing would help.', 5, true],
    [Role.Psychologist, 'adult', 'game', 'praise', 'The participants settled into the Beach quickly and stayed calm.', 8, true],
    [Role.Player, 'child', 'game', 'other', 'my headset was a bit heavy', 10, false],
  ]
  text.forEach(([role, ageBand, target, category, body, days, isRead], i) => {
    messages.push({
      id: nextId(), clientId: nextId(), senderId: `demo-writer-${i}`, role, ageBand, target, category, text: body,
      createdMs: now - days * DAY_MS - random() * 3600_000, isRead,
    })
  })

  state = { questionnaires, messages }
  return state
}

// --- Who is calling (the demo token is "demo-token-<player id>") ---

interface Caller { id: string; role: RoleValue; age: number | null }

function caller(): Caller {
  const id = getToken()?.replace(/^demo-token-/, '')
  const world = getWorld()
  const account = id === DEMO_ADMIN.id ? DEMO_ADMIN : world.players.find((p) => p.id === id)
  if (!account) throw refused(401, 'Not authenticated.')
  return { id: account.id, role: account.role, age: account.info.age }
}

function sender(): { id: string; role: SenderRole; ageBand: AgeBand } {
  const who = caller()
  if (who.role !== Role.Player && who.role !== Role.Psychologist) throw refused(403, 'Only players and psychologists can send feedback.')
  return { id: who.id, role: who.role, ageBand: ageBandOf(who.age) }
}

function requireAdmin(): void {
  if (caller().role !== Role.Admin) throw refused(403, 'Admin role required.')
}

function checkTarget(who: { role: SenderRole }, target: FeedbackTarget, allowed: FeedbackTarget[]): void {
  if (!allowed.includes(target)) throw refused(400, 'This cannot be rated here.')
  if (who.role === Role.Player && target !== 'game') throw refused(403, 'Players can only rate the game.')
}

const receipt = (id: string, createdMs: number) => ({ id, createdAt: new Date(createdMs).toISOString().replace(/\.\d{3}Z$/, 'Z') })

// --- Statistics (port of feedback/results.py) ---

const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length
const sd = (values: number[]) => {
  if (values.length < 2) return 0
  const m = mean(values)
  return Math.sqrt(values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1))
}
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}
/** Rounds half up, like the server (and turns -0 into 0). */
const round = (value: number, digits = 2) => Math.floor(value * 10 ** digits + 0.5) / 10 ** digits + 0
const T975 = [12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.160, 2.145, 2.131,
  2.120, 2.110, 2.101, 2.093, 2.086, 2.080, 2.074, 2.069, 2.064, 2.060, 2.056, 2.052, 2.048, 2.045, 2.042]
const t975 = (degrees: number) => (degrees <= 30 ? T975[degrees - 1] : degrees <= 60 ? 2.0 : 1.96)
const INSTRUMENT_ORDER: Record<string, number> = { SUS: 0, UEQ: 1, SMILEY: 2 }

function weekStart(ms: number): string {
  const d = new Date(ms)
  const monday = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
  return new Date(monday).toISOString().slice(0, 10)
}

const dayStart = (day: string) => Date.parse(`${day}T00:00:00Z`)

function filterQuestionnaires(rows: StoredQuestionnaire[], f: ResultFilters): StoredQuestionnaire[] {
  return rows.filter((r) =>
    (f.target === undefined || r.target === f.target) && (f.role === undefined || r.role === f.role)
    && (f.ageBand === undefined || r.ageBand === f.ageBand) && (f.version === undefined || r.version === f.version)
    && (!f.dateFrom || r.createdMs >= dayStart(f.dateFrom)) && (!f.dateTo || r.createdMs < dayStart(f.dateTo) + DAY_MS))
}

function groupStatistics(instrument: InstrumentId, rows: StoredQuestionnaire[]): Partial<ResultGroup> {
  if (instrument === 'SUS') {
    const scores = rows.map((r) => (r.scores as { score: number }).score)
    const bins = new Array<number>(10).fill(0)
    scores.forEach((s) => { bins[Math.min(Math.floor(s / 10), 9)]++ })
    const contributions = rows.map((r) => susContributions(r.answers))
    return {
      sus: {
        mean: round(mean(scores)), sd: round(sd(scores)), median: round(median(scores)), min: round(Math.min(...scores)), max: round(Math.max(...scores)),
        histogram: bins.map((count, i) => ({ from: i * 10, to: i * 10 + 10, count })),
        items: SUS_ITEMS.map((id) => ({ id, mean: round(mean(contributions.map((c) => c[id]))) })),
      },
    }
  }
  if (instrument === 'UEQ') {
    const values = rows.map((r) => ueqValues(r.answers))
    const scale = (r: StoredQuestionnaire, id: UeqScaleId) => (r.scores as { scales: Record<UeqScaleId, number> }).scales[id]
    return {
      ueq: {
        scales: UEQ_SCALE_IDS.map((id) => {
          const list = rows.map((r) => scale(r, id))
          const m = mean(list)
          const half = list.length > 1 ? (t975(list.length - 1) * sd(list)) / Math.sqrt(list.length) : 0
          return { id, mean: round(m), low: round(m - half), high: round(m + half) }
        }),
        pragmatic: round(mean(rows.map((r) => (r.scores as { pragmatic: number }).pragmatic))),
        hedonic: round(mean(rows.map((r) => (r.scores as { hedonic: number }).hedonic))),
        items: UEQ_ITEMS.map((id) => ({ id, mean: round(mean(values.map((v) => v[id]))) })),
      },
    }
  }
  return {
    smiley: {
      mean: round(mean(rows.map((r) => (r.scores as { mean: number }).mean))),
      items: SMILEY_ITEMS.map((id) => {
        const answers = rows.map((r) => r.answers[id])
        return { id, mean: round(mean(answers)), distribution: [1, 2, 3, 4, 5].map((face) => answers.filter((a) => a === face).length) }
      }),
    },
  }
}

function questionnaireResults(f: ResultFilters): QuestionnaireResults {
  const everything = filterQuestionnaires(getState().questionnaires, f).sort((a, b) => a.createdMs - b.createdMs)
  const latest = new Map<string, StoredQuestionnaire>()
  everything.forEach((r) => latest.set(`${r.senderId}|${r.instrument}|${r.target}`, r))
  const counted = f.counting === 'latest' ? [...latest.values()] : everything

  const key = (r: { instrument: InstrumentId; target: FeedbackTarget; role: SenderRole }) => `${r.instrument}|${r.target}|${r.role}`
  const order = (a: string, b: string) => {
    const [ai, at, ar] = a.split('|')
    const [bi, bt, br] = b.split('|')
    return (INSTRUMENT_ORDER[ai] - INSTRUMENT_ORDER[bi]) || at.localeCompare(bt) || Number(ar) - Number(br)
  }

  const grouped = new Map<string, StoredQuestionnaire[]>()
  counted.forEach((r) => grouped.set(key(r), [...(grouped.get(key(r)) ?? []), r]))
  const groups: ResultGroup[] = [...grouped.keys()].sort(order).map((k) => {
    const rows = grouped.get(k)!
    const ageBands: Partial<Record<AgeBand, number>> = {}
    rows.forEach((r) => { ageBands[r.ageBand] = (ageBands[r.ageBand] ?? 0) + 1 })
    const group: ResultGroup = {
      instrument: rows[0].instrument, target: rows[0].target, role: rows[0].role, n: rows.length,
      accounts: new Set(rows.map((r) => r.senderId)).size, versions: [...new Set(rows.map((r) => r.version))].sort(),
      ageBands, enough: rows.length >= MIN_GROUP_SIZE,
    }
    return group.enough ? { ...group, ...groupStatistics(group.instrument, rows) } : group
  })

  // The trend follows all submissions in time (the latest-only rule would remove the earlier ones)
  const weekly = new Map<string, number[]>()
  everything.forEach((r) => {
    const k = `${key(r)}|${weekStart(r.createdMs)}`
    weekly.set(k, [...(weekly.get(k) ?? []), headline(r.instrument, r.scores)])
  })
  const trend: TrendPoint[] = [...weekly.entries()]
    .filter(([, values]) => values.length >= MIN_GROUP_SIZE)
    .map(([k, values]) => {
      const [instrument, target, role, week] = k.split('|')
      return { instrument: instrument as InstrumentId, target: target as FeedbackTarget, role: Number(role) as SenderRole, week, n: values.length, mean: round(mean(values)) }
    })
    .sort((a, b) => order(`${a.instrument}|${a.target}|${a.role}`, `${b.instrument}|${b.target}|${b.role}`) || a.week.localeCompare(b.week))

  return { counting: f.counting, minGroupSize: MIN_GROUP_SIZE, submissions: everything.length, counted: counted.length, groups, trend }
}

function usage(): UsageNumbers {
  const { players, metas } = getWorld()
  const state = getState()
  const playerAccounts = players.filter((p) => p.role === Role.Player)
  const psychologists = players.filter((p) => p.role === Role.Psychologist)
  const withDrawings = new Set(metas.map((m) => m.playerID))
  // The demo accounts have no creation date; they are spread over the last weeks
  const thisWeek = Date.parse(`${weekStart(Date.now())}T00:00:00Z`)
  const perWeek = new Map<string, { players: number; psychologists: number; total: number }>()
  players.concat({ ...DEMO_ADMIN, role: Role.Admin }).forEach((p, i) => {
    const week = new Date(thisWeek - (3 - (i % 4)) * 7 * DAY_MS).toISOString().slice(0, 10)
    const row = perWeek.get(week) ?? { players: 0, psychologists: 0, total: 0 }
    row.total++
    if (p.role === Role.Player) row.players++
    if (p.role === Role.Psychologist) row.psychologists++
    perWeek.set(week, row)
  })
  return {
    registered: { total: players.length + 1, players: playerAccounts.length, psychologists: psychologists.length, admins: 1 },
    used: { players: playerAccounts.filter((p) => withDrawings.has(p.id)).length, psychologists: psychologists.length },
    accountsPerWeek: [...perWeek.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([week, row]) => ({ weekStart: week, ...row })),
    submissions: {
      questionnaires: state.questionnaires.length, messages: state.messages.length,
      unreadMessages: state.messages.filter((m) => !m.isRead).length,
    },
  }
}

// --- Messages ---

function toAdminMessage(m: StoredMessage): AdminMessage {
  return {
    id: m.id, code: pseudonymOf(m.senderId), role: m.role, ageBand: m.ageBand, target: m.target, category: m.category, text: m.text,
    createdAt: receipt(m.id, m.createdMs).createdAt, isRead: m.isRead,
  }
}

function filterMessages(rows: StoredMessage[], f: MessageFilters): StoredMessage[] {
  const q = f.q?.toLowerCase()
  return rows.filter((m) =>
    (f.target === undefined || m.target === f.target) && (f.category === undefined || m.category === f.category)
    && (f.role === undefined || m.role === f.role) && (f.ageBand === undefined || m.ageBand === f.ageBand)
    && (!f.dateFrom || m.createdMs >= dayStart(f.dateFrom)) && (!f.dateTo || m.createdMs < dayStart(f.dateTo) + DAY_MS)
    && (f.read === undefined || m.isRead === (f.read === 'read')) && (!q || m.text.toLowerCase().includes(q)))
}

/** A cell that starts with = + - or @ is read as a formula by a spreadsheet: a leading apostrophe makes it text again. */
const safe = (text: string) => (/^[=+\-@\t\r]/.test(text) ? `'${text}` : text)

function csvCell(value: string | number | boolean | null, dialect: CsvDialect): string {
  if (value === null) return ''
  let text: string
  if (typeof value === 'number') {
    text = Number.isInteger(value) ? String(value) : value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')
    if (dialect === 'excel') text = text.replace('.', ',')
  } else if (typeof value === 'boolean') {
    text = value ? '1' : '0'
  } else {
    text = safe(value) // only text can be a formula, a negative number is just a number
  }
  const separator = dialect === 'excel' ? ';' : ','
  return /["\r\n]/.test(text) || text.includes(separator) ? `"${text.replace(/"/g, '""')}"` : text
}

function csv(header: string[], rows: (string | number | boolean | null)[][], dialect: CsvDialect): Blob {
  const separator = dialect === 'excel' ? ';' : ','
  const lines = [header.join(separator), ...rows.map((row) => row.map((c) => csvCell(c, dialect)).join(separator))]
  const text = lines.join('\r\n') + '\r\n'
  return new Blob([dialect === 'excel' ? '﻿' + text : text], { type: 'text/csv;charset=utf-8' })
}

const roleName = (role: SenderRole) => (role === Role.Player ? 'player' : 'psychologist')

// --- The demo's feedback and admin API ---

export const mockFeedback: Pick<Api, 'feedback' | 'admin'> = {
  feedback: {
    instruments: async () => INSTRUMENT_DEFINITIONS,

    sendQuestionnaire: async (input) => {
      const who = sender()
      const definition = INSTRUMENT_DEFINITIONS.find((d) => d.id === input.instrument)
      if (!definition) throw refused(422, `Unknown questionnaire: ${input.instrument}.`)
      if (definition.version !== input.version) {
        throw refused(422, 'This questionnaire has been updated. Please reload the page and fill it in again.')
      }
      const given = Object.keys(input.answers)
      if (given.length !== definition.itemIds.length || !definition.itemIds.every((id) => id in input.answers)) {
        throw refused(422, definition.itemIds.some((id) => !(id in input.answers)) ? 'Please answer every question.' : 'The answers do not match the questionnaire.')
      }
      for (const id of definition.itemIds) {
        const value = input.answers[id]
        if (!Number.isInteger(value) || value < definition.scaleMin || value > definition.scaleMax) throw refused(422, 'An answer is outside the scale.')
      }
      checkTarget(who, input.target, definition.targets)

      const { questionnaires } = getState()
      const existing = questionnaires.find((q) => q.clientId === input.clientId)
      if (existing) {
        if (existing.senderId !== who.id) throw refused(409, 'The submission ID is already used.')
        return receipt(existing.id, existing.createdMs)
      }
      const now = Date.now()
      const mine = questionnaires.filter((q) => q.senderId === who.id)
      const last = Math.max(0, ...mine.filter((q) => q.instrument === input.instrument && q.target === input.target).map((q) => q.createdMs))
      if (last && now - last < QUESTIONNAIRE_INTERVAL_MS) {
        throw refused(429, `You can send this questionnaire again in ${humanWait(last + QUESTIONNAIRE_INTERVAL_MS - now)}.`)
      }
      if (mine.length >= MAX_QUESTIONNAIRES) throw refused(409, 'You have reached the maximum number of stored questionnaires.')

      const stored: StoredQuestionnaire = {
        id: nextId(), clientId: input.clientId, senderId: who.id, role: who.role, ageBand: who.ageBand, target: input.target,
        instrument: input.instrument, version: definition.version, answers: { ...input.answers },
        scores: scoreAnswers(input.instrument, input.answers), createdMs: now,
      }
      questionnaires.push(stored)
      return receipt(stored.id, now)
    },

    sendMessage: async (input) => {
      const who = sender()
      const text = (input.text ?? '').replace(/\r\n?/g, '\n').trim()
      if (!text) throw refused(422, 'The message is empty.')
      if (text.length > MESSAGE_MAX_CHARS) throw refused(422, `The message is too long (at most ${MESSAGE_MAX_CHARS} characters).`)
      // eslint-disable-next-line no-control-regex
      if (/[\u0000-\u0008\u000b-\u001f\u007f-\u009f‪-‮⁦-⁩]/.test(text)) {
        throw refused(422, 'The message contains characters that are not allowed.')
      }
      checkTarget(who, input.target, ['game', 'webapp'])

      const { messages } = getState()
      const existing = messages.find((m) => m.clientId === input.clientId)
      if (existing) {
        if (existing.senderId !== who.id) throw refused(409, 'The submission ID is already used.')
        return receipt(existing.id, existing.createdMs)
      }
      const now = Date.now()
      const mine = messages.filter((m) => m.senderId === who.id)
      const last = Math.max(0, ...mine.map((m) => m.createdMs))
      if (last && now - last < MESSAGE_INTERVAL_MS) {
        throw refused(429, `Please wait ${humanWait(last + MESSAGE_INTERVAL_MS - now)} before you send another message.`)
      }
      const today = mine.filter((m) => m.createdMs > now - DAY_MS)
      if (today.length >= MESSAGES_PER_DAY) {
        const oldest = Math.min(...today.map((m) => m.createdMs))
        throw refused(429, `You have reached the daily limit of messages. You can send the next one in ${humanWait(oldest + DAY_MS - now)}.`)
      }
      if (mine.length >= MAX_MESSAGES) throw refused(409, 'You have reached the maximum number of stored messages.')

      const stored: StoredMessage = {
        id: nextId(), clientId: input.clientId, senderId: who.id, role: who.role, ageBand: who.ageBand, target: input.target,
        category: input.category, text, createdMs: now, isRead: false,
      }
      messages.push(stored)
      return receipt(stored.id, now)
    },

    mine: async (limit, offset) => {
      const who = caller()
      const { questionnaires, messages } = getState()
      const all = [
        ...questionnaires.filter((q) => q.senderId === who.id).map((q) => ({
          createdMs: q.createdMs,
          item: { kind: 'questionnaire' as const, id: q.id, createdAt: receipt(q.id, q.createdMs).createdAt, target: q.target, instrument: q.instrument },
        })),
        ...messages.filter((m) => m.senderId === who.id).map((m) => ({
          createdMs: m.createdMs,
          item: { kind: 'message' as const, id: m.id, createdAt: receipt(m.id, m.createdMs).createdAt, target: m.target, category: m.category, text: m.text },
        })),
      ].sort((a, b) => b.createdMs - a.createdMs)
      return { total: all.length, items: all.slice(offset, offset + limit).map((e) => e.item) }
    },
  },

  admin: {
    usage: async () => { requireAdmin(); return usage() },

    questionnaireResults: async (filters) => {
      requireAdmin()
      return questionnaireResults(filters)
    },

    messages: async (filters, limit, offset) => {
      requireAdmin()
      const { messages } = getState()
      const matching = filterMessages(messages, filters).sort((a, b) => b.createdMs - a.createdMs)
      return {
        total: matching.length, unread: messages.filter((m) => !m.isRead).length,
        items: matching.slice(offset, offset + limit).map(toAdminMessage),
      }
    },

    setMessageRead: async (messageId, read) => {
      requireAdmin()
      const message = getState().messages.find((m) => m.id === messageId)
      if (!message) throw refused(404, 'Message not found.')
      message.isRead = read
      return toAdminMessage(message)
    },

    deleteMessage: async (messageId) => {
      requireAdmin()
      const current = getState()
      if (!current.messages.some((m) => m.id === messageId)) throw refused(404, 'Message not found.')
      current.messages = current.messages.filter((m) => m.id !== messageId)
    },

    exportQuestionnaires: async (instrument, dialect, filters) => {
      requireAdmin()
      const definition = INSTRUMENT_DEFINITIONS.find((d) => d.id === instrument)!
      const rows = filterQuestionnaires(getState().questionnaires, filters).filter((q) => q.instrument === instrument)
        .sort((a, b) => a.createdMs - b.createdMs)
      const scoreNames = instrument === 'SUS' ? ['score'] : instrument === 'UEQ' ? [...UEQ_SCALE_IDS, 'pragmatic', 'hedonic'] : ['mean']
      const scoreValues = (scores: Scores): number[] => {
        if ('scales' in scores) return [...UEQ_SCALE_IDS.map((id) => scores.scales[id]), scores.pragmatic, scores.hedonic]
        return [Object.values(scores)[0]]
      }
      return csv(
        ['code', 'role', 'ageBand', 'target', 'version', 'createdAt', ...scoreNames, ...definition.itemIds],
        rows.map((q) => [
          pseudonymOf(q.senderId), roleName(q.role), q.ageBand, q.target, q.version, receipt(q.id, q.createdMs).createdAt,
          ...scoreValues(q.scores), ...definition.itemIds.map((id) => q.answers[id]),
        ]),
        dialect,
      )
    },

    exportMessages: async (dialect, filters) => {
      requireAdmin()
      const rows = filterMessages(getState().messages, filters).sort((a, b) => a.createdMs - b.createdMs)
      return csv(
        ['code', 'role', 'ageBand', 'target', 'category', 'createdAt', 'read', 'text'],
        rows.map((m) => [pseudonymOf(m.senderId), roleName(m.role), m.ageBand, m.target, m.category, receipt(m.id, m.createdMs).createdAt, m.isRead, m.text]),
        dialect,
      )
    },
  },
}
