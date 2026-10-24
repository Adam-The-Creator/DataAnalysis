import type { TFunction } from 'i18next'
import { Role, type AgeBand, type FeedbackCategory, type FeedbackTarget, type InstrumentId, type SenderRole } from '@/api/types'

/** The words for the values of the feedback data, shared by the feedback page and the admin dashboard. */

export const targetLabel = (t: TFunction, target: FeedbackTarget) => t(`feedback.targets.${target}`)
/** "the game", "the web application": for a sentence. */
export const subjectLabel = (t: TFunction, target: FeedbackTarget) => t(`feedback.subject.${target}`)
export const categoryLabel = (t: TFunction, category: FeedbackCategory) => t(`feedback.categories.${category}`)
export const ageBandLabel = (t: TFunction, band: AgeBand) => t(`admin.feedback.ageBands.${band}`)
export const instrumentName = (t: TFunction, instrument: InstrumentId) => t(`feedback.instruments.${instrument}.name`)
export const senderRoleLabel = (t: TFunction, role: SenderRole) => t(role === Role.Player ? 'roles.player' : 'roles.psychologist')
