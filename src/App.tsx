import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ErrorBoundary } from './components/layout/ErrorBoundary'
import { AuthProvider } from './contexts/AuthContext'
import { CoupleProvider } from './contexts/CoupleContext'
import { FriendsProvider } from './contexts/FriendsContext'
import { AppLayout } from './components/layout/AppLayout'
import { ProtectedRoute } from './components/layout/ProtectedRoute'
import { LoginPage } from './pages/LoginPage'
import { HomePage } from './pages/HomePage'
import { SearchPage } from './pages/SearchPage'
import { WatchlistPage } from './pages/WatchlistPage'
import { CollectionPage } from './pages/CollectionPage'
import { MovieDetailPage } from './pages/MovieDetailPage'
import { ProfilePage } from './pages/ProfilePage'
import { MovieNightPage } from './pages/MovieNightPage'
import { PersonPage } from './pages/PersonPage'
import { TvDetailPage } from './pages/TvDetailPage'
import { TvSeasonDetailPage } from './pages/TvSeasonDetailPage'
import { TvEpisodeDetailPage } from './pages/TvEpisodeDetailPage'
import { FriendRecommendationsPage } from './pages/FriendRecommendationsPage'
import { FriendsListPage } from './pages/FriendsListPage'
import { FriendProfilePage } from './pages/FriendProfilePage'

export function App() {
  return (
    <ErrorBoundary>
    <AuthProvider>
      <CoupleProvider>
      <FriendsProvider>
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
                <Route path="pick" element={<MovieNightPage />} />
                <Route path="movie/:id" element={<MovieDetailPage />} />
                <Route path="person/:id" element={<PersonPage />} />
                <Route path="tv/:id" element={<TvDetailPage />} />
                <Route path="tv/:id/season/:seasonNumber" element={<TvSeasonDetailPage />} />
                <Route path="tv/:id/season/:seasonNumber/episode/:episodeNumber" element={<TvEpisodeDetailPage />} />
                <Route path="recommendations" element={<FriendRecommendationsPage />} />
                <Route path="friends" element={<FriendsListPage />} />
                <Route path="friend/:userId" element={<FriendProfilePage />} />
                <Route path="profile" element={<ProfilePage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </FriendsProvider>
      </CoupleProvider>
    </AuthProvider>
    </ErrorBoundary>
  )
}
