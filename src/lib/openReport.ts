import { getApi } from '@/api'

/** Opens a stored report (a self-contained HTML file) in a new browser tab. */
export async function openReport(reportId: string): Promise<void> {
  const html = await getApi().analysis.reportHtml(reportId)
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
  const link = document.createElement('a')
  link.href = url
  link.target = '_blank'
  link.rel = 'noopener'
  link.click()
  // The new tab has loaded the page long before this fires.
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
