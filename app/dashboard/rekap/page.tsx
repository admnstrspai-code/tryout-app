'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Rekap = {
  id: string
  score: number
  profiles: { full_name: string; sekolah: string }
}

export default function RekapNilai() {
  const router = useRouter()
  const [data, setData] = useState<Rekap[]>([])
  const [loading, setLoading] = useState(true)
  const [filterSekolah, setFilterSekolah] = useState('SEMUA')
  
  // State untuk mendeteksi siapa yang sedang login
  const [role, setRole] = useState('')
  const [mySekolah, setMySekolah] = useState('')

  useEffect(() => {
    const initData = async () => {
      // 1. Ambil identitas user yang login
      const { data: { user } } = await supabase.auth.getUser()
      let currentRole = ''
      let currentSekolah = ''

      if (user) {
        const { data: prof } = await supabase.from('profiles').select('role, sekolah').eq('id', user.id).single()
        if (prof) {
          setRole(prof.role)
          setMySekolah(prof.sekolah || '')
          currentRole = prof.role
          currentSekolah = prof.sekolah || ''
        }
      }

      // 2. Ambil data nilai
      const { data: sData } = await supabase
        .from('sessions')
        .select('id, score, profiles(full_name, sekolah)')
        .eq('status', 'finished')
        .order('score', { ascending: false })

      if (sData) setData(sData as any)
      
      // 3. Jika yang login adalah pengawas, otomatis kunci filternya ke sekolahnya
      if (currentRole === 'pengawas' || currentRole === 'guru') {
        setFilterSekolah(currentSekolah)
      }

      setLoading(false)
    }
    
    initData()
  }, [])

  // Daftar sekolah untuk dropdown (hanya untuk Admin/Panitia)
  const daftarSekolah = ['SEMUA', ...Array.from(new Set(data.map(d => d.profiles?.sekolah).filter(Boolean)))]

  // Filter data
  const filteredData = filterSekolah === 'SEMUA' 
    ? data 
    : data.filter(d => d.profiles?.sekolah === filterSekolah)

  if (loading) return <p className="p-6 text-center">Memuat data nilai...</p>

  // Cek apakah user adalah Admin/Panitia (yang boleh ganti-ganti filter)
  const isAdminOrPanitia = role === 'admin' || role === 'panitia'

  return (
    <main className="p-6 max-w-5xl mx-auto">
      {/* HEADER KHUSUS PRINT PDF */}
      <div className="hidden print:block text-center mb-8">
        <h1 className="text-2xl font-bold">LAPORAN HASIL TRY OUT PAI</h1>
        <h2 className="text-xl mt-2">
          {filterSekolah === 'SEMUA' ? 'Semua Sekolah' : `Sekolah: ${filterSekolah}`}
        </h2>
        <hr className="my-4 border-black" />
      </div>

      {/* HEADER WEB (SEMBUNYI SAAT PRINT) */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold">Rekapitulasi Nilai</h1>
          <p className="text-gray-500 text-sm">Peringkat siswa berdasarkan nilai tertinggi.</p>
        </div>
        
        <div className="flex flex-wrap gap-2 items-center">
          
          {/* LOGIKA FILTER: Jika Admin/Panitia, tampilkan dropdown. Jika Pengawas, kunci teksnya. */}
          {isAdminOrPanitia ? (
            <>
              <label className="font-medium text-sm">Filter Sekolah:</label>
              <select 
                className="border p-2 rounded font-medium"
                value={filterSekolah}
                onChange={(e) => setFilterSekolah(e.target.value)}
              >
                {daftarSekolah.map((sek, i) => (
                  <option key={i} value={sek}>{sek}</option>
                ))}
              </select>
            </>
          ) : (
            <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded font-bold border border-blue-300">
              Sekolah: {mySekolah || '-'}
            </div>
          )}
          
          <button 
            onClick={() => window.print()} 
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm font-bold shadow flex items-center gap-2 ml-2"
          >
            🖨️ Cetak PDF
          </button>
          
          <button onClick={() => router.push('/dashboard')} className="bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded text-sm font-medium">
            Kembali
          </button>
        </div>
      </div>

      {/* TABEL DATA */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden print:border-none print:shadow-none">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-100 text-sm print:bg-gray-200">
              <th className="p-4 w-16 text-center border-b print:border-black">Rank</th>
              <th className="p-4 border-b print:border-black">Nama Siswa</th>
              <th className="p-4 border-b print:border-black">Asal Sekolah</th>
              <th className="p-4 text-center w-32 border-b print:border-black">Nilai Akhir</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((row, index) => (
              <tr key={row.id} className="border-b hover:bg-gray-50">
                <td className="p-4 text-center font-bold text-gray-500 print:text-black print:border-black">
                  {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                </td>
                <td className="p-4 font-medium print:border-black">{row.profiles?.full_name || 'Tanpa Nama'}</td>
                <td className="p-4 text-sm text-gray-600 print:text-black print:border-black">{row.profiles?.sekolah || '-'}</td>
                <td className="p-4 text-center print:border-black">
                  <span className={`px-3 py-1 rounded font-bold ${row.score >= 70 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'} print:bg-transparent print:text-black print:p-0`}>
                    {row.score}
                  </span>
                </td>
              </tr>
            ))}
            {filteredData.length === 0 && (
              <tr><td colSpan={4} className="p-8 text-center text-gray-500">Belum ada siswa yang menyelesaikan ujian.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  )
}