import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from './AuthContext'
import { useCoupleContext } from './CoupleContext'
import { useFriendsContext } from './FriendsContext'
import { useToast } from '../hooks/useToast'
import { supabase } from '../lib/supabase'
import { ensureMovie } from '../lib/movies'
import { tmdb } from '../lib/tmdb'
import type { TmdbMovie } from '../lib/tmdb'
import { RecommendModal } from '../components/movie/RecommendModal'
import { PosterHoldMenu } from '../components/hold/PosterHoldMenu'
import { HOLD_ZONES, zoneForDrag } from '../components/hold/holdZones'
import type { HoldZoneKey } from '../components/hold/holdZones'

interface HoldMenuApi {
  /** Le menu peut s'ouvrir (utilisateur connecté) */
  enabled: boolean
  /**
   * movieDbId : UUID de la table movies si déjà connu (évite un upsert avec données partielles).
   * partial : l'objet movie est incomplet (reco d'ami…) → refetch TMDB avant ensureMovie.
   */
  openMenu: (movie: TmdbMovie, rect: DOMRect, opts?: { movieDbId?: string; partial?: boolean }) => void
  moveDrag: (dx: number, dy: number) => void
  releaseDrag: (dx: number, dy: number) => void
  abortDrag: () => void
}

const HoldMenuContext = createContext<HoldMenuApi>({
  enabled: false,
  openMenu: () => {},
  moveDrag: () => {},
  releaseDrag: () => {},
  abortDrag: () => {},
})

// eslint-disable-next-line react-refresh/only-export-components
export function useHoldMenu() {
  return useContext(HoldMenuContext)
}

interface MenuState {
  movie: TmdbMovie
  movieDbId?: string
  partial?: boolean
  rect: { top: number; left: number; width: number; height: number }
  closing: boolean
}

/**
 * Orchestre le menu radial d'appui long sur une affiche : ouverture,
 * glisser sans relâcher vers une zone (coins + haut), exécution de
 * l'action au relâchement, toast de confirmation.
 */
