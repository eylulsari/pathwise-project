import { Link } from 'react-router-dom';
import { IstanbulSilhouette } from '../components/IstanbulSilhouette';

const FEATURES = [
  {
    icon: '🧭',
    title: 'Budget-aware routes',
    body: 'Pick a neighborhood, set a budget and pace — get a scored, walkable day plan in seconds.',
  },
  {
    icon: '🗺️',
    title: 'Live interactive map',
    body: 'Every stop pinned with hours, entry fees and a local tip. Walking & ferry legs drawn in.',
  },
  {
    icon: '🌦️',
    title: 'Weather-smart',
    body: 'Rain swaps outdoor stops for indoor ones in the same area; sunset spots move to golden hour.',
  },
  {
    icon: '🤝',
    title: 'Social & solo-verified',
    body: 'Find verified travel buddies, clone community routes and check in as you go.',
  },
];

export default function Landing() {
  return (
    <div className="min-h-full flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-5 md:px-10">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🗺️</span>
          <span className="font-display text-xl font-bold text-gradient">Pathwise</span>
        </div>
        <Link
          to="/auth"
          className="rounded-xl border border-violet/40 px-4 py-2 text-sm font-semibold text-cream transition-colors hover:bg-violet/10"
        >
          Sign In
        </Link>
      </header>

      {/* Hero */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <span className="mb-4 rounded-full border border-fuchsia/30 bg-fuchsia/10 px-4 py-1 text-xs font-semibold uppercase tracking-wider text-fuchsia">
          Istanbul · smart & social
        </span>
        <h1 className="font-display text-5xl font-extrabold leading-tight md:text-7xl">
          Plan Istanbul
          <br />
          <span className="text-gradient">your way.</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-cream/70">
          Pathwise builds budget-aware, vibe-driven day itineraries across five
          neighborhoods — then drops them on a live map and connects you with
          verified travelers.
        </p>
        <Link to="/auth" className="btn-accent mt-8 text-lg">
          Sign in to start planning →
        </Link>

        {/* Features */}
        <section className="mt-16 grid w-full max-w-5xl gap-4 md:grid-cols-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="card-cream flex flex-col gap-2 p-5 text-left"
            >
              <span className="text-3xl">{f.icon}</span>
              <h3 className="font-display text-lg font-bold">{f.title}</h3>
              <p className="text-sm text-night/70">{f.body}</p>
            </div>
          ))}
        </section>
      </main>

      {/* Skyline footer */}
      <footer className="mt-16">
        <IstanbulSilhouette className="h-24 w-full text-violet/30" />
      </footer>
    </div>
  );
}
