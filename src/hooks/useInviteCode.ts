import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Charge le code d'invitation de l'utilisateur, en le générant et le
 * persistant s'il n'existe pas encore. N'affiche jamais un code non persisté
 * (sinon l'ami qui le saisit obtiendrait « Code invalide »).
 */
export function useInviteCode(userId: string | null | undefined) {
  const [inviteCode, setInviteCode] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    let cancelled = false

    async function loadOrCreateCode() {
      const { data, error } = await supabase
        .from('profiles')
        .select('invite_code')
        .eq('id', userId!)
        .single()

      if (cancelled) return

      if (error) {
        // Ne pas générer de nouveau code sur une erreur de lecture :
        // on risquerait d'écraser un code déjà partagé
        return
      }

      if (data?.invite_code) {
        setInviteCode(data.invite_code)
      } else {
        // Le select() relit la ligne : si un autre appareil a généré un code
        // entre-temps, on affiche la valeur réellement en base.
        const code = crypto.randomUUID().slice(0, 8).toUpperCase()
        const { data: updated, error: updateError } = await supabase
          .from('profiles')
          .update({ invite_code: code })
          .eq('id', userId!)
          .select('invite_code')
          .single()
        if (cancelled) return
        if (!updateError && updated?.invite_code) setInviteCode(updated.invite_code)
      }
    }

    loadOrCreateCode()
    return () => { cancelled = true }
  }, [userId])

  return inviteCode
}
