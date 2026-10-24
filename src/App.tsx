import { QueryClientProvider } from '@tanstack/react-query'
import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router'
import { AuthProvider } from '@/auth/AuthProvider'
import { RequireAuth, RequireRole } from '@/auth/guards'
import { AppShell } from '@/components/layout/AppShell'
import { LoadingBlock } from '@/components/ui/states'
import { LoginPage } from '@/features/auth/LoginPage'
import { RoleHome } from '@/features/dashboard/RoleHome'
import { NotFoundPage } from '@/features/NotFoundPage'
import { ParticipantPage } from '@/features/participants/ParticipantPage'
import { ParticipantsPage } from '@/features/participants/ParticipantsPage'
import { PlayerHomePage } from '@/features/player/PlayerHomePage'
import { ReportsPage } from '@/features/reports/ReportsPage'
import { RoadmapPage } from '@/features/roadmap/RoadmapPage'
import { SessionDetailPage } from '@/features/sessions/SessionDetailPage'
import { SessionsPage } from '@/features/sessions/SessionsPage'
import { queryClient } from '@/queryClient'

// The pages with the 3D viewer pull in three.js (most of the bundle), so they are loaded when first opened.
const DrawingPage = lazy(() => import('@/features/drawings/DrawingPage').then((m) => ({ default: m.DrawingPage })))
const ComparePage = lazy(() => import('@/features/compare/ComparePage').then((m) => ({ default: m.ComparePage })))

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<LoadingBlock />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />

              {/* Everything below needs a logged in user */}
              <Route element={<RequireAuth />}>
                <Route element={<AppShell />}>
                  <Route index element={<RoleHome />} />

                  {/* Psychologists: analysis (requirements ACC-01, REP-06) */}
                  <Route element={<RequireRole role="psychologist" />}>
                    <Route path="sessions" element={<SessionsPage />} />
                    <Route path="sessions/:sessionId" element={<SessionDetailPage />} />
                    <Route path="drawings/:drawingId" element={<DrawingPage />} />
                    <Route path="participants" element={<ParticipantsPage />} />
                    <Route path="participants/:playerId" element={<ParticipantPage />} />
                    <Route path="compare" element={<ComparePage />} />
                    <Route path="reports" element={<ReportsPage />} />
                    <Route path="roadmap" element={<RoadmapPage />} />
                  </Route>

                  {/* Players: their own records only (requirement ACC-02) */}
                  <Route element={<RequireRole role="player" />}>
                    <Route path="my" element={<PlayerHomePage />} />
                    <Route path="my/drawings/:drawingId" element={<DrawingPage />} />
                  </Route>

                  <Route path="*" element={<NotFoundPage />} />
                </Route>
              </Route>
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
