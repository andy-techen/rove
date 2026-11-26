import { Component, ErrorInfo, ReactNode } from 'react'
import { t } from '@shared/copy'
import { Button } from '../ui/Button'
import { Logo } from '../ui/Logo'
import './ErrorBoundary.css'

interface Props {
  children: ReactNode
  /** Starts the window over; open songs come back on their own. */
  onReload(): void
}

/**
 * Catches a crash anywhere in the app. Without it React clears the whole window and
 * the singer is left with a blank screen; this says their recordings are safe (they're
 * on disk, never touched by edits) and offers a way back.
 */
export class ErrorBoundary extends Component<Props, { crashed: boolean }> {
  state = { crashed: false }

  static getDerivedStateFromError(): { crashed: boolean } {
    return { crashed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Kept in the console so the cause can be found in DevTools afterwards.
    console.error(error, info.componentStack)
  }

  render(): ReactNode {
    if (!this.state.crashed) return this.props.children
    return (
      <main className="error-boundary">
        <Logo size="lg" />
        <h1>{t('crash.title')}</h1>
        <p>{t('crash.safe')}</p>
        <div>
          <Button variant="primary" onClick={this.props.onReload}>
            {t('crash.reopen')}
          </Button>
        </div>
      </main>
    )
  }
}
