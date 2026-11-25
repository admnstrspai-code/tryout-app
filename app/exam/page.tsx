'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Q = { id: string; number: number; question: string; option_a: string; option_b: string; option_c: string; option_d: string }
type S = { id: string; status: 'active'|'locked'|'finished'; exam_id: string; started_at: string; score: number | null }

const LOCK_AFTER_MS = 30_000
const POLL_ACTIVE_MS = 60_000
const POLL_LOCKED_MS = 10_000
const MINIMUM_MINUTES = 60

export default function ExamPage() {
  const router = useRouter()
  const [session, setSession] = useState<S | null>(null)
  const [questions, setQuestions] = useState<Q[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [showWarning, setShowWarning] = useState(false)
  const [warnLeft, setWarnLeft] = useState(30)
  
  const [timeElapsed, setTimeElapsed] = useState(0)
  const [examDuration, setExamDuration] = useState(120)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // STATE BARU: Untuk Halaman Instruksi
  const [showWelcome, setShowWelcome] = useState(true)
  const [examId, setExamId] = useState<string>('')
  const [isStarting, setIsStarting] = useState(false)

  const hideTimer = useRef<number | null>(null)
  const warnInterval = useRef<number | null>(null)

  // 1. INIT: Ambil Data
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/')

      const { data: exam } = await supabase.from('exams').select('*').eq('is_open', true).limit(1).single()
      if (!exam) return alert('Tidak ada ujian aktif')
      
      if (exam.duration_minutes) setExamDuration(exam.duration_minutes)
      setExamId(exam.id)

      const { data: qs } = await supabase.from('questions_untuk_siswa').select('*').eq('exam_id', exam.id).order('number')
      setQuestions((qs || []) as Q[])

      // Cek apakah siswa sudah punya sesi ujian
      const { data: sess } = await supabase.from('sessions').select('*').eq('user_id', user.id).eq('exam_id', exam.id).maybeSingle()
      
      if (sess) {
        // Jika sesi sudah ada (misal: refresh halaman), langsung masuk ujian
        setSession(sess as S)
        setShowWelcome(false)
        const { data: ans } = await supabase.from('answers').select('question_id, choice').eq('session_id', sess.id)
        const map: Record<string, string> = {}
        ans?.forEach((a: any) => map[a.question_id] = a.choice)
        setAnswers(map)
      }
      // Jika belum ada sesi, biarkan showWelcome = true
    })()
  }, [router])

  // 2. FUNGSI MULAI UJIAN (Dipicu dari Halaman Instruksi)
  const handleStartExam = async () => {
    setIsStarting(true)
    try {
      // Meminta izin Fullscreen ke browser
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen()
      }
    } catch (err) {
      console.log("Fullscreen ditolak oleh browser")
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Baru membuat sesi di database (timer mulai berjalan)
    const { data: newSess } = await supabase.from('sessions').insert({ user_id: user.id, exam_id: examId }).select().single()
    if (newSess) {
      setSession(newSess as S)
      setShowWelcome(false)
    }
    setIsStarting(false)
  }

  // 3. TIMER & AUTO-SUBMIT
  useEffect(() => {
    if (!session || session.status !== 'active') return
    const startTime = new Date(session.started_at).getTime()
    const maxSeconds = examDuration * 60

    const interval = setInterval(() => {
      const now = new Date().getTime()
      const diffInSeconds = Math.floor((now - startTime) / 1000)
      setTimeElapsed(diffInSeconds)

      if (diffInSeconds >= maxSeconds) {
        clearInterval(interval)
        supabase.from('sessions').update({ 
          status: 'finished', 
          finished_at: new Date().toISOString(),
          duration_seconds: diffInSeconds
        }).eq('id', session.id).then(() => {
          setSession(s => s ? { ...s, status: 'finished' } : s)
        })
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [session, examDuration])

  // 4. DETEKSI PINDAH TAB (Anti-Kecurangan)
  useEffect(() => {
    if (!session || session.status !== 'active') return
    const onVis = () => {
      if (document.hidden) {
        setShowWarning(true)
        setWarnLeft(30)
        const start = Date.now()
        warnInterval.current = window.setInterval(() => {
          setWarnLeft(Math.max(0, 30 - Math.floor((Date.now()-start)/1000)))
        }, 500)
        hideTimer.current = window.setTimeout(async () => {
          const { data } = await supabase.rpc('lock_my_session', { p_session_id: session.id })
          if (data === 'locked') setSession(s => s ? { ...s, status: 'locked' } : s)
          if (warnInterval.current) clearInterval(warnInterval.current)
        }, LOCK_AFTER_MS)
      } else {
        if (hideTimer.current) clearTimeout(hideTimer.current)
        if (warnInterval.current) clearInterval(warnInterval.current)
        setShowWarning(false)
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [session])

  // 5. POLLING STATUS
  useEffect(() => {
    if (!session) return
    const interval = session.status === 'locked' ? POLL_LOCKED_MS : POLL_ACTIVE_MS
    const id = setInterval(async () => {
      const { data } = await supabase.from('sessions').select('status').eq('id', session.id).single()
      if (data?.status && data.status !== session.status) {
        setSession(s => s ? { ...s, status: data.status } : s)
      }
    }, interval)
    return () => clearInterval(id)
  }, [session])

  // 6. SIMPAN JAWABAN
  const saveAnswer = useCallback(async (qid: string, choice: string) => {
    if (!session) return
    setAnswers(a => ({ ...a, [qid]: choice }))
    await supabase.from('answers').upsert(
      { session_id: session.id, question_id: qid, choice, updated_at: new Date().toISOString() },
      { onConflict: 'session_id,question_id' }
    )
  }, [session])

  // 7. SUBMIT MANUAL
  const handleSubmit = async () => {
    if (!session) return
    const minutesElapsed = Math.floor(timeElapsed / 60)
    if (minutesElapsed < MINIMUM_MINUTES) {
      alert(`Anda baru mengerjakan ${minutesElapsed} menit. Anda harus mengerjakan minimal ${MINIMUM_MINUTES} menit sebelum bisa mengumpulkan.`)
      return
    }
    const answeredCount = Object.keys(answers).length
    if (answeredCount < questions.length) {
      alert(`Masih ada ${questions.length - answeredCount} soal yang belum dijawab! Silakan cek navigasi soal berwarna merah.`)
      return
    }
    if (!confirm('Semua soal sudah dijawab. Yakin ingin mengumpulkan ujian?')) return
    setIsSubmitting(true)

    const { error } = await supabase.from('sessions').update({ 
      status: 'finished', 
      finished_at: new Date().toISOString(),
      duration_seconds: timeElapsed
    }).eq('id', session.id)

    if (error) {
      alert('Gagal mengumpulkan: ' + error.message)
      setIsSubmitting(false)
    } else {
      // Ambil data sesi terbaru dari DB agar skor (yang dihitung database) langsung muncul
      const { data: updatedSess } = await supabase.from('sessions').select('*').eq('id', session.id).single()
      
      if (updatedSess) {
        setSession(updatedSess as S)
      } else {
        setSession(s => s ? { ...s, status: 'finished' } : s)
      }
      
      // Keluar dari Fullscreen jika selesai
      if (document.fullscreenElement) {
        document.exitFullscreen()
      }
    }
  }

  const formatRemainingTime = () => {
    const totalSeconds = examDuration * 60
    const remaining = Math.max(0, totalSeconds - timeElapsed)
    const h = Math.floor(remaining / 3600)
    const m = Math.floor((remaining % 3600) / 60)
    const s = remaining % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  if (!session && showWelcome) return (
    // ===== HALAMAN INSTRUKSI (WELCOME SCREEN) =====
    <main className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
      <div className="bg-white p-8 rounded-lg shadow-lg max-w-2xl w-full">
        <h1 className="text-3xl font-bold text-center mb-6 text-blue-900">Instruksi Ujian</h1>
        
        <div className="space-y-4 mb-8 text-gray-700">
          <div className="flex items-start">
            <span className="text-xl mr-3">📝</span>
            <p>Ujian ini terdiri dari <strong>{questions.length} soal</strong> Pilihan Ganda.</p>
          </div>
          <div className="flex items-start">
            <span className="text-xl mr-3">⏱️</span>
            <p>Waktu pengerjaan maksimal adalah <strong>{examDuration} menit</strong>.</p>
          </div>
          <div className="flex items-start">
            <span className="text-xl mr-3">🔒</span>
            <p>Anda <strong>tidak bisa mengumpulkan</strong> ujian sebelum mengerjakan minimal <strong>60 menit</strong>.</p>
          </div>
          <div className="flex items-start p-4 bg-red-50 border border-red-200 rounded-md mt-4">
            <span className="text-2xl mr-3">⚠️</span>
            <div>
              <p className="font-bold text-red-700">PERINGATAN KERAS!</p>
              <p className="text-red-600">Dilarang keras berpindah tab, meminimalkan browser, atau meninggalkan halaman ini. Sistem pengawas akan <strong>mengunci ujian Anda secara otomatis</strong> jika Anda terdeteksi keluar dari layar ujian lebih dari 30 detik.</p>
            </div>
          </div>
        </div>

        <button 
          onClick={handleStartExam}
          disabled={isStarting}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-lg text-lg transition shadow-md"
        >
          {isStarting ? 'Mempersiapkan Ujian...' : 'Saya Mengerti & Mulai Ujian'}
        </button>
      </div>
    </main>
  )

  if (!session) return <p className="p-6">Memuat data soal…</p>

  if (session.status === 'locked') return (
    <main className="min-h-screen flex items-center justify-center bg-red-50">
      <div className="text-center p-8 bg-white rounded shadow max-w-md">
        <h1 className="text-2xl font-bold text-red-700">🔒 Ujian Terkunci</h1>
        <p className="mt-3">Anda terdeteksi meninggalkan halaman ujian lebih dari 30 detik.</p>
        <p className="mt-2 text-sm text-gray-600">Hubungi pengawas. Jika tidak dibuka dalam 30 menit, ujian otomatis selesai.</p>
      </div>
    </main>
  )

  // ===== HALAMAN SELESAI (TAMPILAN NILAI BARU) =====
  if (session.status === 'finished') {
    return (
      <main className="min-h-screen flex items-center justify-center bg-green-50">
        <div className="text-center p-8 bg-white rounded shadow max-w-md w-full border-4 border-green-500">
          <h1 className="text-3xl font-bold text-green-700 mb-2">Ujian Selesai!</h1>
          <p className="text-gray-600 mb-6">Jawaban Anda telah berhasil disimpan.</p>
          
          <div className="bg-gray-100 p-6 rounded-lg mb-6">
            <p className="text-sm text-gray-500 mb-2">Nilai Anda:</p>
            <p className="text-6xl font-bold text-blue-700">{session.score !== null ? session.score : '...'}</p>
            <p className="text-sm text-gray-500 mt-2">dari 100</p>
          </div>

          <button onClick={() => router.push('/')} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded font-bold w-full">
            Kembali ke Halaman Login
          </button>
        </div>
      </main>
    )
  }

  const currentQ = questions[currentIdx]
  const minutesElapsed = Math.floor(timeElapsed / 60)
  const isTimeUp = minutesElapsed >= MINIMUM_MINUTES
  const allAnswered = Object.keys(answers).length === questions.length
  const timeRemainingSeconds = (examDuration * 60) - timeElapsed

  return (
    // ===== HALAMAN UJIAN SESUNGGUHNYA =====
    <main className="p-6 max-w-5xl mx-auto flex flex-col md:flex-row gap-6">
      {showWarning && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded max-w-md text-center border-4 border-red-500">
            <h2 className="text-3xl font-bold text-red-600 animate-pulse">⚠️ JANGAN TINGGALKAN HALAMAN!</h2>
            <p className="mt-4 text-xl">Kembali dalam <b className="text-3xl text-red-700">{warnLeft}</b> detik atau ujian akan terkunci.</p>
          </div>
        </div>
      )}

      <div className="flex-1">
        <div className="flex justify-between items-center mb-4 bg-gray-100 p-4 rounded shadow-sm">
          <h1 className="text-xl font-bold">Ujian PAI</h1>
          <div className={`text-lg font-mono font-bold ${timeRemainingSeconds < 300 ? 'text-red-600 animate-pulse' : 'text-blue-700'}`}>
            ⏱ Sisa Waktu: {formatRemainingTime()}
          </div>
        </div>

        {currentQ && (
          <div className="p-6 border rounded shadow-sm bg-white">
            <p className="font-medium text-lg mb-4">{currentQ.number}. {currentQ.question}</p>
            <div className="space-y-3">
              {(['A','B','C','D'] as const).map(opt => (
                <label key={opt} className={`block p-3 border rounded cursor-pointer transition ${answers[currentQ.id] === opt ? 'bg-blue-50 border-blue-500' : 'hover:bg-gray-50'}`}>
                  <input 
                    type="radio" 
                    name={currentQ.id} 
                    checked={answers[currentQ.id]===opt} 
                    onChange={()=>saveAnswer(currentQ.id, opt)}
                    className="mr-3"
                  />
                  <span>{opt}. {(currentQ as any)['option_'+opt.toLowerCase()]}</span>
                </label>
              ))}
            </div>
            
            <div className="mt-6 flex justify-between">
              <button 
                onClick={() => setCurrentIdx(i => Math.max(0, i - 1))}
                disabled={currentIdx === 0}
                className="bg-gray-300 px-4 py-2 rounded disabled:opacity-50 font-medium"
              >
                ← Sebelumnya
              </button>
              <button 
                onClick={() => setCurrentIdx(i => Math.min(questions.length - 1, i + 1))}
                disabled={currentIdx === questions.length - 1}
                className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50 font-medium"
              >
                Selanjutnya →
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="w-full md:w-80">
        <div className="border rounded shadow-sm p-4 bg-white sticky top-6">
          <h2 className="font-bold mb-3 border-b pb-2">Navigasi Soal</h2>
          
          <div className="grid grid-cols-5 gap-2 mb-6">
            {questions.map((q, i) => {
              const isAnswered = !!answers[q.id]
              return (
                <button
                  key={q.id}
                  onClick={() => setCurrentIdx(i)}
                  className={`h-10 w-full rounded font-bold text-sm transition
                    ${currentIdx === i ? 'ring-2 ring-blue-600 ring-offset-1' : ''}
                    ${isAnswered ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}
                  `}
                >
                  {q.number}
                </button>
              )
            })}
          </div>

          <div className="space-y-1 text-sm mb-6 text-gray-600">
            <p><span className="inline-block w-3 h-3 bg-green-500 rounded-sm mr-2"></span> Sudah dijawab</p>
            <p><span className="inline-block w-3 h-3 bg-red-500 rounded-sm mr-2"></span> Belum dijawab</p>
          </div>

          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={`w-full py-3 rounded font-bold text-white transition
              ${(!isTimeUp || !allAnswered) ? 'bg-gray-400 cursor-not-allowed' : 'bg-black hover:bg-gray-800'}
            `}
          >
            {isSubmitting ? 'Mengirim...' : (isTimeUp && allAnswered) ? 'Kumpulkan Ujian' : 'Belum Bisa Kumpul'}
          </button>
          
          {!isTimeUp && (
            <p className="text-xs text-red-600 mt-2 text-center">
              Minimal pengerjaan {MINIMUM_MINUTES} menit. Sisa waktu tunggu: {MINIMUM_MINUTES - minutesElapsed} menit.
            </p>
          )}
          {isTimeUp && !allAnswered && (
            <p className="text-xs text-red-600 mt-2 text-center">
              Waktu sudah cukup, tapi masih ada soal yang merah!
            </p>
          )}
        </div>
      </div>
    </main>
  )
}