// frontend_nasabah/src/pages/Notifikasi.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, ArrowLeft, Bell, CheckCheck, Loader2, RefreshCw } from 'lucide-react'
import PhoneShell from '../components/PhoneShell'
import BottomNav from '../components/BottomNav'
import { API, formatTanggal, parseDate, parseResponse, getAuthHeaders, requestJson } from '../api'
import { metaTipe, tujuanNotifikasi, useNotifikasi } from '../notifikasi'

const PER_HALAMAN = 30

// "5 menit lalu", "2 jam lalu", selebihnya tanggal lengkap
function waktuRelatif(value) {
  const selisih = Date.now() - parseDate(value).getTime()
  const menit = Math.floor(selisih / 60000)
  if (menit < 1) return 'Baru saja'
  if (menit < 60) return `${menit} menit lalu`
  const jam = Math.floor(menit / 60)
  if (jam < 24) return `${jam} jam lalu`
  return formatTanggal(value)
}

function labelHari(value) {
  const d = parseDate(value)
  const mulaiHari = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const selisihHari = Math.round((mulaiHari(new Date()) - mulaiHari(d)) / 86400000)
  if (selisihHari <= 0) return 'Hari ini'
  if (selisihHari === 1) return 'Kemarin'
  return formatTanggal(value, false)
}

