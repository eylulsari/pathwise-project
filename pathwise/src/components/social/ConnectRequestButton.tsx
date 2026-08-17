import { useState } from 'react';
import { api } from '../../services/api';
import { useT } from '../../i18n';

/**
 * "Ask to connect" on a check-in.
 *
 * Sending this does not open a conversation — it asks. Nothing can be sent
 * until the other person accepts, and the server is what enforces that; this
 * button only starts the request.
 *
 * The three outcomes are shown as they are. A silent failure here would leave
 * someone believing they had reached out when they had not, and a request that
 * was refused (they blocked you, or you have asked too many people this hour)
 * is not the same as one that is waiting.
 */
export function ConnectRequestButton({ userId }: { userId: string }) {
  const { t } = useT();
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'refused'>('idle');

  if (state === 'sent') {
    return <span className="text-[10px] font-semibold text-sage">✓ {t('dm.requestSent')}</span>;
  }
  if (state === 'refused') {
    return <span className="text-[10px] font-semibold text-ink/40">{t('dm.requestRefused')}</span>;
  }

  return (
    <button
      disabled={state === 'sending'}
      onClick={async () => {
        setState('sending');
        try {
          await api.requestConnection(userId);
          setState('sent');
        } catch {
          setState('refused');
        }
      }}
      className="text-[10px] font-semibold text-iznik hover:text-terracotta disabled:opacity-50"
    >
      ✉️ {t('dm.askToConnect')}
    </button>
  );
}
