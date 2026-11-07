export type Role = 'admin' | 'fasil' | 'penghuni'
// Nama sesi mengikuti tabel `sesi` (misal: Subuh, Malam) sehingga bisa diatur admin
export type SessionType = string
export type PresensiStatus = 'Hadir' | 'Tidak Hadir' | 'Izin' | 'Belum' | 'Libur'
export type IzinStatus = 'Pending' | 'Disetujui' | 'Ditolak'

export interface CurrentUser {
  nim: string
  nama: string
  role: Role
  nomorKamar?: string
  idGedung?: number
  namaGedung?: string
  email: string
  tanggalMasuk?: string
}

export interface Gedung {
  id: number
  nama: string
  nimPj: string | null
  namaPj: string | null
  latitude: number | null
  longitude: number | null
  radiusMeter: number
  totalKamar: number
  jenis: 'Putra' | 'Putri'
}

export interface Kamar {
  nomorKamar: string
  lantai: number
  idGedung: number
  namaGedung: string
  kapasitas: number
  penghuniCount: number
}

export interface Penghuni {
  nim: string
  nama: string
  nomorKamar: string
  namaGedung: string
  asal: string
  email: string
  noHp: string
  statusAktif: boolean
  role: 'penghuni' | 'fasil'
  tanggalMasuk: string
}

export interface Sesi {
  id: number
  nama: string
  jamMulai: string // HH:MM
  jamSelesai: string // HH:MM
  aktif: boolean
}

export interface HariLibur {
  id: number
  tanggalMulai: string
  tanggalSelesai: string
  keterangan: string
}

// Pengecualian aturan presensi yang diaktifkan admin untuk mencoba fitur absensi
export interface ModeUji {
  abaikanJam: boolean
  abaikanRadius: boolean
}

export interface PresensiRecord {
  id: number
  nim: string
  namaPenghuni: string
  nomorKamar: string
  namaGedung: string
  tanggal: string
  sesi: SessionType
  waktu: string
  latitude: number | null
  longitude: number | null
  status: PresensiStatus
  fotoWajah: string
  keterangan: string
  dikoreksiOleh?: string | null
}

export interface IzinRecord {
  id: number
  nim: string
  namaPenghuni: string
  nomorKamar: string
  namaGedung: string
  nimApprover?: string
  namaApprover?: string
  alasan: string
  statusPersetujuan: IzinStatus
  fileBukti: string
  tanggal: string
  tanggalSelesai: string
  // null = berlaku untuk seluruh sesi pada rentang tanggal
  sesi: string | null
  catatanApprover?: string
  tanggalApproval?: string
}
