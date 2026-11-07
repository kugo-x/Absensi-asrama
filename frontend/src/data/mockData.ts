import type { Gedung, Kamar, Penghuni, PresensiRecord, IzinRecord, Sesi, HariLibur } from '../types'
import { addDays, todayLocal } from '../logic'

// Data cadangan saat backend tidak tersedia; tanggal relatif terhadap hari ini (sama seperti seeder)
export const TODAY = todayLocal()
const hari = (n: number) => addDays(TODAY, n)

export const sesiList: Sesi[] = [
  { id: 1, nama: 'Subuh', jamMulai: '04:00', jamSelesai: '06:00', aktif: true },
  { id: 2, nama: 'Malam', jamMulai: '18:00', jamSelesai: '20:30', aktif: true },
]

export const liburList: HariLibur[] = [
  { id: 1, tanggalMulai: hari(-10), tanggalSelesai: hari(-9), keterangan: 'Libur Maulid Nabi' },
]

export const gedungList: Gedung[] = [
  { id: 1, nama: 'Asrama Putra A', nimPj: '2310936001', namaPj: 'Fitra Rahmad', latitude: -0.914488, longitude: 100.466542, radiusMeter: 50, totalKamar: 6, jenis: 'Putra' },
  { id: 2, nama: 'Asrama Putra B', nimPj: '2310936002', namaPj: 'Dimas Arjuna', latitude: -0.9149, longitude: 100.467, radiusMeter: 50, totalKamar: 2, jenis: 'Putra' },
  { id: 3, nama: 'Asrama Putri A', nimPj: '2310936003', namaPj: 'Sari Dewi Putri', latitude: -0.9135, longitude: 100.4658, radiusMeter: 50, totalKamar: 4, jenis: 'Putri' },
  { id: 4, nama: 'Asrama Putri B', nimPj: null, namaPj: null, latitude: -0.9139, longitude: 100.4661, radiusMeter: 50, totalKamar: 0, jenis: 'Putri' },
]

export const kamarList: Kamar[] = [
  { nomorKamar: '001-PA', lantai: 1, idGedung: 1, namaGedung: 'Asrama Putra A', kapasitas: 1, penghuniCount: 1 },
  { nomorKamar: '101-PA', lantai: 1, idGedung: 1, namaGedung: 'Asrama Putra A', kapasitas: 2, penghuniCount: 2 },
  { nomorKamar: '102-PA', lantai: 1, idGedung: 1, namaGedung: 'Asrama Putra A', kapasitas: 2, penghuniCount: 1 },
  { nomorKamar: '103-PA', lantai: 1, idGedung: 1, namaGedung: 'Asrama Putra A', kapasitas: 2, penghuniCount: 0 },
  { nomorKamar: '201-PA', lantai: 2, idGedung: 1, namaGedung: 'Asrama Putra A', kapasitas: 2, penghuniCount: 1 },
  { nomorKamar: '202-PA', lantai: 2, idGedung: 1, namaGedung: 'Asrama Putra A', kapasitas: 2, penghuniCount: 0 },
  { nomorKamar: '101-PB', lantai: 1, idGedung: 2, namaGedung: 'Asrama Putra B', kapasitas: 3, penghuniCount: 3 },
  { nomorKamar: '102-PB', lantai: 1, idGedung: 2, namaGedung: 'Asrama Putra B', kapasitas: 2, penghuniCount: 0 },
  { nomorKamar: '001-PtA', lantai: 1, idGedung: 3, namaGedung: 'Asrama Putri A', kapasitas: 1, penghuniCount: 1 },
  { nomorKamar: '101-PtA', lantai: 1, idGedung: 3, namaGedung: 'Asrama Putri A', kapasitas: 2, penghuniCount: 2 },
  { nomorKamar: '102-PtA', lantai: 1, idGedung: 3, namaGedung: 'Asrama Putri A', kapasitas: 2, penghuniCount: 1 },
  { nomorKamar: '201-PtA', lantai: 2, idGedung: 3, namaGedung: 'Asrama Putri A', kapasitas: 2, penghuniCount: 1 },
]

