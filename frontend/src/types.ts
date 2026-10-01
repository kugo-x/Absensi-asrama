export type Role = 'admin' | 'fasil' | 'penghuni'
export type SessionType = 'Subuh' | 'Malam'
export type PresensiStatus = 'Hadir' | 'Tidak Hadir' | 'Izin' | 'Belum'
export type IzinStatus = 'Pending' | 'Disetujui' | 'Ditolak'

export interface CurrentUser {
  nim: string
  nama: string
  role: Role
  nomorKamar?: string
  namaGedung?: string
  email: string
}

export interface Gedung {
  id: number
  nama: string
  nimPj: string
  namaPj: string
  radiusMeter: number
  totalKamar: number
  jenis: 'Putra' | 'Putri'
}

export interface Kamar {
  nomorKamar: string
  lantai: number
  idGedung: number
  namaGedung: string
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
  angkatan: string
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
  status: PresensiStatus
  keterangan: string
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
  tanggalAkhir: string
  tanggalApproval?: string
  keteranganPenolakan?: string
}
