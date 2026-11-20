'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Analisis = {
  question_id: string
  nomor_soal: number
  pertanyaan: string
  total_dijawab: number
  total_benar: number
  persentase_benar: number
  tingkat_kesulitan: string
}

export default function AnalisisButirSoal() {
  const router = useRouter()
  const [data, setData] = useState<Analisis[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      const { data, error } = await supabase
        .from('analisis_butir_soal')
        .select('*')
        .order('nomor_soal')

      if (error) {
        console.error('Error fetching analisis:', error)
      } else {
        setData(data || [])
      }
      setLoading(false)
    }
    fetchData()
  }, [])

  const getWarnaTingkat = (tingkat: string) => {
    switch (tingkat) {
      case 'Mudah': return 'bg-green-100 text-green-800 border-green-300'
      case 'Sedang': return 'bg-yellow-100 text-yellow-800 border-yellow-300'
      case 'Susah': return 'bg-red-100 text-red-800 border-red-300'
      default: return 'bg-gray-100 text-gray-800 border-gray-300'
    }
  }

  if (loading) return <p className="p-6 text-center text-gray-500">Memuat data analisis...</p>

  return (
    <main className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Analisis Butir Soal</h1>
          <p className="text-gray-500 text-sm mt-1">Evaluasi tingkat kesulitan soal berdasarkan jawaban seluruh peserta.</p>
        </div>
        <button 
          onClick={() => router.push('/dashboard')}
          className="bg-gray-200 hover:bg-gray-300 text-black px-4 py-2 rounded text-sm font-medium"
        >
          ← Kembali ke Dashboard
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-x-auto border">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b">
              <th className="p-4 font-semibold text-sm w-16">No. Soal</th>
              <th className="p-4 font-semibold text-sm">Pertanyaan</th>
              <th className="p-4 font-semibold text-sm text-center w-24">Dijawab</th>
              <th className="p-4 font-semibold text-sm text-center w-24">Benar</th>
              <th className="p-4 font-semibold text-sm text-center w-24">% Benar</th>
              <th className="p-4 font-semibold text-sm text-center w-32">Kesimpulan</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.question_id} className="border-b hover:bg-gray-50 transition">
                <td className="p-4 text-center font-bold text-gray-700">{row.nomor_soal}</td>
                <td className="p-4 text-sm">{row.pertanyaan}</td>
                <td className="p-4 text-center text-sm">{row.total_dijawab}</td>
                <td className="p-4 text-center text-sm font-medium text-green-600">{row.total_benar}</td>
                <td className="p-4 text-center text-sm font-bold">{row.persentase_benar}%</td>
                <td className="p-4 text-center">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getWarnaTingkat(row.tingkat_kesulitan)}`}>
                    {row.tingkat_kesulitan}
                  </span>
                </td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-gray-500">
                  Belum ada data jawaban siswa untuk dianalisis.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  )
}