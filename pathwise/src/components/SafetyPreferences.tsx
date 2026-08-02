import { useState } from 'react';
import type { SafetyPreferencesInput } from '../types';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useT } from '../i18n';

/**
 * Opt-in women-traveler preferences (Profile › Privacy & safety).
 *
 * Three independent switches, all optional and all off/unset by default:
 *   1. the self-declaration itself,
 *   2. "show me only to women travelers" (visibility),
 *   3. "show me only women travelers" (discovery).
 *
 * ⚠️ SELF-DECLARATION, NOT VERIFICATION: nothing here is checked against any
 * document or third party, which is why the disclaimer below is rendered
 * unconditionally rather than hidden behind a tooltip — a user must be able to
 * see what this mode is and is not before opting in.
 *
 * Clearing the declaration also clears both switches, so a user who withdraws
 * it is never left silently filtered by a preference they can no longer see.
 */
export function SafetyPreferences() {
  const { user, refreshUser } = useAuth();
  const { t } = useT();
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle');

  const declared = user?.identifiesAsWoman === true;

  async function save(patch: SafetyPreferencesInput) {
    setSaving(true);
    setStatus('idle');
    try {
      await api.updateSafetyPreferences(patch);
      await refreshUser();
      setStatus('saved');
    } catch {
      setStatus('error');
    } finally {
      setSaving(false);
    }
  }

  function toggleDeclaration(next: boolean) {
    // Withdrawing the declaration switches the whole mode off with it.
    void save(
      next
        ? { identifiesAsWoman: true }
        : { identifiesAsWoman: null, visibleToWomenOnly: false, showWomenOnly: false },
    );
  }

  return (
    <section className="rounded-2xl border border-ink/10 bg-surface-2 p-5">
      <h2 className="font-display text-lg font-bold text-ink">{t('profile.safetyTitle')}</h2>
      <p className="mt-1 text-sm text-ink/60">{t('profile.safetyIntro')}</p>

      <div className="mt-4 space-y-3">
        <CheckboxRow
          label={t('profile.identifiesAsWoman')}
          hint={t('profile.identifiesAsWomanHint')}
          checked={declared}
          disabled={saving}
          onChange={toggleDeclaration}
        />

        <div className={declared ? '' : 'opacity-50'}>
          <CheckboxRow
            label={t('profile.visibleToWomenOnly')}
            hint={declared ? t('profile.visibleToWomenOnlyHint') : t('profile.safetyRequiresDeclaration')}
            checked={!!user?.visibleToWomenOnly}
            disabled={saving || !declared}
            onChange={(next) => save({ visibleToWomenOnly: next })}
          />
          <div className="mt-3">
            <CheckboxRow
              label={t('profile.showWomenOnly')}
              hint={declared ? t('profile.showWomenOnlyHint') : t('profile.safetyRequiresDeclaration')}
              checked={!!user?.showWomenOnly}
              disabled={saving || !declared}
              onChange={(next) => save({ showWomenOnly: next })}
            />
          </div>
        </div>
      </div>

      <p className="mt-4 rounded-xl bg-mustard/15 px-3 py-2 text-xs leading-relaxed text-ink/70">
        {t('profile.safetyDisclaimer')}
      </p>

      {status === 'saved' && (
        <p className="mt-2 text-xs font-semibold text-sage">{t('profile.safetySaved')}</p>
      )}
      {status === 'error' && (
        <p className="mt-2 text-xs font-semibold text-terracotta">{t('profile.safetySaveError')}</p>
      )}
    </section>
  );
}

function CheckboxRow({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  disabled: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className={`flex gap-3 ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 flex-shrink-0 accent-iznik"
      />
      <span>
        <span className="block text-sm font-semibold text-ink">{label}</span>
        <span className="block text-xs text-ink/50">{hint}</span>
      </span>
    </label>
  );
}
