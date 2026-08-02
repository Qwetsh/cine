import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from './AuthContext'
import { useCoupleContext } from './CoupleContext'
import { useFriendsContext } from './FriendsContext'
import { useToast } from '../hooks/useToast'
import { supabase } from '../lib/supabase'
import { ensureMovie } from '../lib/movies'
import { ensureTvShow } from '../lib/tvShows'
import { tmdb } from '../lib/tmdb'
import type { TmdbMovie } from '../lib/tmdb'
import { RecommendModal } from '../components/movie/RecommendModal'
import { PosterHoldMenu } from '../components/hold/PosterHoldMenu'
import { HOLD_ZONES, placeZones, zoneAtPoint, tierForDist } from '../components/hold/holdZones'
import type { HoldZoneKey, PlacedZone } from '../components/hold/holdZones'

interface HoldMenuApi {
  /** Le menu peut s'ouvrir (utilisateur connecté) */
  enabled: boolean
  /**
   * origin : point d'appui du doigt (viewport) — les bulles se placent en cercle autour.
   * movieDbId : UUID de la table movies si déjà connu (évite un upsert avec données partielles).
   * partial : l'objet movie est incomplet (reco d'ami…) → refetch TMDB avant ensureMovie.
   */
  openMenu: (movie: TmdbMovie, rect: DOMRect, origin: { x: number; y: number }, opts?: { movieDbId?: string; partial?: boolean }) => void
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

/** Position du doigt = point d'appui + vecteur de glissement */
function fingerAt(origin: { x: number; y: number }, drag: { dx: number; dy: number }) {
  return { x: origin.x + drag.dx, y: origin.y + drag.dy }
}

// eslint-disable-next-line react-refresh/only-export-components
export function useHoldMenu() {
  return useContext(HoldMenuContext)
}

interface MenuState {
  movie: TmdbMovie
  movieDbId?: string
  partial?: boolean
  rect: { top: number; left: number; width: number; height: number }
  origin: { x: number; y: number }
  /** Bulles placées en cercle autour du point d'appui (figées à l'ouverture) */
  placed: PlacedZone[]
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
  useEffect(() => {
    zonesRef.current = zones
  }, [zones])

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

    const isTv = (movie as TmdbMovie & { media_type?: string }).media_type === 'tv'