export function HoldMenuProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { coupleId, partner } = useCoupleContext()
  const { friends } = useFriendsContext()
  const { toast, showToast } = useToast()

  const [menu, setMenu] = useState<MenuState | null>(null)
  const [drag, setDrag] = useState<{ dx: number; dy: number } | null>(null)
  const [recoMovie, setRecoMovie] = useState<TmdbMovie | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Valeurs fraîches pour les callbacks stables
  const stateRef = useRef({ user, coupleId, partner, friends, menu })
  stateRef.current = { user, coupleId, partner, friends, menu }

  const hasRecipients = !!partner || friends.length > 0

  // Zones proposées selon le contexte (pas de couple → pas de zones couple, etc.)
  const zones = useMemo(
    () => HOLD_ZONES.filter(z => {
      if ((z.key === 'col-couple' || z.key === 'wl-couple') && !coupleId) return false
      if (z.key === 'reco' && !hasRecipients) return false
      return true
    }),
    [coupleId, hasRecipients],
  )
  const zonesRef = useRef(zones)
  zonesRef.current = zones

  const closeMenu = useCallback(() => {
    setMenu(m => (m ? { ...m, closing: true } : m))
    setDrag(null)
    clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(() => setMenu(null), 220)
  }, [])

  const runAction = useCallback(async (key: HoldZoneKey, movie: TmdbMovie, opts?: { movieDbId?: string; partial?: boolean }) => {
    const { user, coupleId } = stateRef.current
    if (!user) return

    if (key === 'reco') {
      setRecoMovie(movie)
      return
    }

    try {
      let movieDbId = opts?.movieDbId
      if (!movieDbId) {
        // Objet partiel : on récupère la fiche TMDB complète pour ne pas
        // insérer un film amputé (synopsis, genres…) dans la table movies
        const toStore = opts?.partial ? await tmdb.getMovie(movie.id) : movie
        movieDbId = await ensureMovie(toStore)
      }

      if (key === 'wl-solo') {
        const { data: row } = await supabase.from('watchlist').select('id').is('couple_id', null).eq('added_by', user.id).eq('movie_id', movieDbId).maybeSingle()
        if (row) { showToast('Déjà dans ta liste solo'); return }
        const { error } = await supabase.from('watchlist').insert({ movie_id: movieDbId, added_by: user.id, couple_id: null })
        if (error) throw error
        showToast('Ajouté à ta liste solo ✓')

      } else if (key === 'wl-couple') {
        if (!coupleId) return
        const { data: row } = await supabase.from('watchlist').select('id').eq('couple_id', coupleId).eq('movie_id', movieDbId).maybeSingle()
        if (row) { showToast('Déjà dans la liste couple'); return }
        const { error } = await supabase.from('watchlist').insert({ movie_id: movieDbId, added_by: user.id, couple_id: coupleId })
        if (error) throw error
        showToast('Ajouté à la liste couple ✓')

      } else if (key === 'col-solo') {
        const { data: row } = await supabase.from('personal_collection').select('id').eq('user_id', user.id).eq('movie_id', movieDbId).maybeSingle()
        if (row) { showToast('Déjà dans ta collection solo'); return }
        // Retirer de la watchlist solo si présent (même logique que la fiche film)
        const { data: wlRow } = await supabase.from('watchlist').select('id').is('couple_id', null).eq('added_by', user.id).eq('movie_id', movieDbId).maybeSingle()
        if (wlRow) await supabase.from('watchlist').delete().eq('id', wlRow.id)
        const { error } = await supabase.from('personal_collection').insert({ movie_id: movieDbId, user_id: user.id, watched_at: new Date().toISOString() })
        if (error) throw error
        showToast('Ajouté à ta collection solo ✓')

      } else if (key === 'col-couple') {
        if (!coupleId) return
        const { data: row } = await supabase.from('collection').select('id').eq('couple_id', coupleId).eq('movie_id', movieDbId).maybeSingle()
        if (row) { showToast('Déjà dans la collection couple'); return }
        const { data: wlRow } = await supabase.from('watchlist').select('id').eq('couple_id', coupleId).eq('movie_id', movieDbId).maybeSingle()
        if (wlRow) await supabase.from('watchlist').delete().eq('id', wlRow.id)
        const { error } = await supabase.from('collection').insert({ movie_id: movieDbId, couple_id: coupleId, watched_at: new Date().toISOString() })
        if (error) throw error
        showToast('Ajouté à la collection couple ✓')
      }
    } catch {
      showToast('Erreur, réessaie')
    }
  }, [showToast])

  const api = useMemo<HoldMenuApi>(() => ({
    enabled: !!user,
    openMenu: (movie, rect, opts) => {
      clearTimeout(closeTimer.current)
      setDrag(null)
      setMenu({ movie, movieDbId: opts?.movieDbId, partial: opts?.partial, rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height }, closing: false })
    },
    moveDrag: (dx, dy) => {
      setDrag({ dx, dy })
    },
    releaseDrag: (dx, dy) => {
      const current = stateRef.current.menu
      if (!current || current.closing) return
      const hit = zoneForDrag(dx, dy, zonesRef.current)
      if (hit && hit.progress >= 1) {
        void runAction(hit.zone.key, current.movie, { movieDbId: current.movieDbId, partial: current.partial })
      }
      closeMenu()
    },
    abortDrag: () => closeMenu(),
  }), [user, runAction, closeMenu])

  // Zone visée et tier de proximité pour le rendu
  const hit = menu && !menu.closing && drag ? zoneForDrag(drag.dx, drag.dy, zones) : null
  const activeKey = hit ? hit.zone.key : null
  const tier: 0 | 1 | 2 | 3 = !hit ? 0 : hit.progress >= 1 ? 3 : hit.progress >= 0.75 ? 2 : 1

  return (
    <HoldMenuContext.Provider value={api}>
      {children}

      {menu && createPortal(
        <PosterHoldMenu
          movie={menu.movie}
          rect={menu.rect}
          closing={menu.closing}
          zones={zones}
          activeKey={activeKey}
          tier={tier}
          drag={menu.closing ? null : drag}
        />,
        document.body,
      )}

      {recoMovie && (
        <RecommendModal
          movieId={recoMovie.id}
          tvShowId={null}
          title={recoMovie.title}
          open
          onClose={() => setRecoMovie(null)}
          onBeforeSend={() => ensureMovie(recoMovie)}
        />
      )}

      {toast && createPortal(
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[80] bg-green-600 text-white text-sm px-4 py-2 rounded-full shadow-lg">
          {toast}
        </div>,
        document.body,
      )}
    </HoldMenuContext.Provider>
  )
}
