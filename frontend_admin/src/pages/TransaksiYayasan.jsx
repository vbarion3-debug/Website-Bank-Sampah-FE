import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Eye,
  History,
  Loader2,
  Search,
  X,
} from "lucide-react";
import Modal from "../components/Modal";
import { API, getAuthHeaders } from "../api";
import { parseWaktu } from "../utils/waktu";

// ======================================================
// HELPER
// ======================================================
const RIWAYAT_AWAL = 8;

const formatRupiah = (v) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(v || 0));

const formatBerat = (v) =>
  `${Number(v || 0).toLocaleString("id-ID", { maximumFractionDigits: 2 })} Kg`;

const formatTanggal = (iso) => {
  if (!iso) return "-";
  return parseWaktu(iso).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// Tampilan saja (bukan kolom di database): #TRX-2026-0702
const kodeTransaksi = (t) =>
  `#TRX-${parseWaktu(t.tanggal_transaksi).getFullYear()}-${String(
    t.id_transaksi_jual
  ).padStart(4, "0")}`;

// "4,5" atau "4.5" -> 4.5 (admin Indonesia biasa mengetik koma)
const parseBerat = (v) => Number(String(v).replace(",", "."));
const BERAT_VALID = /^\d+([.,]\d{1,2})?$/; // backend: maksimal 2 angka desimal

// FastAPI mengirim error validasi (422) sebagai array, bukan string
function bacaDetail(data) {
  const d = data?.detail ?? data?.message ?? data?.error;
  if (Array.isArray(d)) return d.map((x) => x?.msg).filter(Boolean).join("; ");
  return typeof d === "string" ? d : "";
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...getAuthHeaders(),
      ...options.headers,
    },
  });
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
  "w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";

function Field({ label, children, className = "" }) {
  return (
    <label className={`block min-w-0 ${className}`}>
      <span className="mb-1.5 block text-xs font-bold text-slate-700">
        {label}
      </span>
      {children}
    </label>
  );
}

