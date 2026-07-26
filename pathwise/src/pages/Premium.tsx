import { useState } from 'react';
import { AppHeader } from '../components/AppHeader';
import { ReferralPanel } from '../components/ReferralPanel';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { useT } from '../i18n';

/**
 * Premium comparison + upgrade. The "upgrade" button is a DEMO toggle — no
 * real payment. TODO: replace with a Stripe/İyzico checkout + webhook.
 */
export default function Premium() {
  const { user, isPremium, refreshUser } = useAuth();
  const { t } = useT();
  const [busy, setBusy] = useState(false);

  const rows = [
    { label: t('premium.fOptimize'), free: t('premium.fOptimizeFree'), premium: t('premium.fOptimizePremium') },
    { label: t('premium.fDays'), free: t('premium.fDaysFree'), premium: t('premium.fDaysPremium') },
    { label: t('premium.fStory'), free: t('premium.fStoryFree'), premium: t('premium.fStoryPremium') },
    { label: t('premium.fPdf'), free: t('premium.fPdfFree'), premium: t('premium.fPdfPremium') },
    { label: t('premium.fAds'), free: t('premium.fAdsFree'), premium: t('premium.fAdsPremium') },
  ];

  async function change(tier: 'free' | 'premium') {
    setBusy(true);
    try {
      await api.setSubscription(tier);
      await refreshUser();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 p-4 md:p-6">
        <div className="rounded-2xl bg-accent-gradient p-6 text-center text-ink shadow-soft">
          <h1 className="font-display text-3xl font-extrabold">{t('premium.title')}</h1>
          <p className="mt-1 text-ink/70">{t('premium.subtitle')}</p>
          <p className="mt-3 inline-block rounded-full bg-white/50 px-3 py-1 text-sm">
            {t('premium.current')}: <span className="font-bold">{isPremium ? t('premium.premium') : t('premium.free')}</span>
          </p>
          {user?.subscriptionTier !== 'premium' && user?.trialEndsAt && new Date(user.trialEndsAt) > new Date() && (
            <p className="mt-2 text-xs text-ink/70">
              ⏳ {t('premium.trialActive')} — {t('premium.trialEnds')} {new Date(user.trialEndsAt).toLocaleDateString()}
            </p>
          )}
        </div>

        <ReferralPanel />

        {/* Comparison table */}
        <div className="overflow-x-auto rounded-2xl border border-ink/10 bg-surface-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-ink/10 text-left">
                <th className="px-4 py-3 font-semibold text-ink/70">{t('premium.feature')}</th>
                <th className="px-4 py-3 font-semibold text-ink/70">{t('premium.free')}</th>
                <th className="px-4 py-3 font-semibold text-iznik">{t('premium.premium')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-b border-ink/5">
                  <td className="px-4 py-3 font-medium text-ink">{r.label}</td>
                  <td className="px-4 py-3 text-ink/60">{r.free}</td>
                  <td className="px-4 py-3 font-semibold text-sage">{r.premium}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col items-center gap-2">
          {isPremium ? (
            <button
              onClick={() => change('free')}
              disabled={busy}
              className="rounded-xl border border-ink/15 px-6 py-3 text-sm font-semibold text-ink/70 hover:text-ink"
            >
              {busy ? t('premium.updating') : t('premium.downgrade')}
            </button>
          ) : (
            <button onClick={() => change('premium')} disabled={busy} className="btn-accent px-8 py-3 text-lg">
              {busy ? t('premium.updating') : t('premium.upgrade')}
            </button>
          )}
          <p className="max-w-md text-center text-xs text-ink/40">{t('premium.paymentNote')}</p>
        </div>

        <p className="text-center text-xs text-ink/30">Signed in as {user?.email}</p>
      </main>
    </div>
  );
}
