import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useT } from '../i18n';

/** Sign-up confirmation with a checkmark animation, then auto-continue. */
export default function Success() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useT();

  useEffect(() => {
    const t = setTimeout(() => navigate('/dashboard'), 2400);
    return () => clearTimeout(t);
  }, [navigate]);

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="relative flex h-28 w-28 items-center justify-center">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald/30" />
        <span className="relative flex h-24 w-24 items-center justify-center rounded-full bg-emerald text-5xl text-white">
          ✓
        </span>
      </div>
      <h1 className="font-display text-3xl font-bold">
        {t('success.title')}{user?.name ? `, ${user.name.split(' ')[0]}` : ''}!
      </h1>
      <p className="max-w-sm text-cream/70">{t('success.subtitle')}</p>
      <button
        onClick={() => navigate('/dashboard')}
        className="text-sm font-semibold text-violet hover:text-fuchsia"
      >
        {t('success.goNow')}
      </button>
    </div>
  );
}
