import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Friendship, Profile } from '../types'

export interface FriendWithProfile extends Friendship {
  profile: Profile
}

export interface UseFriendsState {
  friends: FriendWithProfile[]
  pendingRequests: FriendWithProfile[]
  loading: boolean
  error: string | null
  addFriend: (inviteCode: string) => Promise<{ error: string | null }>
  acceptRequest: (friendshipId: string) => Promise<{ error: string | null }>
  rejectRequest: (friendshipId: string) => Promise<{ error: string | null }>
  removeFriend: (friendshipId: string) => Promise<{ error: string | null }>
  refetch: () => Promise<void>
}

export function useFriends(userId: string | null): UseFriendsState {
  const [allFriendships, setAllFriendships] = useState<Friendship[]>([])
  const [profiles, setProfiles] = useState<Map<string, Profile>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchFriends = useCallback(async () => {
    if (!userId) {
      setAllFriendships([])
      setProfiles(new Map())
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)

    const { data, error: fetchError } = await supabase
      .from('friendships')
      .select('*')
      .or('requester_id.eq.' + userId + ',addressee_id.eq.' + userId)
      .order('created_at', { ascending: false })

    if (fetchError) {
      setError(fetchError.message)
      setLoading(false)
      return
    }

    const friendships = (data ?? []) as unknown as Friendship[]
    setAllFriendships(friendships)

    // Charger les profils des autres utilisateurs
    const otherIds = friendships.map(f =>
      f.requester_id === userId ? f.addressee_id : f.requester_id
    )
    const uniqueIds = [...new Set(otherIds)]

    if (uniqueIds.length > 0) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .in('id', uniqueIds)

      const map = new Map<string, Profile>()
      for (const p of (profileData ?? []) as unknown as Profile[]) {
        map.set(p.id, p)
      }
      setProfiles(map)
    } else {
      setProfiles(new Map())
    }

    setLoading(false)
  }, [userId])

  useEffect(() => {
    fetchFriends()
  }, [fetchFriends])

  function withProfile(f: Friendship): FriendWithProfile {
    const otherId = f.requester_id === userId ? f.addressee_id : f.requester_id
    const profile = profiles.get(otherId) ?? {
      id: otherId,
      email: '',
      display_name: 'Utilisateur',
      avatar_url: null,
      partner_id: null,
      created_at: '',
      updated_at: '',
    }
    return { ...f, profile }
  }

  const friends = allFriendships
    .filter(f => f.status === 'accepted')
    .map(withProfile)

  const pendingRequests = allFriendships
    .filter(f => f.status === 'pending' && f.addressee_id === userId)
    .map(withProfile)

  async function addFriend(inviteCode: string): Promise<{ error: string | null }> {
    if (!userId) return { error: 'Non connecté' }

    const code = inviteCode.trim()
    if (!code) return { error: 'Code invalide' }

    // Résoudre le code invite
    const { data: resolvedId } = await supabase
      .rpc('resolve_invite_code_for_friend', { code })

    if (!resolvedId) return { error: 'Code invalide ou utilisateur introuvable' }
    const targetId = resolvedId as string

    if (targetId === userId) return { error: 'Tu ne peux pas t\'ajouter toi-même' }

    // Vérifier doublon dans le state local (les deux sens)
    const exists = allFriendships.some(f =>
      (f.requester_id === userId && f.addressee_id === targetId) ||
      (f.requester_id === targetId && f.addressee_id === userId)
    )
    if (exists) return { error: 'Une relation existe déjà avec cet utilisateur' }

    // Insert
    const { data: inserted, error: insertError } = await supabase
      .from('friendships')
      .insert({ requester_id: userId, addressee_id: targetId })
      .select()
      .single()

    if (insertError) {
      // Doublon DB (race condition)
      if (insertError.code === '23505') return { error: 'Une relation existe déjà avec cet utilisateur' }
      return { error: insertError.message }
    }

    // Optimistic add
    const newFriendship = inserted as unknown as Friendship
    setAllFriendships(prev => [newFriendship, ...prev])

    // Charger le profil du nouvel ami
    const { data: targetProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', targetId)
      .single()

    if (targetProfile) {
      setProfiles(prev => {
        const next = new Map(prev)
        next.set(targetId, targetProfile as unknown as Profile)
        return next
      })
    }

    return { error: null }
  }

  async function acceptRequest(friendshipId: string): Promise<{ error: string | null }> {
    // Optimistic update
    setAllFriendships(prev =>
      prev.map(f => f.id !== friendshipId ? f : { ...f, status: 'accepted' as const })
    )

    const { error: updateError } = await supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('id', friendshipId)

    if (updateError) {
      await fetchFriends()
      return { error: updateError.message }
    }

    return { error: null }
  }

  async function rejectRequest(friendshipId: string): Promise<{ error: string | null }> {
    // Optimistic remove
    setAllFriendships(prev => prev.filter(f => f.id !== friendshipId))

    const { error: deleteError } = await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId)

    if (deleteError) {
      await fetchFriends()
      return { error: deleteError.message }
    }

    return { error: null }
  }

  async function removeFriend(friendshipId: string): Promise<{ error: string | null }> {
    // Optimistic remove
    setAllFriendships(prev => prev.filter(f => f.id !== friendshipId))

    const { error: deleteError } = await supabase
      .from('friendships')
      .delete()
      .eq('id', friendshipId)

    if (deleteError) {
      await fetchFriends()
      return { error: deleteError.message }
    }

    return { error: null }
  }

  return {
    friends,
    pendingRequests,
    loading,
    error,
    addFriend,
    acceptRequest,
    rejectRequest,
    removeFriend,
    refetch: fetchFriends,
  }
}
