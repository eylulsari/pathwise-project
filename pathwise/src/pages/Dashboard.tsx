import { useAuth } from '../context/AuthContext';

/** Phase 4 placeholder — the full dashboard (map, route generator, Today's
 *  Path) is built in Phase 5. This confirms the protected route + auth work. */
export default function Dashboard() {
  const { user, logout } = useAuth();
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <span className="text-5xl">🎉</span>
      <h1 className="font-display text-3xl font-bold">
        Signed in as <span className="text-gradient">{user?.name}</span>
      </h1>
      <p className="text-cream/60">{user?.email}</p>
      <div className="card-cream px-6 py-4 text-sm">
        Dashboard, map and Today’s Path arrive in Phase 5.
      </div>
      <button onClick={logout} className="text-sm font-semibold text-violet hover:text-fuchsia">
        Log out
      </button>
    </div>
  );
}
