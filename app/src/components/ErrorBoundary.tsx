import { Component, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="m-4 max-h-[80vh] overflow-auto rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900">
          <div className="mb-2 text-base font-semibold">Error en MapView</div>
          <div className="font-mono whitespace-pre-wrap">
            {this.state.error.message}
            {'\n\n'}
            {this.state.error.stack}
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
