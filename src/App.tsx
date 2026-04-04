import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ErrorBoundary } from './components/layout/ErrorBoundary'
import { AuthProvider } from './contexts/AuthContext'
import { CoupleProvider } from './contexts/CoupleContext'
import { AppLayout } from './components/layout/AppLayout'
import { ProtectedRoute } from './components/layout/ProtectedRoute'
import { LoginPage } from './pages/LoginPage'
import { HomePage } from './pages/HomePage'
import { SearchPage } from './pages/SearchPage'
import { WatchlistPage } from './pages/WatchlistPage'
import { CollectionPage } from './pages/CollectionPage'
import { MovieDetailPage } from './pages/MovieDetailPage'
import { ProfilePage } from './pages/ProfilePage'

export function App() {
  return (
    <ErrorBoundary>
    <AuthProvider>
      <CoupleProvider>
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <Routes>
            {/* Route publique */}
            <Route path="/login" element={<LoginPage />} />

            {/* Routes protégées */}
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route index element={<HomePage />} />
                <Route path="search" element={<SearchPage />} />
                <Route path="watchlist" element={<WatchlistPage />} />
                <Route path="collection" element={<CollectionPage />} />
                <Route path="movie/:id" element={<MovieDetailPage />} />
                <Route path="profile" element={<ProfilePage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </CoupleProvider>
    </AuthProvider>
    </ErrorBoundary>
  )
}
