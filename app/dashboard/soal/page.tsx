'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Soal = {
  id: string
  number: number
  question: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_option: string
}

export default function ManajemenSoal() {
  const router = useRouter()
  const [examId, setExamId] = useState<string>('')
  const [questions, setQuestions] = useState<Soal[]>([])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  // State untuk TABS (Manual atau Excel)
  const [activeTab, setActiveTab] = useState<'manual' | 'excel'>('manual')

  // State Form Manual
  const [editId, setEditId] = useState<string | null>(null)
  const [number, setNumber] = useState(1)
  const [question, setQuestion] = useState('')
  const [optionA, setOptionA] = useState('')
  const [optionB, setOptionB] = useState('')
  const [optionC, setOptionC] = useState('')
  const [optionD, setOptionD] = useState('')
  const [correctOption, setCorrectOption] = useState('A')

  // State Import Excel
  const [excelText, setExcelText] = useState('')

  // 1. Ambil ID Ujian & Daftar Soal
  const loadData = useCallback(async () => {
    const { data: exam } = await supabase.from('exams').select('id').eq('is_open', true).limit(1).single()
    if (exam) {
      setExamId(exam.id)
      const { data: qs } = await supabase.from('questions').select('*').eq('exam_id', exam.id).order('number')
      if (qs) setQuestions(qs)
      
      if (qs && qs.length > 0 && !editId) {
        setNumber(Math.max(...qs.map(q => q.number)) + 1)
      }
    } else {
      setMsg('Tidak ada ujian aktif di database.')
    }
  }, [editId])

  useEffect(() => {
    loadData()
  }, [loadData])

  // 2. Simpan Soal (Manual)
  const handleSaveManual = async (e: any) => {
    e.preventDefault()
    if (!examId) return alert('Ujian tidak ditemukan')
    setLoading(true)
    setMsg('')

    const payload = {
      exam_id: examId, number, question,
      option_a: optionA, option_b: optionB, option_c: optionC, option_d: optionD,
      correct_option: correctOption
    }

    let errorMsg = null
    if (editId) {
      const { error } = await supabase.from('questions').update(payload).eq('id', editId)
      if (error) errorMsg = error.message
    } else {
      const { error } = await supabase.from('questions').insert(payload)
      if (error) errorMsg = error.message
    }

    if (errorMsg) {
      setMsg(`Gagal menyimpan: ${errorMsg}`)
    } else {
      setMsg(editId ? 'Soal berhasil diperbarui!' : 'Soal berhasil disimpan!')
      resetForm()
      loadData()
    }
    setLoading(false)
  }

  // 3. Simpan Soal Massal (Excel Paste)
  const handleSaveExcel = async () => {
    if (!examId) return alert('Ujian tidak ditemukan')
    if (!excelText.trim()) return alert('Data Excel masih kosong!')
    setLoading(true)
    setMsg('')

    try {
      // Memecah teks berdasarkan baris enter
      const lines = excelText.trim().split('\n')
      const payloads = []

      for (const line of lines) {
        // Memecah kolom berdasarkan Tab (karakter pemisah otomatis dari Excel)
        const cols = line.split('\t')
        if (cols.length >= 7) {
          payloads.push({
            exam_id: examId,
            number: parseInt(cols[0].trim()),
            question: cols[1].trim(),
            option_a: cols[2].trim(),
            option_b: cols[3].trim(),
            option_c: cols[4].trim(),
            option_d: cols[5].trim(),
            correct_option: cols[6].trim().toUpperCase()
          })
        }
      }

      if (payloads.length === 0) throw new Error('Format tidak sesuai. Pastikan ada 7 kolom dan dipisahkan Tab.')

      // Simpan semuanya ke database sekaligus
      const { error } = await supabase.from('questions').insert(payloads)
      if (error) throw error

      setMsg(`Berhasil meng-import ${payloads.length} soal!`)
      setExcelText('')
      loadData()
    } catch (err: any) {
      setMsg(`Gagal import: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  // 4. Hapus & Edit
  const handleDelete = async (id: string) => {
    if (!confirm('Yakin ingin menghapus soal ini?')) return
    const { error } = await supabase.from('questions').delete().eq('id', id)
    if (error) return alert(error.message)
    loadData()
  }

  const handleEdit = (q: Soal) => {
    setActiveTab('manual')
    setEditId(q.id)
    setNumber(q.number)
    setQuestion(q.question)
    setOptionA(q.option_a)
    setOptionB(q.option_b)
    setOptionC(q.option_c)
    setOptionD(q.option_d)
    setCorrectOption(q.correct_option)
    window.scrollTo(0, 0)
  }

  const resetForm = () => {
    setEditId(null)
    setQuestion('')
    setOptionA('')
    setOptionB('')
    setOptionC('')
    setOptionD('')
    setCorrectOption('A')
    if (questions.length > 0) {
      setNumber(Math.max(...questions.map(q => q.number)) + 1)
    }
  }

  return (
    <main className="p-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Manajemen Soal Ujian</h1>
        <button onClick={() => router.push('/dashboard')} className="bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded text-sm font-medium">
          ← Kembali ke Dashboard
        </button>
      </div>

      {msg && (
        <div className={`p-4 mb-4 rounded border ${msg.includes('berhasil') ? 'bg-green-50 border-green-300 text-green-800' : 'bg-red-50 border-red-300 text-red-800'}`}>
          {msg}
        </div>
      )}

      {/* TAB MENU */}
      <div className="flex gap-2 mb-4">
        <button 
          onClick={() => setActiveTab('manual')}
          className={`px-4 py-2 rounded font-medium ${activeTab === 'manual' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
        >
          Input Manual
        </button>
        <button 
          onClick={() => setActiveTab('excel')}
          className={`px-4 py-2 rounded font-medium ${activeTab === 'excel' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700'}`}
        >
          Import dari Excel
        </button>
      </div>

      {/* ====== TAB MANUAL ====== */}
      {activeTab === 'manual' && (
        <form onSubmit={handleSaveManual} className="bg-white p-6 rounded-lg shadow-sm border space-y-4 mb-8">
          <h2 className="text-lg font-bold border-b pb-2">{editId ? '✏️ Edit Soal' : '➕ Tambah Soal Baru'}</h2>
          
          <div className="grid grid-cols-4 gap-4">
            <div className="col-span-1">
              <label className="block text-sm font-medium mb-1">No. Soal</label>
              <input type="number" className="w-full border p-2 rounded" value={number} onChange={e => setNumber(parseInt(e.target.value))} required />
            </div>
            <div className="col-span-3">
              <label className="block text-sm font-medium mb-1">Kunci Jawaban</label>
              <select className="w-full border p-2 rounded" value={correctOption} onChange={e => setCorrectOption(e.target.value)}>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
                <option value="D">D</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Pertanyaan</label>
            <textarea className="w-full border p-2 rounded h-20" value={question} onChange={e => setQuestion(e.target.value)} required />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-sm font-medium mb-1">Pilihan A</label><input className="w-full border p-2 rounded" value={optionA} onChange={e => setOptionA(e.target.value)} required /></div>
            <div><label className="block text-sm font-medium mb-1">Pilihan B</label><input className="w-full border p-2 rounded" value={optionB} onChange={e => setOptionB(e.target.value)} required /></div>
            <div><label className="block text-sm font-medium mb-1">Pilihan C</label><input className="w-full border p-2 rounded" value={optionC} onChange={e => setOptionC(e.target.value)} required /></div>
            <div><label className="block text-sm font-medium mb-1">Pilihan D</label><input className="w-full border p-2 rounded" value={optionD} onChange={e => setOptionD(e.target.value)} required /></div>
          </div>

          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={loading} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded disabled:opacity-50">
              {loading ? 'Menyimpan...' : (editId ? 'Simpan Perubahan' : 'Simpan Soal Baru')}
            </button>
            {editId && (
              <button type="button" onClick={resetForm} className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded">
                Batal Edit
              </button>
            )}
          </div>
        </form>
      )}

      {/* ====== TAB EXCEL ====== */}
      {activeTab === 'excel' && (
        <div className="bg-white p-6 rounded-lg shadow-sm border space-y-4 mb-8">
          <h2 className="text-lg font-bold border-b pb-2">📊 Import Massal dari Excel</h2>
          
          <div className="bg-blue-50 p-4 rounded text-sm text-blue-800">
            <p className="font-bold mb-2">Cara Penggunaan:</p>
            <ol className="list-decimal pl-5 space-y-1">
              <li>Buka Microsoft Excel atau Google Sheets.</li>
              <li>Buat kolom dengan urutan: <strong>No | Pertanyaan | Pilihan A | Pilihan B | Pilihan C | Pilihan D | Kunci</strong>.</li>
              <li><strong>Blok semua data soal</strong> di Excel (tanpa judul kolom), lalu tekan <strong>Ctrl+C</strong>.</li>
              <li>Paste (Ctrl+V) di kotak besar di bawah ini.</li>
            </ol>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Paste Data Excel di sini:</label>
            <textarea 
              className="w-full border p-3 rounded h-64 font-mono text-sm" 
              placeholder="Contoh:&#10;5&#9;Sifat wajib Allah...&#9;Al-'Alim&#9;As-Sami'&#9;Al-Bashir&#9;Al-Qadir&#9;C"
              value={excelText} 
              onChange={e => setExcelText(e.target.value)} 
            />
          </div>

          <button 
            onClick={handleSaveExcel} 
            disabled={loading} 
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded disabled:opacity-50"
          >
            {loading ? 'Memproses...' : 'Mulai Import Sekarang'}
          </button>
        </div>
      )}

      {/* TABEL DAFTAR SOAL */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="p-4 bg-gray-50 border-b">
          <h2 className="font-bold">Daftar Soal Saat Ini ({questions.length} Soal)</h2>
        </div>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-100 text-sm">
              <th className="p-3 w-12 text-center">No</th>
              <th className="p-3">Pertanyaan</th>
              <th className="p-3 w-20 text-center">Kunci</th>
              <th className="p-3 w-32 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {questions.map((q) => (
              <tr key={q.id} className="border-b hover:bg-gray-50 text-sm">
                <td className="p-3 text-center font-bold">{q.number}</td>
                <td className="p-3 truncate max-w-md">{q.question}</td>
                <td className="p-3 text-center font-bold text-blue-600">{q.correct_option}</td>
                <td className="p-3 text-center space-x-2">
                  <button onClick={() => handleEdit(q)} className="text-blue-600 hover:underline font-medium">Edit</button>
                  <button onClick={() => handleDelete(q.id)} className="text-red-600 hover:underline font-medium">Hapus</button>
                </td>
              </tr>
            ))}
            {questions.length === 0 && (
              <tr><td colSpan={4} className="p-4 text-center text-gray-500">Belum ada soal.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  )
}