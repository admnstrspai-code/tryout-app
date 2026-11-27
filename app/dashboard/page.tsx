'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Row = { id: string; status: string; locked_at: string|null; user_id: string; profiles: { full_name: string; sekolah: string }; score: number|null }
type Exam = { id: string; title: string; is_open: boolean }
type Siswa = { id: string; full_name: string; email: string }

export default function Dashboard() {
  const router = useRouter()
  const [rows, setRows] = useState<Row[]>([])
  const [exams, setExams] = useState<Exam[]>([])
  const [siswaSekolah, setSiswaSekolah] = useState<Siswa[]>([])
  const [role, setRole] = useState<string>('')
  const [sekolah, setSekolah] = useState<string>('')

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    let currentRole = ''
    let currentSekolah = ''

    if (user) {
      const { data: prof } = await supabase.from('profiles').select('role, sekolah').eq('id', user.id).single()
      if (prof) {
        setRole(prof.role)
        setSekolah(prof.sekolah || '')
        currentRole = prof.role
        currentSekolah = prof.sekolah || ''
      }
    }

    // 1. Ambil Data Sesi
    const { data: sData } = await supabase
      .from('sessions')
      .select('id, status, locked_at, user_id, score, profiles(full_name, sekolah)')
      .order('locked_at', { ascending: false, nullsFirst: false })
    setRows((sData as any) || [])

    // 2. Jika yang login adalah Pengawas, ambil daftar siswa (Gunakan ilike agar tidak sensitif huruf besar/kecil)
    if (currentRole === 'pengawas' && currentSekolah) {
      const { data: siswaData } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('role', 'siswa')
        .ilike('sekolah', currentSekolah) // <-- ilike membuat pencarian tidak peduli huruf besar/kecil
        .order('full_name')
      
      if (siswaData) setSiswaSekolah(siswaData as Siswa[])
    }

    // 3. Ambil Daftar Ujian
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
  
  const isSuperAdmin = role === 'admin'
  const isPanitia = role === 'admin' || role === 'panitia'
  const isPengawas = role === 'pengawas'

  return (
    <main className="p-6 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold">Dashboard Pengawas</h1>
          <p className="text-sm text-gray-600">
            Login sebagai: <strong className="uppercase text-blue-600">{role}</strong> 
            {sekolah && ` | Sekolah: ${sekolah}`}
          </p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          {isPanitia && (
            <>
              <button onClick={() => router.push('/dashboard/soal')} className="bg-purple-600 text-white px-4 py-2 rounded shadow text-sm font-medium">📝 Input Soal</button>
              <button onClick={() => router.push('/dashboard/siswa')} className="bg-green-600 text-white px-4 py-2 rounded shadow text-sm font-medium">👥 Import Siswa</button>
            </>
          )}
          
          <button onClick={() => router.push('/dashboard/rekap')} className="bg-orange-500 text-white px-4 py-2 rounded shadow text-sm font-medium">🏆 Rekap Nilai</button>
          
          {isPanitia && (
            <button onClick={() => router.push('/dashboard/analisis')} className="bg-blue-600 text-white px-4 py-2 rounded shadow text-sm font-medium">📊 Analisis Butir</button>
          )}
          
          <button onClick={() => { supabase.auth.signOut(); router.push('/') }} className="bg-red-600 text-white px-4 py-2 rounded shadow text-sm font-medium">Logout</button>
        </div>
      </div>

      {isSuperAdmin && (
        <section className="mb-8 p-4 bg-yellow-50 border border-yellow-300 rounded-lg">
          <h2 className="font-bold text-lg mb-4 text-yellow-800">👑 Kontrol Status Ujian (Super Admin Only)</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {exams.map(ex => (
              <div key={ex.id} className={`p-4 rounded border-2 bg-white ${ex.is_open ? 'border-green-500' : 'border-gray-300'}`}>
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
          <thead><tr className="bg-red-50"><th className="text-left p-2">Siswa</th><th className="text-left p-2">Sekolah</th><th className="text-left p-2">Waktu</th><th className="text-left p-2">Aksi</th></tr></thead>
          <tbody>
            {locked.map(r => (
              <tr key={r.id} className="border-t bg-white">
                <td className="p-2">{r.profiles?.full_name || r.user_id.slice(0,8)}</td>
                <td className="p-2 text-sm text-gray-600">{r.profiles?.sekolah || '-'}</td>
                <td className="p-2 text-sm">{r.locked_at ? new Date(r.locked_at).toLocaleTimeString() : '-'}</td>
                <td className="p-2"><button onClick={()=>unlock(r.id)} className="bg-red-600 text-white px-3 py-1 rounded text-sm">Buka Kunci</button></td>
              </tr>
            ))}
            {locked.length===0 && <tr className="bg-white"><td colSpan={4} className="p-4 text-gray-500 text-center">Tidak ada siswa terkunci.</td></tr>}
          </tbody>
        </table>
      </section>

      {isPengawas && (
        <section className="mb-6 mt-10">
          <div className="flex justify-between items-end mb-2">
            <h2 className="text-blue-700 font-semibold">📡 Monitoring Siswa {sekolah}</h2>
            <span className="text-sm text-gray-500">Total: {siswaSekolah.length} Siswa</span>
          </div>
          <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-100 text-sm">
                  <th className="p-3 border-b">Nama Siswa</th>
                  <th className="p-3 border-b">Email</th>
                  <th className="p-3 border-b text-center w-40">Status Ujian</th>
                </tr>
              </thead>
              <tbody>
                {siswaSekolah.map((siswa) => {
                  const sesiSiswa = rows.find(r => r.user_id === siswa.id)
                  let statusLabel = 'Belum Login'
                  let statusColor = 'bg-gray-200 text-gray-700'
                  
                  if (sesiSiswa) {
                    if (sesiSiswa.status === 'active') {
                      statusLabel = 'Sedang Mengerjakan'
                      statusColor = 'bg-green-100 text-green-700 font-bold border border-green-300'
                    } else if (sesiSiswa.status === 'locked') {
                      statusLabel = 'Terkunci (Pelanggaran)'
                      statusColor = 'bg-red-100 text-red-700 font-bold border border-red-300 animate-pulse'
                    } else if (sesiSiswa.status === 'finished') {
                      statusLabel = 'Selesai'
                      statusColor = 'bg-blue-100 text-blue-700 font-bold border border-blue-300'
                    }
                  }

                  return (
                    <tr key={siswa.id} className="border-b hover:bg-gray-50 text-sm">
                      <td className="p-3 font-medium">{siswa.full_name}</td>
                      <td className="p-3 text-gray-500">{siswa.email}</td>
                      <td className="p-3 text-center">
                        <span className={`px-3 py-1 rounded-full text-xs ${statusColor}`}>
                          {statusLabel}
                        </span>
                      </td>
                    </tr>
                  )
                })}
                {siswaSekolah.length === 0 && (
                  <tr><td colSpan={3} className="p-4 text-center text-gray-500">Belum ada data siswa untuk sekolah ini.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {isPanitia && (
        <section className="mb-6 mt-10">
          <h2 className="text-blue-700 font-semibold mb-2">📊 Rekap Nilai Siswa</h2>
          <table className="w-full border">
            <thead>
              <tr className="bg-blue-50">
                <th className="text-left p-2">Nama Siswa</th>
                <th className="text-left p-2">Sekolah</th>
                <th className="text-left p-2">Status</th>
                <th className="text-left p-2">Nilai</th>
              </tr>
            </thead>
            <tbody>
              {done.map(r => (
                <tr key={r.id} className="border-t bg-white">
                  <td className="p-2">{r.profiles?.full_name || r.user_id.slice(0,8)}</td>
                  <td className="p-2 text-sm text-gray-600">{r.profiles?.sekolah || '-'}</td>
                  <td className="p-2 text-green-600 font-medium text-sm">Selesai</td>
                  <td className="p-2 font-bold text-lg">{r.score !== null ? r.score : '-'}</td>
                </tr>
              ))}
              {done.length===0 && <tr className="bg-white"><td colSpan={4} className="p-4 text-gray-500 text-center">Belum ada siswa yang selesai ujian.</td></tr>}
            </tbody>
          </table>
        </section>
      )}

    </main>
  )
}