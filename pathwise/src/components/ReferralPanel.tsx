import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useT } from '../i18n';

/** Invite-a-friend panel (B2): share code, see how many joined, redeem a code. */
export function ReferralPanel() {
  const { t } = useT();
  const { refreshUser } = useAuth();
  const [data, setData] = useState<{ code: string; redeemedCount: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [redeemCode, setRedeemCode] = useState('');
  const [redeemMsg, setRedeemMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.getReferral().then(setData).catch(() => {});
  }, []);

  function copy() {
    if (!data) return;
    navigator.clipboard?.writeText(data.code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function redeem() {
    if (!redeemCode.trim()) return;
    setBusy(true);
    setRedeemMsg(null);
    try {
      await api.redeemReferral(redeemCode.trim().toUpperCase());
      await refreshUser();
      const fresh = await api.getReferral();
      setData(fresh);
      setRedeemMsg(t('premium.referRedeemed'));
      setRedeemCode('');
    } catch (e) {
      setRedeemMsg(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-ink/10 bg-surface-2 p-4">
      <h3 className="font-display text-sm font-bold text-ink">{t('premium.referTitle')}</h3>
      <p className="mt-1 text-xs text-ink/60">{t('premium.referBody')}</p>

      {data && (
        <>
          <div className="mt-3 flex items-center gap-2">
            <code className="flex-1 rounded-lg border border-iznik/40 bg-white px-3 py-2 text-center font-mono text-lg font-bold tracking-widest text-iznik">
              {data.code}
            </code>
            <button onClick={copy} className="rounded-lg bg-iznik/20 px-3 py-2 text-xs font-semibold text-ink">
              {copied ? t('premium.referCopied') : t('premium.referCopy')}
            </button>
          </div>
          <p className="mt-1.5 text-xs text-ink/50">
            👥 {data.redeemedCount} {t('premium.referJoined')}
          </p>
        </>
      )}

      <div className="mt-4 border-t border-ink/10 pt-3">
        <p className="mb-1.5 text-xs font-semibold text-ink/70">{t('premium.referHave')}</p>
        <div className="flex gap-2">
          <input
            value={redeemCode}
            onChange={(e) => setRedeemCode(e.target.value)}
            placeholder="PWXXXXXX"
            className="flex-1 rounded-lg border border-ink/10 bg-white px-3 py-2 text-sm uppercase outline-none focus:border-iznik"
          />
          <button onClick={redeem} disabled={busy} className="rounded-lg bg-iznik px-4 text-sm font-semibold text-white disabled:opacity-40">
            {t('premium.referRedeem')}
          </button>
        </div>
        {redeemMsg && <p className="mt-1.5 text-xs font-semibold text-sage">{redeemMsg}</p>}
      </div>
    </div>
  );
}
