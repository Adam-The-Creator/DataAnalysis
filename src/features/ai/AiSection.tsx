import type { ReactNode } from 'react'
import type { AiOutput } from '@/api/types'
import { ErrorView, LoadingBlock } from '@/components/ui/states'
import { AiNotice } from './AiBox'

/** The loading, error and "no result" states of a query that returns an AI output. The children get the output with a result. */
export function AiSection<T>({ query, children }: {
  query: { isPending: boolean; isError: boolean; error: unknown; data?: AiOutput<T>; refetch: () => unknown }
  children: (output: AiOutput<T> & { result: T }) => ReactNode
}) {
  if (query.isPending) return <LoadingBlock />
  if (query.isError) return <ErrorView error={query.error} onRetry={() => void query.refetch()} />
  const output = query.data!
  if (output.status !== 'ok' || output.result === null) return <AiNotice output={output} />
  return <>{children(output as AiOutput<T> & { result: T })}</>
}
