import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import { useT } from '../i18n';

/** Gates a route behind authentication; bounces to /auth if signed out. */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const { t } = useT();

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center text-ink/60">
        <span className="animate-pulse">{t('common.loading')}</span>
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}
