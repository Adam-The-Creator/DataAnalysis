import { QueryClient } from '@tanstack/react-query'
import { ApiError, NotImplementedError } from '@/api/errors'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // Retrying a missing feature or a client error (4xx) never helps, a flaky network sometimes does.
      retry: (failureCount, error) => {
        if (error instanceof NotImplementedError) return false
        if (error instanceof ApiError && error.kind === 'http' && error.status !== null && error.status < 500) return false
        return failureCount < 1
      },
    },
  },
})
