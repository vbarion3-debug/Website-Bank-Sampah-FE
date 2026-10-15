import { useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  History as HistoryIcon,
  Recycle,
  RefreshCw,
  WalletCards,
} from "lucide-react";
import PhoneShell from "../components/PhoneShell";
import BottomNav from "../components/BottomNav";
import {
  API,
  getAuthHeaders,
  parseResponse,
  parseDate,
  formatTanggal,
} from "../api";
import { useData } from "../useData";

// ======================================================
// HELPER
// ======================================================
function rupiah(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function formatBerat(value) {
  const berat = Number(value);
  if (value == null || !Number.isFinite(berat)) return "";
  return `${new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 2,
  }).format(berat)} kg`;
}

// Backend bisa mengirim array langsung atau dibungkus { data: [...] }
function toList(result) {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.data)) return result.data;
  if (Array.isArray(result?.data?.data)) return result.data.data;
  return [];
}

// Satu transaksi setoran = satu kartu (ringkasan semua jenis sampah di dalamnya)
function normalizeSetoran(item) {
  const id = item.id_transaksi ?? item.transaksi_id ?? item.id;
  const rawDetails = item.details ?? item.detail ?? [];
  const details = Array.isArray(rawDetails) ? rawDetails : [];

  const names = [
    ...new Set(
      details
        .map((d) => d.nama_jenis ?? d.jenis_sampah ?? d.nama_sampah)
        .filter(Boolean)
    ),
  ];
  const detailTotal = details.reduce(
    (sum, d) => sum + (Number(d.subtotal ?? d.total) || 0),
    0
  );
  const detailBerat = details.reduce(
    (sum, d) => sum + (Number(d.berat ?? d.berat_kg) || 0),
    0
  );

  return {
    id: `setoran-${id}`,
    category: "setoran",
    title: "Setoran Sampah",
    subtitle: names.join(", ") || item.jenis_sampah || item.nama_jenis || "",
    amount:
      Number(
        item.total_nilai ??
          item.total ??
          item.nominal ??
          item.total_pembayaran
      ) || detailTotal,
    weight: item.total_berat ?? item.berat ?? (details.length ? detailBerat : null),
    date: item.tanggal_transaksi ?? item.tanggal ?? item.created_at,
    status: item.status ?? "berhasil",
  };
}

function normalizePenarikan(item) {
  const id = item.id_penarikan ?? item.id;
  const bank = item.nama_bank ?? "Rekening";

  return {
    id: `penarikan-${id}`,
    category: "penarikan",
    title: `Penarikan ke ${bank}`,
    subtitle: item.no_rekening ?? "",
    amount: Number(item.jumlah ?? item.nominal ?? item.total) || 0,
    weight: null,
    date: item.tanggal_pengajuan ?? item.tanggal ?? item.created_at,
    status: item.status ?? "menunggu",
  };
}

// Dibuat di luar komponen supaya referensinya stabil untuk useData
async function fetchRiwayat() {
  const headers = getAuthHeaders();

  // Setoran: wajib berhasil, kalau gagal tampilkan error
  const setoranResponse = await fetch(API.transaksiHistory, { headers });
  const setoran = toList(await parseResponse(setoranResponse));

  // Penarikan: opsional, kalau endpoint belum ada riwayat setoran tetap tampil
  let penarikan = [];
  try {
    const response = await fetch(API.penarikanHistory, { headers });
    if (response.ok) penarikan = toList(await response.json());
  } catch {
    penarikan = [];
  }

  return [
    ...setoran.map(normalizeSetoran),
    ...penarikan.map(normalizePenarikan),
  ].sort((a, b) => parseDate(b.date) - parseDate(a.date));
}

function statusInfo(status) {
  const value = String(status ?? "").toLowerCase();

  if (["berhasil", "success", "completed", "selesai", "disetujui", "dibayar"].includes(value)) {
    return { label: "Berhasil", className: "bg-emerald-50 text-emerald-600" };
  }
  if (["ditolak", "rejected", "failed", "gagal"].includes(value)) {
    return { label: "Ditolak", className: "bg-red-50 text-red-600" };
  }
  if (value === "dibatalkan") {
    return { label: "Dibatalkan", className: "bg-slate-100 text-slate-500" };
  }
  return { label: "Menunggu", className: "bg-amber-50 text-amber-700" };
}

const FILTERS = [
  { id: "semua", label: "Semua" },
  { id: "setoran", label: "Setoran Masuk" },
  { id: "penarikan", label: "Penarikan Saldo" },
];

