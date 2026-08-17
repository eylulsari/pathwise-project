import type { ReactNode } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import Social from './pages/Social';
import Profile from './pages/Profile';
import Premium from './pages/Premium';
import Essentials from './pages/Essentials';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ErrorBoundary } from './components/ErrorBoundary';

/**
 * Each route gets its own boundary (keyed by path) so a crash is scoped to the
 * page that caused it — the other tabs stay navigable instead of the whole app
 * being replaced by one fallback until a reload.
 */
function Page({ path, children }: { path: string; children: ReactNode }) {
  return (
    <ErrorBoundary key={path} label={path}>
      {children}
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Page path="/"><Landing /></Page>} />
      <Route path="/auth" element={<Page path="/auth"><AuthPage /></Page>} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Page path="/dashboard">
              <Dashboard />
            </Page>
          </ProtectedRoute>
        }
      />
      <Route
        path="/social"
        element={
          <ProtectedRoute>
            <Page path="/social">
              <Social />
            </Page>
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Page path="/profile">
              <Profile />
            </Page>
          </ProtectedRoute>
        }
      />
      <Route
        path="/premium"
        element={
          <ProtectedRoute>
            <Page path="/premium">
              <Premium />
            </Page>
          </ProtectedRoute>
        }
      />
      <Route
        path="/essentials"
        element={
          <ProtectedRoute>
            <Page path="/essentials">
              <Essentials />
            </Page>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
