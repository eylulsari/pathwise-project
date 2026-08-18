import { useCallback, useEffect, useState } from 'react';
import type { AppNotification, NotificationType } from '../types';
import { api } from '../services/api';
import { useT } from '../i18n';

const ICONS: Record<NotificationType, string> = {
  reservation: '📎',
  trial: '⏳',
  poll: '🗳️',
  nearby: '📍',
  budget: '💸',
  sos: '🆘',
  welcome: '👋',
};

const PREF_TYPES: NotificationType[] = ['reservation', 'trial', 'poll', 'nearby', 'budget'];

/** 🔔 Notification Center (B6): unread badge, list, mark-read, preferences. */
export function NotificationBell() {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [muted, setMuted] = useState<string[]>([]);
  const [showPrefs, setShowPrefs] = useState(false);

  const refreshCount = useCallback(() => {
    api.getUnreadCount().then(setCount).catch(() => {});
  }, []);

  useEffect(() => {
    refreshCount();
    const id = window.setInterval(refreshCount, 20000);
    window.addEventListener('pw-notify', refreshCount);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('pw-notify', refreshCount);
    };
  }, [refreshCount]);

  async function openPanel() {
    setOpen((o) => !o);
    if (!open) {
      const [list, prefs] = await Promise.all([api.getNotifications(), api.getNotifPrefs()]);
      setItems(list);
      setMuted(prefs);
    }
  }

  async function markAll() {
    await api.markAllNotificationsRead();
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setCount(0);
  }

  async function click(n: AppNotification) {
    if (!n.read) {
      await api.markNotificationRead(n.id);
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      refreshCount();
    }
  }

  async function togglePref(type: string) {
    const next = muted.includes(type) ? muted.filter((m) => m !== type) : [...muted, type];
    setMuted(next);
    await api.setNotifPrefs(next);
  }

  return (
    <div className="relative">
      <button onClick={openPanel} className="relative rounded-lg px-2 py-1.5 text-lg hover:bg-ink/5" aria-label="Notifications">
        🔔
        {count > 0 && (
          <span className="absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-terracotta px-1 text-[10px] font-bold text-white">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[1040]" onClick={() => setOpen(false)} />
          <div className="absolute end-0 z-[1041] mt-1 w-80 max-w-[90vw] overflow-hidden rounded-xl border border-ink/10 bg-surface-2 shadow-2xl">
            <div className="flex items-center justify-between border-b border-ink/10 px-3 py-2">
              <span className="font-display text-sm font-bold text-ink">{t('notif.title')}</span>
              <div className="flex items-center gap-2 text-xs">
                <button onClick={markAll} className="text-ink/60 hover:text-ink">{t('notif.markAll')}</button>
                <button onClick={() => setShowPrefs((s) => !s)} className="text-ink/60 hover:text-ink">⚙</button>
              </div>
            </div>

            {showPrefs && (
              <div className="border-b border-ink/10 bg-white p-3">
                <p className="mb-1.5 text-[10px] uppercase tracking-wide text-ink/40">{t('notif.prefs')}</p>
                {PREF_TYPES.map((type) => (
                  <label key={type} className="flex items-center justify-between py-1 text-xs text-ink/80">
                    <span>{ICONS[type]} {t(`notif.type.${type}`)}</span>
                    <input
                      type="checkbox"
                      checked={!muted.includes(type)}
                      onChange={() => togglePref(type)}
                      className="accent-iznik"
                    />
                  </label>
                ))}
              </div>
            )}

            <div className="max-h-80 overflow-y-auto">
              {items.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-ink/40">{t('notif.empty')}</p>
              ) : (
                items.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => click(n)}
                    className={`flex w-full gap-2 border-b border-ink/5 px-3 py-2.5 text-start hover:bg-ink/5 ${n.read ? 'opacity-60' : ''}`}
                  >
                    <span className="text-lg">{ICONS[n.type] ?? '🔔'}</span>
                    <span className="flex-1">
                      <span className="block text-sm font-semibold text-ink">
                        {n.title}
                        {!n.read && <span className="ms-1 inline-block h-1.5 w-1.5 rounded-full bg-sunset align-middle" />}
                      </span>
                      <span className="block text-xs text-ink/60">{n.body}</span>
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
