import { useState } from 'react';
import { useT } from '../../i18n';

export interface QuizResult {
  mood: 'history' | 'foodie' | 'art' | 'photo';
  pace: 'relaxed' | 'moderate' | 'packed';
  budgetTry: number;
}

const MOODS: { id: QuizResult['mood']; labelKey: string; icon: string }[] = [
  { id: 'history', labelKey: 'quiz.historyBuff', icon: '🏛️' },
  { id: 'foodie', labelKey: 'quiz.localFoodie', icon: '☕' },
  { id: 'art', labelKey: 'quiz.undergroundArt', icon: '🎨' },
  { id: 'photo', labelKey: 'quiz.photoHour', icon: '📸' },
];
const PACES: { id: QuizResult['pace']; labelKey: string; icon: string }[] = [
  { id: 'relaxed', labelKey: 'quiz.relaxed', icon: '☕' },
  { id: 'moderate', labelKey: 'quiz.moderate', icon: '🚶' },
  { id: 'packed', labelKey: 'quiz.packed', icon: '⚡' },
];

/** 3-step Travel Vibe Quiz. On finish it calls onComplete, which generates and
 *  applies an itinerary automatically. */
export function TravelVibeQuiz({
  onComplete,
  onClose,
}: {
  onComplete: (r: QuizResult) => void;
  onClose: () => void;
}) {
  const { t } = useT();
  const [step, setStep] = useState(0);
  const [mood, setMood] = useState<QuizResult['mood'] | null>(null);
  const [pace, setPace] = useState<QuizResult['pace'] | null>(null);
  const [budget, setBudget] = useState(2000);

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="card-cream w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xl font-bold text-night">{t('quiz.title')}</h3>
          <button onClick={onClose} className="text-night/40 hover:text-night">✕</button>
        </div>
        <div className="mt-2 flex gap-1">
          {[0, 1, 2].map((s) => (
            <div key={s} className={`h-1.5 flex-1 rounded-full ${s <= step ? 'bg-accent-gradient' : 'bg-night/10'}`} />
          ))}
        </div>

        {step === 0 && (
          <Step title={t('quiz.moodQ')}>
            <div className="grid grid-cols-2 gap-2">
              {MOODS.map((m) => (
                <Choice key={m.id} active={mood === m.id} onClick={() => setMood(m.id)} icon={m.icon} label={t(m.labelKey)} />
              ))}
            </div>
          </Step>
        )}

        {step === 1 && (
          <Step title={t('quiz.paceQ')}>
            <div className="grid grid-cols-3 gap-2">
              {PACES.map((p) => (
                <Choice key={p.id} active={pace === p.id} onClick={() => setPace(p.id)} icon={p.icon} label={t(p.labelKey)} />
              ))}
            </div>
          </Step>
        )}

        {step === 2 && (
          <Step title={t('quiz.budgetQ')}>
            <p className="text-center font-display text-3xl font-bold text-night">
              ₺{budget.toLocaleString('tr-TR')}{budget >= 5000 ? '+' : ''}
            </p>
            <input
              type="range" min={0} max={5000} step={250} value={budget}
              onChange={(e) => setBudget(Number(e.target.value))}
              className="mt-3 w-full accent-fuchsia"
            />
            <div className="flex justify-between text-xs text-night/40"><span>₺0</span><span>₺5,000+</span></div>
          </Step>
        )}

        <div className="mt-6 flex justify-between">
          <button
            onClick={() => (step === 0 ? onClose() : setStep((s) => s - 1))}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-night/60 hover:text-night"
          >
            {step === 0 ? t('quiz.cancel') : t('quiz.back')}
          </button>
          <button
            disabled={(step === 0 && !mood) || (step === 1 && !pace)}
            onClick={() => {
              if (step < 2) setStep((s) => s + 1);
              else if (mood && pace) onComplete({ mood, pace, budgetTry: budget });
            }}
            className="btn-accent px-6 py-2 text-sm disabled:opacity-40"
          >
            {step < 2 ? t('quiz.next') : t('quiz.build')}
          </button>
        </div>
      </div>
    </div>
  );
}

function Step({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <h4 className="mb-3 text-center font-display text-lg font-semibold text-night">{title}</h4>
      {children}
    </div>
  );
}

function Choice({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: string; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 rounded-xl border-2 p-3 text-sm font-semibold transition-colors ${
        active ? 'border-violet bg-violet/10 text-night' : 'border-night/10 text-night/70 hover:border-night/25'
      }`}
    >
      <span className="text-2xl">{icon}</span>
      {label}
    </button>
  );
}
