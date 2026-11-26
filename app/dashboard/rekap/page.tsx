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

  useEffect(() => {
    const fetchData = async () => {
      const { data, error } = await supabase
        .from('sessions')
        .select('id, score, profiles(full_name, sekolah)')
        .eq('status', 'finished')
        .order('score', { ascending: false })

      if (data) setData(data as any)
      setLoading(false)
    }
    fetchData()
  }, [])

  const daftarSekolah = ['SEMUA', ...Array.from(new Set(data.map(d => d.profiles?.sekolah).filter(Boolean)))]

  const filteredData = filterSekolah === 'SEMUA' 
    ? data 
    : data.filter(d => d.profiles?.sekolah === filterSekolah)

  if (loading) return <p className="p-6 text-center">Memuat data nilai...</p>

  return (
    <main className="p-6 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold">Rekapitulasi Nilai</h1>
          <p className="text-gray-500 text-sm">Peringkat siswa berdasarkan nilai tertinggi.</p>
        </div>
        
        <div className="flex gap-2 items-center">
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
          <button onClick={() => router.push('/dashboard')} className="bg-gray-200 px-4 py-2 rounded text-sm font-medium ml-2">
            Kembali
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-100 text-sm">
              <th className="p-4 w-16 text-center">Rank</th>
              <th className="p-4">Nama Siswa</th>
              <th className="p-4">Asal Sekolah</th>
              <th className="p-4 text-center w-32">Nilai Akhir</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.map((row, index) => (
              <tr key={row.id} className="border-b hover:bg-gray-50">
                <td className="p-4 text-center font-bold text-gray-500">
                  {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                </td>
                <td className="p-4 font-medium">{row.profiles?.full_name || 'Tanpa Nama'}</td>
                <td className="p-4 text-sm text-gray-600">{row.profiles?.sekolah || '-'}</td>
                <td className="p-4 text-center">
                  <span className={`px-3 py-1 rounded font-bold ${row.score >= 70 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
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