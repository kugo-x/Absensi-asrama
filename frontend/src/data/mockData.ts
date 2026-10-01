import type { Gedung, Kamar, Penghuni, PresensiRecord, IzinRecord } from '../types'

export const TODAY = '2026-09-24'

export const gedungList: Gedung[] = [
  { id: 1, nama: 'Asrama Putra A', nimPj: '2310936001', namaPj: 'Fitra Rahmad', radiusMeter: 50, totalKamar: 20, jenis: 'Putra' },
  { id: 2, nama: 'Asrama Putra B', nimPj: '2310936002', namaPj: 'Dimas Arjuna', radiusMeter: 50, totalKamar: 18, jenis: 'Putra' },
  { id: 3, nama: 'Asrama Putri A', nimPj: '2310936003', namaPj: 'Sari Dewi Putri', radiusMeter: 50, totalKamar: 22, jenis: 'Putri' },
  { id: 4, nama: 'Asrama Putri B', nimPj: '2310936004', namaPj: 'Nurul Hidayah', radiusMeter: 50, totalKamar: 20, jenis: 'Putri' },
]

export const kamarList: Kamar[] = [
  { nomorKamar: '101-PA', lantai: 1, idGedung: 1, namaGedung: 'Asrama Putra A', penghuniCount: 2 },
  { nomorKamar: '102-PA', lantai: 1, idGedung: 1, namaGedung: 'Asrama Putra A', penghuniCount: 2 },
  { nomorKamar: '103-PA', lantai: 1, idGedung: 1, namaGedung: 'Asrama Putra A', penghuniCount: 1 },
  { nomorKamar: '201-PA', lantai: 2, idGedung: 1, namaGedung: 'Asrama Putra A', penghuniCount: 2 },
  { nomorKamar: '202-PA', lantai: 2, idGedung: 1, namaGedung: 'Asrama Putra A', penghuniCount: 2 },
  { nomorKamar: '101-PB', lantai: 1, idGedung: 2, namaGedung: 'Asrama Putra B', penghuniCount: 2 },
  { nomorKamar: '102-PB', lantai: 1, idGedung: 2, namaGedung: 'Asrama Putra B', penghuniCount: 2 },
  { nomorKamar: '101-PtA', lantai: 1, idGedung: 3, namaGedung: 'Asrama Putri A', penghuniCount: 2 },
  { nomorKamar: '102-PtA', lantai: 1, idGedung: 3, namaGedung: 'Asrama Putri A', penghuniCount: 2 },
  { nomorKamar: '201-PtA', lantai: 2, idGedung: 3, namaGedung: 'Asrama Putri A', penghuniCount: 2 },
]

export const penghuniList: Penghuni[] = [
  { nim: '2310933001', nama: 'Ahmad Fauzi', nomorKamar: '101-PA', namaGedung: 'Asrama Putra A', asal: 'Padang', email: 'ahmad.fauzi@student.unand.ac.id', noHp: '08123456789', statusAktif: true, role: 'penghuni', angkatan: '2023' },
  { nim: '2310933002', nama: 'Budi Santoso', nomorKamar: '101-PA', namaGedung: 'Asrama Putra A', asal: 'Bukittinggi', email: 'budi.santoso@student.unand.ac.id', noHp: '08987654321', statusAktif: true, role: 'penghuni', angkatan: '2023' },
  { nim: '2310933003', nama: 'Rizky Pratama', nomorKamar: '102-PA', namaGedung: 'Asrama Putra A', asal: 'Payakumbuh', email: 'rizky.pratama@student.unand.ac.id', noHp: '08567890123', statusAktif: true, role: 'penghuni', angkatan: '2023' },
  { nim: '2310933004', nama: 'Dani Kurniawan', nomorKamar: '201-PA', namaGedung: 'Asrama Putra A', asal: 'Solok', email: 'dani.kurniawan@student.unand.ac.id', noHp: '08678901234', statusAktif: true, role: 'penghuni', angkatan: '2023' },
  { nim: '2310933005', nama: 'Eko Saputra', nomorKamar: '101-PB', namaGedung: 'Asrama Putra B', asal: 'Pariaman', email: 'eko.saputra@student.unand.ac.id', noHp: '08345678901', statusAktif: true, role: 'penghuni', angkatan: '2023' },
  { nim: '2310933006', nama: 'Fajar Nugroho', nomorKamar: '101-PB', namaGedung: 'Asrama Putra B', asal: 'Batam', email: 'fajar.nugroho@student.unand.ac.id', noHp: '08456789012', statusAktif: true, role: 'penghuni', angkatan: '2023' },
  { nim: '2310933007', nama: 'Putri Rahayu', nomorKamar: '101-PtA', namaGedung: 'Asrama Putri A', asal: 'Padang Panjang', email: 'putri.rahayu@student.unand.ac.id', noHp: '08234567890', statusAktif: true, role: 'penghuni', angkatan: '2023' },
  { nim: '2310933008', nama: 'Siti Aminah', nomorKamar: '101-PtA', namaGedung: 'Asrama Putri A', asal: 'Lintau', email: 'siti.aminah@student.unand.ac.id', noHp: '08111223344', statusAktif: false, role: 'penghuni', angkatan: '2023' },
  { nim: '2310933009', nama: 'Novia Rahmawati', nomorKamar: '102-PtA', namaGedung: 'Asrama Putri A', asal: 'Sijunjung', email: 'novia.r@student.unand.ac.id', noHp: '08765432109', statusAktif: true, role: 'penghuni', angkatan: '2023' },
  { nim: '2310933010', nama: 'Indah Permata', nomorKamar: '201-PtA', namaGedung: 'Asrama Putri A', asal: 'Dharmasraya', email: 'indah.p@student.unand.ac.id', noHp: '08543219876', statusAktif: true, role: 'penghuni', angkatan: '2023' },
  { nim: '2310936001', nama: 'Fitra Rahmad', nomorKamar: '001-PA', namaGedung: 'Asrama Putra A', asal: 'Padang', email: 'fitra.rahmad@student.unand.ac.id', noHp: '08111222333', statusAktif: true, role: 'fasil', angkatan: '2022' },
  { nim: '2310936003', nama: 'Sari Dewi Putri', nomorKamar: '001-PtA', namaGedung: 'Asrama Putri A', asal: 'Padang', email: 'sari.dewi@student.unand.ac.id', noHp: '08333444555', statusAktif: true, role: 'fasil', angkatan: '2022' },
]

