declare module 'react-native-plaid-link-sdk' {
  export type LinkSuccess = {
    publicToken: string
    metadata?: Record<string, unknown>
  }

  export type LinkExit = {
    error?: unknown
    metadata?: Record<string, unknown>
  }

  export type LinkTokenConfiguration = {
    token: string
    noLoadingState?: boolean
  }

  export function create(config: LinkTokenConfiguration): void

  export function open(config: {
    onSuccess: (success: LinkSuccess) => void
    onExit?: (exit: LinkExit) => void
  }): void
}
