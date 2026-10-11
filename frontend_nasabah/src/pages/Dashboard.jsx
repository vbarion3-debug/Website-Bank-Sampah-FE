import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowUpRight,
  Bell,
  ChevronRight,
  Eye,
  EyeOff,
  Megaphone,
  RefreshCw,
  WalletCards,
} from "lucide-react";
import PhoneShell from "../components/PhoneShell";
import BottomNav from "../components/BottomNav";
import { stripMarkdown } from "../components/RichText";
import {
  API,
  getAuthHeaders,
  parseResponse,
  fetchActiveAnnouncements,
  fetchHargaSampah,
  formatTanggal,
} from "../api";
import { useData } from "../useData";

function greeting() {
  const h = new Date().getHours();
  if (h < 11) return "Selamat pagi";
  if (h < 15) return "Selamat siang";
  if (h < 18) return "Selamat sore";
  return "Selamat malam";
}

const rupiah = (n) => `Rp ${Number(n || 0).toLocaleString("id-ID")}`;

function Skeleton({ className = "" }) {
  return <div className={`animate-pulse rounded-lg bg-slate-200/70 ${className}`} />;
}

function InlineError({ message, onRetry }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-600">
      <span className="flex items-center gap-2">
        <AlertCircle size={14} className="shrink-0" />
        {message}
      </span>
      <button
        type="button"
        onClick={onRetry}
        className="flex shrink-0 items-center gap-1 font-bold underline underline-offset-2"
      >
        <RefreshCw size={12} />
        Coba lagi
      </button>
    </div>
  );
}