export const presensiList: PresensiRecord[] = [
  // Today subuh
  { id: 1, nim: '2310933001', namaPenghuni: 'Ahmad Fauzi', nomorKamar: '101-PA', namaGedung: 'Asrama Putra A', tanggal: TODAY, sesi: 'Subuh', waktu: '05:12', status: 'Hadir', keterangan: '' },
  { id: 2, nim: '2310933002', namaPenghuni: 'Budi Santoso', nomorKamar: '101-PA', namaGedung: 'Asrama Putra A', tanggal: TODAY, sesi: 'Subuh', waktu: '05:30', status: 'Hadir', keterangan: '' },
  { id: 3, nim: '2310933003', namaPenghuni: 'Rizky Pratama', nomorKamar: '102-PA', namaGedung: 'Asrama Putra A', tanggal: TODAY, sesi: 'Subuh', waktu: '', status: 'Tidak Hadir', keterangan: '' },
  { id: 4, nim: '2310933004', namaPenghuni: 'Dani Kurniawan', nomorKamar: '201-PA', namaGedung: 'Asrama Putra A', tanggal: TODAY, sesi: 'Subuh', waktu: '', status: 'Izin', keterangan: 'Pulang kampung' },
  { id: 5, nim: '2310933005', namaPenghuni: 'Eko Saputra', nomorKamar: '101-PB', namaGedung: 'Asrama Putra B', tanggal: TODAY, sesi: 'Subuh', waktu: '04:55', status: 'Hadir', keterangan: '' },
  { id: 6, nim: '2310933006', namaPenghuni: 'Fajar Nugroho', nomorKamar: '101-PB', namaGedung: 'Asrama Putra B', tanggal: TODAY, sesi: 'Subuh', waktu: '05:40', status: 'Hadir', keterangan: '' },
  { id: 7, nim: '2310933007', namaPenghuni: 'Putri Rahayu', nomorKamar: '101-PtA', namaGedung: 'Asrama Putri A', tanggal: TODAY, sesi: 'Subuh', waktu: '05:20', status: 'Hadir', keterangan: '' },
  { id: 8, nim: '2310933008', namaPenghuni: 'Siti Aminah', nomorKamar: '101-PtA', namaGedung: 'Asrama Putri A', tanggal: TODAY, sesi: 'Subuh', waktu: '', status: 'Tidak Hadir', keterangan: '' },
  { id: 9, nim: '2310933009', namaPenghuni: 'Novia Rahmawati', nomorKamar: '102-PtA', namaGedung: 'Asrama Putri A', tanggal: TODAY, sesi: 'Subuh', waktu: '05:10', status: 'Hadir', keterangan: '' },
  { id: 10, nim: '2310933010', namaPenghuni: 'Indah Permata', nomorKamar: '201-PtA', namaGedung: 'Asrama Putri A', tanggal: TODAY, sesi: 'Subuh', waktu: '05:25', status: 'Hadir', keterangan: '' },
  // Yesterday
  { id: 11, nim: '2310933001', namaPenghuni: 'Ahmad Fauzi', nomorKamar: '101-PA', namaGedung: 'Asrama Putra A', tanggal: '2026-09-23', sesi: 'Subuh', waktu: '05:05', status: 'Hadir', keterangan: '' },
  { id: 12, nim: '2310933001', namaPenghuni: 'Ahmad Fauzi', nomorKamar: '101-PA', namaGedung: 'Asrama Putra A', tanggal: '2026-09-23', sesi: 'Malam', waktu: '19:15', status: 'Hadir', keterangan: '' },
  { id: 13, nim: '2310933001', namaPenghuni: 'Ahmad Fauzi', nomorKamar: '101-PA', namaGedung: 'Asrama Putra A', tanggal: '2026-09-22', sesi: 'Subuh', waktu: '05:30', status: 'Hadir', keterangan: '' },
  { id: 14, nim: '2310933001', namaPenghuni: 'Ahmad Fauzi', nomorKamar: '101-PA', namaGedung: 'Asrama Putra A', tanggal: '2026-09-22', sesi: 'Malam', waktu: '', status: 'Tidak Hadir', keterangan: '' },
  { id: 15, nim: '2310933001', namaPenghuni: 'Ahmad Fauzi', nomorKamar: '101-PA', namaGedung: 'Asrama Putra A', tanggal: '2026-09-21', sesi: 'Subuh', waktu: '', status: 'Izin', keterangan: 'Sakit' },
  { id: 16, nim: '2310933001', namaPenghuni: 'Ahmad Fauzi', nomorKamar: '101-PA', namaGedung: 'Asrama Putra A', tanggal: '2026-09-21', sesi: 'Malam', waktu: '', status: 'Izin', keterangan: 'Sakit' },
]