export default function Notifikasi({ onNavigate }) {
  const { belumDibaca, refresh, kurangiBelumDibaca, nolkanBelumDibaca } = useNotifikasi()
  const [filter, setFilter] = useState('semua') // semua | belum
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [menandai, setMenandai] = useState(false)
  const jumlahMuat = useRef(0) // jumlah item saat ini; dibaca lewat ref supaya muat() tidak basi
  jumlahMuat.current = items.length

  const muat = useCallback(
    async ({ tambah = false } = {}) => {
      tambah ? setLoadingMore(true) : setLoading(true)
      setError('')
      try {
        const offset = tambah ? jumlahMuat.current : 0
        const qs = new URLSearchParams({ limit: String(PER_HALAMAN), offset: String(offset) })
        if (filter === 'belum') qs.set('hanya_belum_dibaca', 'true')
        const r = await parseResponse(await fetch(`${API.notifikasi}?${qs}`, { headers: getAuthHeaders() }))
        setItems((prev) => (tambah ? [...prev, ...(r?.data || [])] : r?.data || []))
        setTotal(r?.total ?? 0)
      } catch (err) {
        setError(err.message || 'Gagal memuat notifikasi.')
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [filter]
  )

  useEffect(() => {
    muat()
    refresh({ silent: true }) // sinkronkan badge; notifikasi yang sedang dilihat tidak perlu di-toast
  }, [muat, refresh])

  const kelompok = useMemo(() => {
    const peta = new Map()
    items.forEach((n) => {
      const label = labelHari(n.tanggal)
      if (!peta.has(label)) peta.set(label, [])
      peta.get(label).push(n)
    })
    return [...peta.entries()]
  }, [items])

  async function ketuk(n) {
    if (!n.is_read) {
      // Optimistik: tampilan langsung berubah, server menyusul
      setItems((prev) =>
        filter === 'belum'
          ? prev.filter((x) => x.id_notifikasi !== n.id_notifikasi)
          : prev.map((x) => (x.id_notifikasi === n.id_notifikasi ? { ...x, is_read: true } : x))
      )
      kurangiBelumDibaca(1)
      requestJson(`${API.notifikasi}${n.id_notifikasi}/baca`, { method: 'POST' }).catch(() => refresh({ silent: true }))
    }
    onNavigate(tujuanNotifikasi(n.tipe))
  }

  async function tandaiSemua() {
    setMenandai(true)
    try {
      await requestJson(API.notifikasiBacaSemua, { method: 'POST' })
      nolkanBelumDibaca()
      setItems((prev) => (filter === 'belum' ? [] : prev.map((x) => ({ ...x, is_read: true }))))
      if (filter === 'belum') setTotal(0)
    } catch (err) {
      setError(err.message || 'Gagal menandai notifikasi.')
    } finally {
      setMenandai(false)
    }
  }

  const FILTER = [
    { id: 'semua', label: 'Semua' },
    { id: 'belum', label: belumDibaca > 0 ? `Belum dibaca (${belumDibaca})` : 'Belum dibaca' },
  ]

  return (
    <PhoneShell bottom={<BottomNav active="" onNavigate={onNavigate} />}>
      <div className="min-h-205 bg-slate-50">
        <header className="flex h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={() => onNavigate('dashboard')} aria-label="Kembali ke beranda">
              <ArrowLeft size={18} className="text-slate-500" />
            </button>
            <div className="min-w-0">
              <h1 className="font-poppins text-base font-bold text-emerald-900">Notifikasi</h1>
              <p className="text-[11px] text-slate-400">
                {belumDibaca > 0 ? `${belumDibaca} belum dibaca` : 'Semua sudah dibaca'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={tandaiSemua}
            disabled={belumDibaca === 0 || menandai}
            className="flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-bold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent"
          >
            {menandai ? <Loader2 size={14} className="animate-spin" /> : <CheckCheck size={14} />}
            Tandai semua dibaca
          </button>
        </header>

        <div className="flex gap-2 overflow-x-auto border-b border-slate-100 bg-white px-6 pb-3 pt-1">
          {FILTER.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              aria-pressed={filter === f.id}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                filter === f.id
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                  : 'border-slate-200 bg-white text-slate-500'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <main className="px-6 py-5">
          {loading && items.length === 0 && (
            <div className="space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-200/70" />
              ))}
            </div>
          )}

          {error && (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-600">
              <span className="flex items-center gap-2">
                <AlertCircle size={14} className="shrink-0" />
                {error}
              </span>
              <button
                type="button"
                onClick={() => muat()}
                className="flex shrink-0 items-center gap-1 font-bold underline underline-offset-2"
              >
                <RefreshCw size={12} />
                Coba lagi
              </button>
            </div>
          )}

          {!loading && !error && items.length === 0 && (
            <div className="flex flex-col items-center py-20 text-center">
              <div className="flex size-16 items-center justify-center rounded-full bg-emerald-50">
                <Bell size={26} className="text-emerald-600" />
              </div>
              <p className="mt-4 font-poppins text-sm font-bold text-slate-700">
                {filter === 'belum' ? 'Tidak ada yang belum dibaca' : 'Belum ada notifikasi'}
              </p>
              <p className="mt-1 max-w-60 text-xs text-slate-400">
                Kabar soal setoran, penarikan saldo, dan pengumuman akan muncul di sini.
              </p>
            </div>
          )}

          <div className="space-y-5">
            {kelompok.map(([label, daftar]) => (
              <section key={label}>
                <h2 className="mb-2 text-[11px] font-bold text-slate-400">{label}</h2>
                <ul className="space-y-2">
                  {daftar.map((n) => {
                    const { icon: Icon, box } = metaTipe(n.tipe)
                    return (
                      <li key={n.id_notifikasi}>
                        <button
                          type="button"
                          onClick={() => ketuk(n)}
                          className={`flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left transition active:scale-[0.99] ${
                            n.is_read
                              ? 'border-slate-200 bg-white'
                              : 'border-emerald-200 bg-emerald-50/50'
                          }`}
                        >
                          <div className={`flex size-10 shrink-0 items-center justify-center rounded-full ${box}`}>
                            <Icon size={18} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p
                                className={`font-poppins text-xs text-slate-800 ${
                                  n.is_read ? 'font-semibold' : 'font-bold'
                                }`}
                              >
                                {n.judul}
                              </p>
                              {!n.is_read && (
                                <span
                                  aria-label="Belum dibaca"
                                  className="mt-1 size-2 shrink-0 rounded-full bg-emerald-500"
                                />
                              )}
                            </div>
                            <p className="mt-1 line-clamp-3 text-[11px] leading-4 text-slate-500">{n.isi}</p>
                            <p className="mt-1.5 text-[10px] text-slate-400">{waktuRelatif(n.tanggal)}</p>
                          </div>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
          </div>

          {items.length > 0 && items.length < total && (
            <button
              type="button"
              onClick={() => muat({ tambah: true })}
              disabled={loadingMore}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3 text-xs font-bold text-emerald-700 disabled:opacity-60"
            >
              {loadingMore && <Loader2 size={14} className="animate-spin" />}
              Muat lebih banyak
            </button>
          )}
        </main>
      </div>
    </PhoneShell>
  )
}