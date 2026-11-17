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
  noHp?: string
  asal?: string
  tanggalMasuk?: string
  token?: string
  fotoProfil?: string
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
  passwordDefault?: boolean
}

export interface Sesi {
  id: number
  nama: string
  jamMulai: string // HH:MM
  jamSelesai: string // HH:MM
  aktif: boolean
  // YYYY-MM-DD sesi dibuat; sebelum tanggal ini sesi belum menjadi kewajiban presensi
  berlakuSejak?: string
  // null/undefined = sesi global (diatur admin, semua gedung).
  // Terisi = sesi khusus satu gedung (mis. absen Malam yang diatur fasil PJ gedung).
  idGedung?: number | null
  namaGedung?: string | null
  diaturOleh?: string | null
  namaPengatur?: string | null
  // Pengecualian per hari untuk sesi gedung (hari tanpa entri memakai jamMulai/jamSelesai)
  jadwalHari?: JadwalHari[]
}

// 1 = Senin … 7 = Minggu (ISO-8601)
export type HariIso = 1 | 2 | 3 | 4 | 5 | 6 | 7

export interface JadwalHari {
  hari: HariIso
  aktif: boolean // false = tidak ada absen pada hari itu
  jamMulai: string | null
  jamSelesai: string | null
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

// Aturan presensi yang diatur admin (tabel pengaturan)
export interface AturanPresensi {
  gpsAkurasiMaks: number // meter, 0 = tidak diperiksa
  batasTidakHadir: number // Tidak Hadir dalam 30 hari sebelum fasil diperingatkan
  pengingatMenit: number // banner pengingat N menit sebelum sesi ditutup, 0 = mati
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
  // Radius ketidakpastian lokasi yang dilaporkan perangkat saat presensi (meter)
  akurasiMeter?: number | null
  status: PresensiStatus
  fotoWajah: string
  keterangan: string
  dikoreksiOleh?: string | null
  // Validasi foto wajah oleh fasil; null = presensi tanpa foto (koreksi / otomatis)
  statusFoto?: StatusFoto | null
  catatanValidasi?: string
  divalidasiOleh?: string | null
  namaValidator?: string | null
  divalidasiPada?: string
  // true = dibuat command presensi:tandai-alpa dan belum dikoreksi fasil
  otomatis?: boolean
}

export type StatusFoto = 'Menunggu' | 'Diterima' | 'Ditolak'

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
  // Izin rutin: hanya berlaku pada hari-hari ini dalam rentang tanggal; null = setiap hari
  hariBerulang?: HariIso[] | null
  catatanApprover?: string
  tanggalApproval?: string
  // Pengajuan ulang: id izin lama yang ditolak, beserta catatan penolakannya
  idIzinSebelumnya?: number | null
  catatanSebelumnya?: string
}

// ----------------------------------------------------
// Modul 2: Gedung, Kamar & Event Asrama
// ----------------------------------------------------

export interface GedungInput {
  nama: string
  nimPj?: string | null
  latitude?: number | null
  longitude?: number | null
  radiusMeter?: number
}

export interface KamarInput {
  nomorKamar: string
  lantai: number
  kapasitas: number
  idGedung: number
}

export type EventTipe = 'seluruh' | 'gedung'

export interface EventAsrama {
  id: number
  judul: string
  deskripsi: string | null
  tipe: EventTipe
  idGedung: number | null
  namaGedung?: string | null
  tanggal: string // YYYY-MM-DD
  jamMulai: string // HH:MM
  jamSelesai: string // HH:MM
  lokasi: string
  latitude: number | null
  longitude: number | null
  radiusMeter: number
  createdBy?: string | null
  namaPembuat?: string | null
  statusKehadiran?: 'Hadir' | 'Tidak Hadir' | 'Belum Absen'
  presensiSaya?: PresensiEventRecord | null
}

export interface PresensiEventRecord {
  id: number
  idEvent: number
  nim: string
  namaPenghuni?: string
  nomorKamar?: string
  namaGedung?: string
  tanggal: string
  waktu: string | null
  latitude: number | null
  longitude: number | null
  jarakMeter: number | null
  foto: string | null
  status: 'Hadir' | 'Tidak Hadir'
  keterangan: string | null
}

export interface PesertaRekapEvent {
  nim: string
  nama: string
  nomorKamar: string
  namaGedung: string
  status: 'Hadir' | 'Tidak Hadir' | 'Belum Absen'
  waktu: string | null
  jarakMeter: number | null
  foto: string | null
  keterangan: string | null
}

export interface RekapEventResult {
  event: EventAsrama
  statistik: {
    totalPeserta: number
    hadir: number
    tidakHadir: number
    belumAbsen: number
    persenHadir: number
  }
  peserta: PesertaRekapEvent[]
}
