'use client'
export const dynamic = 'force-dynamic'

import { useState } from 'react'

export default function ImportSiswa() {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  const handleImport = async () => {
    if (!text.trim()) return alert('Data kosong!')
    setLoading(true)
    setResult(null)

    // Memecah teks berdasarkan baris baru
    const lines = text.trim().split('\n')
    const users = lines.map(line => {
      const [full_name, email, password] = line.split(',').map(s => s.trim())
      return { full_name, email, password }
    }).filter(u => u.email && u.password)

    try {
      const res = await fetch('/api/admin/create-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ users })
      })
      const data = await res.json()
      setResult(data)
    } catch (err) {
      alert('Terjadi kesalahan sistem')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Import Akun Siswa</h1>
      <p className="text-gray-600 mb-6">Format: Nama Lengkap, Email, Password (Pisahkan dengan koma, satu baris satu siswa).</p>

      <div className="bg-blue-50 p-4 rounded mb-4 text-sm text-blue-800">
        <strong>Contoh Format:</strong><br />
        Ahmad Fauzi, ahmad@test.com, rahasia123<br />
        Budi Santoso, budi@test.com, rahasia123
      </div>

      <textarea
        className="w-full h-64 p-4 border rounded font-mono text-sm"
        placeholder="Paste data dari Excel di sini..."
        value={text}
        onChange={(e) => setText(e.target.value)}
      />

      <button
        onClick={handleImport}
        disabled={loading}
        className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded font-bold disabled:opacity-50"
      >
        {loading ? 'Memproses...' : 'Mulai Import'}
      </button>

      {result && (
        <div className={`mt-6 p-4 rounded border ${result.success ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'}`}>
          <h3 className="font-bold text-lg mb-2">Hasil Import:</h3>
          {result.success ? (
            <>
              <p>Berhasil membuat <strong>{result.successCount}</strong> akun. Gagal: {result.failedCount}.</p>
              {result.errors && result.errors.length > 0 && (
                <ul className="mt-2 text-sm text-red-600 list-disc pl-5">
                  {result.errors.map((err: string, i: number) => <li key={i}>{err}</li>)}
                </ul>
              )}
            </>
          ) : (
            <p>Error: {result.error}</p>
          )}
        </div>
      )}
    </main>
  )
}