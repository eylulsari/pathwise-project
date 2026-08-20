import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, tokenStore } from '../services/api';
import { IstanbulSilhouette } from '../components/IstanbulSilhouette';
import { LanguageToggle } from '../components/LanguageToggle';
import { useT } from '../i18n';

type Mode = 'signin' | 'signup';

/**
 * Where someone locked out should write.
 *
 * The project address is the default so the note is never a dead end: an
 * unconfigured build printed "write to us" and then gave the reader nowhere
 * to write, which is worse than saying nothing at all. Override it with
 * VITE_SUPPORT_EMAIL at build time — Vite inlines this value, so it cannot
 * be changed by a runtime env var afterwards.
 *
 * The default is only as good as the mailbox behind it. Point the MX for
 * pathwise.app at something a person reads, or set the env var to an address
 * that already works.
 */
const SUPPORT_EMAIL =
  import.meta.env.VITE_SUPPORT_EMAIL ?? 'support@pathwise.app';

/** How long each inspiration card holds the left panel. */
const CARD_MS = 7000;

/**
 * The sign-in screen.
 *
 * ON DECORATION, AND WHERE IT STOPS
 * The standing rule for this project is that account-security surfaces stay
 * plain — reassurance there should come from clarity, not ornament. This
 * screen is now deliberately the exception, because it is also the first
 * thing anyone sees and a blank form is a poor first impression of a travel
 * app. The line is drawn inside the screen rather than around it: the left
 * panel carries the atmosphere, the right panel stays a quiet form, and the
 * forgotten-password note keeps its plain treatment untouched. Nothing
 * decorative sits between a person and the thing they came here to do.
 *
 * WHAT IS REAL AND WHAT IS NOT
 * "Keep me signed in" moves the access token between localStorage and
 * sessionStorage — a real switch with a real effect. The social buttons are
 * not wired to any provider, so they are rendered disabled, labelled as not
 * connected, and explained in a sentence underneath. A button that looks
 * ready and silently does nothing is the thing this codebase keeps refusing
 * to ship, and a placeholder that announces itself is not that.
 */
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
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [remember, setRemember] = useState(() => tokenStore.remembered);
  /**
   * The shake, restarted rather than re-keyed.
   *
   * A changing `key` would also restart it, by rebuilding the form — and
   * that throws away the caret and the focus along with the animation, so the
   * second attempt starts by hunting for the password box. Dropping the class
   * and re-adding it on the next frame retriggers the animation and leaves
   * the DOM alone. Clearing it on animationend keeps the class from sticking
   * around and swallowing the next restart.
   */
  const [shaking, setShaking] = useState(false);
  const shakeNow = () => {
    setShaking(false);
    requestAnimationFrame(() => setShaking(true));
  };
  const [card, setCard] = useState(0);

  const { login, register } = useAuth();
  const navigate = useNavigate();
  const passwordRef = useRef<HTMLInputElement>(null);

  const isSignup = mode === 'signup';

  const cards = [
    { line: t('auth.card1'), place: t('auth.card1Place') },
    { line: t('auth.card2'), place: t('auth.card2Place') },
    { line: t('auth.card3'), place: t('auth.card3Place') },
  ];

  useEffect(() => {
    const handle = window.setInterval(
      () => setCard((c) => (c + 1) % 3),
      CARD_MS,
    );
    return () => window.clearInterval(handle);
  }, []);

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
      shakeNow();
      return;
    }

    // Set before the call: `setAccess` reads this to choose its storage, and
    // the token arrives inside `login`/`register`.
    tokenStore.setRemembered(remember);

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
      shakeNow();
    } finally {
      setBusy(false);
    }
  }

  /**
   * Caps Lock, read from the event rather than tracked.
   *
   * `getModifierState` answers for the moment the key was pressed, so there is
   * no state to get out of sync — and no need to guess from what the user
   * typed, which is how this warning ends up accusing people who meant it.
   */
  function readCapsLock(e: React.KeyboardEvent<HTMLInputElement>) {
    setCapsLock(e.getModifierState('CapsLock'));
  }

  const errs = fieldErrors();
  const show = (k: string) => (touched[k] ? errs[k] : undefined);

  return (
    <div className="grid min-h-full md:grid-cols-2">
      {/* ── Atmosphere. Decorative, and only here. ───────────────────── */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-surface-2 p-10 md:flex">
        {/* A soft dusk wash over the sand ground — the Bosphorus palette the
            rest of the app already uses, at the one scale where it can be
            generous without competing with anything. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-iznik/12 via-transparent to-sunset/20"
        />

        <Link to="/" className="relative flex items-center gap-2">
          <span className="text-2xl">🗺️</span>
          <span className="font-display text-xl font-bold text-gradient">Pathwise</span>
        </Link>

        <div className="relative">
          <h2 className="font-display text-4xl font-extrabold leading-tight">
            {t('auth.brand1')}
            <br />
            <span className="text-gradient">{t('auth.brand2')}</span>
          </h2>
          <p className="mt-4 max-w-sm text-ink/60">{t('auth.brandSub')}</p>

          {/* One card at a time, cross-fading. Three lines about three real
              places, rather than a quotation — the famous Istanbul quotes are
              mostly misattributed, and a name under a sentence somebody never
              wrote is not decoration, it is an invention. */}
          <div className="mt-8 max-w-sm" data-testid="auth-card">
            <div
              key={card}
              className="animate-auth-card rounded-2xl border border-ink/10 bg-surface/70 p-4 shadow-soft backdrop-blur-sm"
            >
              <p className="font-display text-base leading-snug text-ink/85">
                {cards[card].line}
              </p>
              <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-iznik">
                {cards[card].place}
              </p>
            </div>
            <div className="mt-3 flex gap-1.5" aria-hidden="true">
              {cards.map((_, i) => (
                <span
                  key={i}
                  className={`h-1 rounded-full transition-all duration-500 ${
                    i === card ? 'w-6 bg-iznik' : 'w-2 bg-ink/15'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        <IstanbulSilhouette className="pointer-events-none absolute bottom-0 start-0 h-40 w-full text-iznik/20" />
      </div>

      {/* ── The form. Quiet on purpose. ──────────────────────────────── */}
      <div className="flex items-center justify-center p-6">
        <form
          onSubmit={submit}
          noValidate
          onAnimationEnd={() => setShaking(false)}
          className={`w-full max-w-sm ${shaking ? 'animate-auth-shake' : ''}`}
        >
          <div className="mb-4 flex justify-end md:hidden">
            <LanguageToggle />
          </div>
          <h1 className="font-display text-3xl font-bold">
            {isSignup ? t('auth.signUpTitle') : t('auth.signInTitle')}
          </h1>
          <p className="mt-1 text-sm text-ink/60">
            {isSignup ? t('auth.signUpSub') : t('auth.signInSub')}
          </p>

          {/* Placeholders that say so. Disabled, labelled "not connected yet",
              and explained underneath — the alternative is a button that looks
              ready and does nothing, which is the one thing worse than not
              offering it at all. */}
          <div className="mt-6 space-y-2">
            {(
              [
                { key: 'auth.continueGoogle', mark: 'G', testId: 'auth-social-google' },
                { key: 'auth.continueApple', mark: '', testId: 'auth-social-apple' },
              ] as const
            ).map((provider) => (
              <button
                key={provider.key}
                type="button"
                disabled
                data-testid={provider.testId}
                className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-ink/10 bg-surface-2/60 px-4 py-2.5 text-sm font-semibold text-ink/40"
              >
                <span aria-hidden="true" className="text-base leading-none">
                  {provider.mark}
                </span>
                {t(provider.key)}
                <span className="rounded-full bg-ink/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink/40">
                  {t('auth.socialSoon')}
                </span>
              </button>
            ))}
            <p className="text-[11px] leading-relaxed text-ink/45" data-testid="auth-social-note">
              {t('auth.socialNote')}
            </p>
          </div>

          <div className="my-5 flex items-center gap-3" aria-hidden="true">
            <span className="h-px flex-1 bg-ink/10" />
            <span className="text-xs font-medium uppercase tracking-wide text-ink/35">
              {t('auth.orDivider')}
            </span>
            <span className="h-px flex-1 bg-ink/10" />
          </div>

          <div className="space-y-4">
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
              inputRef={passwordRef}
              label={t('auth.password')}
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={setPassword}
              placeholder={t('auth.passwordHint')}
              required
              testId="auth-password"
              error={show('password')}
              onBlur={() => {
                setTouched((p) => ({ ...p, password: true }));
                setCapsLock(false);
              }}
              onKeyUp={readCapsLock}
              onKeyDown={readCapsLock}
              trailing={
                <button
                  type="button"
                  data-testid="auth-password-toggle"
                  aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                  aria-pressed={showPassword}
                  onClick={() => {
                    setShowPassword((v) => !v);
                    // Revealing a password should not also cost the caret.
                    passwordRef.current?.focus();
                  }}
                  className="rounded-lg px-1.5 py-1 text-base leading-none text-ink/40 transition-colors hover:text-ink/70"
                >
                  <span aria-hidden="true">{showPassword ? '🙈' : '👁️'}</span>
                </button>
              }
              /* Announced politely rather than as an alert: it is a hint about
                 the keyboard, not a failure, and it appears while typing. */
              hint={
                capsLock ? (
                  <span
                    data-testid="auth-caps-lock"
                    role="status"
                    className="mt-1 flex items-center gap-1 text-xs font-medium text-terracotta"
                  >
                    <span aria-hidden="true">⇪</span>
                    {t('auth.capsLock')}
                  </span>
                ) : null
              }
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

          {/* Stay-signed-in and the way back in, on one line: the two things
              someone at this box might want that are not "submit". */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <label className="flex cursor-pointer items-center gap-2 text-xs text-ink/70">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                data-testid="auth-remember"
                className="h-4 w-4 rounded border-ink/20 accent-iznik"
              />
              {t('auth.rememberMe')}
            </label>

            {/*
              Forgotten password.

              There is no self-service reset yet, because there is no way to
              send mail — no provider, no verified domain, no key. The token
              half is written and tested server-side; the delivery half is a
              decision somebody has to make and pay for.

              So this says what is true and gives a way through, rather than
              offering a form that would collect an address and do nothing
              with it. Deliberately plain, and left plain by the redesign
              around it: this is an account-security surface, and the
              reassurance here should come from clarity, not decoration.
            */}
            {!isSignup && (
              <button
                type="button"
                data-testid="forgot-password"
                onClick={() => setShowForgot((v) => !v)}
                className="text-xs font-medium text-ink/60 underline underline-offset-2 hover:text-ink"
              >
                {t('auth.forgotLink')}
              </button>
            )}
          </div>

          <p className="mt-1.5 text-[11px] text-ink/45">{t('auth.rememberHint')}</p>

          {!isSignup && showForgot && (
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

          {error && (
            <p
              role="alert"
              data-testid="auth-error"
              className="mt-4 rounded-lg bg-sunset/15 px-3 py-2 text-sm text-terracotta"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            data-testid="auth-submit"
            className="btn-accent mt-6 flex w-full items-center justify-center gap-2 disabled:opacity-70"
          >
            {busy && (
              <span
                aria-hidden="true"
                data-testid="auth-spinner"
                className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
              />
            )}
            {busy ? t('auth.wait') : isSignup ? t('auth.createAccount') : t('auth.signInBtn')}
          </button>

          <p className="mt-4 text-center text-sm text-ink/60">
            {isSignup ? t('auth.haveAccount') : t('auth.newHere')}{' '}
            <button
              type="button"
              onClick={() => {
                setMode(isSignup ? 'signin' : 'signup');
                setError(null);
                setShowForgot(false);
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
  onKeyUp?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  testId?: string;
  /** Sits inside the field's right edge — the password eye. */
  trailing?: React.ReactNode;
  /** A note under the field that is not an error (Caps Lock). */
  hint?: React.ReactNode;
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink/80">
        {props.label}
      </span>
      {/* The ring lives on the wrapper, not the input, so focusing the box
          lights the whole field including the eye button beside it. */}
      <span
        className={`flex items-center rounded-xl border bg-surface-2 transition-all focus-within:ring-4 ${
          props.error
            ? 'border-terracotta focus-within:border-terracotta focus-within:ring-terracotta/15'
            : 'border-ink/10 focus-within:border-iznik focus-within:ring-iznik/15'
        }`}
      >
        <input
          ref={props.inputRef}
          type={props.type ?? 'text'}
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          onBlur={props.onBlur}
          onKeyUp={props.onKeyUp}
          onKeyDown={props.onKeyDown}
          placeholder={props.placeholder}
          required={props.required}
          // Announced, not just coloured: a red border says nothing to a screen
          // reader, and the message under the field is the actual answer.
          aria-invalid={props.error ? true : undefined}
          aria-describedby={props.error && props.testId ? `${props.testId}-error` : undefined}
          className="w-full flex-1 rounded-xl bg-transparent px-4 py-3 text-ink placeholder:text-ink/30 outline-none"
        />
        {props.trailing && <span className="pe-2 flex-shrink-0">{props.trailing}</span>}
      </span>
      {props.error && (
        <span
          id={props.testId ? `${props.testId}-error` : undefined}
          data-testid={props.testId ? `${props.testId}-error` : undefined}
          className="mt-1 block text-xs font-medium text-terracotta"
        >
          {props.error}
        </span>
      )}
      {props.hint}
    </label>
  );
}
