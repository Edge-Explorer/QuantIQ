import { StrictMode, Component } from 'react'
import type { ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Global Error Boundary to catch any runtime React crash
// and show a visible error message instead of a blank screen
interface EBState { hasError: boolean; error: Error | null; }

class ErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: any) {
    console.error('[QuantIQ ErrorBoundary] Caught crash:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', minHeight: '100vh', gap: '16px',
          background: '#06070d', color: '#f1f5f9', fontFamily: 'monospace',
          padding: '32px', textAlign: 'center'
        }}>
          <div style={{ fontSize: '32px' }}>⚠️</div>
          <h2 style={{ color: '#ff1744', fontSize: '18px', margin: 0 }}>
            QuantIQ encountered an error
          </h2>
          <pre style={{
            background: '#0d101b', border: '1px solid #2e303a',
            borderRadius: '8px', padding: '16px', fontSize: '12px',
            color: '#94a3b8', maxWidth: '700px', overflowX: 'auto',
            whiteSpace: 'pre-wrap', textAlign: 'left'
          }}>
            {this.state.error?.message}
            {'\n\n'}
            {this.state.error?.stack}
          </pre>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
            style={{
              background: '#a154ff', color: '#fff', border: 'none',
              padding: '10px 24px', borderRadius: '8px', cursor: 'pointer',
              fontSize: '14px', fontWeight: 600
            }}
          >
            Reload App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
