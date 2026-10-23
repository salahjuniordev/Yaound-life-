import { useEffect, useState, type FormEvent } from 'react';
import { useGame } from '../state/store';
import type { AuthResult } from '../persistence/supabase';
import { Icon } from './icons';

type AuthMode = 'signin' | 'signup' | 'reset';

function getCopy(fr: boolean) {
  return fr
    ? {
        account: 'Compte',
        close: 'Fermer',
        signIn: 'Se connecter',
        signUp: 'Créer un compte',
        reset: 'Mot de passe oublié',
        email: 'Email',
        password: 'Mot de passe',
        confirmPassword: 'Confirmer le mot de passe',
        newPassword: 'Nouveau mot de passe',
        displayName: 'Nom affiché',
        saveName: 'Enregistrer le nom',
        updatePassword: 'Changer le mot de passe',
        signedOutTitle: 'Synchronisation cloud',
        signedOutText: 'Connecte-toi pour retrouver ta progression sur tous tes appareils.',
        offline: 'Hors-ligne : ta progression reste sur cet appareil.',
        anonymous: 'Compte anonyme',
        anonymousText: 'Crée un compte pour protéger ta progression et la retrouver ailleurs.',
        signedInAs: 'Connecté en tant que',
        emailUnverified: 'Email non confirmé',
        resend: "Renvoyer l'email",
        upgradeTitle: 'Créer un compte permanent',
        upgradeText: 'Ton personnage et tes sauvegardes restent liés.',
        upgrade: 'Créer le compte',
        existing: 'Tu as déjà un compte ?',
        useExisting: 'Se connecter à un autre compte',
        hideExisting: 'Masquer la connexion',
        sync: 'Synchronisation',
        push: 'Envoyer la sauvegarde',
        pull: 'Charger la sauvegarde cloud',
        signOut: 'Se déconnecter',
        deleteCloud: 'Supprimer les données cloud',
        deleteConfirm: 'Supprimer toutes tes sauvegardes cloud ? La sauvegarde locale reste sur cet appareil.',
        signOutConfirm: 'Se déconnecter ? La sauvegarde locale reste sur cet appareil.',
        forgot: 'Mot de passe oublié ?',
        back: 'Retour à la connexion',
        noAccount: 'Pas encore de compte ?',
        haveAccount: 'Déjà un compte ?',
        createOne: 'Créer un compte',
        passwordHint: '6 caractères minimum.',
        fillFields: 'Remplis tous les champs.',
        invalidEmail: 'Adresse email invalide.',
        shortPassword: 'Le mot de passe doit contenir au moins 6 caractères.',
        mismatch: 'Les mots de passe ne correspondent pas.',
        resetHelp: 'Entre ton email pour recevoir un lien de réinitialisation.',
        sendReset: 'Envoyer le lien',
        chooseAccount: 'Ton compte',
        guestNote: 'La connexion remplace la session anonyme actuelle. La sauvegarde locale reste disponible.',
        localSave: 'Sauvegarde locale conservée.',
        cloudNote: 'La synchronisation est optionnelle. Sans compte, tout reste sur cet appareil.',
      }
    : {
        account: 'Account',
        close: 'Close',
        signIn: 'Sign in',
        signUp: 'Create account',
        reset: 'Forgot password',
        email: 'Email',
        password: 'Password',
        confirmPassword: 'Confirm password',
        newPassword: 'New password',
        displayName: 'Display name',
        saveName: 'Save name',
        updatePassword: 'Change password',
        signedOutTitle: 'Cloud sync',
        signedOutText: 'Sign in to continue your progress on all your devices.',
        offline: 'Offline: progress stays on this device.',
        anonymous: 'Anonymous account',
        anonymousText: 'Create an account to protect your progress and use it on other devices.',
        signedInAs: 'Signed in as',
        emailUnverified: 'Email not confirmed',
        resend: 'Resend email',
        upgradeTitle: 'Create a permanent account',
        upgradeText: 'Your character and saves stay linked.',
        upgrade: 'Create account',
        existing: 'Already have an account?',
        useExisting: 'Sign in to another account',
        hideExisting: 'Hide sign in',
        sync: 'Sync',
        push: 'Push save',
        pull: 'Load cloud save',
        signOut: 'Sign out',
        deleteCloud: 'Delete cloud data',
        deleteConfirm: 'Delete all your cloud saves? The local save stays on this device.',
        signOutConfirm: 'Sign out? The local save stays on this device.',
        forgot: 'Forgot password?',
        back: 'Back to sign in',
        noAccount: 'No account yet?',
        haveAccount: 'Already have an account?',
        createOne: 'Create one',
        passwordHint: 'At least 6 characters.',
        fillFields: 'Fill in every field.',
        invalidEmail: 'Invalid email address.',
        shortPassword: 'Password must be at least 6 characters.',
        mismatch: 'Passwords do not match.',
        resetHelp: 'Enter your email to receive a reset link.',
        sendReset: 'Send reset link',
        chooseAccount: 'Your account',
        guestNote: 'Signing in replaces the current anonymous session. The local save stays available.',
        localSave: 'Local save kept.',
        cloudNote: 'Cloud sync is optional. Without an account everything stays on this device.',
      };
}

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function useFrench(): boolean {
  const engineLang = useGame((s) => s.engine?.state.settings.language ?? null);
  if (engineLang) return engineLang === 'fr';
  return (typeof localStorage !== 'undefined' ? localStorage.getItem('yaounde-lang') : null) === 'fr';
}

