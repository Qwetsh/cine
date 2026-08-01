// Lien d'invitation partageable : ouvre l'app avec ?invite=CODE.
// Le code est capturé par InviteCapture (App.tsx) et survit au login/signup
// via localStorage, puis la demande d'ami est envoyée automatiquement.

export const PENDING_INVITE_KEY = 'cine-pending-invite'

export function buildInviteUrl(code: string): string {
  return window.location.origin + import.meta.env.BASE_URL + '?invite=' + encodeURIComponent(code)
}

/** Partage le lien d'invitation (Web Share si dispo, sinon copie). Retourne le mode utilisé. */
export async function shareInviteLink(code: string): Promise<'shared' | 'copied' | 'failed'> {
  const url = buildInviteUrl(code)
  const text = 'Rejoins-moi sur Ciné pour partager nos films ! 🎬'

  if (navigator.share) {
    try {
      await navigator.share({ title: 'Ciné', text, url })
      return 'shared'
    } catch (e) {
      // AbortError = l'utilisateur a annulé le partage : ne pas basculer sur la copie
      if (e instanceof DOMException && e.name === 'AbortError') return 'failed'
    }
  }

  try {
    await navigator.clipboard.writeText(url)
    return 'copied'
  } catch {
    return 'failed'
  }
}

export function getPendingInviteCode(): string | null {
  return localStorage.getItem(PENDING_INVITE_KEY)
}

export function storePendingInviteCode(code: string) {
  localStorage.setItem(PENDING_INVITE_KEY, code)
}

export function clearPendingInviteCode() {
  localStorage.removeItem(PENDING_INVITE_KEY)
}