export const penghuniList: Penghuni[] = [
  { nim: '2310933001', nama: 'Ahmad Fauzi', nomorKamar: '101-PA', namaGedung: 'Asrama Putra A', asal: 'Padang', email: 'ahmad.fauzi@student.unand.ac.id', noHp: '08123456789', statusAktif: true, role: 'penghuni', tanggalMasuk: hari(-60) },
  { nim: '2310933002', nama: 'Budi Santoso', nomorKamar: '101-PA', namaGedung: 'Asrama Putra A', asal: 'Bukittinggi', email: 'budi.santoso@student.unand.ac.id', noHp: '08987654321', statusAktif: true, role: 'penghuni', tanggalMasuk: hari(-60) },
  { nim: '2310933003', nama: 'Rizky Pratama', nomorKamar: '102-PA', namaGedung: 'Asrama Putra A', asal: 'Payakumbuh', email: 'rizky.pratama@student.unand.ac.id', noHp: '08567890123', statusAktif: true, role: 'penghuni', tanggalMasuk: hari(-60) },
  { nim: '2310933004', nama: 'Dani Kurniawan', nomorKamar: '201-PA', namaGedung: 'Asrama Putra A', asal: 'Solok', email: 'dani.kurniawan@student.unand.ac.id', noHp: '08678901234', statusAktif: true, role: 'penghuni', tanggalMasuk: hari(-60) },
  { nim: '2310933005', nama: 'Eko Saputra', nomorKamar: '101-PB', namaGedung: 'Asrama Putra B', asal: 'Pariaman', email: 'eko.saputra@student.unand.ac.id', noHp: '08345678901', statusAktif: true, role: 'penghuni', tanggalMasuk: hari(-60) },
  { nim: '2310933006', nama: 'Fajar Nugroho', nomorKamar: '101-PB', namaGedung: 'Asrama Putra B', asal: 'Batam', email: 'fajar.nugroho@student.unand.ac.id', noHp: '08456789012', statusAktif: true, role: 'penghuni', tanggalMasuk: hari(-60) },
  { nim: '2310933007', nama: 'Putri Rahayu', nomorKamar: '101-PtA', namaGedung: 'Asrama Putri A', asal: 'Padang Panjang', email: 'putri.rahayu@student.unand.ac.id', noHp: '08234567890', statusAktif: true, role: 'penghuni', tanggalMasuk: hari(-60) },
  { nim: '2310933008', nama: 'Siti Aminah', nomorKamar: '', namaGedung: '', asal: 'Lintau', email: 'siti.aminah@student.unand.ac.id', noHp: '08111223344', statusAktif: false, role: 'penghuni', tanggalMasuk: hari(-60) },
  { nim: '2310933009', nama: 'Novia Rahmawati', nomorKamar: '102-PtA', namaGedung: 'Asrama Putri A', asal: 'Sijunjung', email: 'novia.r@student.unand.ac.id', noHp: '08765432109', statusAktif: true, role: 'penghuni', tanggalMasuk: hari(-60) },
  { nim: '2310933010', nama: 'Indah Permata', nomorKamar: '201-PtA', namaGedung: 'Asrama Putri A', asal: 'Dharmasraya', email: 'indah.p@student.unand.ac.id', noHp: '08543219876', statusAktif: true, role: 'penghuni', tanggalMasuk: hari(-60) },
  { nim: '2310936001', nama: 'Fitra Rahmad', nomorKamar: '001-PA', namaGedung: 'Asrama Putra A', asal: 'Padang', email: 'fitra.rahmad@student.unand.ac.id', noHp: '08111222333', statusAktif: true, role: 'fasil', tanggalMasuk: hari(-400) },
  { nim: '2310936002', nama: 'Dimas Arjuna', nomorKamar: '101-PB', namaGedung: 'Asrama Putra B', asal: 'Bukittinggi', email: 'dimas.arjuna@student.unand.ac.id', noHp: '08111222334', statusAktif: true, role: 'fasil', tanggalMasuk: hari(-400) },
  { nim: '2310936003', nama: 'Sari Dewi Putri', nomorKamar: '001-PtA', namaGedung: 'Asrama Putri A', asal: 'Padang', email: 'sari.dewi@student.unand.ac.id', noHp: '08333444555', statusAktif: true, role: 'fasil', tanggalMasuk: hari(-400) },
]

let nextId = 1
function p(nim: string, offset: number, sesi: string, waktu: string, status: 'Hadir' | 'Tidak Hadir' | 'Izin', keterangan = '', dikoreksiOleh: string | null = null): PresensiRecord {
  const u = penghuniList.find(x => x.nim === nim)!
  const g = gedungList.find(x => x.nama === u.namaGedung)
  const viaGps = status === 'Hadir' && !dikoreksiOleh
  return {
    id: nextId++, nim, namaPenghuni: u.nama, nomorKamar: u.nomorKamar, namaGedung: u.namaGedung,
    tanggal: hari(offset), sesi, waktu,
    latitude: viaGps ? g?.latitude ?? null : null, longitude: viaGps ? g?.longitude ?? null : null,
    status, fotoWajah: '', keterangan, dikoreksiOleh,
  }
}

