'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function InputSoal() {
  const router = useRouter()
  const [examId, setExamId] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  // State untuk form soal
  const [number, setNumber] = useState(1)
  const [question, setQuestion] = useState('')
  const [optionA, setOptionA] = useState('')
  const [optionB, setOptionB] = useState('')
  const [optionC, setOptionC] = useState('')
  const [optionD, setOptionD] = useState('')
  const [correctOption, setCorrectOption] = useState('A')

  // Ambil ID Ujian yang sedang aktif
  useEffect(() => {
    const fetchExam = async () => {
      const { data } = await supabase.from('exams').select('id').eq('is_open', true).limit(1).single()
      if (data) {
        setExamId(data.id)
        // Cari nomor soal terakhir untuk otomatis menaikkan nomor
        const { data: qs } = await supabase.from('questions').select('number').eq('exam_id', data.id).order('number', { ascending: false }).limit(1)
        if (qs && qs.length > 0) setNumber(qs[0].number + 1)
      } else {
        setMsg('Tidak ada ujian aktif. Buka ujian di Supabase terlebih dahulu.')
      }
    }
    fetchExam()
  }, [])

  const handleSave = async (e: any) => {
    e.preventDefault()
    if (!examId) return alert('Ujian tidak ditemukan')
    setLoading(true)
    setMsg('')

    const { error } = await supabase.from('questions').insert({
      exam_id: examId,
      number: number,
      question: question,
      option_a: optionA,
      option_b: optionB,
      option_c: optionC,
      option_d: optionD,
      correct_option: correctOption
    })

    if (error) {
      setMsg(`Gagal menyimpan: ${error.message}`)
    } else {
      setMsg('Soal berhasil disimpan!')
      // Kosongkan form dan naikkan nomor otomatis
      setQuestion('')
      setOptionA('')
      setOptionB('')
      setOptionC('')
      setOptionD('')
      setCorrectOption('A')
      setNumber(prev => prev + 1)
    }
    setLoading(false)
  }

  return (
    <main className="p-6 max-w-3xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Input Soal Ujian</h1>
        <button 
          onClick={() => router.push('/dashboard')}
          className="bg-gray-200 hover:bg-gray-300 text-black px-4 py-2 rounded text-sm font-medium"
        >
          ← Kembali ke Dashboard
        </button>
      </div>

      {msg && (
        <div className={`p-4 mb-4 rounded border ${msg.includes('berhasil') ? 'bg-green-50 border-green-300 text-green-800' : 'bg-red-50 border-red-300 text-red-800'}`}>
          {msg}
        </div>
      )}

      <form onSubmit={handleSave} className="bg-white p-6 rounded-lg shadow-sm border space-y-4">
        <div className="grid grid-cols-4 gap-4">
          <div className="col-span-1">
            <label className="block text-sm font-medium mb-1">No. Soal</label>
            <input 
              type="number" 
              className="w-full border p-2 rounded" 
              value={number} 
              onChange={e => setNumber(parseInt(e.target.value))} 
              required 
            />
          </div>
          <div className="col-span-3">
            <label className="block text-sm font-medium mb-1">Kunci Jawaban</label>
            <select 
              className="w-full border p-2 rounded" 
              value={correctOption} 
              onChange={e => setCorrectOption(e.target.value)}
            >
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
              <option value="D">D</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Pertanyaan</label>
          <textarea 
            className="w-full border p-2 rounded h-24" 
            placeholder="Ketik pertanyaan di sini..."
            value={question} 
            onChange={e => setQuestion(e.target.value)} 
            required 
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Pilihan A</label>
            <input className="w-full border p-2 rounded" value={optionA} onChange={e => setOptionA(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Pilihan B</label>
            <input className="w-full border p-2 rounded" value={optionB} onChange={e => setOptionB(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Pilihan C</label>
            <input className="w-full border p-2 rounded" value={optionC} onChange={e => setOptionC(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Pilihan D</label>
            <input className="w-full border p-2 rounded" value={optionD} onChange={e => setOptionD(e.target.value)} required />
          </div>
        </div>

        <button 
          type="submit" 
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded mt-4 disabled:opacity-50"
        >
          {loading ? 'Menyimpan...' : 'Simpan Soal'}
        </button>
      </form>
    </main>
  )
}