// ======================================================
// HALAMAN
// ======================================================
export default function History({ onNavigate }) {
  const { data, loading, error, reload } = useData(fetchRiwayat);
  const [activeFilter, setActiveFilter] = useState("semua");

  const list = useMemo(() => {
    const rows = data || [];
    return activeFilter === "semua"
      ? rows
      : rows.filter((item) => item.category === activeFilter);
  }, [data, activeFilter]);

  return (
    <PhoneShell bottom={<BottomNav active="history" onNavigate={onNavigate} />}>
      <div className="min-h-205 bg-slate-50">
        {/* Header */}
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6">
          <div>
            <h1 className="font-poppins text-base font-bold text-emerald-900">
              Riwayat Transaksi
            </h1>
            <p className="text-[11px] text-slate-400">
              Semua catatan setoran &amp; aktivitas saldomu
            </p>
          </div>
          <button
            type="button"
            onClick={reload}
            aria-label="Muat ulang transaksi"
            className="rounded-lg p-2 text-emerald-600 hover:bg-emerald-50"
          >
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          </button>
        </header>

        {/* Filter */}
        <div className="flex gap-2 overflow-x-auto border-b border-slate-100 bg-white px-6 pb-3 pt-1">
          {FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setActiveFilter(filter.id)}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                activeFilter === filter.id
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-white text-slate-500"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <main className="space-y-3 px-6 py-5">
          {/* Loading */}
          {loading && !data && (
            <div className="space-y-3">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-20 animate-pulse rounded-2xl bg-slate-200/70"
                />
              ))}
            </div>
          )}

          {/* Error */}
          {error && !data && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-600">
              <span className="flex items-center gap-2">
                <AlertCircle size={14} className="shrink-0" />
                {error}
              </span>
              <button
                type="button"
                onClick={reload}
                className="flex shrink-0 items-center gap-1 font-bold underline underline-offset-2"
              >
                <RefreshCw size={12} />
                Coba lagi
              </button>
            </div>
          )}

          {/* Kosong */}
          {data && list.length === 0 && (
            <div className="flex flex-col items-center py-20 text-center">
              <div className="flex size-16 items-center justify-center rounded-full bg-emerald-50">
                <HistoryIcon size={26} className="text-emerald-600" />
              </div>
              <p className="mt-4 font-poppins text-sm font-bold text-slate-700">
                Belum ada transaksi
              </p>
              <p className="mt-1 max-w-60 text-xs text-slate-400">
                Riwayat transaksi akan muncul di sini setelah ada aktivitas.
              </p>
            </div>
          )}

          {/* Daftar */}
          {list.map((item) => {
            const withdrawal = item.category === "penarikan";
            const status = statusInfo(item.status);
            const berat = formatBerat(item.weight);
            // Penarikan ditolak/dibatalkan: saldo dikembalikan, jadi bukan uang keluar
            const refunded =
              withdrawal && ["ditolak", "dibatalkan"].includes(item.status);

            return (
              <article
                key={item.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`flex size-10 shrink-0 items-center justify-center rounded-full ${
                      withdrawal
                        ? "bg-amber-50 text-amber-600"
                        : "bg-emerald-50 text-emerald-600"
                    }`}
                  >
                    {withdrawal ? <WalletCards size={18} /> : <Recycle size={18} />}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-poppins text-sm font-bold text-emerald-900">
                      {item.title}
                    </h2>
                    {item.subtitle && (
                      <p className="mt-0.5 truncate text-[11px] text-slate-500">
                        {item.subtitle}
                      </p>
                    )}
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {formatTanggal(item.date, false)}
                      {berat && ` • ${berat}`}
                    </p>
                    <span
                      className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${status.className}`}
                    >
                      {status.label}
                    </span>
                  </div>

                  <div className="shrink-0 text-right">
                    <p
                      className={`text-sm font-bold ${
                        refunded
                          ? "text-slate-400 line-through"
                          : withdrawal
                          ? "text-red-500"
                          : "text-emerald-600"
                      }`}
                    >
                      {withdrawal ? "- " : "+ "}
                      {rupiah(item.amount)}
                    </p>
                    <p
                      className={`mt-1 flex items-center justify-end gap-0.5 text-[10px] ${
                        refunded
                          ? "text-slate-400"
                          : withdrawal
                          ? "text-red-400"
                          : "text-emerald-500"
                      }`}
                    >
                      {withdrawal ? (
                        <ArrowUpRight size={11} />
                      ) : (
                        <ArrowDownLeft size={11} />
                      )}
                      {refunded ? "Dikembalikan" : withdrawal ? "Keluar" : "Masuk"}
                    </p>
                  </div>
                </div>
              </article>
            );
          })}
        </main>
      </div>
    </PhoneShell>
  );
}