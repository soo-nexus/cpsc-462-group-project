import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const PLAID_CLIENT_ID = Deno.env.get('PLAID_CLIENT_ID')
const PLAID_SECRET = Deno.env.get('PLAID_SECRET')
const PLAID_ENV = Deno.env.get('PLAID_ENV') || 'sandbox'

const PLAID_URL = PLAID_ENV === 'production' 
  ? 'https://production.plaid.com'
  : PLAID_ENV === 'development'
  ? 'https://development.plaid.com'
  : 'https://sandbox.plaid.com'

serve(async (req) => {
  try {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response('ok', {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST',
          'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        },
      })
    }

    // Get user from auth header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      throw new Error('Unauthorized')
    }

    // Get public token from request body
    const { public_token, institution_id, accounts } = await req.json()
    if (!public_token) {
      throw new Error('public_token is required')
    }

    // Exchange public token for access token
    const response = await fetch(`${PLAID_URL}/item/public_token/exchange`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: PLAID_CLIENT_ID,
        secret: PLAID_SECRET,
        public_token,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Plaid API error:', data)
      throw new Error(data.error_message || 'Failed to exchange public token')
    }

    const { access_token, item_id } = data

    // Store access token and item info in database
    const { error: dbError } = await supabaseClient
      .from('plaid_items')
      .upsert({
        user_id: user.id,
        item_id,
        access_token,
        institution_id,
        created_at: new Date().toISOString(),
      })

    if (dbError) {
      console.error('Database error:', dbError)
      throw new Error('Failed to store access token')
    }

    // Store account information if provided
    if (accounts && accounts.length > 0) {
      const accountRecords = accounts.map((account: any) => ({
        user_id: user.id,
        item_id,
        account_id: account.id,
        name: account.name,
        mask: account.mask,
        type: account.type,
        subtype: account.subtype,
      }))

      await supabaseClient.from('plaid_accounts').upsert(accountRecords)
    }

    return new Response(JSON.stringify({ 
      success: true,
      item_id,
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }
})
