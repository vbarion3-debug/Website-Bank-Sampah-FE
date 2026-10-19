import { useEffect, useMemo, useState } from "react";
import {
  PackageCheck,
  AlertTriangle,
  Scale,
  Search,
  Pencil,
  Trash2,
  Plus,
  Save,
  X,
  ImageOff,
} from "lucide-react";
import PageHeader from "../components/PageHeader";
import Modal from "../components/Modal";
import FormTransaksiManual from "../components/FormTransaksiManual";
import {
  API,
  getAuthHeaders,
  parseResponse,
  getAdminName,
  getAdminUsername,
  getFileUrl,
} from "../api";
import { parseWaktu } from "../utils/waktu"

const CONFIDENCE_THRESHOLD = 80;

function formatRupiah(value) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatBerat(value) {
  return `${Number(value || 0).toLocaleString("id-ID")} kg`;
}

function formatTanggal(iso) {
  if (!iso) return "-";
  return parseWaktu(iso).toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function SummaryCard({ icon: Icon, label, value, tone = "default" }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
            tone === "amber"
              ? "bg-amber-50 text-amber-600"
              : "bg-emerald-50 text-emerald-600"
          }`}
        >
          <Icon size={19} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-500">{label}</p>
          <p className="truncate font-['Poppins'] text-xl font-bold text-slate-800">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const adminNama = getAdminName() || getAdminUsername() || "Admin";

  // =========================================================
  // DAFTAR JENIS SAMPAH (buat dropdown edit/tambah/manual)
  // =========================================================
  const [daftarJenis, setDaftarJenis] = useState([]);

  useEffect(() => {
    async function fetchJenis() {
      try {
        const response = await fetch(API.jenisSampah, { headers: getAuthHeaders() });
        const result = await parseResponse(response);
        setDaftarJenis(Array.isArray(result) ? result : []);
      } catch (err) {
        console.error(err);
      }
    }
    fetchJenis();
  }, []);

  // =========================================================
  // LIST TRANSAKSI MASUK
  // =========================================================
  const [transaksiList, setTransaksiList] = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState("");
  const [searchNik, setSearchNik] = useState("");
  const [onlyFlagged, setOnlyFlagged] = useState(false);

  async function fetchTransaksiList() {
    try {
      setLoadingList(true);
      setListError("");
      const response = await fetch(API.transaksiHistory, { headers: getAuthHeaders() });
      const result = await parseResponse(response);
      setTransaksiList(Array.isArray(result) ? result : []);
    } catch (err) {
      console.error(err);
      setListError(err.message);
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    fetchTransaksiList();
  }, []);

  const filteredList = transaksiList.filter((t) => {
    if (onlyFlagged && !t.ada_flag) return false;
    if (searchNik.trim()) {
      const q = searchNik.trim().toLowerCase();
      return (
        t.nik?.toLowerCase().includes(q) ||
        t.nama_nasabah?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalFlagged = transaksiList.filter((t) => t.ada_flag).length;
  const totalNilaiSemua = transaksiList.reduce(
    (sum, t) => sum + Number(t.total_nilai || 0),
    0
  );

  // =========================================================
  // MODAL DETAIL TRANSAKSI
  // =========================================================
  const [selectedId, setSelectedId] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState("");

  async function openDetail(id) {
    setSelectedId(id);
    setDetailData(null);
    setDetailError("");
    setEditingDetailId(null);
    setShowAddForm(false);
    try {
      setLoadingDetail(true);
      const response = await fetch(API.transaksiDetail(id), { headers: getAuthHeaders() });
      const result = await parseResponse(response);
      setDetailData(result);
    } catch (err) {
      console.error(err);
      setDetailError(err.message);
    } finally {
      setLoadingDetail(false);
    }
  }

  function closeDetail() {
    setSelectedId(null);
    setDetailData(null);
    setEditingDetailId(null);
    setShowAddForm(false);
  }

  async function refreshAfterChange() {
    await openDetail(selectedId);
    await fetchTransaksiList();
  }

  // =========================================================
  // EDIT 1 ITEM SAMPAH
  // =========================================================
  const [editingDetailId, setEditingDetailId] = useState(null);
  const [editForm, setEditForm] = useState({ id_jenis: "", berat: "" });
  const [savingItem, setSavingItem] = useState(false);

  function startEditItem(item) {
    setEditingDetailId(item.id_detail);
    setEditForm({ id_jenis: String(item.id_jenis), berat: String(item.berat) });
  }

  async function saveEditItem() {
    if (!editForm.id_jenis || !editForm.berat || Number(editForm.berat) <= 0) {
      alert("Jenis sampah dan berat wajib diisi dengan benar.");
      return;
    }
    try {
      setSavingItem(true);
      const response = await fetch(API.transaksiItem(selectedId, editingDetailId), {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          id_jenis: Number(editForm.id_jenis),
          berat: Number(editForm.berat),
        }),
      });
      await parseResponse(response);
      setEditingDetailId(null);
      await refreshAfterChange();
    } catch (err) {
      alert(err.message);
    } finally {
      setSavingItem(false);
    }
  }

  async function deleteItem(item) {
    const yakin = window.confirm(
      `Hapus item "${item.nama_jenis || item.jenis_terdeteksi}" dari transaksi ini?`
    );
    if (!yakin) return;
    try {
      setSavingItem(true);
      const response = await fetch(API.transaksiItem(selectedId, item.id_detail), {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      await parseResponse(response);
      await refreshAfterChange();
    } catch (err) {
      alert(err.message);
    } finally {
      setSavingItem(false);
    }
  }

  // =========================================================
  // TAMBAH ITEM SAMPAH BARU
  // =========================================================
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({ id_jenis: "", berat: "" });

  function openAddForm() {
    setAddForm({ id_jenis: daftarJenis[0] ? String(daftarJenis[0].id_jenis) : "", berat: "" });
    setShowAddForm(true);
  }

  async function submitAddItem() {
    if (!addForm.id_jenis || !addForm.berat || Number(addForm.berat) <= 0) {
      alert("Jenis sampah dan berat wajib diisi dengan benar.");
      return;
    }
    try {
      setSavingItem(true);
      const response = await fetch(API.transaksiItemAdd(selectedId), {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          id_jenis: Number(addForm.id_jenis),
          berat: Number(addForm.berat),
        }),
      });
      await parseResponse(response);
      setShowAddForm(false);
      await refreshAfterChange();
    } catch (err) {
      alert(err.message);
    } finally {
      setSavingItem(false);
    }
  }


  return (
    <div className="mx-auto w-full max-w-[1180px]">
      <PageHeader title={`Halo, ${adminNama}!`} />

      {listError && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {listError}
        </div>
      )}

      {/* RINGKASAN */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard icon={PackageCheck} label="Total Transaksi" value={transaksiList.length} />
        <SummaryCard
          icon={AlertTriangle}
          label="Perlu Direview"
          value={totalFlagged}
          tone="amber"
        />
        <SummaryCard icon={Scale} label="Total Nilai" value={formatRupiah(totalNilaiSemua)} />
      </div>

      {/* DAFTAR TRANSAKSI MASUK */}
      <section className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-5">
          <h2 className="font-['Poppins'] text-lg font-bold text-slate-800">
            Transaksi Masuk
          </h2>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
              <input
                type="checkbox"
                checked={onlyFlagged}
                onChange={(e) => setOnlyFlagged(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              Hanya yang perlu direview
            </label>
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <Search size={15} className="shrink-0 text-slate-400" />
              <input
                type="text"
                value={searchNik}
                onChange={(e) => setSearchNik(e.target.value)}
                placeholder="Cari NIK/nama..."
                className="min-w-0 bg-transparent text-sm outline-none"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="bg-slate-100 text-xs font-bold uppercase text-slate-500">
              <tr>
                <th className="px-5 py-4">Nasabah</th>
                <th className="px-5 py-4">Tanggal</th>
                <th className="px-5 py-4">Berat</th>
                <th className="px-5 py-4">Nilai</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loadingList && (
                <tr>
                  <td colSpan="6" className="px-5 py-10 text-center text-slate-400">
                    Memuat transaksi...
                  </td>
                </tr>
              )}
              {!loadingList &&
                filteredList.map((t) => (
                  <tr key={t.id_transaksi} className="border-t border-slate-100">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-800">
                        {t.nama_nasabah || "-"}
                      </p>
                      {t.dibuat_manual && (
                        <span
                          title={t.dibuat_oleh ? `Dicatat manual oleh ${t.dibuat_oleh}` : "Dicatat manual"}
                          className="mt-1 inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700"
                        >
                          Manual
                        </span>
                      )}
                      <p className="font-mono text-xs text-slate-400">{t.nik}</p>
                    </td>
                    <td className="px-5 py-4 text-slate-600">
                      {formatTanggal(t.tanggal_transaksi)}
                    </td>
                    <td className="px-5 py-4 text-slate-600">{formatBerat(t.total_berat)}</td>
                    <td className="px-5 py-4 font-bold text-emerald-700">
                      {formatRupiah(t.total_nilai)}
                    </td>
                    <td className="px-5 py-4">
                      {t.ada_flag ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">
                          <AlertTriangle size={12} />
                          Perlu Review
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                          Normal
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <button
                        onClick={() => openDetail(t.id_transaksi)}
                        className="rounded-lg border border-slate-300 px-3.5 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
                      >
                        Lihat Detail
                      </button>
                    </td>
                  </tr>
                ))}
              {!loadingList && filteredList.length === 0 && (
                <tr>
                  <td colSpan="6" className="px-5 py-10 text-center text-slate-400">
                    Belum ada transaksi.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* CATAT TRANSAKSI MANUAL (foto wajib per item) */}
      <div className="mb-6">
        <FormTransaksiManual daftarJenis={daftarJenis} onSaved={fetchTransaksiList} />
      </div>

      {/* MODAL DETAIL TRANSAKSI */}
      <Modal
        open={selectedId !== null}
        onClose={closeDetail}
        title={`Detail Transaksi #${selectedId ?? ""}`}
      >
        {loadingDetail && (
          <div className="py-10 text-center text-sm text-slate-400">Memuat detail...</div>
        )}

        {detailError && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {detailError}
          </div>
        )}

        {!loadingDetail && detailData && (
          <div className="space-y-5">
            {/* INFO NASABAH */}
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="font-['Poppins'] text-base font-bold text-slate-800">
                {detailData.nama_nasabah || "-"}
              </p>
              <p className="font-mono text-xs text-slate-400">NIK: {detailData.nik}</p>
              <p className="mt-1 text-xs text-slate-400">
                {formatTanggal(detailData.tanggal_transaksi)}
              </p>
              {detailData.dibuat_manual && (
                <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-700">
                  Manual
                  {detailData.dibuat_oleh && (
                    <span className="font-medium">· dicatat oleh {detailData.dibuat_oleh}</span>
                  )}
                </p>
              )}
            </div>

            {/* LIST ITEM SAMPAH */}
            <div className="space-y-3">
              {detailData.details.map((item) => (
                <div
                  key={item.id_detail}
                  className={`rounded-xl border p-4 ${
                    item.is_flagged
                      ? "border-amber-300 bg-amber-50"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  {editingDetailId === item.id_detail ? (
                    // ===================== MODE EDIT =====================
                    <div className="space-y-3">
                      <div className="flex gap-4">
                        <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100">
                          {item.foto_url ? (
                            <img
                              src={getFileUrl(item.foto_url)}
                              alt="Foto sampah"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <ImageOff size={22} className="text-slate-300" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1 space-y-2">
                          {item.confidence !== null && item.confidence !== undefined && (
                            <p className="text-xs text-slate-500">
                              Confidence ML:{" "}
                              <span
                                className={`font-bold ${
                                  Number(item.confidence) < CONFIDENCE_THRESHOLD
                                    ? "text-amber-600"
                                    : "text-emerald-600"
                                }`}
                              >
                                {Number(item.confidence).toFixed(1)}%
                              </span>
                              {item.jenis_terdeteksi && (
                                <span className="text-slate-400">
                                  {" "}
                                  (terdeteksi: {item.jenis_terdeteksi})
                                </span>
                              )}
                            </p>
                          )}
                          <select
                            value={editForm.id_jenis}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, id_jenis: e.target.value }))
                            }
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
                          >
                            {daftarJenis.map((j) => (
                              <option key={j.id_jenis} value={j.id_jenis}>
                                {j.nama_jenis}
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            value={editForm.berat}
                            onChange={(e) =>
                              setEditForm((f) => ({ ...f, berat: e.target.value }))
                            }
                            placeholder="Berat (kg)"
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setEditingDetailId(null)}
                          disabled={savingItem}
                          className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                        >
                          <X size={13} />
                          Batal
                        </button>
                        <button
                          onClick={saveEditItem}
                          disabled={savingItem}
                          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
                        >
                          <Save size={13} />
                          {savingItem ? "Menyimpan..." : "Simpan"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    // ===================== MODE TAMPIL =====================
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-slate-800">
                            {item.nama_jenis || item.jenis_terdeteksi || "Tidak diketahui"}
                          </p>
                          {item.is_flagged && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                              <AlertTriangle size={10} />
                              Confidence {Number(item.confidence).toFixed(1)}%
                            </span>
                          )}
                          {item.ditambahkan_manual && (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                              Ditambah manual
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {formatBerat(item.berat)} · {formatRupiah(item.subtotal)}
                        </p>
                        {item.foto_url && (
                          <a
                            href={getFileUrl(item.foto_url)}
                            target="_blank"
                            rel="noreferrer"
                            title="Klik untuk membuka foto"
                          >
                            <img
                              src={getFileUrl(item.foto_url)}
                              alt="Foto sampah"
                              className="mt-2 h-20 w-20 rounded-lg border border-slate-200 object-cover"
                            />
                          </a>
                        )}
                        {item.dikoreksi_oleh && (
                          <p className="mt-1 text-[11px] text-slate-400">
                            Dikoreksi oleh {item.dikoreksi_oleh} · {formatTanggal(item.dikoreksi_at)}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          onClick={() => startEditItem(item)}
                          className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-slate-600 hover:bg-slate-200"
                          title="Edit"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => deleteItem(item)}
                          className="flex h-8 w-8 items-center justify-center rounded-md bg-red-50 text-red-500 hover:bg-red-100"
                          title="Hapus"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* TAMBAH ITEM BARU */}
            {showAddForm ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <select
                    value={addForm.id_jenis}
                    onChange={(e) => setAddForm((f) => ({ ...f, id_jenis: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
                  >
                    {daftarJenis.map((j) => (
                      <option key={j.id_jenis} value={j.id_jenis}>
                        {j.nama_jenis}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={addForm.berat}
                    onChange={(e) => setAddForm((f) => ({ ...f, berat: e.target.value }))}
                    placeholder="Berat (kg)"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowAddForm(false)}
                      disabled={savingItem}
                      className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                    >
                      Batal
                    </button>
                    <button
                      onClick={submitAddItem}
                      disabled={savingItem}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
                    >
                      <Save size={13} />
                      Tambah
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={openAddForm}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 py-3 text-sm font-bold text-slate-500 transition hover:border-emerald-400 hover:text-emerald-600"
              >
                <Plus size={16} />
                Tambah Sampah
              </button>
            )}

            {/* TOTAL */}
            <div className="flex items-center justify-between rounded-xl bg-emerald-50 p-4">
              <div>
                <p className="text-xs font-bold text-emerald-700">Total Berat</p>
                <p className="font-['Poppins'] text-lg font-bold text-emerald-900">
                  {formatBerat(detailData.total_berat)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-emerald-700">Total Nilai</p>
                <p className="font-['Poppins'] text-lg font-bold text-emerald-900">
                  {formatRupiah(detailData.total_nilai)}
                </p>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
