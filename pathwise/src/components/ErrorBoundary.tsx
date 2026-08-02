import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * Crash containment. React unmounts the whole tree when a render throws, so a
 * single failing component white-screens the entire app. This catches that and
 * renders a fallback instead.
 *
 * Wrap two kinds of thing:
 *  - the route tree, so an unexpected error degrades to a recoverable card
 *    rather than a blank page;
 *  - any feature that is still incomplete, with `fallback={null}` (render
 *    nothing) or a short "unavailable" note — a feature that quietly says
 *    nothing is far better than one that takes the page down.
 *
 * Deliberately hook-free and text-only in its default fallback so it cannot
 * itself throw (it must work even if a context provider is what failed).
 */

interface Props {
  children: ReactNode;
  /** Rendered instead of `children` after a crash. `null` renders nothing. */
  fallback?: ReactNode;
  /** Shown in the console warning, to locate which boundary tripped. */
  label?: string;
}

interface State {
  failed: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // warn, not error: a contained crash is a degraded feature, not a failure
    // of the app. (React itself still logs the original error in dev mode.)
    console.warn(
      `[ErrorBoundary${this.props.label ? `: ${this.props.label}` : ''}] contained a crash —`,
      error?.message ?? error,
      info?.componentStack ?? '',
    );
  }

  render() {
    if (!this.state.failed) return this.props.children;
    if (this.props.fallback !== undefined) return this.props.fallback;

    return (
      <div className="mx-auto my-10 max-w-sm rounded-2xl border border-ink/10 bg-surface-2 p-6 text-center shadow-soft">
        <p className="text-3xl">🧭</p>
        <p className="mt-2 font-display text-lg font-bold text-ink">
          Something went off-route
        </p>
        <p className="mt-1 text-sm text-ink/60">
          Bir şeyler ters gitti. Sayfayı yenilemeyi deneyin.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="btn-accent mt-4 px-5 py-2 text-sm"
        >
          Reload · Yenile
        </button>
      </div>
    );
  }
}
