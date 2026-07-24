import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { IstanbulSilhouette } from '../components/IstanbulSilhouette';

type Mode = 'signin' | 'signup';

export default function AuthPage() {
  const [mode, setMode] = useState<Mode>('signup');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nationality, setNationality] = useState('');
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
        navigate('/success');
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
      <div className="relative hidden flex-col justify-between overflow-hidden bg-night-800 p-10 md:flex">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-2xl">🗺️</span>
          <span className="font-display text-xl font-bold text-gradient">Pathwise</span>
        </Link>
        <div>
          <h2 className="font-display text-4xl font-extrabold leading-tight">
            Your Istanbul,
            <br />
            <span className="text-gradient">one smart path.</span>
          </h2>
          <p className="mt-4 max-w-sm text-cream/60">
            Sign in to generate budget-aware routes, save trips and meet
            verified travel buddies.
          </p>
        </div>
        <IstanbulSilhouette className="absolute bottom-0 left-0 h-40 w-full text-violet/20" />
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm">
          <h1 className="font-display text-3xl font-bold">
            {isSignup ? 'Create your account' : 'Welcome back'}
          </h1>
          <p className="mt-1 text-sm text-cream/60">
            {isSignup
              ? 'A few details and you are planning.'
              : 'Sign in to pick up where you left off.'}
          </p>

          <div className="mt-6 space-y-4">
            {isSignup && (
              <Field
                label="Full name"
                value={name}
                onChange={setName}
                placeholder="Aylin Demir"
                required
              />
            )}
            <Field
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="you@example.com"
              required
            />
            <Field
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              placeholder="At least 8 characters"
              required
            />
            {isSignup && (
              <Field
                label="Nationality (optional)"
                value={nationality}
                onChange={setNationality}
                placeholder="Turkey"
              />
            )}
          </div>

          {error && (
            <p className="mt-4 rounded-lg bg-fuchsia/15 px-3 py-2 text-sm text-fuchsia">
              {error}
            </p>
          )}

          <button type="submit" disabled={busy} className="btn-accent mt-6 w-full">
            {busy
              ? 'Please wait…'
              : isSignup
                ? 'Create account'
                : 'Sign in'}
          </button>

          <p className="mt-4 text-center text-sm text-cream/60">
            {isSignup ? 'Already have an account?' : 'New to Pathwise?'}{' '}
            <button
              type="button"
              onClick={() => {
                setMode(isSignup ? 'signin' : 'signup');
                setError(null);
              }}
              className="font-semibold text-violet hover:text-fuchsia"
            >
              {isSignup ? 'Sign in' : 'Create one'}
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
      <span className="mb-1 block text-sm font-medium text-cream/80">
        {props.label}
      </span>
      <input
        type={props.type ?? 'text'}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        required={props.required}
        className="w-full rounded-xl border border-white/10 bg-night-800 px-4 py-3 text-cream placeholder:text-cream/30 outline-none transition-colors focus:border-violet"
      />
    </label>
  );
}