export const presensiList: PresensiRecord[] = [
  // Kemarin
  p('2310933001', -1, 'Subuh', '05:05', 'Hadir'), p('2310933001', -1, 'Malam', '19:15', 'Hadir'),
  p('2310933002', -1, 'Subuh', '05:20', 'Hadir'), p('2310933002', -1, 'Malam', '19:02', 'Hadir'),
  p('2310933003', -1, 'Subuh', '05:40', 'Hadir'),
  p('2310933005', -1, 'Subuh', '04:58', 'Hadir'), p('2310933005', -1, 'Malam', '18:45', 'Hadir'),
  p('2310933006', -1, 'Malam', '20:10', 'Hadir'),
  p('2310933007', -1, 'Subuh', '05:12', 'Hadir'), p('2310933007', -1, 'Malam', '19:30', 'Hadir'),
  p('2310933009', -1, 'Subuh', '05:22', 'Hadir'),
  p('2310933010', -1, 'Subuh', '05:01', 'Hadir'), p('2310933010', -1, 'Malam', '18:50', 'Hadir'),
  // Dua hari lalu
  p('2310933001', -2, 'Subuh', '05:30', 'Hadir'),
  p('2310933001', -2, 'Malam', '20:00', 'Hadir', 'GPS perangkat bermasalah, hadir dicek langsung', '2310936001'),
  p('2310933002', -2, 'Subuh', '05:10', 'Hadir'), p('2310933002', -2, 'Malam', '19:20', 'Hadir'),
  p('2310933003', -2, 'Malam', '19:44', 'Hadir'),
  p('2310933007', -2, 'Subuh', '05:15', 'Hadir'),
  // Tiga hari lalu
  p('2310933001', -3, 'Subuh', '05:12', 'Hadir'), p('2310933001', -3, 'Malam', '19:05', 'Hadir'),
  p('2310933002', -3, 'Subuh', '05:31', 'Hadir'),
]

export const izinList: IzinRecord[] = [
  { id: 1, nim: '2310933003', namaPenghuni: 'Rizky Pratama', nomorKamar: '102-PA', namaGedung: 'Asrama Putra A', alasan: 'Keluarga sakit, perlu pulang ke rumah untuk merawat ibu', statusPersetujuan: 'Pending', fileBukti: 'surat_keterangan.pdf', tanggal: hari(1), tanggalSelesai: hari(3), sesi: null },
  { id: 2, nim: '2310933004', namaPenghuni: 'Dani Kurniawan', nomorKamar: '201-PA', namaGedung: 'Asrama Putra A', alasan: 'Pulang kampung mengunjungi orang tua', statusPersetujuan: 'Disetujui', fileBukti: 'foto_tiket.jpg', tanggal: hari(-1), tanggalSelesai: hari(1), sesi: null, nimApprover: '2310936001', namaApprover: 'Fitra Rahmad', tanggalApproval: hari(-2), catatanApprover: 'Hati-hati di jalan' },
  { id: 3, nim: '2310933005', namaPenghuni: 'Eko Saputra', nomorKamar: '101-PB', namaGedung: 'Asrama Putra B', alasan: 'Sakit, perlu istirahat di rumah', statusPersetujuan: 'Ditolak', fileBukti: '', tanggal: hari(-4), tanggalSelesai: hari(-4), sesi: null, nimApprover: '2310936002', namaApprover: 'Dimas Arjuna', tanggalApproval: hari(-4), catatanApprover: 'Surat keterangan dokter tidak dilampirkan' },
  { id: 4, nim: '2310933001', namaPenghuni: 'Ahmad Fauzi', nomorKamar: '101-PA', namaGedung: 'Asrama Putra A', alasan: 'Kuliah praktikum malam di laboratorium', statusPersetujuan: 'Disetujui', fileBukti: 'jadwal_praktikum.pdf', tanggal: hari(-4), tanggalSelesai: hari(-4), sesi: 'Malam', nimApprover: '2310936001', namaApprover: 'Fitra Rahmad', tanggalApproval: hari(-5), catatanApprover: '' },
  { id: 5, nim: '2310933009', namaPenghuni: 'Novia Rahmawati', nomorKamar: '102-PtA', namaGedung: 'Asrama Putri A', alasan: 'Kegiatan organisasi di luar kota', statusPersetujuan: 'Pending', fileBukti: 'surat_tugas.pdf', tanggal: hari(2), tanggalSelesai: hari(2), sesi: 'Malam' },
]

// Login credentials for demo
export const DEMO_ACCOUNTS = [
  { nim: 'admin', password: 'admin123', role: 'admin' as const, nama: 'Administrator', email: 'admin@unand.ac.id' },
  { nim: '2310936001', password: 'fasil123', role: 'fasil' as const, nama: 'Fitra Rahmad', email: 'fitra.rahmad@student.unand.ac.id', nomorKamar: '001-PA', idGedung: 1, namaGedung: 'Asrama Putra A', tanggalMasuk: hari(-400) },
  { nim: '2310933001', password: 'penghuni123', role: 'penghuni' as const, nama: 'Ahmad Fauzi', email: 'ahmad.fauzi@student.unand.ac.id', nomorKamar: '101-PA', idGedung: 1, namaGedung: 'Asrama Putra A', tanggalMasuk: hari(-60) },
]
