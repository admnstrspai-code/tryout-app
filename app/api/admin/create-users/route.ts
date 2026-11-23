import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(request: Request) {
  try {
    const { users } = await request.json()
    let successCount = 0
    let failedCount = 0
    let errorMessages: string[] = []

    for (const user of users) {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: { full_name: user.full_name }
      })

      if (error) {
        failedCount++
        errorMessages.push(`Gagal (${user.email}): ${error.message}`) // Simpan pesan error
      } else {
        successCount++
      }
    }

    return NextResponse.json({ success: true, successCount, failedCount, errors: errorMessages })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}