import { Component, type ReactNode } from 'react'

/** Catches render errors of a part of the page (for example no WebGL) so the rest of the page keeps working. */
export class ErrorBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}
