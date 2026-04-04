// TODO: Connecter useAuth() une fois la config Supabase en place

export function ProfilePage() {
  return (
    <div className="max-w-2xl mx-auto px-4 pt-6">
      <h1 className="text-xl font-bold text-[var(--color-text)] mb-6">Profil</h1>

      {/* Placeholder état non-connecté */}
      <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-[var(--color-surface-2)] flex items-center justify-center text-3xl mx-auto mb-4">
          👤
        </div>
        <p className="text-[var(--color-text)] font-semibold mb-1">Connexion requise</p>
        <p className="text-[var(--color-text-muted)] text-sm mb-4">
          Connectez-vous pour synchroniser votre liste avec votre partenaire
        </p>

        <div className="space-y-3">
          <input
            type="email"
            placeholder="Email"
            className="w-full bg-[var(--color-surface-2)] text-[var(--color-text)] placeholder-[var(--color-text-muted)] px-4 py-3 rounded-xl border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] text-sm"
          />
          <input
            type="password"
            placeholder="Mot de passe"
            className="w-full bg-[var(--color-surface-2)] text-[var(--color-text)] placeholder-[var(--color-text-muted)] px-4 py-3 rounded-xl border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] text-sm"
          />
          <button className="w-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-xl py-3 font-medium text-sm transition-colors">
            Se connecter
          </button>
          <button className="w-full text-[var(--color-text-muted)] text-sm hover:text-[var(--color-text)] transition-colors">
            Créer un compte
          </button>
        </div>
      </div>
    </div>
  )
}
