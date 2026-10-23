import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { buttonClass } from '@/components/ui/buttonStyles'
import { PageHeader } from '@/components/ui/PageHeader'

export function NotFoundPage() {
  const { t } = useTranslation()
  return (
    <>
      <PageHeader title={t('notFound.title')} subtitle={t('notFound.body')} />
      <Link to="/" className={buttonClass('primary')}>{t('notFound.home')}</Link>
    </>
  )
}
