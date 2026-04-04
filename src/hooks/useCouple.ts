import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Couple, Profile } from '../types'

export interface CoupleState {
  coupleId: string | null
  couple: Couple | null
  partner: Profile | null
  isUser1: boolean
  loading: boolean
  linkPartner: (partnerUserId: string) => Promise<{ error: string | null }>
  refresh: () => Promise<void>
}

export function useCouple(userId: string | null): CoupleState {
  const [couple, setCouple] = useState<Couple | null>(null)
  const [partner, setPartner] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchCouple = useCallback(async () => {
    if (!userId) {
      setLoading(false)
      return
    }
    setLoading(true)

    const { data } = await supabase
      .from('couples')
      .select('*')
      .or('user1_id.eq.' + userId + ',user2_id.eq.' + userId)
      .maybeSingle()

    if (data) {
      setCouple(data)
      const partnerId = data.user1_id === userId ? data.user2_id : data.user1_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', partnerId)
        .single()
      setPartner(profile)
    } else {
      setCouple(null)
      setPartner(null)
    }

    setLoading(false)
  }, [userId])

  useEffect(() => {
    fetchCouple()
  }, [fetchCouple])

  async function linkPartner(partnerCode: string): Promise<{ error: string | null }> {
    if (!userId) return { error: 'Non connecté' }

    partnerCode = partnerCode.trim()
    if (!partnerCode) return { error: 'Code invalide' }

    // Résoudre le code d'invitation vers un user ID (via fonction SECURITY DEFINER)
    const { data: resolvedId } = await supabase
      .rpc('resolve_invite_code', { code: partnerCode })

    if (!resolvedId) return { error: 'Code invalide ou utilisateur introuvable' }
    const partnerUserId = resolvedId as string

    if (partnerUserId === userId) return { error: 'Vous ne pouvez pas vous lier à vous-même' }

    // Vérifier qu'un couple n'existe pas déjà pour nous
    const { data: existing } = await supabase
      .from('couples')
      .select('id')
      .or('user1_id.eq.' + userId + ',user2_id.eq.' + userId)
      .maybeSingle()

    if (existing) return { error: 'Vous avez déjà un partenaire lié' }

    // Vérifier que le partenaire n'est pas déjà dans un couple
    const { data: partnerExisting } = await supabase
      .from('couples')
      .select('id')
      .or('user1_id.eq.' + partnerUserId + ',user2_id.eq.' + partnerUserId)
      .maybeSingle()

    if (partnerExisting) return { error: 'Ce partenaire est déjà lié à quelqu\'un' }

    // Créer le couple — une contrainte UNIQUE (user1_id, user2_id) côté DB
    // empêche les doublons en cas de race condition résiduelle
    const { error: coupleError } = await supabase
      .from('couples')
      .insert({ user1_id: userId, user2_id: partnerUserId })

    if (coupleError) {
      return { error: 'Impossible de créer le couple. Réessayez.' }
    }

    // Mettre à jour partner_id sur les deux profils (via fonction SECURITY DEFINER)
    await supabase.rpc('link_partners', { user_a: userId, user_b: partnerUserId })

    await fetchCouple()
    return { error: null }
  }

  const isUser1 = couple?.user1_id === userId

  return {
    coupleId: couple?.id ?? null,
    couple,
    partner,
    isUser1,
    loading,
    linkPartner,
    refresh: fetchCouple,
  }
}
