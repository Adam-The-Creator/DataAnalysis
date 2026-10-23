import { useTranslation } from 'react-i18next'
import type { SessionStatus } from '@/lib/format'
import type { FeatureStatus, Phase } from '@/features/roadmap/registry'
import { Badge, type BadgeTone } from './Badge'

const sessionTone: Record<SessionStatus, BadgeTone> = { active: 'emerald', open: 'sky', closed: 'slate' }

export function SessionStatusBadge({ status }: { status: SessionStatus }) {
  const { t } = useTranslation()
  return <Badge tone={sessionTone[status]}>{t(`status.${status}`)}</Badge>
}

const featureTone: Record<FeatureStatus, BadgeTone> = { done: 'emerald', partial: 'sky', demo: 'amber', planned: 'slate' }

export function FeatureStatusBadge({ status }: { status: FeatureStatus }) {
  const { t } = useTranslation()
  return <Badge tone={featureTone[status]}>{t(`roadmap.status.${status}`)}</Badge>
}

const phaseTone: Record<Phase, BadgeTone> = { MVP: 'indigo', P2: 'sky', P3: 'slate' }

export function PhaseBadge({ phase }: { phase: Phase }) {
  return <Badge tone={phaseTone[phase]}>{phase}</Badge>
}
