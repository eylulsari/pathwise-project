/**
 * Phase 1 placeholder shell. Confirms the Vite + Tailwind + brand theme are
 * wired. Replaced by the real router + onboarding flow in Phase 4.
 */
export default function App() {
  return (
    <div className="min-h-full flex flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="text-6xl">🗺️</div>
      <h1 className="font-display text-5xl font-extrabold text-gradient">
        Pathwise
      </h1>
      <p className="max-w-md text-cream/70">
        Smart, social travel planning for Istanbul. The skeleton is up — brand
        theme, Tailwind, and Vite are all wired.
      </p>
      <div className="card-cream px-6 py-4">
        <span className="text-emerald font-semibold">● </span>
        Frontend skeleton ready
      </div>
    </div>
  );
}
