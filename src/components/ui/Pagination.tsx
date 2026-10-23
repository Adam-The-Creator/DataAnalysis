import { useTranslation } from 'react-i18next'
import { Button } from './Button'

export function Pagination({ page, pageCount, onChange }: { page: number; pageCount: number; onChange: (page: number) => void }) {
  const { t } = useTranslation()
  if (pageCount <= 1) {
    return null
  }
  return (
    <nav aria-label={t('common.pagination')} className="mt-4 flex items-center justify-between text-sm text-slate-600">
      <span>{t('common.pageOf', { page: page + 1, count: pageCount })}</span>
      <div className="flex gap-2">
        <Button variant="secondary" disabled={page === 0} onClick={() => onChange(page - 1)}>{t('common.previous')}</Button>
        <Button variant="secondary" disabled={page >= pageCount - 1} onClick={() => onChange(page + 1)}>{t('common.next')}</Button>
      </div>
    </nav>
  )
}
