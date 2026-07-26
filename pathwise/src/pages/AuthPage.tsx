import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { IstanbulSilhouette } from '../components/IstanbulSilhouette';
import { LanguageToggle } from '../components/LanguageToggle';
import { useT } from '../i18n';

type Mode = 'signin' | 'signup';

export default function AuthPage() {
  const { t } = useT();
  const [mode, setMode] = useState<Mode>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nationality, setNationality] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { login, register } = useAuth();
  const navigate = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
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
        // Straight to the planner — the first route auto-generates there, so the
        // separate confirmation interstitial was an extra step with no payoff.
        navigate('/dashboard');
      } else {
        await login({ email, password });
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  const isSignup = mode === 'signup';

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
        <IstanbulSilhouette className="absolute bottom-0 left-0 h-40 w-full text-iznik/20" />
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
              />
            )}
            <Field
              label={t('auth.email')}
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="you@example.com"
              required
            />
            <Field
              label={t('auth.password')}
              type="password"
              value={password}
              onChange={setPassword}
              placeholder={t('auth.passwordHint')}
              required
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
        placeholder={props.placeholder}
        required={props.required}
        className="w-full rounded-xl border border-ink/10 bg-surface-2 px-4 py-3 text-ink placeholder:text-ink/30 outline-none transition-colors focus:border-iznik"
      />
    </label>
  );
}