export function AccountModal() {
  const open = useGame((s) => s.accountOpen);
  const close = useGame((s) => s.closeAccount);
  const fr = useFrench();
  const t = getCopy(fr);
  if (!open) return null;
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={close}>
      <div className="modal account-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-kicker">
          <Icon name="account" size={14} /> {t.account}
        </div>
        <h2>{t.chooseAccount}</h2>
        <AccountBody />
        <button className="muted small" style={{ alignSelf: 'flex-start', marginTop: 10 }} onClick={close}>
          {t.close}
        </button>
      </div>
    </div>
  );
}

export function AccountPanel() {
  return <AccountBody />;
}

function AccountBody() {
  const fr = useFrench();
  const t = getCopy(fr);
  const cloud = useGame((s) => s.cloud);
  const engine = useGame((s) => s.engine);
  const cloudMessage = useGame((s) => s.cloudMessage);
  const authSignIn = useGame((s) => s.authSignIn);
  const authSignUp = useGame((s) => s.authSignUp);
  const authSignOut = useGame((s) => s.authSignOut);
  const authResetPassword = useGame((s) => s.authResetPassword);
  const authUpdatePassword = useGame((s) => s.authUpdatePassword);
  const authUpdateDisplayName = useGame((s) => s.authUpdateDisplayName);
  const authResendConfirmation = useGame((s) => s.authResendConfirmation);
  const authDeleteCloud = useGame((s) => s.authDeleteCloud);
  const syncCloud = useGame((s) => s.syncCloud);
  const loadCloudLast = useGame((s) => s.loadCloudLast);
  const closeAccount = useGame((s) => s.closeAccount);

  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [displayName, setDisplayName] = useState(cloud.displayName ?? '');
  const [newPassword, setNewPassword] = useState('');
  const [showExisting, setShowExisting] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    setDisplayName(cloud.displayName ?? '');
  }, [cloud.displayName]);

  const locale = fr ? 'fr' : 'en';
  const emailOk = validEmail(email);

  async function run(key: string, action: () => Promise<AuthResult>): Promise<AuthResult> {
    setBusy(key);
    setMsg(null);
    const result = await action();
    setMsg({ text: result.message, ok: result.ok });
    if (result.ok) {
      setPassword('');
      setConfirm('');
    }
    setBusy(null);
    return result;
  }

  function submitSignIn(event: FormEvent) {
    event.preventDefault();
    if (!emailOk) return setMsg({ text: t.invalidEmail, ok: false });
    if (!password) return setMsg({ text: t.fillFields, ok: false });
    void run('signin', () => authSignIn(email, password));
  }

  function submitSignUp(event: FormEvent) {
    event.preventDefault();
    if (!emailOk) return setMsg({ text: t.invalidEmail, ok: false });
    if (password.length < 6) return setMsg({ text: t.shortPassword, ok: false });
    if (password !== confirm) return setMsg({ text: t.mismatch, ok: false });
    void run('signup', () => authSignUp(email, password));
  }

  function submitReset(event: FormEvent) {
    event.preventDefault();
    if (!emailOk) return setMsg({ text: t.invalidEmail, ok: false });
    void run('reset', () => authResetPassword(email));
  }

  function submitPassword(event: FormEvent) {
    event.preventDefault();
    if (newPassword.length < 6) return setMsg({ text: t.shortPassword, ok: false });
    void run('password', () => authUpdatePassword(newPassword)).then((result) => {
      if (result.ok) setNewPassword('');
    });
  }

  function submitName(event: FormEvent) {
    event.preventDefault();
    void run('name', () => authUpdateDisplayName(displayName, locale));
  }

  const message = msg ? (
    <p className={`account-msg ${msg.ok ? 'ok' : 'error'}`}>{msg.text}</p>
  ) : cloudMessage ? (
    <p className="account-msg muted">{cloudMessage}</p>
  ) : null;

  if (!cloud.connected) {
    return (
      <div>
        <p className="muted small">{t.signedOutText}</p>
        {cloud.lastError && <p className="muted small">{cloud.lastError}</p>}
        <div className="chip-row account-tabs">
          <button className={mode === 'signin' ? 'selected' : ''} onClick={() => setMode('signin')}>
            {t.signIn}
          </button>
          <button className={mode === 'signup' ? 'selected' : ''} onClick={() => setMode('signup')}>
            {t.signUp}
          </button>
        </div>

        {mode === 'signin' && (
          <form className="account-form" onSubmit={submitSignIn}>
            <label>
              {t.email}
              <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label>
              {t.password}
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <button className="menu-btn account-submit" type="submit" disabled={busy !== null || !emailOk || !password}>
              {busy === 'signin' ? '…' : t.signIn}
            </button>
            <button className="muted small" type="button" onClick={() => setMode('reset')}>
              {t.forgot}
            </button>
          </form>
        )}

        {mode === 'signup' && (
          <form className="account-form" onSubmit={submitSignUp}>
            <label>
              {t.email}
              <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label>
              {t.password}
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <label>
              {t.confirmPassword}
              <input
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </label>
            <p className="muted small">{t.passwordHint}</p>
            <button
              className="menu-btn account-submit"
              type="submit"
              disabled={busy !== null || !emailOk || password.length < 6 || password !== confirm}
            >
              {busy === 'signup' ? '…' : t.signUp}
            </button>
          </form>
        )}

        {mode === 'reset' && (
          <form className="account-form" onSubmit={submitReset}>
            <p className="muted small">{t.resetHelp}</p>
            <label>
              {t.email}
              <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <button className="menu-btn account-submit" type="submit" disabled={busy !== null || !emailOk}>
              {busy === 'reset' ? '…' : t.sendReset}
            </button>
            <button className="muted small" type="button" onClick={() => setMode('signin')}>
              {t.back}
            </button>
          </form>
        )}

        {message}
        <p className="muted small">{t.cloudNote}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="account-status">
        <Icon name={cloud.anonymous ? 'account' : 'cloud'} size={20} />
        <div className="account-status-main">
          <strong>{cloud.anonymous ? t.anonymous : cloud.email ?? t.signedInAs}</strong>
          <div className="muted small">
            {cloud.anonymous ? t.anonymousText : cloud.emailVerified ? t.signedInAs : t.emailUnverified}
          </div>
        </div>
      </div>

      {!cloud.anonymous && cloud.email && !cloud.emailVerified && (
        <button
          className="small"
          disabled={busy !== null}
          onClick={() => void run('resend', () => authResendConfirmation(cloud.email!))}
        >
          {busy === 'resend' ? '…' : t.resend}
        </button>
      )}

      {message}

      <form className="account-form" onSubmit={submitName}>
        <label>
          {t.displayName}
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={40} />
        </label>
        <button className="small" type="submit" disabled={busy !== null || displayName === (cloud.displayName ?? '')}>
          {busy === 'name' ? '…' : t.saveName}
        </button>
      </form>

      {cloud.anonymous ? (
        <div>
          <div className="account-divider" />
          <h3>{t.upgradeTitle}</h3>
          <p className="muted small">{t.upgradeText}</p>
          <form className="account-form" onSubmit={submitSignUp}>
            <label>
              {t.email}
              <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label>
              {t.password}
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <label>
              {t.confirmPassword}
              <input
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </label>
            <p className="muted small">{t.passwordHint}</p>
            <button
              className="menu-btn account-submit"
              type="submit"
              disabled={busy !== null || !emailOk || password.length < 6 || password !== confirm}
            >
              {busy === 'signup' ? '…' : t.upgrade}
            </button>
          </form>
          <div className="account-divider" />
          <button className="muted small" onClick={() => setShowExisting((value) => !value)}>
            {showExisting ? t.hideExisting : t.existing}
          </button>
          {showExisting && (
            <form className="account-form" onSubmit={submitSignIn}>
              <p className="muted small">{t.guestNote}</p>
              <label>
                {t.email}
                <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
              <label>
                {t.password}
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <button className="menu-btn account-submit" type="submit" disabled={busy !== null || !emailOk || !password}>
                {busy === 'signin' ? '…' : t.signIn}
              </button>
            </form>
          )}
        </div>
      ) : (
        <div>
          <div className="account-divider" />
          <form className="account-form" onSubmit={submitPassword}>
            <label>
              {t.newPassword}
              <input
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </label>
            <button className="small" type="submit" disabled={busy !== null || newPassword.length < 6}>
              {busy === 'password' ? '…' : t.updatePassword}
            </button>
          </form>
        </div>
      )}

      <div className="account-divider" />
      <h3>{t.sync}</h3>
      <div className="btn-grid">
        {engine && (
          <button onClick={() => void syncCloud()} disabled={busy !== null}>
            {t.push}
          </button>
        )}
        <button
          onClick={() => {
            void loadCloudLast().then((loaded) => {
              if (loaded) closeAccount();
            });
          }}
          disabled={busy !== null}
        >
          {t.pull}
        </button>
      </div>

      <div className="account-divider" />
      <div className="account-actions">
        <button
          className="danger"
          disabled={busy !== null}
          onClick={() => {
            if (!window.confirm(t.signOutConfirm)) return;
            void run('signout', authSignOut);
          }}
        >
          {t.signOut}
        </button>
        <button
          className="danger"
          disabled={busy !== null}
          onClick={() => {
            if (!window.confirm(t.deleteConfirm)) return;
            void run('delete', authDeleteCloud);
          }}
        >
          {t.deleteCloud}
        </button>
      </div>
      <p className="muted small">{t.localSave}</p>
      <p className="muted small">{t.cloudNote}</p>
    </div>
  );
}
