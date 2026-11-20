'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function Home() {
  const [mode, setMode] = useState<'login'|'register'>('login')
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [msg, setMsg] = useState('')
  const router = useRouter()

  async function submit(e: any) {
    e.preventDefault()
    setMsg('')
    if (mode === 'register') {
      const { error } = await supabase.auth.signUp({ email, password: pass })
      if (error) return setMsg(error.message)
      setMsg('Akun dibuat. Silakan login.')
      setMode('login')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pass })
      if (error) return setMsg(error.message)
      
      const { data: { user } } = await supabase.auth.getUser()
      const { data: prof } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
      router.push(prof?.role === 'guru' ? '/dashboard' : '/exam')
    }
  }

  return (
    <main className="max-w-sm mx-auto p-6 mt-20">
      <h1 className="text-2xl font-bold mb-4">Tryout</h1>
      <form onSubmit={submit} className="space-y-3">
        <input className="border p-2 w-full" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
        <input className="border p-2 w-full" type="password" placeholder="Password" value={pass} onChange={e=>setPass(e.target.value)} />
        <button className="bg-black text-white p-2 w-full">{mode==='login'?'Login':'Daftar'}</button>
      </form>
      {msg && <p className="text-red-600 mt-2 text-sm">{msg}</p>}
      <button className="mt-3 text-sm underline" onClick={()=>setMode(mode==='login'?'register':'login')}>
        {mode==='login'?'Belum punya akun? Daftar':'Sudah punya akun? Login'}
      </button>
    </main>
  )
}