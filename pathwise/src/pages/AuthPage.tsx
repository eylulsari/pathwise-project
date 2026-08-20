import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { IstanbulSilhouette } from '../components/IstanbulSilhouette';
import { LanguageToggle } from '../components/LanguageToggle';
import { useT } from '../i18n';

type Mode = 'signin' | 'signup';

/**
 * Where someone locked out should write. Configured, not committed: the only
 * address available today is a person's own, and baking that into a public
 * repo is not a decision code should make. With it unset the note still says
 * what is true, it just cannot hand over an address.
 */
const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL ?? '';

export default function AuthPage() {
  const { t } = useT();
  const [mode, setMode] = useState<Mode>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nationality, setNationality] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  // A field only shows its complaint once the traveller has left it (or tried
  // to submit). Nagging about an empty password box on the first keystroke is
  // how a form feels hostile.
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  const { login, register } = useAuth();
  const navigate = useNavigate();

  const isSignup = mode === 'signup';

  /**
   * What is wrong with each field, before the server is asked.
   *
   * These are the same rules the RegisterDto enforces, restated here so the
   * traveller learns about a short password while they are still looking at
   * the password box — rather than after a round trip, in a sentence written
   * for a developer ("password must be longer than or equal to 8 characters").
   *
   * The server still enforces them. This is a courtesy, not a control.
   */
  function fieldErrors(): Record<string, string> {
    const errs: Record<string, string> = {};
    if (isSignup && name.trim().length < 2) errs.name = t('auth.errName');
    // Deliberately loose: the shapes a real address can take are stranger than
    // any regex worth writing, and the server checks properly. This only
    // catches what is obviously not an address yet.
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) errs.email = t('auth.errEmail');
    if (password.length < 8) errs.password = t('auth.errPassword');
    return errs;
  }

  /**
   * A sentence for a person, from whatever the server said.
   *
   * The old code printed `err.message` directly, so users met "email must be
   * an email" and "Invalid credentials" — machine strings, in English, in an
   * app that speaks six languages. Anything unrecognised falls back to a
   * general apology rather than leaking the raw text.
   */
  function friendlyError(err: unknown): string {
    const raw = err instanceof Error ? err.message : '';
    if (/already registered/i.test(raw)) return t('auth.errEmailTaken');
    if (/invalid credentials/i.test(raw)) return t('auth.errBadCredentials');
    if (/must be an email/i.test(raw)) return t('auth.errEmail');
    if (/longer than or equal to 8/i.test(raw)) return t('auth.errPassword');
    if (/too many requests|throttl/i.test(raw)) return t('auth.errTooMany');
    return t('auth.errGeneric');
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const errs = fieldErrors();
    setTouched({ name: true, email: true, password: true });
    if (Object.keys(errs).length > 0) {
      // Nothing is sent. The messages are already under the fields.
      return;
    }

    setBusy(true);
    try {
      if (mode === 'signup') {
        await register({
          name,
          email,
          password,
          nationality: nationality || undefined,
        });
        // B2: redeem a friend's referral code if provided (best-effort).
        if (referralCode.trim()) {
          await api.redeemReferral(referralCode.trim().toUpperCase()).catch(() => {});
        }
        // To the planner, with a one-time hello. The route generates behind it,
        // so nothing is delayed by the panel — it just stops the first screen
        // being a plan that appeared with no explanation.
        navigate('/dashboard?welcome=1');
      } else {
        await login({ email, password });
        navigate('/dashboard');
      }
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  const errs = fieldErrors();
  const show = (k: string) => (touched[k] ? errs[k] : undefined);

  return (
    <div className="grid min-h-full md:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-surface-2 p-10 md:flex">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-2xl">🗺️</span>
          <span className="font-display text-xl font-bold text-gradient">Pathwise</span>
        </Link>
        <div>
          <h2 className="font-display text-4xl font-extrabold leading-tight">
            {t('auth.brand1')}
            <br />
            <span className="text-gradient">{t('auth.brand2')}</span>
          </h2>
          <p className="mt-4 max-w-sm text-ink/60">{t('auth.brandSub')}</p>
        </div>
        <IstanbulSilhouette className="absolute bottom-0 start-0 h-40 w-full text-iznik/20" />
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm">
          <div className="mb-4 flex justify-end md:hidden">
            <LanguageToggle />
          </div>
          <h1 className="font-display text-3xl font-bold">
            {isSignup ? t('auth.signUpTitle') : t('auth.signInTitle')}
          </h1>
          <p className="mt-1 text-sm text-ink/60">
            {isSignup ? t('auth.signUpSub') : t('auth.signInSub')}
          </p>

          <div className="mt-6 space-y-4">
            {isSignup && (
              <Field
                label={t('auth.fullName')}
                value={name}
                onChange={setName}
                placeholder="Aylin Demir"
                required
                testId="auth-name"
                error={show('name')}
                onBlur={() => setTouched((p) => ({ ...p, name: true }))}
              />
            )}
            <Field
              label={t('auth.email')}
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="you@example.com"
              required
              testId="auth-email"
              error={show('email')}
              onBlur={() => setTouched((p) => ({ ...p, email: true }))}
            />
            <Field
              label={t('auth.password')}
              type="password"
              value={password}
              onChange={setPassword}
              placeholder={t('auth.passwordHint')}
              required
              testId="auth-password"
              error={show('password')}
              onBlur={() => setTouched((p) => ({ ...p, password: true }))}
            />
            {isSignup && (
              <Field
                label={t('auth.nationality')}
                value={nationality}
                onChange={setNationality}
                placeholder="Turkey"
              />
            )}
            {isSignup && (
              <Field
                label={t('auth.referral')}
                value={referralCode}
                onChange={setReferralCode}
                placeholder="PWXXXXXX"
              />
            )}
          </div>

          {/*
            Forgotten password.

            There is no self-service reset yet, because there is no way to send
            mail — no provider, no verified domain, no key. The token half is
            written and tested server-side; the delivery half is a decision
            somebody has to make and pay for.

            So this says what is true and gives a way through, rather than
            offering a form that would collect an address and do nothing with
            it. Deliberately plain: this is an account-security surface, and
            the reassurance here should come from clarity, not decoration.
          */}
          {!isSignup && (
            <div className="mt-3">
              <button
                type="button"
                data-testid="forgot-password"
                onClick={() => setShowForgot((v) => !v)}
                className="text-xs font-medium text-ink/60 underline underline-offset-2 hover:text-ink"
              >
                {t('auth.forgotLink')}
              </button>
              {showForgot && (
                <p
                  data-testid="forgot-password-note"
                  className="mt-2 rounded-lg border border-ink/10 px-3 py-2 text-xs leading-relaxed text-ink/70"
                >
                  {t('auth.forgotBody')}
                  {SUPPORT_EMAIL && (
                    <>
                      {' '}
                      <a
                        href={`mailto:${SUPPORT_EMAIL}`}
                        className="font-semibold text-iznik underline underline-offset-2"
                      >
                        {SUPPORT_EMAIL}
                      </a>
                    </>
                  )}
                </p>
              )}
            </div>
          )}

          {error && (
            <p className="mt-4 rounded-lg bg-sunset/15 px-3 py-2 text-sm text-terracotta">
              {error}
            </p>
          )}

          <button type="submit" disabled={busy} className="btn-accent mt-6 w-full">
            {busy ? t('auth.wait') : isSignup ? t('auth.createAccount') : t('auth.signInBtn')}
          </button>

          <p className="mt-4 text-center text-sm text-ink/60">
            {isSignup ? t('auth.haveAccount') : t('auth.newHere')}{' '}
            <button
              type="button"
              onClick={() => {
                setMode(isSignup ? 'signin' : 'signup');
                setError(null);
              }}
              className="font-semibold text-iznik hover:text-terracotta"
            >
              {isSignup ? t('auth.signInBtn') : t('auth.createOne')}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  /** Shown under the field, and reddens its border. */
  error?: string;
  onBlur?: () => void;
  testId?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink/80">
        {props.label}
      </span>
      <input
        type={props.type ?? 'text'}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        onBlur={props.onBlur}
        placeholder={props.placeholder}
        required={props.required}
        // Announced, not just coloured: a red border says nothing to a screen
        // reader, and the message under the field is the actual answer.
        aria-invalid={props.error ? true : undefined}
        aria-describedby={props.error && props.testId ? `${props.testId}-error` : undefined}
        className={`w-full rounded-xl border bg-surface-2 px-4 py-3 text-ink placeholder:text-ink/30 outline-none transition-colors ${
          props.error
            ? 'border-terracotta focus:border-terracotta'
            : 'border-ink/10 focus:border-iznik'
        }`}
      />
      {props.error && (
        <span
          id={props.testId ? `${props.testId}-error` : undefined}
          data-testid={props.testId ? `${props.testId}-error` : undefined}
          className="mt-1 block text-xs font-medium text-terracotta"
        >
          {props.error}
        </span>
      )}
    </label>
  );
}
