'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Row = { id: string; status: string; locked_at: string|null; user_id: string; profiles: { full_name: string }; score: number|null }
type Exam = { id: string; title: string; is_open: boolean }

export default function Dashboard() {
  const router = useRouter()
  const [rows, setRows] = useState<Row[]>([])
  const [exams, setExams] = useState<Exam[]>([])
  const [role, setRole] = useState<string>('guru')

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (prof) setRole(prof.role)
    }

    const { data: sData } = await supabase
      .from('sessions')
      .select('id, status, locked_at, user_id, score, profiles(full_name)')
      .order('locked_at', { ascending: false, nullsFirst: false })
    setRows((sData as any) || [])

    const { data: eData } = await supabase.from('exams').select('*').order('title')
    if (eData) setExams(eData)
  }, [])

  useEffect(() => {
    loadData()
    const ch = supabase.channel('guru').on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, loadData).subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [loadData])

  const toggleExam = async (id: string, currentStatus: boolean) => {
    if (currentStatus) {
      if (!confirm('Tutup ujian ini? Siswa tidak akan bisa masuk lagi.')) return
    }
    if (!currentStatus) {
      await supabase.from('exams').update({ is_open: false }).neq('id', '00000000-0000-0000-0000-000000000000')
    }
    await supabase.from('exams').update({ is_open: !currentStatus }).eq('id', id)
    loadData()
  }

  const unlock = async (id: string) => {
    const yakin = confirm('Yakin ingin membuka kunci siswa ini?')
    if (yakin) {
      const { error } = await supabase.rpc('unlock_session', { p_session_id: id })
      if (error) alert(error.message)
      else loadData()
    }
  }

  const locked = rows.filter(r => r.status === 'locked')
  const done = rows.filter(r => r.status === 'finished')

  return (
    <main className="p-6 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold">Dashboard Pengawas</h1>
          <p className="text-sm text-gray-500">Login sebagai: <strong className="uppercase text-blue-600">{role}</strong></p>
        </div>
        
        {role === 'admin' && (
          <div className="flex flex-wrap gap-2">
            <button onClick={() => router.push('/dashboard/soal')} className="bg-purple-600 text-white px-4 py-2 rounded shadow text-sm font-medium">📝 Input Soal</button>
            <button onClick={() => router.push('/dashboard/siswa')} className="bg-green-600 text-white px-4 py-2 rounded shadow text-sm font-medium">👥 Import Siswa</button>
          </div>
        )}
        
        <div className="flex flex-wrap gap-2">
          <button onClick={() => router.push('/dashboard/rekap')} className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded shadow text-sm font-medium">🏆 Rekap Nilai</button>
          <button onClick={() => router.push('/dashboard/analisis')} className="bg-blue-600 text-white px-4 py-2 rounded shadow text-sm font-medium">📊 Analisis Butir</button>
          <button onClick={() => { supabase.auth.signOut(); router.push('/') }} className="bg-red-600 text-white px-4 py-2 rounded shadow text-sm font-medium">Logout</button>
        </div>
      </div>

      {role === 'admin' && (
        <section className="mb-8 p-4 bg-gray-50 border rounded-lg">
          <h2 className="font-bold text-lg mb-4">Kontrol Status Ujian (Khusus Admin)</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {exams.map(ex => (
              <div key={ex.id} className={`p-4 rounded border-2 ${ex.is_open ? 'border-green-500 bg-green-50' : 'border-gray-300 bg-white'}`}>
                <h3 className="font-bold text-lg mb-2">{ex.title}</h3>
                <p className="text-sm mb-4">Status: <strong className={ex.is_open ? 'text-green-600' : 'text-red-600'}>{ex.is_open ? 'TERBUKA' : 'TERTUTUP'}</strong></p>
                <button 
                  onClick={() => toggleExam(ex.id, ex.is_open)}
                  className={`w-full py-2 rounded font-bold text-white ${ex.is_open ? 'bg-red-500 hover:bg-red-600' : 'bg-green-600 hover:bg-green-700'}`}
                >
                  {ex.is_open ? 'Tutup Ujian Ini' : 'Buka Ujian Ini'}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mb-6">
        <h2 className="text-red-700 font-semibold mb-2">🔴 Siswa Terkunci ({locked.length})</h2>
        <table className="w-full border">
          <thead><tr className="bg-red-50"><th className="text-left p-2">Siswa</th><th className="text-left p-2">Waktu</th><th className="text-left p-2">Aksi</th></tr></thead>
          <tbody>
            {locked.map(r => (
              <tr key={r.id} className="border-t bg-white">
                <td className="p-2">{r.profiles?.full_name || r.user_id.slice(0,8)}</td>
                <td className="p-2">{r.locked_at ? new Date(r.locked_at).toLocaleTimeString() : '-'}</td>
                <td className="p-2"><button onClick={()=>unlock(r.id)} className="bg-red-600 text-white px-3 py-1 rounded">Buka Kunci</button></td>
              </tr>
            ))}
            {locked.length===0 && <tr className="bg-white"><td colSpan={3} className="p-4 text-gray-500 text-center">Tidak ada siswa terkunci.</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="mb-6 mt-10">
        <h2 className="text-blue-700 font-semibold mb-2">📊 Rekap Nilai Siswa</h2>
        <table className="w-full border">
          <thead>
            <tr className="bg-blue-50">
              <th className="text-left p-2">Nama Siswa</th>
              <th className="text-left p-2">Status</th>
              <th className="text-left p-2">Nilai</th>
            </tr>
          </thead>
          <tbody>
            {done.map(r => (
              <tr key={r.id} className="border-t bg-white">
                <td className="p-2">{r.profiles?.full_name || r.user_id.slice(0,8)}</td>
                <td className="p-2 text-green-600 font-medium">Selesai</td>
                <td className="p-2 font-bold text-lg">{r.score !== null ? r.score : '-'}</td>
              </tr>
            ))}
            {done.length===0 && <tr className="bg-white"><td colSpan={3} className="p-4 text-gray-500 text-center">Belum ada siswa yang selesai ujian.</td></tr>}
          </tbody>
        </table>
      </section>
    </main>
  )
}