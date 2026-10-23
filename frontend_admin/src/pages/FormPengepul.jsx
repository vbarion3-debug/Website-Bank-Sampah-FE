import { useState } from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import { API, getAuthHeaders } from "../api";

export default function FormPengepul() {
  const nav = useNavigate();

  const [formData, setFormData] = useState({
    nama: "",
    lokasi: "",
    kontak: "",
    email: "",
    alamat: "",
    penanggung_jawab: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setLoading(true);
    setError("");

    try {
      const response = await fetch(API.mitraCreate, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          nama_mitra: formData.nama,
          deskripsi: formData.lokasi
            ? `Lokasi/Kecamatan: ${formData.lokasi}`
            : "",
          alamat: formData.alamat,
          no_hp: formData.kontak,
          email: formData.email,
          nama_penanggung_jawab: formData.penanggung_jawab,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Gagal menyimpan data pengepul");
      }

      alert("Data pengepul berhasil disimpan!");

      nav("/database-pengepul");
    } catch (err) {
      console.error("Error:", err);
      setError(err.message || "Terjadi kesalahan saat menyimpan data");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[980px]">
      <PageHeader title="Formulir Data Pengepul" />

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-7"
      >
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <label className="min-w-0">
            <span className="mb-2 block text-sm font-bold text-slate-700">
              Nama Pengepul
            </span>

            <input
              type="text"
              name="nama"
              value={formData.nama}
              onChange={handleChange}
              required
              placeholder="Masukkan nama pengepul"
              className="w-full min-w-0 rounded-lg border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500"
            />
          </label>

          <label className="min-w-0">
            <span className="mb-2 block text-sm font-bold text-slate-700">
              Lokasi / Kecamatan
            </span>

            <input
              type="text"
              name="lokasi"
              value={formData.lokasi}
              onChange={handleChange}
              required
              placeholder="Masukkan lokasi / kecamatan"
              className="w-full min-w-0 rounded-lg border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500"
            />
          </label>

          <label className="min-w-0">
            <span className="mb-2 block text-sm font-bold text-slate-700">
              Nomor Kontak
            </span>

            <input
              type="tel"
              name="kontak"
              value={formData.kontak}
              onChange={handleChange}
              required
              placeholder="Masukkan nomor kontak"
              className="w-full min-w-0 rounded-lg border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500"
            />
          </label>

          <label className="min-w-0">
            <span className="mb-2 block text-sm font-bold text-slate-700">
              Email
            </span>

            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="Masukkan email"
              className="w-full min-w-0 rounded-lg border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500"
            />
          </label>
        </div>

        <div className="mt-5">
          <label className="mb-2 block text-sm font-bold text-slate-700">
            Nama Penanggung Jawab
          </label>

          <input
            type="text"
            name="penanggung_jawab"
            value={formData.penanggung_jawab}
            onChange={handleChange}
            required
            placeholder="Masukkan nama penanggung jawab"
            className="w-full min-w-0 rounded-lg border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500"
          />
        </div>

        <div className="mt-5">
          <label className="mb-2 block text-sm font-bold text-slate-700">
            Alamat Lengkap
          </label>

          <textarea
            name="alamat"
            value={formData.alamat}
            onChange={handleChange}
            rows="4"
            required
            placeholder="Masukkan alamat lengkap pengepul"
            className="w-full min-w-0 rounded-lg border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500"
          />
        </div>

        {error && (
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
            {error}
          </div>
        )}

        <div className="mt-7 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={() => nav("/database-pengepul")}
            disabled={loading}
            className="rounded-lg border border-slate-300 px-5 py-3 font-bold text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Batal
          </button>

          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-emerald-600 px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Menyimpan..." : "Simpan Data"}
          </button>
        </div>
      </form>
    </div>
  );
}