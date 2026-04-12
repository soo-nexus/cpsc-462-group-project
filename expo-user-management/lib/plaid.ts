import { supabase, supabaseAnonKey, supabaseUrl } from './supabase'

type PlaidLinkTokenResponse = {
  link_token: string
  expiration?: string
}

type PlaidExchangeResponse = {
  itemId: string
  institutionName?: string | null
}

type PlaidSyncResponse = {
  importedCount: number
  modifiedCount: number
  removedCount: number
}

export async function createPlaidLinkToken() {
  return callFunction<PlaidLinkTokenResponse>('plaid-link-token')
}

export async function exchangePlaidPublicToken(publicToken: string, metadata?: unknown) {
  return callFunction<PlaidExchangeResponse>('plaid-exchange-public-token', {
    publicToken,
    metadata,
  })
}

export async function syncPlaidTransactions() {
  return callFunction<PlaidSyncResponse>('plaid-sync-transactions')
}

async function getAuthHeaders() {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.access_token) {
    throw new Error('You must be signed in to use Plaid sync.')
  }

  return {
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  }
}

async function callFunction<T>(name: string, body?: unknown) {
  const headers = await getAuthHeaders()
  const response = await fetch(`${supabaseUrl}/functions/v1/${name}`, {
    method: 'POST',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  const text = await response.text()
  const payload = text ? tryParseJson(text) : null

  if (!response.ok) {
    const message =
      payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string'
        ? payload.error
        : text || `Edge function ${name} failed with status ${response.status}.`
    throw new Error(message)
  }

  if (!payload) {
    throw new Error(`No response body was returned from ${name}.`)
  }

  return payload as T
}

function tryParseJson(value: string) {
  try {
    return JSON.parse(value) as unknown
  } catch {
    return null
  }
}
