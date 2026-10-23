import { useTranslation } from 'react-i18next'
import { PageHeader } from '@/components/ui/PageHeader'
import { PlannedPanel } from '@/components/ui/PlannedPanel'

/** Placeholder: comparison is a second-phase feature (requirements CMP-01..03). */
export function ComparePage() {
  const { t } = useTranslation()
  return (
    <>
      <PageHeader title={t('compare.title')} subtitle={t('compare.subtitle')} />
      <PlannedPanel ids={['CMP-01', 'CMP-02', 'CMP-03', 'MUL-01', 'MUL-02', 'MUL-03']} />
    </>
  )
}
