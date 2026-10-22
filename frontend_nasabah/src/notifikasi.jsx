import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  Megaphone,
  Recycle,
  ShieldAlert,
  WalletCards,
  X,
  XCircle,
} from 'lucide-react'
import { API, getAuthHeaders, parseResponse, requestJson } from './api'

const INTERVAL_MS = 30_000
const KOSONG = { belum_dibaca: 0, chat_belum_dibaca: 0 }

// ---------- tampilan & tujuan per jenis notifikasi ----------
export const TIPE_META = {
  setoran: { icon: Recycle, box: 'bg-emerald-50 text-emerald-600' },
  penarikan_selesai: { icon: CheckCircle2, box: 'bg-sky-50 text-sky-600' },
  penarikan_ditolak: { icon: XCircle, box: 'bg-red-50 text-red-600' },
  saldo: { icon: WalletCards, box: 'bg-violet-50 text-violet-600' },
  pengumuman: { icon: Megaphone, box: 'bg-amber-50 text-amber-600' },
  keamanan: { icon: ShieldAlert, box: 'bg-red-50 text-red-600' },
  sukses: { icon: CheckCircle2, box: 'bg-emerald-50 text-emerald-600' },
  galat: { icon: AlertCircle, box: 'bg-red-50 text-red-600' },
  default: { icon: Bell, box: 'bg-slate-100 text-slate-500' },
}
export const metaTipe = (tipe) => TIPE_META[tipe] || TIPE_META.default

// id halaman di App.jsx yang dibuka saat notifikasi diketuk
export function tujuanNotifikasi(tipe) {
  switch (tipe) {
    case 'setoran':
      return 'history'
    case 'penarikan_selesai':
    case 'penarikan_ditolak':
      return 'withdraw'
    case 'pengumuman':
      return 'pengumuman'
    case 'keamanan':
      return 'profile'
    default:
      return 'dashboard'
  }
}

// ---------- context ----------
const NotifContext = createContext({
  belumDibaca: 0,
  chatBelumDibaca: 0,
  refresh: async () => {},
  kurangiBelumDibaca: () => {},
  nolkanBelumDibaca: () => {},
  tampilkanToast: () => {},
})

export const useNotifikasi = () => useContext(NotifContext)

