import { corsHeaders } from '../_shared/cors.ts'
import { getPlaidClient } from '../_shared/plaid.ts'
import { getAuthenticatedUser, getSupabaseAdmin } from '../_shared/supabase.ts'

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('plaid-exchange-public-token invoked')
    const user = await getAuthenticatedUser(request)
    const { publicToken } = await request.json()

    if (typeof publicToken !== 'string' || publicToken.trim().length === 0) {
      throw new Error('Missing Plaid public token.')
    }

    const plaid = getPlaidClient()
    const admin = getSupabaseAdmin()

    const exchange = await plaid.itemPublicTokenExchange({ public_token: publicToken })
    console.log('Plaid public token exchanged', {
      userId: user.id,
      itemId: exchange.data.item_id,
    })
    const syncTimestamp = new Date().toISOString()

    const { error: saveItemError } = await admin.from('finance_plaid_items').upsert(
      {
        user_id: user.id,
        plaid_item_id: exchange.data.item_id,
        access_token: exchange.data.access_token,
        institution_name: null,
        updated_at: syncTimestamp,
        revoked_at: null,
      },
      { onConflict: 'user_id,plaid_item_id' }
    )

    if (saveItemError) {
      throw saveItemError
    }

    console.log('Plaid item saved', {
      userId: user.id,
      itemId: exchange.data.item_id,
    })

    let institutionName: string | null = null

    try {
      const item = await plaid.itemGet({ access_token: exchange.data.access_token })
      const institutionId = item.data.item.institution_id

      if (institutionId) {
        const institution = await plaid.institutionsGetById({
          institution_id: institutionId,
          country_codes: ['US'],
        })

        institutionName = institution.data.institution.name ?? null

        const { error: updateInstitutionError } = await admin
          .from('finance_plaid_items')
          .update({
            institution_name: institutionName,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id)
          .eq('plaid_item_id', exchange.data.item_id)

        if (updateInstitutionError) {
          throw updateInstitutionError
        }
      }
    } catch (institutionError) {
      console.error('Unable to enrich plaid item with institution details', institutionError)
    }

    return Response.json(
      {
        itemId: exchange.data.item_id,
        institutionName,
      },
      { headers: corsHeaders }
    )
  } catch (error) {
    console.error('plaid-exchange-public-token failed', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unable to exchange public token' },
      { status: 400, headers: corsHeaders }
    )
  }
})
