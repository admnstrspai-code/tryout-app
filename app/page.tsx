'use client'
export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function Home() {
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [msg, setMsg] = useState('')
  const router = useRouter()

  async function submit(e: any) {
    e.preventDefault()
    setMsg('')
    
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass })
    if (error) return setMsg(error.message)
    
    const { data: { user } } = await supabase.auth.getUser()
    const { data: prof } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
    
    // Jika role-nya bukan siswa, lempar ke dashboard
    if (prof?.role && prof.role !== 'siswa') {
      router.push('/dashboard')
    } else {
      router.push('/exam')
    }
  }

  return (
    <main className="max-w-sm mx-auto p-6 mt-20">
      <h1 className="text-2xl font-bold mb-6 text-center">Tryout PAI</h1>
      
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input className="border p-2 w-full rounded" type="email" placeholder="Masukkan email" value={email} onChange={e=>setEmail(e.target.value)} required />
        </div>
        
        <div>
          <label className="block text-sm font-medium mb-1">Password</label>
          <input className="border p-2 w-full rounded" type="password" placeholder="Masukkan password" value={pass} onChange={e=>setPass(e.target.value)} required />
        </div>

        <button className="bg-black hover:bg-gray-800 text-white p-2 w-full rounded font-bold mt-2">
          Login
        </button>
      </form>

      {msg && <p className="text-red-600 mt-4 text-sm text-center bg-red-50 p-2 rounded">{msg}</p>}
      
      <p className="mt-8 text-center text-xs text-gray-500">
        Akun dibuat oleh panitia/guru. Hubungi pengawas jika Anda belum memiliki akun.
      </p>
    </main>
  )
}