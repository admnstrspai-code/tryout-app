'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Row = { id: string; status: string; locked_at: string|null; user_id: string; profiles: { full_name: string } }

export default function Dashboard() {
  const router = useRouter()
  const [rows, setRows] = useState<Row[]>([])

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('sessions')
      .select('id, status, locked_at, user_id, profiles(full_name)')
      .order('locked_at', { ascending: false, nullsFirst: false })

    if (error) {
      console.error('[dashboard load]', error)
      return
    }
    setRows((data as any) || [])
  }, [])

  useEffect(() => {
    load()
    const ch = supabase.channel('guru')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load])

  const unlock = async (id: string) => {
    const yakin = confirm('Yakin ingin membuka kunci (unlock) siswa ini?\n\nKlik OK atau tekan Enter untuk melanjutkan.')
    if (yakin) {
      const { error } = await supabase.rpc('unlock_session', { p_session_id: id })
      if (error) alert(error.message)
      else load()
    }
  }

  const locked = rows.filter(r => r.status === 'locked')
  const active = rows.filter(r => r.status === 'active')
  const done   = rows.filter(r => r.status === 'finished')

  return (
    <main className="p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold">Dashboard Pengawas</h1>
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={() => router.push('/dashboard/soal')}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded shadow text-sm font-medium"
          >
            📝 Input Soal
          </button>
          <button 
            onClick={() => router.push('/dashboard/siswa')}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded shadow text-sm font-medium"
          >
            👥 Import Siswa
          </button>
          <button 
            onClick={() => router.push('/dashboard/analisis')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow text-sm font-medium"
          >
            📊 Lihat Analisis
          </button>
        </div>
      </div>

      <section className="mb-6">
        <h2 className="text-red-700 font-semibold">🔴 Terkunci ({locked.length})</h2>
        <table className="w-full mt-2 border">
          <thead>
            <tr className="bg-red-50">
              <th className="text-left p-2">Siswa</th>
              <th className="text-left p-2">Locked sejak</th>
              <th className="text-left p-2">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {locked.map(r => (
              <tr key={r.id} className="border-t">
                <td className="p-2">{r.profiles?.full_name || r.user_id.slice(0,8)}</td>
                <td className="p-2">{r.locked_at ? new Date(r.locked_at).toLocaleTimeString() : '-'}</td>
                <td className="p-2">
                  <button onClick={()=>unlock(r.id)} className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded">
                    Unlock
                  </button>
                </td>
              </tr>
            ))}
            {locked.length===0 && (
              <tr>
                <td colSpan={3} className="p-2 text-gray-500">Tidak ada siswa terkunci.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="mb-6">
        <h2 className="text-green-700 font-semibold">🟢 Aktif ({active.length})</h2>
      </section>
      
      <section>
        <h2 className="text-gray-700 font-semibold">✅ Selesai ({done.length})</h2>
      </section>
    </main>
  )
}