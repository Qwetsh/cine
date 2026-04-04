import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { hasError: boolean }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
          <p className="text-4xl mb-4">😵</p>
          <p className="font-semibold text-lg mb-2">Quelque chose s'est mal passé</p>
          <button
            onClick={() => { this.setState({ hasError: false }); window.location.reload() }}
            className="mt-4 bg-[var(--color-accent)] text-white px-6 py-2 rounded-xl text-sm"
          >
            Recharger
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
