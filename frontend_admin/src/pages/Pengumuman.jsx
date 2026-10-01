import { useEffect, useRef, useState } from "react";
import { Plus, Send, Save, Trash2, Pencil, Bold, Italic, List, X } from "lucide-react";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { API, getAuthHeaders, parseResponse } from "../api";

// Backend: status = "draft" | "terbit" | "arsip"
const STATUS_LABEL = {
  terbit: "Terbit",
  draft: "Draft",
  arsip: "Arsip",
};

function formatTanggal(iso) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatJam(iso) {
  if (!iso) return "-";
  return new Date(iso).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// =========================================================
// RICH TEXT RINGAN (markdown sederhana: **bold**, *italic*, "- " bullet)
// =========================================================
function parseInline(line, keyPrefix) {
  const regex = /\*\*(.+?)\*\*|\*(.+?)\*/g;
  const nodes = [];
  let lastIndex = 0;
  let match;
  let i = 0;

  while ((match = regex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(line.slice(lastIndex, match.index));
    }
    if (match[1] !== undefined) {
      nodes.push(<strong key={`${keyPrefix}-b-${i}`}>{match[1]}</strong>);
    } else {
      nodes.push(<em key={`${keyPrefix}-i-${i}`}>{match[2]}</em>);
    }
    lastIndex = regex.lastIndex;
    i += 1;
  }
  if (lastIndex < line.length) nodes.push(line.slice(lastIndex));
  return nodes;
}

function RichText({ text, className = "" }) {
  if (!text) return null;
  const lines = text.split("\n");

  return (
    <div className={className}>
      {lines.map((line, idx) => {
        const isBullet = line.trim().startsWith("- ");
        if (isBullet) {
          return (
            <div key={idx} className="flex gap-2">
              <span className="shrink-0">•</span>
              <span>{parseInline(line.trim().slice(2), idx)}</span>
            </div>
          );
        }
        if (!line.trim()) return <br key={idx} />;
        return (
          <p key={idx} className="mb-1 last:mb-0">
            {parseInline(line, idx)}
          </p>
        );
      })}
    </div>
  );
}

export default function Pengumuman() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ judul: "", isi: "" });
  const [editingId, setEditingId] = useState(null);
  const [editingJudulAsli, setEditingJudulAsli] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [error, setError] = useState("");

  const textareaRef = useRef(null);

  // GET /pengumuman/  -> list semua pengumuman (semua status)
  async function fetchAnnouncements() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(API.pengumuman, {
        headers: getAuthHeaders(),
      });
      const result = await parseResponse(response);

      setRows(Array.isArray(result) ? result : []);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  function resetForm() {
    setForm({ judul: "", isi: "" });
    setEditingId(null);
    setEditingJudulAsli("");
  }

  // POST /pengumuman/create  ATAU  PUT /pengumuman/{id}
  async function saveAnnouncement(status) {
    if (!form.judul.trim() || !form.isi.trim()) {
      setError("Judul dan isi pengumuman wajib diisi.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const payload = {
        judul: form.judul,
        isi: form.isi,
        status,
      };

      const response = editingId
        ? await fetch(API.pengumumanDetail(editingId), {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              ...getAuthHeaders(),
            },
            body: JSON.stringify(payload),
          })
        : await fetch(API.pengumumanCreate, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...getAuthHeaders(),
            },
            body: JSON.stringify(payload),
          });

      await parseResponse(response);

      resetForm();
      await fetchAnnouncements();
      alert(
        status === "terbit"
          ? "Pengumuman berhasil diterbitkan."
          : "Pengumuman berhasil disimpan sebagai draft."
      );
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // GET /pengumuman/{id}  -> ambil data terbaru buat diedit
  // Kalau statusnya "terbit", ditarik dulu jadi "draft" lewat PUT /pengumuman/{id}
  async function startEdit(id) {
    try {
      setLoadingEdit(true);
      setError("");

      const response = await fetch(API.pengumumanDetail(id), {
        headers: getAuthHeaders(),
      });
      const data = await parseResponse(response);

      if (data.status === "terbit") {
        const yakin = window.confirm(
          `Pengumuman "${data.judul}" sudah terbit. Tarik ke draft supaya bisa diedit?`
        );
        if (!yakin) return;

        const pullResponse = await fetch(API.pengumumanDetail(id), {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
          body: JSON.stringify({ status: "draft" }),
        });
        const pulled = await parseResponse(pullResponse);

        setForm({ judul: pulled.judul, isi: pulled.isi });
        setEditingJudulAsli(pulled.judul);
        await fetchAnnouncements();
      } else {
        setForm({ judul: data.judul, isi: data.isi });
        setEditingJudulAsli(data.judul);
      }

      setEditingId(id);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoadingEdit(false);
    }
  }

  // DELETE /pengumuman/{id_pengumuman}
  async function deleteAnnouncement(id) {
    const yakin = window.confirm(
      "Apakah kamu yakin ingin menghapus pengumuman ini?"
    );
    if (!yakin) return;

    try {
      setSaving(true);
      setError("");

      const response = await fetch(API.pengumumanDetail(id), {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      await parseResponse(response);

      if (editingId === id) resetForm();
      await fetchAnnouncements();
      alert("Pengumuman berhasil dihapus.");
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // =========================================================
  // TOOLBAR FORMAT TEKS (Bold / Italic / Bullet List)
  // =========================================================
  function applyFormat(type) {
    const el = textareaRef.current;
    if (!el) return;

    const start = el.selectionStart;
    const end = el.selectionEnd;
    const value = form.isi;

    if (type === "list") {
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      const newValue = value.slice(0, lineStart) + "- " + value.slice(lineStart);
      setForm((f) => ({ ...f, isi: newValue }));
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(start + 2, end + 2);
      });
      return;
    }

    const before = type === "bold" ? "**" : "*";
    const after = type === "bold" ? "**" : "*";
    const placeholder = type === "bold" ? "tebal" : "miring";
    const selected = value.slice(start, end) || placeholder;

    const newValue = value.slice(0, start) + before + selected + after + value.slice(end);
    const selStart = start + before.length;
    const selEnd = selStart + selected.length;

    setForm((f) => ({ ...f, isi: newValue }));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(selStart, selEnd);
    });
  }

  return (
    <div className="mx-auto w-full max-w-[1180px]">
      <PageHeader title="Pengumuman Sistem" />

      {/* ERROR */}
      {error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* FORM BUAT / EDIT PENGUMUMAN */}
      <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {editingId ? (
              <Pencil size={18} className="shrink-0 text-slate-800" />
            ) : (
              <Plus size={18} className="shrink-0 text-slate-800" />
            )}
            <h2 className="font-['Poppins'] text-sm font-bold text-slate-800">
              {editingId
                ? `Mengedit: ${editingJudulAsli}`
                : "Buat Pengumuman Baru"}
            </h2>
          </div>

          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
            >
              <X size={13} />
              Batal Edit
            </button>
          )}
        </div>

        <div className="space-y-4">
          <input
            required
            type="text"
            minLength={3}
            maxLength={200}
            placeholder="Judul Pengumuman..."
            value={form.judul}
            onChange={(e) => setForm({ ...form, judul: e.target.value })}
            className="w-full min-w-0 rounded-lg border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-emerald-500"
          />

          {/* TOOLBAR + TEXTAREA (dibungkus 1 div biar nggak kena space-y-4 dari parent) */}
          <div>
            <div className="flex flex-wrap items-center gap-1.5 rounded-t-lg border border-b-0 border-slate-300 bg-slate-50 p-2">
              <button
                type="button"
                onClick={() => applyFormat("bold")}
                title="Tebal"
                className="flex h-8 w-8 items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-200"
              >
                <Bold size={15} />
              </button>
              <button
                type="button"
                onClick={() => applyFormat("italic")}
                title="Miring"
                className="flex h-8 w-8 items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-200"
              >
                <Italic size={15} />
              </button>
              <button
                type="button"
                onClick={() => applyFormat("list")}
                title="Bullet List"
                className="flex h-8 w-8 items-center justify-center rounded-md text-slate-600 transition hover:bg-slate-200"
              >
                <List size={15} />
              </button>
              <span className="ml-2 text-[11px] text-slate-400">
                Blok teks lalu klik tombol untuk format
              </span>
            </div>

            <textarea
              ref={textareaRef}
              required
              rows={4}
              placeholder="Tulis isi pesan pengumuman di sini..."
              value={form.isi}
              onChange={(e) => setForm({ ...form, isi: e.target.value })}
              className="w-full min-w-0 resize-none rounded-b-lg border border-slate-300 px-4 py-3 text-sm outline-none transition focus:border-emerald-500"
            />
          </div>

          {/* PREVIEW */}
          {form.isi.trim() && (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                Pratinjau
              </p>
              <RichText text={form.isi} className="text-sm leading-6 text-slate-700" />
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={() => saveAnnouncement("draft")}
              disabled={saving || loadingEdit}
              className="flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-5 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save size={16} />
              <span>{saving ? "Menyimpan..." : "Simpan sebagai Draft"}</span>
            </button>

            <button
              type="button"
              onClick={() => saveAnnouncement("terbit")}
              disabled={saving || loadingEdit}
              className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Send size={16} />
              <span>{saving ? "Menyimpan..." : "Terbitkan Sekarang"}</span>
            </button>
          </div>
        </div>
      </section>

      {/* DAFTAR PENGUMUMAN */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left">
            <thead className="bg-slate-100 text-xs font-bold uppercase text-slate-500">
              <tr>
                <th className="px-6 py-4">Judul & Isi Pengumuman</th>
                <th className="px-6 py-4">Tanggal Rilis</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Aksi</th>
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td
                    colSpan="4"
                    className="px-6 py-10 text-center text-sm text-slate-400"
                  >
                    Memuat data pengumuman...
                  </td>
                </tr>
              )}

              {!loading &&
                rows.map((row) => (
                  <tr
                    key={row.id_pengumuman}
                    className={`border-t border-slate-100 ${
                      editingId === row.id_pengumuman ? "bg-emerald-50/50" : ""
                    }`}
                  >
                    <td className="max-w-xl px-6 py-5">
                      <p className="break-words text-sm font-bold text-emerald-900">
                        {row.judul}
                      </p>
                      <RichText
                        text={row.isi}
                        className="mt-1 break-words text-xs leading-5 text-slate-500"
                      />
                    </td>

                    <td className="px-6 py-5">
                      <p className="text-sm font-semibold text-slate-800">
                        {formatTanggal(row.tanggal_publikasi)}
                      </p>
                      <p className="text-xs text-slate-400">
                        {formatJam(row.tanggal_publikasi)}
                      </p>
                    </td>

                    <td className="px-6 py-5">
                      <StatusBadge
                        tone={row.status === "terbit" ? "green" : "gray"}
                      >
                        {STATUS_LABEL[row.status] || row.status}
                      </StatusBadge>
                    </td>

                    <td className="px-6 py-5">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(row.id_pengumuman)}
                          disabled={saving || loadingEdit}
                          title={
                            row.status === "terbit"
                              ? "Tarik ke Draft & Edit"
                              : "Edit Pengumuman"
                          }
                          className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-slate-600 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Pencil size={15} />
                        </button>

                        <button
                          type="button"
                          onClick={() => deleteAnnouncement(row.id_pengumuman)}
                          disabled={saving || loadingEdit}
                          title="Hapus Pengumuman"
                          className="flex h-8 w-8 items-center justify-center rounded-md bg-red-50 text-red-500 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

              {!loading && rows.length === 0 && (
                <tr>
                  <td
                    colSpan="4"
                    className="px-6 py-10 text-center text-sm text-slate-400"
                  >
                    Belum ada pengumuman.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