export default function Dashboard({ onNavigate }) {
  // ---------- PROFIL ----------
  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState("");
  const [hideSaldo, setHideSaldo] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(API.profile, { headers: getAuthHeaders() });
        const data = await parseResponse(response);
        if (!cancelled) setProfile(data?.data || data);
      } catch (err) {
        if (!cancelled) setProfileError(err.message || "Gagal memuat data profil.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ---------- PENGUMUMAN & HARGA (dari database) ----------
  const announcements = useData(fetchActiveAnnouncements);
  const harga = useData(fetchHargaSampah);

  const name = profile?.nama_nasabah || profile?.nama || "Nasabah";
  const saldo = profile?.saldo ?? profile?.balance ?? 0;
  const profileLoading = !profile && !profileError;

  const activeAnn = announcements.data || [];
  const latest = activeAnn[0];
  const priceList = harga.data || [];

  const nav = (id) => {
    if (id !== "dashboard") onNavigate(id);
  };

  return (
    <PhoneShell bottom={<BottomNav active="dashboard" onNavigate={nav} />}>
      <div className="min-h-[820px] bg-slate-50">
        {/* Header */}
        <header className="flex h-20 items-center justify-between border-b border-slate-200 bg-white px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate("profile")}
              aria-label="Buka profil"
              className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 font-poppins text-base font-bold text-white"
            >
              {name.charAt(0).toUpperCase()}
            </button>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-500">{greeting()},</p>
              {profileLoading ? (
                <Skeleton className="mt-1 h-5 w-32" />
              ) : (
                <h1 className="truncate font-poppins text-lg font-bold leading-6 text-emerald-900">
                  {name}
                </h1>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate("pengumuman")}
            aria-label="Pengumuman"
            className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-50"
          >
            <Bell size={18} className="text-emerald-600" />
            {activeAnn.length > 0 && (
              <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-red-500 ring-2 ring-emerald-50" />
            )}
          </button>
        </header>

        <main className="space-y-6 px-6 py-5">
          {/* Saldo */}
          <section className="relative overflow-hidden rounded-2xl bg-gradient-to-bl from-emerald-900 to-emerald-600 p-5 text-white shadow-[0_10px_20px_rgba(5,150,105,.20)]">
            <div className="pointer-events-none absolute -right-8 -top-8 size-32 rounded-full bg-white/10" />
            <div className="pointer-events-none absolute -bottom-10 right-10 size-24 rounded-full bg-white/5" />

            <div className="relative flex items-center justify-between">
              <p className="text-xs font-semibold text-emerald-100">
                Total Saldo Tabungan Sampah
              </p>
              <button
                type="button"
                onClick={() => setHideSaldo((v) => !v)}
                aria-label={hideSaldo ? "Tampilkan saldo" : "Sembunyikan saldo"}
                className="text-emerald-100 transition hover:text-white"
              >
                {hideSaldo ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {profileLoading ? (
              <Skeleton className="mt-3 h-8 w-44 bg-white/20" />
            ) : (
              <p className="relative mt-2 font-poppins text-3xl font-bold tracking-tight">
                {hideSaldo ? "Rp ••••••" : rupiah(saldo)}
              </p>
            )}

            <div className="relative mt-5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-emerald-100">
                <WalletCards size={13} />
                <span>Siap ditarik kapan saja</span>
              </div>
              <button
                type="button"
                onClick={() => onNavigate("withdraw")}
                className="flex items-center gap-1 rounded-full bg-white px-3.5 py-1.5 text-xs font-bold text-emerald-700 shadow-sm transition hover:bg-emerald-50"
              >
                Tarik Saldo
                <ArrowUpRight size={13} />
              </button>
            </div>

            {profileError && (
              <p className="relative mt-3 text-[11px] text-amber-200">
                Data profil belum dapat dimuat: {profileError}
              </p>
            )}
          </section>

          {/* Pengumuman */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-poppins text-sm font-semibold text-slate-800">
                Pengumuman Admin
              </h2>
              {activeAnn.length > 0 && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                  {activeAnn.length} aktif
                </span>
              )}
            </div>

            {announcements.loading && !announcements.data ? (
              <Skeleton className="h-24 w-full rounded-2xl" />
            ) : announcements.error && !announcements.data ? (
              <InlineError
                message={`Pengumuman gagal dimuat: ${announcements.error}`}
                onRetry={announcements.reload}
              />
            ) : (
              <button
                type="button"
                onClick={() => onNavigate("pengumuman")}
                className="block w-full rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left transition active:scale-[0.99]"
              >
                <div className="flex gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-100">
                    <Megaphone size={16} className="text-amber-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    {latest ? (
                      <>
                        <p className="truncate font-poppins text-xs font-bold text-amber-900">
                          {latest.judul}
                        </p>
                        <p className="mt-1 line-clamp-2 text-xs leading-4 text-amber-800/80">
                          {stripMarkdown(latest.isi)}
                        </p>
                        <p className="mt-2 text-[10px] text-amber-700/70">
                          {formatTanggal(latest.tanggal_publikasi)}
                        </p>
                      </>
                    ) : (
                      <p className="py-2 text-xs text-amber-800/80">
                        Belum ada pengumuman aktif saat ini.
                      </p>
                    )}
                  </div>
                  <ChevronRight size={18} className="mt-1 shrink-0 text-amber-500" />
                </div>
                {activeAnn.length > 1 && (
                  <p className="mt-3 border-t border-amber-200 pt-2 text-center text-[11px] font-bold text-amber-700">
                    Lihat {activeAnn.length} pengumuman
                  </p>
                )}
              </button>
            )}
          </section>

          {/* Harga Sampah */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-poppins text-sm font-semibold text-slate-800">
                Update Harga Sampah / kg
              </h2>
              <button
                type="button"
                onClick={() => onNavigate("harga")}
                className="flex items-center text-xs font-bold text-emerald-600"
              >
                Lihat Semua
                <ChevronRight size={14} />
              </button>
            </div>

            {harga.loading && !harga.data ? (
              <div className="flex gap-2 overflow-hidden">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-[92px] w-[128px] shrink-0 rounded-xl" />
                ))}
              </div>
            ) : harga.error && !harga.data ? (
              <InlineError
                message={`Harga gagal dimuat: ${harga.error}`}
                onRetry={harga.reload}
              />
            ) : priceList.length === 0 ? (
              <p className="rounded-xl border border-slate-200 bg-white py-6 text-center text-xs text-slate-400">
                Belum ada data harga sampah.
              </p>
            ) : (
              <div className="-mx-6 flex snap-x gap-2 overflow-x-auto px-6 pb-1 [scrollbar-width:none]">
                {priceList.slice(0, 8).map((item) => (
                  <div
                    key={item.id}
                    className="w-[128px] shrink-0 snap-start rounded-xl border border-slate-200 bg-white p-3"
                  >
                    <span className="inline-block max-w-full truncate rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600">
                      {item.kategori}
                    </span>
                    <p className="mt-2 line-clamp-2 min-h-8 text-xs font-semibold leading-4 text-slate-700">
                      {item.nama}
                    </p>
                    <p className="mt-1 text-sm font-bold text-emerald-600">
                      {rupiah(item.harga)}
                    </p>
                  </div>
                ))}
                {priceList.length > 8 && (
                  <button
                    type="button"
                    onClick={() => onNavigate("harga")}
                    className="flex w-[100px] shrink-0 snap-start flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-emerald-300 bg-emerald-50 text-xs font-bold text-emerald-600"
                  >
                    <ChevronRight size={18} />
                    +{priceList.length - 8} lagi
                  </button>
                )}
              </div>
            )}
          </section>

          {/* Setoran Terakhir (placeholder, belum ada endpoint) */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <h2 className="font-poppins text-sm font-semibold text-slate-800">
                Setoran Terakhir
              </h2>
              <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
                Contoh
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
              <div>
                <p className="text-xs font-bold text-slate-800">Plastik PET & Kardus</p>
                <p className="mt-1 text-xs text-slate-500">2 Juli 2026 • 14:46 WIB</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-emerald-600">+ Rp 13.750</p>
                <span className="mt-1 inline-block rounded-sm bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-500">
                  Berhasil
                </span>
              </div>
            </div>
          </section>
        </main>
      </div>
    </PhoneShell>
  );
}
