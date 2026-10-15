// Backend menyimpan waktu WIB (UTC+7) tanpa penanda zona.
// Tambahkan "+07:00" supaya tampil benar di browser zona mana pun.
export function parseWaktu(value) {
  if (!value) return new Date(NaN)
  const str = String(value)
  return new Date(/(Z|[+-]\d\d:?\d\d)$/i.test(str) ? str : `${str}+07:00`)
}

// Bulan berjalan menurut WIB, format "YYYY-MM"
export const bulanIniWIB = () =>
  new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 7)
