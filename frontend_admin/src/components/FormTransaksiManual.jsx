import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Loader2,
  Plus,
  Save,
  Search,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { API, getAuthHeaders, parseResponse } from "../api";

const MAX_ITEM = 20; // sama dengan backend
const MAX_FILE_MB = 5;

const rupiah = (v) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(v) || 0);

let nextId = 1;
const newRow = (defaultJenis = "") => ({
  key: nextId++,
  id_jenis: defaultJenis,
  berat: "",
  file: null,
  preview: "",
});

export default function FormTransaksiManual({ daftarJenis, onSaved }) {
  const [nik, setNik] = useState("");
  const [nasabah, setNasabah] = useState(null);
  const [searching, setSearching] = useState(false);
  const [rows, setRows] = useState([]);
  const [keterangan, setKeterangan] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const previewsRef = useRef(new Set());

  const defaultJenis = daftarJenis[0] ? String(daftarJenis[0].id_jenis) : "";

  // Bersihkan object URL saat komponen dilepas
  useEffect(() => {
    const set = previewsRef.current;
    return () => set.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  const jenisById = (id) => daftarJenis.find((j) => String(j.id_jenis) === String(id));

  const subtotal = (row) => {
    const j = jenisById(row.id_jenis);
    return (Number(row.berat) || 0) * (Number(j?.harga_per_kg) || 0);
  };
  const totalBerat = rows.reduce((s, r) => s + (Number(r.berat) || 0), 0);
  const totalNilai = rows.reduce((s, r) => s + subtotal(r), 0);
  const semuaLengkap =
    rows.length > 0 && rows.every((r) => r.id_jenis && Number(r.berat) > 0 && r.file);

  function releasePreview(url) {
    if (url) {
      URL.revokeObjectURL(url);
      previewsRef.current.delete(url);
    }
  }

  function resetForm() {
    rows.forEach((r) => releasePreview(r.preview));
    setNik("");
    setNasabah(null);
    setRows([]);
    setKeterangan("");
  }

  async function cariNasabah() {
    const value = nik.trim();
    if (value.length !== 16) {
      setError("NIK harus 16 digit.");
      return;
    }
    setSearching(true);
    setError("");
    setSuccess("");
    setNasabah(null);
    try {
      const response = await fetch(API.nasabahDetail(value), { headers: getAuthHeaders() });
      const result = await parseResponse(response);
      const data = result?.data || result;
      if (data && data.is_active === false) {
        setError("Akun nasabah ini nonaktif, tidak bisa dicatat transaksinya.");
        return;
      }
      setNasabah(data);
      setRows((prev) => (prev.length ? prev : [newRow(defaultJenis)]));
    } catch (err) {
      setError(err.message || "Nasabah tidak ditemukan.");
    } finally {
      setSearching(false);
    }
  }

  const updateRow = (key, patch) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  function removeRow(key) {
    setRows((prev) => {
      const target = prev.find((r) => r.key === key);
      releasePreview(target?.preview);
      return prev.filter((r) => r.key !== key);
    });
  }

  function pickFile(key, e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    setError("");
    if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) {
      setError("Foto harus berformat JPG, PNG, atau WEBP.");
      return;
    }
    if (f.size > MAX_FILE_MB * 1024 * 1024) {
      setError(`Ukuran tiap foto maksimal ${MAX_FILE_MB} MB.`);
      return;
    }
    const url = URL.createObjectURL(f);
    previewsRef.current.add(url);
    setRows((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r;
        releasePreview(r.preview);
        return { ...r, file: f, preview: url };
      })
    );
  }

  async function simpan() {
    setError("");
    setSuccess("");
    if (!nasabah) return setError("Cari nasabah berdasarkan NIK terlebih dahulu.");
    if (!semuaLengkap) return setError("Tiap item wajib punya jenis, berat, dan foto.");

    const form = new FormData();
    form.append("nik", nik.trim());
    form.append(
      "items",
      JSON.stringify(rows.map((r) => ({ id_jenis: Number(r.id_jenis), berat: Number(r.berat) })))
    );
    if (keterangan.trim()) form.append("keterangan", keterangan.trim());
    // Urutan foto HARUS sama dengan urutan items
    rows.forEach((r) => form.append("foto", r.file));

    try {
      setSaving(true);
      // Jangan set Content-Type manual: browser mengisi boundary multipart sendiri
      const response = await fetch(API.transaksiCreateManual, {
        method: "POST",
        headers: getAuthHeaders(),
        body: form,
      });
      const result = await parseResponse(response);
      setSuccess(
        `Transaksi #${result?.id_transaksi ?? ""} tercatat. Saldo nasabah sekarang ${rupiah(
          result?.saldo_nasabah_sekarang
        )}.`
      );
      resetForm();
      onSaved?.();
    } catch (err) {
      setError(err.message || "Gagal menyimpan transaksi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="font-['Poppins'] text-lg font-bold text-slate-800">
          Catat Transaksi Manual
        </h2>
        <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-[11px] font-bold text-indigo-700">
          Manual
        </span>
      </div>
      <p className="mb-4 text-sm text-slate-500">
        Untuk setoran yang tidak lewat alat IoT. Tiap item sampah <b>wajib difoto</b> sebagai bukti.
      </p>

      {/* 1. nasabah */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
        <input
          type="text"
          inputMode="numeric"
          maxLength={16}
          value={nik}
          onChange={(e) => setNik(e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => e.key === "Enter" && cariNasabah()}
          placeholder="Masukkan NIK nasabah (16 digit)..."
          className="w-full min-w-0 rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500"
        />
        <button
          type="button"
          onClick={cariNasabah}
          disabled={searching}
          className="flex items-center justify-center gap-2 rounded-lg bg-slate-800 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-900 disabled:opacity-60"
        >
          {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          Cari
        </button>
      </div>

      {error && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">
          <AlertCircle size={15} className="shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">
          <CheckCircle2 size={15} className="shrink-0" />
          {success}
        </div>
      )}

      {nasabah && (
        <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
            <UserRound size={16} />
            {nasabah.nama_nasabah || nasabah.nama}
            <span className="font-mono text-xs font-normal text-slate-400">{nik}</span>
          </div>

          {/* 2. item */}
          <div className="space-y-3">
            {rows.map((r, i) => (
              <div key={r.key} className="rounded-xl border border-slate-200 p-3.5">
                <div className="flex items-start gap-3">
                  {/* foto */}
                  <label
                    className={`relative flex h-24 w-24 shrink-0 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border-2 border-dashed text-center transition ${
                      r.file
                        ? "border-transparent"
                        : "border-amber-300 bg-amber-50 text-amber-600 hover:border-amber-400"
                    }`}
                    title="Foto wajib"
                  >
                    {r.preview ? (
                      <img src={r.preview} alt={`Foto item ${i + 1}`} className="h-full w-full object-cover" />
                    ) : (
                      <>
                        <Camera size={20} />
                        <span className="mt-1 text-[10px] font-bold leading-tight">
                          Foto wajib
                        </span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      capture="environment"
                      onChange={(e) => pickFile(r.key, e)}
                      className="hidden"
                    />
                  </label>

                  {/* jenis + berat */}
                  <div className="min-w-0 flex-1 space-y-2">
                    <select
                      value={r.id_jenis}
                      onChange={(e) => updateRow(r.key, { id_jenis: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
                    >
                      {daftarJenis.map((j) => (
                        <option key={j.id_jenis} value={j.id_jenis}>
                          {j.nama_jenis} — {rupiah(j.harga_per_kg)}/kg
                        </option>
                      ))}
                    </select>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={r.berat}
                        onChange={(e) => updateRow(r.key, { berat: e.target.value })}
                        placeholder="Berat (kg)"
                        className="w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                      />
                      <p className="shrink-0 text-sm font-bold text-emerald-700">
                        {rupiah(subtotal(r))}
                      </p>
                    </div>
                  </div>

                  {rows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRow(r.key)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-red-50 text-red-500 hover:bg-red-100"
                      title="Hapus item"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                {r.file && (
                  <button
                    type="button"
                    onClick={() => {
                      releasePreview(r.preview);
                      updateRow(r.key, { file: null, preview: "" });
                    }}
                    className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-red-500"
                  >
                    <X size={12} /> Ganti foto
                  </button>
                )}
              </div>
            ))}

            {rows.length < MAX_ITEM && (
              <button
                type="button"
                onClick={() => setRows((prev) => [...prev, newRow(defaultJenis)])}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 py-2.5 text-sm font-bold text-slate-500 transition hover:border-emerald-400 hover:text-emerald-600"
              >
                <Plus size={16} />
                Tambah item sampah
              </button>
            )}
          </div>

          <textarea
            value={keterangan}
            onChange={(e) => setKeterangan(e.target.value)}
            maxLength={500}
            rows={2}
            placeholder="Catatan (opsional), mis. alasan dicatat manual"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
          />

          {/* 3. total + simpan */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-emerald-50 p-4">
            <div>
              <p className="text-xs font-bold text-emerald-700">
                Total ({rows.length} item · {totalBerat.toLocaleString("id-ID")} kg)
              </p>
              <p className="font-['Poppins'] text-lg font-bold text-emerald-900">
                {rupiah(totalNilai)}
              </p>
              <p className="text-[11px] text-emerald-700/70">
                Perkiraan; harga final dihitung server dari harga terbaru.
              </p>
            </div>
            <button
              type="button"
              onClick={simpan}
              disabled={saving || !semuaLengkap}
              className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? "Menyimpan..." : "Simpan Transaksi"}
            </button>
          </div>
          {!semuaLengkap && rows.length > 0 && (
            <p className="text-xs text-amber-600">
              Tombol simpan aktif setelah semua item punya jenis, berat, dan foto.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
