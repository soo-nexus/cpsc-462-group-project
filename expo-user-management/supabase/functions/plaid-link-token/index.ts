import { corsHeaders } from '../_shared/cors.ts'
import { getAuthenticatedUser } from '../_shared/supabase.ts'
import { getPlaidClient, plaidCountryCodes, plaidProducts } from '../_shared/plaid.ts'

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const user = await getAuthenticatedUser(request)
    const plaid = getPlaidClient()
    const androidPackageName = Deno.env.get('PLAID_ANDROID_PACKAGE_NAME')
    const redirectUri = Deno.env.get('PLAID_REDIRECT_URI')
    const webhook = Deno.env.get('PLAID_WEBHOOK_URL')

    const response = await plaid.linkTokenCreate({
      client_name: 'Finance Dashboard',
      user: { client_user_id: user.id },
      products: plaidProducts,
      country_codes: plaidCountryCodes,
      language: 'en',
      android_package_name: androidPackageName || undefined,
      redirect_uri: redirectUri || undefined,
      webhook: webhook || undefined,
    })

    return Response.json(response.data, { headers: corsHeaders })
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unable to create link token' },
      { status: 400, headers: corsHeaders }
    )
  }
})