export function NotifikasiProvider({ aktif, onBuka, children }) {
  const [ringkasan, setRingkasan] = useState(KOSONG)
  const [toasts, setToasts] = useState([])
  const idTerakhir = useRef(null) // id notifikasi terbaru yang sudah "diketahui" aplikasi
  const toastSeq = useRef(0)
  const bukaRef = useRef(onBuka)

  useEffect(() => {
    bukaRef.current = onBuka
  }, [onBuka])

  const tutupToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const tampilkanToast = useCallback((toast) => {
    const id = ++toastSeq.current
    setToasts((prev) => [...prev.slice(-2), { id, ...toast }]) // maksimal 3 toast sekaligus
    return id
  }, [])

  // silent=true: sinkronkan saja, jangan munculkan toast (mis. setelah aksi yang dilakukan nasabah sendiri)
  const refresh = useCallback(
    async ({ silent = false } = {}) => {
      try {
        const r = await parseResponse(await fetch(API.notifikasiRingkasan, { headers: getAuthHeaders() }))
        setRingkasan({
          belum_dibaca: r?.belum_dibaca ?? 0,
          chat_belum_dibaca: r?.chat_belum_dibaca ?? 0,
        })
        const terbaru = r?.id_terbaru ?? 0

        // Pengecekan pertama setelah login = patokan awal. Notifikasi lama tidak di-toast.
        if (idTerakhir.current === null || silent) {
          idTerakhir.current = Math.max(idTerakhir.current ?? 0, terbaru)
          return
        }
        if (terbaru > idTerakhir.current) {
          const dari = idTerakhir.current
          idTerakhir.current = terbaru
          const daftar = await parseResponse(
            await fetch(`${API.notifikasi}?setelah_id=${dari}&limit=3`, { headers: getAuthHeaders() })
          )
          ;(daftar?.data || [])
            .slice()
            .reverse()
            .forEach((n) =>
              tampilkanToast({ id_notifikasi: n.id_notifikasi, tipe: n.tipe, judul: n.judul, isi: n.isi })
            )
        }
      } catch {
        // Jaringan putus / server sibuk: diam saja, dicoba lagi di siklus berikutnya.
      }
    },
    [tampilkanToast]
  )

  useEffect(() => {
    if (!aktif) {
      idTerakhir.current = null
      setRingkasan(KOSONG)
      setToasts([])
      return undefined
    }
    refresh()
    const timer = setInterval(() => {
      if (!document.hidden) refresh()
    }, INTERVAL_MS)
    const saatTerlihat = () => {
      if (!document.hidden) refresh()
    }
    document.addEventListener('visibilitychange', saatTerlihat)
    window.addEventListener('online', saatTerlihat)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', saatTerlihat)
      window.removeEventListener('online', saatTerlihat)
    }
  }, [aktif, refresh])

  const kurangiBelumDibaca = useCallback((n = 1) => {
    setRingkasan((prev) => ({ ...prev, belum_dibaca: Math.max(0, prev.belum_dibaca - n) }))
  }, [])
  const nolkanBelumDibaca = useCallback(() => {
    setRingkasan((prev) => ({ ...prev, belum_dibaca: 0 }))
  }, [])

  const ketukToast = useCallback(
    (toast) => {
      tutupToast(toast.id)
      if (!toast.id_notifikasi) return
      kurangiBelumDibaca(1)
      requestJson(`${API.notifikasi}${toast.id_notifikasi}/baca`, { method: 'POST' }).catch(() => {})
      bukaRef.current?.(tujuanNotifikasi(toast.tipe))
    },
    [kurangiBelumDibaca, tutupToast]
  )

  const value = useMemo(
    () => ({
      belumDibaca: ringkasan.belum_dibaca,
      chatBelumDibaca: ringkasan.chat_belum_dibaca,
      refresh,
      kurangiBelumDibaca,
      nolkanBelumDibaca,
      tampilkanToast,
    }),
    [ringkasan, refresh, kurangiBelumDibaca, nolkanBelumDibaca, tampilkanToast]
  )

  return (
    <NotifContext.Provider value={value}>
      {children}
      <ToastHost toasts={toasts} onTutup={tutupToast} onKetuk={ketukToast} />
    </NotifContext.Provider>
  )
}

// ---------- toast ----------
function ToastItem({ toast, onTutup, onKetuk }) {
  const { icon: Icon, box } = metaTipe(toast.tipe)
  const bisaDiketuk = !!toast.id_notifikasi

  useEffect(() => {
    const timer = setTimeout(() => onTutup(toast.id), toast.durasi ?? 6000)
    return () => clearTimeout(timer)
  }, [toast.id, toast.durasi, onTutup])

  const isi = (
    <>
      <div className={`flex size-9 shrink-0 items-center justify-center rounded-full ${box}`}>
        <Icon size={17} />
      </div>
      <div className="min-w-0 flex-1 text-left">
        <p className="truncate font-poppins text-xs font-bold text-slate-800">{toast.judul}</p>
        {toast.isi && <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-slate-500">{toast.isi}</p>}
      </div>
    </>
  )

  return (
    <div className="toast-masuk pointer-events-auto flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-lg shadow-slate-300/40">
      {bisaDiketuk ? (
        <button type="button" onClick={() => onKetuk(toast)} className="flex min-w-0 flex-1 items-start gap-3">
          {isi}
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 items-start gap-3">{isi}</div>
      )}
      <button
        type="button"
        onClick={() => onTutup(toast.id)}
        aria-label="Tutup notifikasi"
        className="shrink-0 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
      >
        <X size={14} />
      </button>
    </div>
  )
}

function ToastHost({ toasts, onTutup, onKetuk }) {
  if (toasts.length === 0) return null
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed left-1/2 top-3 z-[70] flex w-[min(388px,calc(100vw-24px))] -translate-x-1/2 flex-col gap-2"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onTutup={onTutup} onKetuk={onKetuk} />
      ))}
    </div>
  )
}