// ======================================================
// HALAMAN
// ======================================================
export default function TransaksiYayasan() {
  const nav = useNavigate();
  const keyBerikut = useRef(1);
  const barisBaru = () => ({ key: keyBerikut.current++, id_jenis: "", berat: "" });

  // ---------- yayasan ----------
  const [mitraList, setMitraList] = useState([]);
  const [loadingMitra, setLoadingMitra] = useState(true);
  const [mitraError, setMitraError] = useState("");
  const mitraAktif = useMemo(
    () => mitraList.filter((m) => m.is_active),
    [mitraList]
  );

  // ---------- form ----------
  const [idMitra, setIdMitra] = useState("");
  const [hargaList, setHargaList] = useState([]);
  const [loadingHarga, setLoadingHarga] = useState(false);
  const [hargaError, setHargaError] = useState("");
  const [items, setItems] = useState([]); // jenis yang dipilih: { key, id_jenis, berat }
  const [fokusKey, setFokusKey] = useState(null);
  const [cariJenis, setCariJenis] = useState("");
  const [jenisMaster, setJenisMaster] = useState([]); // nama & kategori resmi
  const [keterangan, setKeterangan] = useState("");
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // ---------- riwayat ----------
  const [riwayat, setRiwayat] = useState([]);
  const [loadingRiwayat, setLoadingRiwayat] = useState(true);
  const [riwayatError, setRiwayatError] = useState("");
  const [filterMitra, setFilterMitra] = useState("");
  const [tampilSemua, setTampilSemua] = useState(false);
  const [detail, setDetail] = useState(null);
  const riwayatReq = useRef(0);

  // ======================================================
  // LOAD DATA
  // ======================================================
  const loadMitra = useCallback(async () => {
    try {
      setLoadingMitra(true);
      setMitraError("");
      const result = await request(API.mitra); // { total, data }
      setMitraList(Array.isArray(result) ? result : result?.data || []);
    } catch (err) {
      setMitraError(err.message);
    } finally {
      setLoadingMitra(false);
    }
  }, []);

  const loadRiwayat = useCallback(async () => {
    const req = ++riwayatReq.current; // abaikan respons lama kalau filter cepat berganti
    try {
      setLoadingRiwayat(true);
      setRiwayatError("");
      const url = filterMitra
        ? API.transaksiJualMitraByMitra(filterMitra)
        : API.transaksiJualMitraList;
      const result = await request(url);
      if (req === riwayatReq.current) {
        setRiwayat(Array.isArray(result) ? result : []);
      }
    } catch (err) {
      if (req === riwayatReq.current) setRiwayatError(err.message);
    } finally {
      if (req === riwayatReq.current) setLoadingRiwayat(false);
    }
  }, [filterMitra]);

  useEffect(() => {
    loadMitra();
  }, [loadMitra]);

  useEffect(() => {
    loadRiwayat();
  }, [loadRiwayat]);

  // Nama & kategori jenis sampah. Endpoint detail yayasan mengembalikan nama_jenis = null,
  // jadi nama diambil dari daftar jenis sampah (sama seperti halaman Database Yayasan).
  useEffect(() => {
    request(API.jenisSampah)
      .then((r) => setJenisMaster(Array.isArray(r) ? r : r?.data || []))
      .catch(() => {}); // kalau gagal, nama jatuh ke "Jenis #id"
  }, []);

  // Harga beli yayasan terpilih -> menentukan jenis sampah yang boleh dipilih
  useEffect(() => {
    if (!idMitra) {
      setHargaList([]);
      setHargaError("");
      setLoadingHarga(false);
      return;
    }
    let batal = false;
    setLoadingHarga(true);
    setHargaError("");
    request(API.mitraDetail(idMitra))
      .then((d) => {
        if (batal) return;
        const harga = d?.harga_jenis_sampah || [];
        setHargaList(
          [...harga].sort((a, b) =>
            String(a.nama_jenis).localeCompare(String(b.nama_jenis), "id")
          )
        );
      })
      .catch((err) => {
        if (batal) return;
        setHargaList([]);
        setHargaError(err.message);
      })
      .finally(() => {
        if (!batal) setLoadingHarga(false);
      });
    return () => {
      batal = true;
    };
  }, [idMitra]);

  // ======================================================
  // FORM
  // ======================================================
  const opsiJenis = useMemo(() => {
    const master = new Map(jenisMaster.map((j) => [String(j.id_jenis), j]));
    return hargaList
      .map((h) => {
        const m = master.get(String(h.id_jenis));
        return {
          ...h,
          nama_jenis: h.nama_jenis || m?.nama_jenis || `Jenis #${h.id_jenis}`,
          kategori: m?.kategori || "",
        };
      })
      .sort((a, b) => a.nama_jenis.localeCompare(b.nama_jenis, "id"));
  }, [hargaList, jenisMaster]);

  const hargaById = useMemo(() => {
    const map = new Map();
    opsiJenis.forEach((h) => map.set(String(h.id_jenis), h));
    return map;
  }, [opsiJenis]);

  const opsiTampil = useMemo(() => {
    const q = cariJenis.trim().toLowerCase();
    if (!q) return opsiJenis;
    return opsiJenis.filter((o) =>
      `${o.nama_jenis} ${o.kategori}`.toLowerCase().includes(q)
    );
  }, [opsiJenis, cariJenis]);

  const rincian = useMemo(
    () =>
      items.map((it) => {
        const harga = hargaById.get(String(it.id_jenis));
        const berat = BERAT_VALID.test(it.berat) ? parseBerat(it.berat) : 0;
        const perKg = Number(harga?.harga_beli_per_kg || 0);
        return { ...it, harga, berat, perKg, subtotal: berat * perKg };
      }),
    [items, hargaById]
  );
  const totalBerat = rincian.reduce((s, r) => s + r.berat, 0);
  const totalNilai = rincian.reduce((s, r) => s + r.subtotal, 0);

  const sentuh = () => {
    setSuccess("");
    setFormError("");
  };

  const pilihYayasan = (value) => {
    sentuh();
    setIdMitra(value);
    setCariJenis("");
    setItems([]); // harga & jenis beda per yayasan
  };

  const ubahItem = (key, field, value) => {
    sentuh();
    setItems((prev) =>
      prev.map((it) => (it.key === key ? { ...it, [field]: value } : it))
    );
  };

  const ubahBerat = (key, value) => {
    if (!/^\d*[.,]?\d{0,2}$/.test(value)) return; // hanya angka, maks 2 desimal
    ubahItem(key, "berat", value);
  };

  // Klik tile = pilih; klik lagi = batalkan pilihan
  const toggleJenis = (id) => {
    sentuh();
    const ada = items.find((it) => String(it.id_jenis) === String(id));
    if (ada) {
      setItems((prev) => prev.filter((it) => it.key !== ada.key));
      return;
    }
    const baru = barisBaru();
    baru.id_jenis = String(id);
    setFokusKey(baru.key); // kursor langsung ke kolom berat
    setItems((prev) => [...prev, baru]);
  };

  const hapusItem = (key) => {
    sentuh();
    setItems((prev) => prev.filter((it) => it.key !== key));
  };

  const batal = () => {
    sentuh();
    setIdMitra("");
    setItems([]);
    setKeterangan("");
  };

  const validasi = () => {
    if (!idMitra) return "Pilih yayasan tujuan dulu.";
    if (hargaList.length === 0)
      return "Yayasan ini belum punya harga beli. Tambahkan dulu di Database Yayasan.";
    if (items.length === 0) return "Pilih minimal satu jenis sampah.";
    for (const it of items) {
      const nama = hargaById.get(String(it.id_jenis))?.nama_jenis || "sampah";
      if (!BERAT_VALID.test(it.berat) || parseBerat(it.berat) <= 0)
        return `Isi berat ${nama} dengan angka lebih dari 0 (maksimal 2 angka desimal).`;
    }
    return "";
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const pesan = validasi();
    setSuccess("");
    setFormError(pesan);
    if (!pesan) setConfirmOpen(true);
  };

  const simpan = async () => {
    setSubmitting(true);
    setFormError("");
    try {
      const hasil = await request(API.transaksiJualMitra, {
        method: "POST",
        body: JSON.stringify({
          id_mitra: Number(idMitra),
          detail: items.map((it) => ({
            id_jenis: Number(it.id_jenis),
            berat: parseBerat(it.berat),
          })),
          keterangan: keterangan.trim() || null,
        }),
      });
      setConfirmOpen(false);
      setSuccess(
        `${kodeTransaksi(hasil)} tersimpan: ${formatBerat(
          hasil.total_berat
        )} senilai ${formatRupiah(hasil.total_nilai)} ke ${hasil.nama_mitra}.`
      );
      setItems([]);
      setKeterangan("");
      loadRiwayat();
    } catch (err) {
      setConfirmOpen(false);
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const yayasanTerpilih = mitraList.find(
    (m) => String(m.id_mitra) === String(idMitra)
  );

  const kembali = () => (window.history.length > 1 ? nav(-1) : nav("/"));

  const riwayatTampil = tampilSemua ? riwayat : riwayat.slice(0, RIWAYAT_AWAL);
  const adaYayasanAktif = mitraAktif.length > 0;

  // ======================================================
  // RENDER
  // ======================================================
  return (
    <div className="mx-auto w-full max-w-[1180px]">
      {/* Header */}
      <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-['Poppins'] text-3xl font-bold text-emerald-900 break-words">
            Transaksi Yayasan
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Catat sampah yang dijual ke yayasan mitra. Harga mengikuti harga
            beli masing-masing yayasan.
          </p>
        </div>
        <button
          type="button"
          onClick={kembali}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-emerald-700"
        >
          <ArrowLeft size={16} />
          Kembali
        </button>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        {/* ================= FORM ================= */}
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          noValidate
        >
          {success && (
            <div
              role="status"
              className="mb-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800"
            >
              <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
              <span className="min-w-0 break-words">{success}</span>
            </div>
          )}

          <Field label="Pilih Yayasan Tujuan">
            <select
              value={idMitra}
              onChange={(e) => pilihYayasan(e.target.value)}
              disabled={loadingMitra || submitting}
              className={inputClass}
            >
              <option value="">
                {loadingMitra ? "Memuat yayasan..." : "--Pilih Yayasan Mitra--"}
              </option>
              {mitraAktif.map((m) => (
                <option key={m.id_mitra} value={m.id_mitra}>
                  {m.nama_mitra}
                </option>
              ))}
            </select>
          </Field>

          {mitraError && (
            <p className="mt-2 flex items-center gap-2 text-xs font-medium text-red-600">
              {mitraError}
              <button
                type="button"
                onClick={loadMitra}
                className="font-bold underline"
              >
                Coba lagi
              </button>
            </p>
          )}
          {!loadingMitra && !mitraError && !adaYayasanAktif && (
            <p className="mt-2 text-xs text-slate-500">
              Belum ada yayasan aktif.{" "}
              <Link
                to="/database-yayasan"
                className="font-bold text-emerald-700 underline"
              >
                Kelola di Database Yayasan
              </Link>
            </p>
          )}

          {yayasanTerpilih &&
            (yayasanTerpilih.nama_penanggung_jawab || yayasanTerpilih.no_hp) && (
              <p className="mt-2 text-xs text-slate-500">
                Kontak:{" "}
                <span className="font-semibold text-slate-700">
                  {[yayasanTerpilih.nama_penanggung_jawab, yayasanTerpilih.no_hp]
                    .filter(Boolean)
                    .join(", ")}
                </span>
              </p>
            )}

          {/* Pilih jenis sampah */}
          {idMitra && (
            <div className="mt-4">
              {loadingHarga ? (
                <p className="flex items-center gap-2 text-xs text-slate-500">
                  <Loader2 size={14} className="animate-spin" />
                  Memuat harga yayasan...
                </p>
              ) : hargaError ? (
                <p className="text-xs font-medium text-red-600">{hargaError}</p>
              ) : opsiJenis.length === 0 ? (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                  <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                  <span>
                    Yayasan ini belum punya harga beli untuk jenis sampah mana
                    pun, jadi belum bisa dibuatkan transaksi.{" "}
                    <Link to="/database-yayasan" className="font-bold underline">
                      Tambahkan harga
                    </Link>
                  </span>
                </div>
              ) : (
                <>
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">
                      Jenis Sampah
                    </span>
                    <span className="text-xs text-slate-400">
                      {items.length > 0
                        ? `${items.length} dipilih`
                        : "Pilih satu atau lebih"}
                    </span>
                  </div>

                  {opsiJenis.length > 6 && (
                    <div className="relative mb-2">
                      <Search
                        size={14}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                      />
                      <input
                        type="text"
                        value={cariJenis}
                        onChange={(e) => setCariJenis(e.target.value)}
                        placeholder="Cari jenis sampah"
                        aria-label="Cari jenis sampah"
                        className={`${inputClass} pl-9`}
                      />
                    </div>
                  )}

                  <div
                    role="group"
                    aria-label="Pilih jenis sampah"
                    className="grid max-h-64 grid-cols-2 gap-2 overflow-y-auto pr-0.5"
                  >
                    {opsiTampil.map((o) => {
                      const dipilih = items.some(
                        (it) => String(it.id_jenis) === String(o.id_jenis)
                      );
                      return (
                        <button
                          type="button"
                          key={o.id_jenis}
                          aria-pressed={dipilih}
                          disabled={submitting}
                          onClick={() => toggleJenis(o.id_jenis)}
                          className={`relative rounded-xl border px-3 py-2.5 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:opacity-60 ${
                            dipilih
                              ? "border-emerald-500 bg-emerald-50"
                              : "border-slate-200 bg-white hover:border-emerald-300 hover:bg-slate-50"
                          }`}
                        >
                          {dipilih && (
                            <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-white">
                              <Check size={11} strokeWidth={3} />
                            </span>
                          )}
                          <span className="block truncate pr-5 text-sm font-bold text-slate-800">
                            {o.nama_jenis}
                          </span>
                          {o.kategori && (
                            <span className="block truncate text-[11px] text-slate-400">
                              {o.kategori}
                            </span>
                          )}
                          <span className="mt-1 block text-xs font-semibold text-emerald-700">
                            {formatRupiah(o.harga_beli_per_kg)}/kg
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {opsiTampil.length === 0 && (
                    <p className="py-3 text-center text-xs text-slate-400">
                      Tidak ada jenis yang cocok dengan “{cariJenis}”.
                    </p>
                  )}

                  {rincian.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <p className="text-xs font-bold text-slate-700">
                        Berat Sampah (Kg)
                      </p>
                      {rincian.map((r) => (
                        <div
                          key={r.key}
                          className="rounded-lg border border-slate-200 p-2.5"
                        >
                          <div className="flex items-center gap-2">
                            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-700">
                              {r.harga?.nama_jenis}
                            </span>
                            <div className="relative w-28 shrink-0">
                              <input
                                type="text"
                                inputMode="decimal"
                                autoFocus={r.key === fokusKey}
                                value={r.berat}
                                onChange={(e) => ubahBerat(r.key, e.target.value)}
                                disabled={submitting}
                                placeholder="0"
                                aria-label={`Berat ${r.harga?.nama_jenis} dalam kilogram`}
                                className={`${inputClass} pr-9 text-right`}
                              />
                              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                                Kg
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => hapusItem(r.key)}
                              disabled={submitting}
                              aria-label={`Hapus ${r.harga?.nama_jenis}`}
                              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-500"
                            >
                              <X size={16} />
                            </button>
                          </div>
                          {r.berat > 0 && (
                            <p className="mt-1.5 text-right text-xs text-slate-500">
                              {formatBerat(r.berat)} &times; {formatRupiah(r.perKg)} ={" "}
                              <span className="font-semibold text-slate-700">
                                {formatRupiah(r.subtotal)}
                              </span>
                            </p>
                          )}
                        </div>
                      ))}

                      <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5 text-sm">
                        <span className="text-slate-500">
                          Total {formatBerat(totalBerat)}
                        </span>
                        <span className="font-['Poppins'] font-bold text-emerald-800">
                          {formatRupiah(totalNilai)}
                        </span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <Field label="Keterangan Tambahan (Opsional)" className="mt-4">
            <input
              type="text"
              value={keterangan}
              onChange={(e) => {
                sentuh();
                setKeterangan(e.target.value);
              }}
              disabled={submitting}
              placeholder="Catatan khusus atau nomor nota yayasan"
              className={inputClass}
            />
          </Field>

          {formError && (
            <div
              role="alert"
              className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-600"
            >
              {formError}
            </div>
          )}

          <div className="mt-5 flex justify-end gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={batal}
              disabled={submitting}
              className="rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting || loadingHarga}
              className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Submit Transaksi
            </button>
          </div>
        </form>

        {/* ================= RIWAYAT ================= */}
        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-['Poppins'] text-sm font-bold text-emerald-900">
              <History size={16} />
              Riwayat Penyaluran Terbaru
            </h2>
            <select
              value={filterMitra}
              onChange={(e) => {
                setFilterMitra(e.target.value);
                setTampilSemua(false);
              }}
              aria-label="Filter riwayat berdasarkan yayasan"
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 outline-none focus:border-emerald-500"
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

          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs font-bold text-slate-500">
                  <th className="rounded-l-lg px-3 py-2.5">Tanggal</th>
                  <th className="px-3 py-2.5">Yayasan Tujuan</th>
                  <th className="px-3 py-2.5">Jenis Sampah</th>
                  <th className="px-3 py-2.5 text-right">Berat (Kg)</th>
                  <th className="px-3 py-2.5 text-right">Nilai</th>
                  <th className="rounded-r-lg px-3 py-2.5">
                    <span className="sr-only">Detail</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loadingRiwayat ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-10 text-center text-slate-400">
                      <Loader2 size={18} className="mx-auto animate-spin" />
                    </td>
                  </tr>
                ) : riwayatError ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-10 text-center">
                      <p className="text-sm font-medium text-red-600">
                        {riwayatError}
                      </p>
                      <button
                        type="button"
                        onClick={loadRiwayat}
                        className="mt-2 text-xs font-bold text-emerald-700 underline"
                      >
                        Muat ulang
                      </button>
                    </td>
                  </tr>
                ) : riwayatTampil.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-10 text-center text-sm text-slate-400">
                      Belum ada penjualan ke yayasan
                      {filterMitra ? " untuk yayasan ini" : ""}. Transaksi yang
                      disimpan akan muncul di sini.
                    </td>
                  </tr>
                ) : (
                  riwayatTampil.map((t) => {
                    const namaJenis = (t.details || [])
                      .map((d) => d.nama_jenis)
                      .filter(Boolean);
                    const ringkas =
                      namaJenis.length > 2
                        ? `${namaJenis.slice(0, 2).join(", ")} +${namaJenis.length - 2}`
                        : namaJenis.join(", ") || "-";
                    return (
                      <tr
                        key={t.id_transaksi_jual}
                        onClick={() => setDetail(t)}
                        className="cursor-pointer transition hover:bg-slate-50"
                      >
                        <td className="px-3 py-3">
                          <p className="font-semibold text-slate-700">
                            {kodeTransaksi(t)}
                          </p>
                          <p className="text-xs text-slate-400">
                            {formatTanggal(t.tanggal_transaksi)}
                          </p>
                        </td>
                        <td className="px-3 py-3">
                          <span className="inline-block max-w-[180px] truncate rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                            {t.nama_mitra || "-"}
                          </span>
                        </td>
                        <td
                          className="max-w-[200px] truncate px-3 py-3 text-slate-700"
                          title={namaJenis.join(", ")}
                        >
                          {ringkas}
                        </td>
                        <td className="px-3 py-3 text-right font-semibold text-slate-700">
                          {Number(t.total_berat).toLocaleString("id-ID", {
                            maximumFractionDigits: 2,
                          })}
                        </td>
                        <td className="px-3 py-3 text-right text-slate-700">
                          {formatRupiah(t.total_nilai)}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDetail(t);
                            }}
                            aria-label={`Lihat detail ${kodeTransaksi(t)}`}
                            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-emerald-50 hover:text-emerald-700"
                          >
                            <Eye size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {!loadingRiwayat && riwayat.length > RIWAYAT_AWAL && (
            <button
              type="button"
              onClick={() => setTampilSemua((v) => !v)}
              className="mt-3 text-xs font-bold text-emerald-700 hover:underline"
            >
              {tampilSemua
                ? "Tampilkan lebih sedikit"
                : `Lihat semua (${riwayat.length})`}
            </button>
          )}
        </section>
      </div>

      <p className="mt-10 flex items-center justify-center gap-1.5 text-xs font-semibold text-emerald-700">
        <CheckCircle2 size={14} />
        Data akan tersimpan ke database pusat.
      </p>

      {/* ================= MODAL KONFIRMASI ================= */}
      <Modal
        open={confirmOpen}
        onClose={() => !submitting && setConfirmOpen(false)}
        title="Konfirmasi Transaksi"
      >
        <p className="text-sm text-slate-500">
          Tujuan:{" "}
          <span className="font-bold text-slate-800">
            {mitraList.find((m) => String(m.id_mitra) === String(idMitra))
              ?.nama_mitra || "-"}
          </span>
        </p>
        <ul className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200 text-sm">
          {rincian.map((r) => (
            <li key={r.key} className="flex items-start justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0">
                <p className="font-semibold text-slate-700">
                  {r.harga?.nama_jenis}
                </p>
                <p className="text-xs text-slate-400">
                  {formatBerat(r.berat)} &times; {formatRupiah(r.perKg)}
                </p>
              </div>
              <span className="shrink-0 font-semibold text-slate-700">
                {formatRupiah(r.subtotal)}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2.5">
          <span className="text-sm font-semibold text-emerald-800">
            Total {formatBerat(totalBerat)}
          </span>
          <span className="font-['Poppins'] text-lg font-bold text-emerald-800">
            {formatRupiah(totalNilai)}
          </span>
        </div>
        {keterangan.trim() && (
          <p className="mt-3 break-words text-xs text-slate-500">
            Catatan: {keterangan.trim()}
          </p>
        )}
        <p className="mt-3 flex items-start gap-2 text-xs text-amber-700">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          Transaksi yang sudah disimpan tidak bisa diubah atau dihapus.
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setConfirmOpen(false)}
            disabled={submitting}
            className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            Periksa lagi
          </button>
          <button
            type="button"
            onClick={simpan}
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            {submitting ? "Menyimpan..." : "Simpan transaksi"}
          </button>
        </div>
      </Modal>

      {/* ================= MODAL DETAIL ================= */}
      <Modal
        open={!!detail}
        onClose={() => setDetail(null)}
        title={detail ? kodeTransaksi(detail) : ""}
      >
        {detail && (
          <>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-slate-400">Yayasan</dt>
              <dd className="font-semibold text-slate-700">{detail.nama_mitra}</dd>
              <dt className="text-slate-400">Tanggal</dt>
              <dd className="text-slate-700">{formatTanggal(detail.tanggal_transaksi)}</dd>
              {detail.keterangan && (
                <>
                  <dt className="text-slate-400">Catatan</dt>
                  <dd className="break-words text-slate-700">{detail.keterangan}</dd>
                </>
              )}
            </dl>
            <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full min-w-[420px] text-left text-sm">
                <thead className="bg-slate-50 text-xs font-bold text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Jenis</th>
                    <th className="px-3 py-2 text-right">Berat</th>
                    <th className="px-3 py-2 text-right">Harga/kg</th>
                    <th className="px-3 py-2 text-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(detail.details || []).map((d) => (
                    <tr key={d.id_detail_jual}>
                      <td className="px-3 py-2 text-slate-700">{d.nama_jenis || "-"}</td>
                      <td className="px-3 py-2 text-right text-slate-700">{formatBerat(d.berat)}</td>
                      <td className="px-3 py-2 text-right text-slate-700">{formatRupiah(d.harga_per_kg)}</td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-700">{formatRupiah(d.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-emerald-50 text-emerald-800">
                  <tr>
                    <td className="px-3 py-2 font-bold">Total</td>
                    <td className="px-3 py-2 text-right font-bold">{formatBerat(detail.total_berat)}</td>
                    <td />
                    <td className="px-3 py-2 text-right font-bold">{formatRupiah(detail.total_nilai)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