export const izinList: IzinRecord[] = [
  { id: 1, nim: '2310933003', namaPenghuni: 'Rizky Pratama', nomorKamar: '102-PA', namaGedung: 'Asrama Putra A', alasan: 'Keluarga sakit, perlu pulang ke rumah untuk merawat ibu', statusPersetujuan: 'Pending', fileBukti: 'surat_dokter.pdf', tanggal: TODAY, tanggalAkhir: '2026-09-26' },
  { id: 2, nim: '2310933008', namaPenghuni: 'Siti Aminah', nomorKamar: '101-PtA', namaGedung: 'Asrama Putri A', alasan: 'Wisuda kakak di Padang Panjang, diminta hadir oleh keluarga', statusPersetujuan: 'Disetujui', fileBukti: 'undangan_wisuda.jpg', tanggal: '2026-09-22', tanggalAkhir: '2026-09-23', nimApprover: '2310936003', namaApprover: 'Sari Dewi Putri', tanggalApproval: '2026-09-21' },
  { id: 3, nim: '2310933004', namaPenghuni: 'Dani Kurniawan', nomorKamar: '201-PA', namaGedung: 'Asrama Putra A', alasan: 'Pulang kampung mengunjungi orang tua yang sudah lama tidak dikunjungi', statusPersetujuan: 'Disetujui', fileBukti: 'foto_tiket.jpg', tanggal: TODAY, tanggalAkhir: '2026-09-25', nimApprover: '2310936001', namaApprover: 'Fitra Rahmad', tanggalApproval: '2026-09-23' },
  { id: 4, nim: '2310933005', namaPenghuni: 'Eko Saputra', nomorKamar: '101-PB', namaGedung: 'Asrama Putra B', alasan: 'Sakit, perlu istirahat di rumah', statusPersetujuan: 'Ditolak', fileBukti: '', tanggal: '2026-09-20', tanggalAkhir: '2026-09-21', nimApprover: '2310936001', namaApprover: 'Fitra Rahmad', tanggalApproval: '2026-09-20', keteranganPenolakan: 'Bukti surat dokter tidak dilampirkan' },
  { id: 5, nim: '2310933001', namaPenghuni: 'Ahmad Fauzi', nomorKamar: '101-PA', namaGedung: 'Asrama Putra A', alasan: 'Sakit demam, perlu berobat ke rumah', statusPersetujuan: 'Disetujui', fileBukti: 'surat_dokter_2.pdf', tanggal: '2026-09-21', tanggalAkhir: '2026-09-21', nimApprover: '2310936001', namaApprover: 'Fitra Rahmad', tanggalApproval: '2026-09-21' },
]

// Login credentials for demo
export const DEMO_ACCOUNTS = [
  { nim: 'admin', password: 'admin123', role: 'admin' as const, nama: 'Administrator', email: 'admin@unand.ac.id' },
  { nim: '2310936001', password: 'fasil123', role: 'fasil' as const, nama: 'Fitra Rahmad', email: 'fitra.rahmad@student.unand.ac.id', nomorKamar: '001-PA', namaGedung: 'Asrama Putra A' },
  { nim: '2310933001', password: 'penghuni123', role: 'penghuni' as const, nama: 'Ahmad Fauzi', email: 'ahmad.fauzi@student.unand.ac.id', nomorKamar: '101-PA', namaGedung: 'Asrama Putra A' },
]
