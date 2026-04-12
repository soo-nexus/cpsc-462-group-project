import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from 'npm:plaid'

function resolvePlaidEnvironment(env: string | undefined) {
  switch ((env ?? 'sandbox').toLowerCase()) {
    case 'production':
      return PlaidEnvironments.production
    case 'development':
      return PlaidEnvironments.development
    default:
      return PlaidEnvironments.sandbox
  }
}

export function getPlaidClient() {
  const clientId = Deno.env.get('PLAID_CLIENT_ID')
  const secret = Deno.env.get('PLAID_SECRET')

  if (!clientId || !secret) {
    throw new Error('Missing Plaid credentials in Edge Function environment.')
  }

  const config = new Configuration({
    basePath: resolvePlaidEnvironment(Deno.env.get('PLAID_ENV')),
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': clientId,
        'PLAID-SECRET': secret,
      },
    },
  })

  return new PlaidApi(config)
}

export const plaidProducts = [Products.Transactions]
export const plaidCountryCodes = [CountryCode.Us]

export function mapPlaidCategory(transaction: {
  merchant_name?: string | null
  personal_finance_category?: { primary?: string | null; detailed?: string | null } | null
}) {
  const primary = transaction.personal_finance_category?.primary?.toUpperCase() ?? ''
  const detailed = transaction.personal_finance_category?.detailed?.toUpperCase() ?? ''
  const merchant = transaction.merchant_name?.toUpperCase() ?? ''

  if (primary.includes('FOOD') || detailed.includes('GROCERIES') || merchant.includes('MARKET')) {
    return 'Food'
  }

  if (primary.includes('RENT') || detailed.includes('RENT')) {
    return 'Rent'
  }

  if (primary.includes('TRANSPORT') || detailed.includes('GAS') || detailed.includes('PARKING')) {
    return 'Utilities'
  }

  if (primary.includes('GIFTS')) {
    return 'Gifts'
  }

  return 'Fun Money'
}
