import type { HariLibur, IzinRecord, Kamar, Penghuni, PresensiRecord, PresensiStatus, Sesi } from './types'

// ---------- Tanggal & waktu lokal (WIB perangkat) ----------

const pad = (n: number) => String(n).padStart(2, '0')

export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function todayLocal(): string {
  return toDateStr(new Date())
}

export function toHM(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function addDays(tanggal: string, n: number): string {
  const [y, m, d] = tanggal.split('-').map(Number)
  return toDateStr(new Date(y, m - 1, d + n))
}

export function maxDate(a: string, b: string): string {
  return a > b ? a : b
}

// Daftar tanggal dari yang terbaru ke yang terlama
export function dateRangeDesc(mulai: string, sampai: string): string[] {
  const out: string[] = []
  for (let t = sampai; t >= mulai; t = addDays(t, -1)) out.push(t)
  return out
}

// ---------- Sesi, libur, izin ----------

export function sesiAktif(list: Sesi[]): Sesi[] {
  return list.filter(s => s.aktif).sort((a, b) => a.jamMulai.localeCompare(b.jamMulai))
}

export type FaseSesi = 'belum-dibuka' | 'dibuka' | 'ditutup'

export function faseSesi(sesi: Sesi, tanggal: string, now: Date): FaseSesi {
  const today = toDateStr(now)
  if (tanggal < today) return 'ditutup'
  if (tanggal > today) return 'belum-dibuka'
  const hm = toHM(now)
  if (hm < sesi.jamMulai) return 'belum-dibuka'
  if (hm > sesi.jamSelesai) return 'ditutup'
  return 'dibuka'
}

export function cariLibur(tanggal: string, libur: HariLibur[]): HariLibur | undefined {
  return libur.find(l => l.tanggalMulai <= tanggal && tanggal <= l.tanggalSelesai)
}

export function izinMencakup(i: IzinRecord, tanggal: string, sesi: string): boolean {
  return i.tanggal <= tanggal && tanggal <= (i.tanggalSelesai || i.tanggal) && (!i.sesi || i.sesi === sesi)
}

export function cariIzinDisetujui(izin: IzinRecord[], nim: string, tanggal: string, sesi: string): IzinRecord | undefined {
  return izin.find(i => i.nim === nim && i.statusPersetujuan === 'Disetujui' && izinMencakup(i, tanggal, sesi))
}

// ---------- Status presensi turunan ----------

export interface DataPresensi {
  presensi: PresensiRecord[]
  izin: IzinRecord[]
  libur: HariLibur[]
}

export interface StatusDetail {
  status: PresensiStatus
  fase: FaseSesi
  presensi?: PresensiRecord
  izin?: IzinRecord
  libur?: HariLibur
}

/**
 * Urutan prioritas status satu penghuni pada satu sesi:
 * 1. Catatan presensi (absen mandiri / koreksi fasil)
 * 2. Hari libur
 * 3. Izin yang disetujui
 * 4. Sesi sudah ditutup tanpa catatan -> Tidak Hadir, selain itu -> Belum
 */
export function statusSesi(nim: string, tanggal: string, sesi: Sesi, data: DataPresensi, now: Date): StatusDetail {
  const fase = faseSesi(sesi, tanggal, now)
  const presensi = data.presensi.find(p => p.nim === nim && p.tanggal === tanggal && p.sesi === sesi.nama)
  if (presensi && presensi.status !== 'Belum') return { status: presensi.status, fase, presensi }
  const libur = cariLibur(tanggal, data.libur)
  if (libur) return { status: 'Libur', fase, libur }
  const izin = cariIzinDisetujui(data.izin, nim, tanggal, sesi.nama)
  if (izin) return { status: 'Izin', fase, izin }
  return { status: fase === 'ditutup' ? 'Tidak Hadir' : 'Belum', fase }
}

export function keteranganStatus(d: StatusDetail): string {
  if (d.presensi) {
    const koreksi = d.presensi.dikoreksiOleh ? ' (dikoreksi fasil)' : ''
    return (d.presensi.keterangan || '') + koreksi
  }
  if (d.libur) return `Libur: ${d.libur.keterangan}`
  if (d.izin) return `Izin: ${d.izin.alasan}`
  return ''
}

export interface RiwayatRow {
  tanggal: string
  sesi: Sesi
  detail: StatusDetail
}

// Riwayat seluruh sesi wajib seorang penghuni; sesi yang belum berlangsung tidak ditampilkan
export function riwayatPenghuni(nim: string, mulai: string, sampai: string, sesiList: Sesi[], data: DataPresensi, now: Date): RiwayatRow[] {
  const rows: RiwayatRow[] = []
  for (const tanggal of dateRangeDesc(mulai, sampai)) {
    for (const sesi of [...sesiAktif(sesiList)].reverse()) {
      const detail = statusSesi(nim, tanggal, sesi, data, now)
      if (detail.status === 'Belum' && detail.fase === 'belum-dibuka') continue
      rows.push({ tanggal, sesi, detail })
    }
  }
  return rows
}

export function hitungStatus(statuses: PresensiStatus[]) {
  const c = { Hadir: 0, Izin: 0, 'Tidak Hadir': 0, Belum: 0, Libur: 0 }
  statuses.forEach(s => { c[s]++ })
  // Persentase kehadiran dihitung dari sesi wajib (libur dan sesi yang masih berjalan tidak dihitung)
  const wajib = c.Hadir + c.Izin + c['Tidak Hadir']
  return { ...c, wajib, persen: wajib > 0 ? Math.round((c.Hadir / wajib) * 100) : 0 }
}

// ---------- Penghuni & kamar ----------

// Penghuni yang wajib presensi: aktif, berperan penghuni, dan menempati kamar
export function penghuniWajibAbsen(list: Penghuni[], namaGedung?: string): Penghuni[] {
  return list.filter(p => p.statusAktif && p.role === 'penghuni' && p.nomorKamar && (!namaGedung || p.namaGedung === namaGedung))
}

export function hunianKamar(kamar: Kamar, penghuni: Penghuni[]): number {
  return penghuni.filter(p => p.statusAktif && p.nomorKamar === kamar.nomorKamar).length
}

export function periodeRekap(today: string, tanggalMasuk?: string, hari = 30): string {
  const awal = addDays(today, -(hari - 1))
  return tanggalMasuk ? maxDate(awal, tanggalMasuk) : awal
}
