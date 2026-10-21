// frontend_admin/src/pages/LaporanPemasukan.jsx
//
// Laporan pemasukan = uang yang diterima dari PENJUALAN sampah ke yayasan/mitra pengepul.
// (Pasangan Laporan Pengeluaran, yang mencatat uang keluar ke nasabah.)
//
// Endpoint backend:
//   GET /transaksi-jual-mitra/laporan         ringkasan + per jenis + per yayasan + per bulan + baris (paginasi)
//   GET /transaksi-jual-mitra/laporan/export  CSV mengikuti filter yang sama
//   GET /transaksi-jual-mitra/stok            stok per jenis (setoran - penjualan)
//   GET /mitra-pengepul/                      isi filter yayasan

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  HeartHandshake,
  Loader2,
  Package,
  X,
} from "lucide-react";
import PageHeader from "../components/PageHeader";
import { API, getAuthHeaders } from "../api";
import { bulanIniWIB, parseWaktu } from "../utils/waktu";

// ======================================================
// HELPER
// ======================================================
const PER_HALAMAN = 20;
const WARNA = ["#059669", "#0ea5e9", "#f59e0b", "#8b5cf6", "#ec4899"];
const WARNA_LAINNYA = "#94a3b8";

const formatRupiah = (v) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(v || 0));

const formatBerat = (v) =>
  `${Number(v || 0).toLocaleString("id-ID", { maximumFractionDigits: 2 })} kg`;

const formatTanggal = (iso) =>
  iso
    ? parseWaktu(iso).toLocaleString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "-";

const kodeTransaksi = (t) =>
  `#TRX-${parseWaktu(t.tanggal_transaksi).getFullYear()}-${String(
    t.id_transaksi_jual
  ).padStart(4, "0")}`;

const labelBulan = (ym) => {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("id-ID", {
    month: "short",
    year: "2-digit",
  });
};

// Tanggal "YYYY-MM-DD" untuk preset periode (WIB)
const pad = (n) => String(n).padStart(2, "0");
const akhirBulan = (ym) => {
  const [y, m] = ym.split("-").map(Number);
  return `${ym}-${pad(new Date(y, m, 0).getDate())}`;
};
const geserBulan = (ym, delta) => {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};

function bacaDetail(data) {
  const d = data?.detail ?? data?.message ?? data?.error;
  if (Array.isArray(d)) return d.map((x) => x?.msg).filter(Boolean).join("; ");
  return typeof d === "string" ? d : "";
}

async function request(url) {
  const response = await fetch(url, { headers: getAuthHeaders() });
  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!response.ok) {
    throw new Error(bacaDetail(data) || "Permintaan ke server gagal.");
  }
  return data;
}

const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100";

function StatCard({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-bold text-slate-500">{label}</p>
      <p className="mt-2 break-words font-['Poppins'] text-2xl font-bold text-emerald-900">
        {value}
      </p>
    </div>
  );
}

