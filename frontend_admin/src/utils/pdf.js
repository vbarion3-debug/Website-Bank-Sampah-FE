// Pembuat PDF laporan (A4 landscape) untuk halaman Laporan Pemasukan & Pengeluaran.
// Butuh:  npm install jspdf jspdf-autotable
// Library dimuat saat tombol diklik (dynamic import), jadi tidak menambah ukuran bundle awal.

const HIJAU = [5, 150, 105]; // emerald-600
const TEKS = [15, 23, 42]; // slate-900
const TEKS_REDUP = [71, 85, 105]; // slate-600
const ABU = [241, 245, 249]; // slate-100

// Font bawaan PDF tidak suka spasi non-breaking dari Intl (mis. "Rp 25.000").
const bersih = (v) => String(v ?? "").replace(/[\u00a0\u202f]/g, " ");

const WIB = "Asia/Jakarta";

function stempelCetak() {
  const teks = new Date().toLocaleString("id-ID", {
    timeZone: WIB,
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  return `${teks.replace(/(\d{2})\.(\d{2})/, "$1:$2")} WIB`;
}

function stempelFile() {
  return new Date(Date.now() + 7 * 3600 * 1000)
    .toISOString()
    .slice(0, 10)
    .replaceAll("-", "");
}

/**
 * @param {object} o
 * @param {string} o.namaFile      tanpa ekstensi, mis. "laporan-pemasukan-pengepul"
 * @param {string} o.judul
 * @param {string[]} [o.info]      baris keterangan di bawah judul (periode, filter, dst.)
 * @param {{label:string, nilai:string}[]} [o.ringkasan]
 * @param {{judul:string, rata?:"left"|"right"|"center", lebar?:number}[]} o.kolom
 * @param {Array<Array<string|number>>} o.baris   isi sel sudah berupa teks siap tampil
 * @param {Array<string|number>} [o.totalBaris]   satu baris penutup tabel (opsional)
 * @param {string} [o.instansi]
 */
export async function unduhPdf({
  namaFile,
  judul,
  info = [],
  ringkasan = [],
  kolom,
  baris,
  totalBaris = null,
  instansi = "Bank Sampah",
}) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const lebar = doc.internal.pageSize.getWidth();
  const tinggi = doc.internal.pageSize.getHeight();
  const M = 36; // margin

  // ---------- kop ----------
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...HIJAU);
  doc.text(bersih(instansi), M, 40);

  doc.setFontSize(17);
  doc.setTextColor(...TEKS);
  doc.text(bersih(judul), M, 62);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...TEKS_REDUP);
  let y = 78;
  [...info, `Dicetak: ${stempelCetak()}`].forEach((t) => {
    doc.text(bersih(t), M, y);
    y += 12;
  });

  // ---------- ringkasan ----------
  if (ringkasan.length > 0) {
    autoTable(doc, {
      startY: y + 4,
      body: ringkasan.map((r) => [bersih(r.label), bersih(r.nilai)]),
      theme: "plain",
      tableWidth: "wrap",
      margin: { left: M, right: M },
      styles: {
        fontSize: 9,
        textColor: TEKS,
        cellPadding: { top: 2, bottom: 2, left: 0, right: 16 },
      },
      columnStyles: { 0: { textColor: TEKS_REDUP }, 1: { fontStyle: "bold" } },
    });
    y = (doc.lastAutoTable?.finalY ?? y + 40) + 12;
  }

  // ---------- tabel utama ----------
  // Catatan: columnStyles hanya berlaku untuk isi tabel, jadi rata kanan/kiri
  // untuk header dan baris total diberikan per sel.
  const rata = (i) => kolom[i].rata || "left";
  const columnStyles = {};
  kolom.forEach((k, i) => {
    columnStyles[i] = {
      halign: rata(i),
      ...(k.lebar ? { cellWidth: k.lebar } : {}),
    };
  });

  autoTable(doc, {
    startY: y,
    head: [
      kolom.map((k, i) => ({
        content: bersih(k.judul),
        styles: { halign: rata(i) },
      })),
    ],
    body: baris.map((r) => r.map(bersih)),
    foot: totalBaris
      ? [
          totalBaris.map((c, i) => ({
            content: bersih(c),
            styles: { halign: rata(i) },
          })),
        ]
      : undefined,
    showFoot: "lastPage",
    theme: "grid",
    margin: { left: M, right: M, bottom: 36 },
    styles: {
      fontSize: 8,
      cellPadding: 4,
      textColor: TEKS,
      lineColor: [226, 232, 240],
      lineWidth: 0.5,
      overflow: "linebreak",
    },
    headStyles: { fillColor: HIJAU, textColor: 255, fontStyle: "bold" },
    footStyles: { fillColor: ABU, textColor: TEKS, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles,
  });

  // ---------- nomor halaman ----------
  const jumlah = doc.getNumberOfPages();
  for (let i = 1; i <= jumlah; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...TEKS_REDUP);
    doc.text(bersih(`${instansi} - ${judul}`), M, tinggi - 18);
    doc.text(`Halaman ${i} dari ${jumlah}`, lebar - M, tinggi - 18, {
      align: "right",
    });
  }

  doc.save(`${namaFile}-${stempelFile()}.pdf`);
}