    try {
      let dbId = opts?.movieDbId
      if (!dbId) {
        if (isTv) {
          // L'objet série est normalisé en forme film (title…) : on refetch
          // toujours la fiche TV brute avant insertion dans tv_shows
          dbId = await ensureTvShow(await tmdb.getTvShow(movie.id))
        } else {
          // Objet partiel : on récupère la fiche TMDB complète pour ne pas
          // insérer un film amputé (synopsis, genres…) dans la table movies
          const toStore = opts?.partial ? await tmdb.getMovie(movie.id) : movie
          dbId = await ensureMovie(toStore)
        }
      }

      // Tables et colonne de référence selon le média
      const wlTable = isTv ? 'tv_watchlist' : 'watchlist'
      const colTable = isTv ? 'tv_collection' : 'collection'
      const persoTable = isTv ? 'tv_personal_collection' : 'personal_collection'
      const idCol = isTv ? 'tv_show_id' : 'movie_id'

      if (key === 'wl-solo') {
        const { data: row } = await supabase.from(wlTable).select('id').is('couple_id', null).eq('added_by', user.id).eq(idCol, dbId).maybeSingle()
        if (row) { showToast('Déjà dans ta liste solo'); return }
        const { error } = await supabase.from(wlTable).insert({ [idCol]: dbId, added_by: user.id, couple_id: null })
        if (error) throw error
        showToast('Ajouté à ta liste solo ✓')

      } else if (key === 'wl-couple') {
        if (!coupleId) return
        const { data: row } = await supabase.from(wlTable).select('id').eq('couple_id', coupleId).eq(idCol, dbId).maybeSingle()
        if (row) { showToast('Déjà dans la liste couple'); return }
        const { error } = await supabase.from(wlTable).insert({ [idCol]: dbId, added_by: user.id, couple_id: coupleId })
        if (error) throw error
        showToast('Ajouté à la liste couple ✓')

      } else if (key === 'col-solo') {
        const { data: row } = await supabase.from(persoTable).select('id').eq('user_id', user.id).eq(idCol, dbId).maybeSingle()
        if (row) { showToast('Déjà dans ta collection solo'); return }
        // Retirer de la watchlist solo si présent (même logique que la fiche film)
        const { data: wlRow } = await supabase.from(wlTable).select('id').is('couple_id', null).eq('added_by', user.id).eq(idCol, dbId).maybeSingle()
        if (wlRow) await supabase.from(wlTable).delete().eq('id', wlRow.id)
        const { error } = await supabase.from(persoTable).insert({ [idCol]: dbId, user_id: user.id, watched_at: new Date().toISOString() })
        if (error) throw error
        showToast('Ajouté à ta collection solo ✓')

      } else if (key === 'col-couple') {
        if (!coupleId) return
        const { data: row } = await supabase.from(colTable).select('id').eq('couple_id', coupleId).eq(idCol, dbId).maybeSingle()
        if (row) { showToast('Déjà dans la collection couple'); return }
        const { data: wlRow } = await supabase.from(wlTable).select('id').eq('couple_id', coupleId).eq(idCol, dbId).maybeSingle()
        if (wlRow) await supabase.from(wlTable).delete().eq('id', wlRow.id)
        const { error } = await supabase.from(colTable).insert({ [idCol]: dbId, couple_id: coupleId, watched_at: new Date().toISOString() })
        if (error) throw error
        showToast('Ajouté à la collection couple ✓')
      }
    } catch {
      showToast('Erreur, réessaie')
    }
  }, [showToast])

  const api = useMemo<HoldMenuApi>(() => ({
    enabled: !!user,
    openMenu: (movie, rect, origin, opts) => {
      clearTimeout(closeTimer.current)
      setDrag(null)
      const placed = placeZones(zonesRef.current, origin, { width: window.innerWidth, height: window.innerHeight })
      setMenu({
        movie,
        movieDbId: opts?.movieDbId,
        partial: opts?.partial,
        rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
        origin,
        placed,
        closing: false,
      })
    },
    moveDrag: (dx, dy) => {
      setDrag({ dx, dy })
    },
    releaseDrag: (dx, dy) => {
      const current = stateRef.current.menu
      if (!current || current.closing) return
      const finger = fingerAt(current.origin, { dx, dy })
      const hit = zoneAtPoint(current.placed, finger.x, finger.y)
      if (hit) {
        void runAction(hit.zone.key, current.movie, { movieDbId: current.movieDbId, partial: current.partial })
      }
      closeMenu()
    },
    abortDrag: () => closeMenu(),
  }), [user, runAction, closeMenu])

  // Bulle survolée et tier de proximité pour le rendu
  const finger = menu && !menu.closing && drag ? fingerAt(menu.origin, drag) : null
  const hit = menu && finger ? zoneAtPoint(menu.placed, finger.x, finger.y) : null
  const activeKey = hit ? hit.zone.key : null
  const tier: 0 | 1 | 2 | 3 = hit ? tierForDist(hit.dist) : 0

  return (
    <HoldMenuContext.Provider value={api}>
      {children}

      {menu && createPortal(
        <PosterHoldMenu
          movie={menu.movie}
          rect={menu.rect}
          closing={menu.closing}
          zones={menu.placed}
          activeKey={activeKey}
          tier={tier}
          drag={menu.closing ? null : drag}
        />,
        document.body,
      )}

      {recoMovie && (
        <RecommendModal
          movieId={(recoMovie as TmdbMovie & { media_type?: string }).media_type === 'tv' ? null : recoMovie.id}
          tvShowId={(recoMovie as TmdbMovie & { media_type?: string }).media_type === 'tv' ? recoMovie.id : null}
          title={recoMovie.title}
          open
          onClose={() => setRecoMovie(null)}
          onBeforeSend={() =>
            (recoMovie as TmdbMovie & { media_type?: string }).media_type === 'tv'
              ? tmdb.getTvShow(recoMovie.id).then(ensureTvShow)
              : ensureMovie(recoMovie)
          }
        />
      )}

      {toast && createPortal(
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] bg-green-600 text-white text-sm px-4 py-2 rounded-full shadow-lg">
          {toast}
        </div>,
        document.body,
      )}
    </HoldMenuContext.Provider>
  )
}