// ======================================================
// HALAMAN
// ======================================================
export default function LaporanPemasukan() {
  const [mulai, setMulai] = useState("");
  const [akhir, setAkhir] = useState("");
  const [idMitra, setIdMitra] = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const [halaman, setHalaman] = useState(0);

  const [laporan, setLaporan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(() => new Set());

  const [mitraList, setMitraList] = useState([]);
  const [stok, setStok] = useState([]);

  const [mengunduh, setMengunduh] = useState(false);
  const [unduhError, setUnduhError] = useState("");
  const reqId = useRef(0);

  const rentangSalah = !!(mulai && akhir && mulai > akhir);
  const hasFilter = !!(mulai || akhir || idMitra);

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (mulai) p.set("tanggal_mulai", mulai);
    if (akhir) p.set("tanggal_akhir", akhir);
    if (idMitra) p.set("id_mitra", idMitra);
    return p.toString();
  }, [mulai, akhir, idMitra]);

  // ---------- load ----------
  const loadLaporan = useCallback(async () => {
    if (rentangSalah) return;
    const id = ++reqId.current; // abaikan respons lama
    try {
      setLoading(true);
      setError("");
      const sep = qs ? "&" : "";
      const result = await request(
        `${API.transaksiJualMitraLaporan}?${qs}${sep}limit=${PER_HALAMAN}&offset=${
          halaman * PER_HALAMAN
        }`
      );
      if (id === reqId.current) setLaporan(result);
    } catch (err) {
      if (id === reqId.current) setError(err.message);
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [qs, halaman, rentangSalah]);

  useEffect(() => {
    loadLaporan();
  }, [loadLaporan]);

  useEffect(() => {
    request(API.mitra)
      .then((r) => setMitraList(Array.isArray(r) ? r : r?.data || []))
      .catch(() => {});
    request(API.transaksiJualMitraStok)
      .then((r) => setStok(Array.isArray(r) ? r : []))
      .catch(() => {});
  }, []);

  // ---------- filter ----------
  const ubahFilter = (setter) => (value) => {
    setter(value);
    setHalaman(0);
    setExpanded(new Set());
    setUnduhError("");
  };

  const bulanIni = bulanIniWIB();
  const tahunIni = bulanIni.slice(0, 4);
  const presets = [
    { label: "Bulan ini", mulai: `${bulanIni}-01`, akhir: akhirBulan(bulanIni) },
    {
      label: "Bulan lalu",
      mulai: `${geserBulan(bulanIni, -1)}-01`,
      akhir: akhirBulan(geserBulan(bulanIni, -1)),
    },
    { label: "Tahun ini", mulai: `${tahunIni}-01-01`, akhir: `${tahunIni}-12-31` },
    { label: "Semua", mulai: "", akhir: "" },
  ];
  const terapkanPreset = (p) => {
    setMulai(p.mulai);
    setAkhir(p.akhir);
    setHalaman(0);
    setExpanded(new Set());
  };

  const resetFilter = () => {
    setMulai("");
    setAkhir("");
    setIdMitra("");
    setHalaman(0);
    setExpanded(new Set());
  };

  const toggleRow = (id) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // ---------- turunan data ----------
  const ringkasan = laporan?.ringkasan;
  const rows = laporan?.data || [];
  const total = laporan?.total || 0;
  const jumlahHalaman = Math.max(1, Math.ceil(total / PER_HALAMAN));

  const donat = useMemo(() => {
    const list = laporan?.per_jenis || [];
    const totalBerat = list.reduce((s, i) => s + Number(i.berat), 0);
    const items = list.slice(0, 5).map((i, idx) => ({
      nama: i.nama_jenis || `Jenis #${i.id_jenis}`,
      berat: Number(i.berat),
      nilai: Number(i.nilai),
      warna: WARNA[idx],
    }));
    const sisa = list.slice(5);
    if (sisa.length > 0) {
      items.push({
        nama: `Lainnya (${sisa.length} jenis)`,
        berat: sisa.reduce((s, i) => s + Number(i.berat), 0),
        nilai: sisa.reduce((s, i) => s + Number(i.nilai), 0),
        warna: WARNA_LAINNYA,
      });
    }
    return { totalBerat, items };
  }, [laporan]);

  const perMitra = laporan?.per_mitra || [];
  const maxMitra = Math.max(1, ...perMitra.map((m) => Number(m.nilai)));
  const perBulan = laporan?.per_bulan || [];
  const maxBulan = Math.max(1, ...perBulan.map((b) => Number(b.nilai)));
  const stokAda = stok.filter((s) => Number(s.masuk) > 0 || Number(s.keluar) > 0);

  // ---------- unduh CSV ----------
  const unduh = async () => {
    if (total === 0) {
      setUnduhError("Tidak ada data yang sesuai dengan filter.");
      return;
    }
    try {
      setMengunduh(true);
      setUnduhError("");
      const response = await fetch(`${API.transaksiJualMitraExport}?${qs}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const text = await response.text();
        let data = null;
        try {
          data = JSON.parse(text);
        } catch {
          /* bukan JSON */
        }
        throw new Error(bacaDetail(data) || "Gagal mengunduh laporan.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "laporan-pemasukan-yayasan.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setUnduhError(err.message);
    } finally {
      setMengunduh(false);
    }
  };

  // ======================================================
  // RENDER
  // ======================================================
  return (
    <div className="mx-auto w-full max-w-[1180px]">
      <PageHeader title="Laporan Pemasukan" />

      {error && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-600">
          <span>{error}</span>
          <button
            type="button"
            onClick={loadLaporan}
            className="font-bold underline"
          >
            Muat ulang
          </button>
        </div>
      )}

      {/* ================= FILTER ================= */}
      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-['Poppins'] text-lg font-bold text-slate-800">
              Filter Laporan
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Filter penjualan berdasarkan periode tanggal atau yayasan.
            </p>
          </div>
          <div className="flex gap-2">
            {hasFilter && (
              <button
                type="button"
                onClick={resetFilter}
                className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
              >
                <X size={16} />
                Reset
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowFilter(!showFilter)}
              aria-expanded={showFilter}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700"
            >
              <Filter size={16} />
              {showFilter ? "Tutup Filter" : "Filter"}
            </button>
          </div>
        </div>

        {showFilter && (
          <div className="mt-5 border-t border-slate-100 pt-5">
            <div className="mb-4 flex flex-wrap gap-2">
              {presets.map((p) => {
                const aktif = mulai === p.mulai && akhir === p.akhir;
                return (
                  <button
                    type="button"
                    key={p.label}
                    onClick={() => terapkanPreset(p)}
                    aria-pressed={aktif}
                    className={`rounded-full border px-3.5 py-1.5 text-xs font-bold transition ${
                      aktif
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 text-slate-500 hover:border-emerald-300 hover:text-emerald-700"
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-600">
                  Dari tanggal
                </label>
                <input
                  type="date"
                  value={mulai}
                  max={akhir || undefined}
                  onChange={(e) => ubahFilter(setMulai)(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-600">
                  Sampai tanggal
                </label>
                <input
                  type="date"
                  value={akhir}
                  min={mulai || undefined}
                  onChange={(e) => ubahFilter(setAkhir)(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-bold text-slate-600">
                  Yayasan
                </label>
                <select
                  value={idMitra}
                  onChange={(e) => ubahFilter(setIdMitra)(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Semua yayasan</option>
                  {mitraList.map((m) => (
                    <option key={m.id_mitra} value={m.id_mitra}>
                      {m.nama_mitra}
                      {m.is_active ? "" : " (nonaktif)"}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {rentangSalah && (
              <p role="alert" className="mt-3 text-sm font-medium text-red-600">
                Tanggal awal tidak boleh setelah tanggal akhir.
              </p>
            )}
          </div>
        )}
      </section>

      {/* ================= QUICK INFO ================= */}
      <div
        className={`mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 ${
          loading && laporan ? "opacity-60" : ""
        }`}
      >
        <StatCard
          label="Total Transaksi"
          value={Number(ringkasan?.jumlah_transaksi || 0).toLocaleString("id-ID")}
        />
        <StatCard label="Total Berat" value={formatBerat(ringkasan?.total_berat)} />
        <StatCard
          label={hasFilter ? "Total Pemasukan (sesuai filter)" : "Total Pemasukan"}
          value={formatRupiah(ringkasan?.total_nilai)}
        />
        <StatCard
          label="Pemasukan Bulan Ini"
          value={formatRupiah(ringkasan?.pemasukan_bulan_ini)}
        />
      </div>

      {/* ================= JENIS SAMPAH TERJUAL ================= */}
      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="mb-5 font-['Poppins'] text-xl font-bold text-slate-800">
          Jenis Sampah Terjual
        </h2>
        <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-2">
          <div className="flex justify-center">
            <div className="relative h-64 w-64">
              <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" role="img" aria-label="Komposisi berat sampah terjual per jenis">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#e2e8f0" strokeWidth="18" />
                {(() => {
                  const keliling = 2 * Math.PI * 40;
                  let offset = 0;
                  return donat.items.map((item) => {
                    const dash =
                      donat.totalBerat > 0
                        ? (item.berat / donat.totalBerat) * keliling
                        : 0;
                    const sekarang = offset;
                    offset += dash;
                    return (
                      <circle
                        key={item.nama}
                        cx="50"
                        cy="50"
                        r="40"
                        fill="none"
                        stroke={item.warna}
                        strokeWidth="18"
                        strokeDasharray={`${dash} ${keliling}`}
                        strokeDashoffset={-sekarang}
                      />
                    );
                  });
                })()}
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-xs text-slate-400">Total</p>
                  <p className="font-['Poppins'] text-xl font-bold text-emerald-900">
                    {formatBerat(donat.totalBerat)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {donat.items.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-400">
                {loading ? "Memuat..." : "Belum ada data penjualan sampah."}
              </div>
            ) : (
              donat.items.map((item) => (
                <div
                  key={item.nama}
                  className="flex flex-wrap items-center justify-between gap-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className="h-3.5 w-3.5 shrink-0 rounded-md"
                      style={{ backgroundColor: item.warna }}
                    />
                    <span className="break-words text-base text-slate-800">
                      {item.nama}
                    </span>
                  </div>
                  <div className="shrink-0 text-right">
                    <b className="font-['Poppins'] text-lg text-slate-800">
                      {formatBerat(item.berat)}
                    </b>
                    <p className="text-xs text-slate-400">
                      {donat.totalBerat > 0
                        ? ((item.berat / donat.totalBerat) * 100).toFixed(1)
                        : 0}
                      %, {formatRupiah(item.nilai)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* ================= PER YAYASAN + TREN ================= */}
      <div
        className={`mb-6 grid grid-cols-1 gap-6 ${
          perBulan.length >= 2 ? "lg:grid-cols-2" : ""
        }`}
      >
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="mb-5 font-['Poppins'] text-xl font-bold text-slate-800">
            Pemasukan per Yayasan
          </h2>
          {perMitra.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">
              Belum ada data.
            </p>
          ) : (
            <ul className="space-y-4">
              {perMitra.map((m) => (
                <li key={m.id_mitra}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="min-w-0 break-words text-sm font-semibold text-slate-700">
                      {m.nama_mitra}
                    </span>
                    <b className="font-['Poppins'] text-sm text-emerald-800">
                      {formatRupiah(m.nilai)}
                    </b>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${(Number(m.nilai) / maxMitra) * 100}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    {m.jumlah_transaksi} transaksi, {formatBerat(m.berat)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        {perBulan.length >= 2 && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <h2 className="mb-5 font-['Poppins'] text-xl font-bold text-slate-800">
              Tren Pemasukan Bulanan
            </h2>
            <div className="flex h-48 items-end gap-2">
              {perBulan.map((b) => (
                <div
                  key={b.bulan}
                  className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5"
                  title={`${labelBulan(b.bulan)}: ${formatRupiah(b.nilai)}, ${formatBerat(b.berat)}`}
                >
                  <div
                    className="w-full rounded-t-md bg-emerald-500"
                    style={{
                      height: `${Math.max(3, (Number(b.nilai) / maxBulan) * 100)}%`,
                    }}
                  />
                  <span className="text-[11px] text-slate-400">
                    {labelBulan(b.bulan)}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-400">
              Arahkan kursor ke batang untuk melihat nilainya.
            </p>
          </section>
        )}
      </div>

      {/* ================= STOK ================= */}
      {stokAda.length > 0 && (
        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <Package size={20} className="shrink-0 text-emerald-600" />
            <div>
              <h2 className="font-['Poppins'] text-xl font-bold text-slate-800">
                Stok Sampah Saat Ini
              </h2>
              <p className="text-sm text-slate-500">
                Setoran nasabah dikurangi yang sudah dijual ke yayasan.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {stokAda.map((s) => {
              const minus = Number(s.stok) < 0;
              return (
                <div
                  key={s.id_jenis}
                  className={`rounded-xl border p-4 ${
                    minus ? "border-amber-200 bg-amber-50" : "border-slate-200"
                  }`}
                >
                  <p className="truncate text-sm font-bold text-slate-700">
                    {s.nama_jenis}
                  </p>
                  <p
                    className={`mt-1 font-['Poppins'] text-xl font-bold ${
                      minus ? "text-amber-700" : "text-emerald-900"
                    }`}
                  >
                    {formatBerat(s.stok)}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Masuk {formatBerat(s.masuk)}, terjual {formatBerat(s.keluar)}
                  </p>
                  {minus && (
                    <p className="mt-1 text-xs text-amber-700">
                      Penjualan melebihi setoran tercatat. Cek apakah stok awal sudah diinput.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ================= TABEL ================= */}
      <section className="mb-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
          <div className="flex min-w-0 items-center gap-3">
            <HeartHandshake size={20} className="shrink-0 text-emerald-600" />
            <div className="min-w-0">
              <h2 className="break-words font-['Poppins'] text-lg font-bold text-emerald-900">
                Laporan Pemasukan Yayasan
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Riwayat penjualan sampah kepada yayasan
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={unduh}
            disabled={mengunduh}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {mengunduh ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            <span>Download Excel</span>
          </button>
        </div>
        {unduhError && (
          <p role="alert" className="px-5 pb-3 text-sm font-medium text-red-600 sm:px-6">
            {unduhError}
          </p>
        )}

        <div className="border-t border-slate-200 p-4 sm:p-6">
          <div className={`overflow-x-auto ${loading && laporan ? "opacity-60" : ""}`}>
            <table className="w-full min-w-[850px] text-left text-sm">
              <thead className="bg-slate-100 text-xs font-bold uppercase text-slate-500">
                <tr>
                  <th className="w-10 px-3 py-4">
                    <span className="sr-only">Rincian</span>
                  </th>
                  <th className="px-5 py-4">Tanggal</th>
                  <th className="px-5 py-4">ID Transaksi</th>
                  <th className="px-5 py-4">Yayasan</th>
                  <th className="px-5 py-4">Jenis Sampah</th>
                  <th className="px-5 py-4">Berat</th>
                  <th className="px-5 py-4">Total Pemasukan</th>
                </tr>
              </thead>
              <tbody>
                {loading && !laporan ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-slate-400">
                      <Loader2 size={18} className="mx-auto animate-spin" />
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-slate-400">
                      {hasFilter
                        ? "Tidak ada transaksi yang sesuai dengan filter."
                        : "Belum ada data penjualan ke yayasan."}
                    </td>
                  </tr>
                ) : (
                  rows.map((t) => {
                    const buka = expanded.has(t.id_transaksi_jual);
                    const namaJenis = (t.details || [])
                      .map((d) => d.nama_jenis)
                      .filter(Boolean);
                    return (
                      <Fragment key={t.id_transaksi_jual}>
                        <tr
                          className="cursor-pointer border-t border-slate-100 transition hover:bg-slate-50"
                          onClick={() => toggleRow(t.id_transaksi_jual)}
                        >
                          <td className="px-3 py-4">
                            <button
                              type="button"
                              aria-expanded={buka}
                              aria-label={`${buka ? "Tutup" : "Buka"} rincian ${kodeTransaksi(t)}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleRow(t.id_transaksi_jual);
                              }}
                              className="rounded p-1 text-slate-400 hover:bg-slate-100"
                            >
                              <ChevronDown
                                size={16}
                                className={`transition-transform ${buka ? "rotate-180" : ""}`}
                              />
                            </button>
                          </td>
                          <td className="px-5 py-4">{formatTanggal(t.tanggal_transaksi)}</td>
                          <td className="px-5 py-4 font-semibold">{kodeTransaksi(t)}</td>
                          <td className="px-5 py-4">{t.nama_mitra || "-"}</td>
                          <td className="max-w-[220px] truncate px-5 py-4" title={namaJenis.join(", ")}>
                            {namaJenis.join(", ") || "-"}
                          </td>
                          <td className="px-5 py-4">{formatBerat(t.total_berat)}</td>
                          <td className="px-5 py-4 font-bold text-emerald-700">
                            {formatRupiah(t.total_nilai)}
                          </td>
                        </tr>
                        {buka && (
                          <tr className="bg-slate-50">
                            <td />
                            <td colSpan={6} className="px-5 pb-5 pt-1">
                              <table className="w-full max-w-[560px] text-left text-xs">
                                <thead className="text-slate-400">
                                  <tr>
                                    <th className="py-1.5 pr-4 font-semibold">Jenis</th>
                                    <th className="py-1.5 pr-4 text-right font-semibold">Berat</th>
                                    <th className="py-1.5 pr-4 text-right font-semibold">Harga/kg</th>
                                    <th className="py-1.5 text-right font-semibold">Subtotal</th>
                                  </tr>
                                </thead>
                                <tbody className="text-slate-700">
                                  {(t.details || []).map((d) => (
                                    <tr key={d.id_detail_jual} className="border-t border-slate-200">
                                      <td className="py-1.5 pr-4">{d.nama_jenis || "-"}</td>
                                      <td className="py-1.5 pr-4 text-right">{formatBerat(d.berat)}</td>
                                      <td className="py-1.5 pr-4 text-right">{formatRupiah(d.harga_per_kg)}</td>
                                      <td className="py-1.5 text-right font-semibold">{formatRupiah(d.subtotal)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              <p className="mt-3 text-xs text-slate-500">
                                Dicatat oleh{" "}
                                <span className="font-semibold text-slate-700">
                                  {t.dicatat_oleh || "-"}
                                </span>
                                {t.keterangan && (
                                  <>
                                    . Catatan:{" "}
                                    <span className="break-words text-slate-700">
                                      {t.keterangan}
                                    </span>
                                  </>
                                )}
                              </p>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {total > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
              <span>
                Menampilkan {halaman * PER_HALAMAN + 1}
                {" - "}
                {Math.min((halaman + 1) * PER_HALAMAN, total)} dari{" "}
                {total.toLocaleString("id-ID")} transaksi
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setHalaman((h) => Math.max(0, h - 1));
                    setExpanded(new Set());
                  }}
                  disabled={halaman === 0 || loading}
                  aria-label="Halaman sebelumnya"
                  className="rounded-lg border border-slate-300 p-2 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="min-w-[72px] text-center font-semibold text-slate-700">
                  {halaman + 1} / {jumlahHalaman}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setHalaman((h) => Math.min(jumlahHalaman - 1, h + 1));
                    setExpanded(new Set());
                  }}
                  disabled={halaman >= jumlahHalaman - 1 || loading}
                  aria-label="Halaman berikutnya"
                  className="rounded-lg border border-slate-300 p-2 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}