import type { EventAsrama, Gedung, IzinRecord, ModeUji, PresensiRecord, Sesi } from './types'
import type { Notifikasi } from './components/Notifikasi'
import { formatRentangIzin } from './components/PresensiWidgets'
import { addDays, formatTanggal } from './logic'

/**
 * Notifikasi turunan data yang sudah dimuat setiap halaman (tanpa backend baru).
 * Id dibuat dari keadaan datanya, sehingga perubahan keadaan (mis. foto Menunggu -> Ditolak)
 * menghasilkan notifikasi baru, sedangkan keadaan yang sama tidak muncul dua kali.
 */

const RENTANG_HARI = 14

// ---------- Event (penghuni & fasil) ----------

/**
 * Event yang belum lewat dan dibuat dalam RENTANG_HARI terakhir -> "Event baru".
 * Event hari ini yang belum diabsen penghuni -> pengingat (id per hari, jadi muncul sekali tiap hari).
 * Daftar event dari server sudah dibatasi per peran/gedung; event buatan sendiri tidak diberitahukan.
 */
function notifikasiEvent(eventList: EventAsrama[], nimSaya: string, today: string, jamSekarang: string, pengingatHariIni: boolean): Notifikasi[] {
  const batas = addDays(today, -RENTANG_HARI)
  const out: Notifikasi[] = []
  for (const ev of eventList) {
    const belumLewat = ev.tanggal > today || (ev.tanggal === today && ev.jamSelesai >= jamSekarang)
    if (!belumLewat || ev.createdBy === nimSaya) continue
    const kapan = `${ev.tanggal === today ? 'Hari ini' : formatTanggal(ev.tanggal)}, ${ev.jamMulai}–${ev.jamSelesai}`

    if (pengingatHariIni && ev.tanggal === today && ev.statusKehadiran !== 'Hadir') {
      out.push({
        id: `event-hari-ini-${ev.id}-${today}`,
        jenis: 'peringatan',
        judul: `Hari ini: ${ev.judul}`,
        pesan: `${ev.jamMulai}–${ev.jamSelesai} di ${ev.lokasi}. Jangan lupa absen di lokasi event.`,
        labelWaktu: ev.jamMulai > jamSekarang ? `Mulai ${ev.jamMulai}` : 'Berlangsung',
        tab: 'event',
      })
    }
    // Tanpa tanggal dibuat (data lama) tetap diberitahukan selama event belum lewat
    if (!ev.dibuatPada || ev.dibuatPada.slice(0, 10) >= batas) {
      out.push({
        id: `event-baru-${ev.id}`,
        jenis: 'info',
        judul: `Event baru: ${ev.judul}`,
        pesan: `${kapan} · ${ev.lokasi}${ev.namaPembuat ? ` · oleh ${ev.namaPembuat}` : ''}`,
        waktu: ev.dibuatPada || undefined,
        tab: 'event',
      })
    }
  }
  return out
}

// ---------- Penghuni ----------

export function notifikasiPenghuni(a: {
  nim: string
  presensi: PresensiRecord[]
  izin: IzinRecord[]
  sesiHampirTutup: { sesi: Sesi; sisa: number }[]
  today: string
  eventList: EventAsrama[]
  jamSekarang: string
}): Notifikasi[] {
  const batas = addDays(a.today, -RENTANG_HARI)
  const out: Notifikasi[] = notifikasiEvent(a.eventList, a.nim, a.today, a.jamSekarang, true)

  // Absen event: tercatat (menunggu validasi), diterima, atau ditolak fasil
  for (const ev of a.eventList) {
    // presensiSaya selalu milik penghuni yang login (nim/tanggal bisa kosong pada data lama)
    const pr = ev.presensiSaya
    const tgl = pr?.tanggal || ev.tanggal
    if (!pr || (pr.nim && pr.nim !== a.nim) || tgl < batas || !pr.foto) continue
    const ket = `${ev.judul}, ${formatTanggal(tgl)}${pr.waktu ? ` pukul ${pr.waktu.slice(0, 5)}` : ''}`
    if (pr.statusFoto === 'Ditolak') {
      out.push({
        id: `event-absen-${pr.id}-Ditolak`,
        jenis: 'peringatan',
        judul: 'Foto absen event ditolak',
        pesan: `${ket} — tercatat Tidak Hadir${pr.catatanValidasi ? `. ${pr.catatanValidasi}` : ''}. Anda bisa absen ulang selama event masih berlangsung.`,
        waktu: tgl,
        tab: 'event',
      })
    } else if (pr.statusFoto === 'Diterima') {
      out.push({ id: `event-absen-${pr.id}-Diterima`, jenis: 'sukses', judul: 'Absen event diterima', pesan: ket, waktu: tgl, tab: 'event' })
    } else {
      out.push({ id: `event-absen-${pr.id}-Menunggu`, jenis: 'sukses', judul: 'Absen event tercatat', pesan: `${ket} · menunggu validasi foto oleh fasil`, waktu: pr.waktu ? `${tgl} ${pr.waktu}` : tgl, tab: 'event' })
    }
  }

  for (const { sesi, sisa } of a.sesiHampirTutup) {
    out.push({
      id: `pengingat-${a.today}-${sesi.nama}`,
      jenis: 'peringatan',
      judul: `Sesi ${sesi.nama} segera ditutup`,
      pesan: `Ditutup pukul ${sesi.jamSelesai} WIB dan Anda belum presensi.`,
      labelWaktu: sisa <= 0 ? '< 1 mnt lagi' : `${sisa} mnt lagi`,
      tab: 'presensi',
    })
  }

  for (const i of a.izin) {
    if (i.nim !== a.nim || i.statusPersetujuan === 'Pending' || !i.tanggalApproval || i.tanggalApproval < batas) continue
    const setuju = i.statusPersetujuan === 'Disetujui'
    out.push({
      id: `izin-${i.id}-${i.statusPersetujuan}`,
      jenis: setuju ? 'sukses' : 'peringatan',
      judul: setuju ? 'Izin Anda disetujui' : 'Izin Anda ditolak',
      pesan: `${formatRentangIzin(i.tanggal, i.tanggalSelesai, i.sesi, i.hariBerulang)} — ${i.alasan}${i.catatanApprover ? `. Catatan: ${i.catatanApprover}` : ''}`,
      waktu: i.tanggalApproval,
      tab: 'izin',
    })
  }

  for (const p of a.presensi) {
    if (p.nim !== a.nim || p.tanggal < batas) continue
    const sesi = `Sesi ${p.sesi}, ${formatTanggal(p.tanggal)}`
    if (p.statusFoto === 'Diterima' && p.divalidasiPada) {
      out.push({ id: `foto-${p.id}-Diterima`, jenis: 'sukses', judul: 'Foto presensi diterima', pesan: sesi, waktu: p.divalidasiPada, tab: 'riwayat' })
    } else if (p.statusFoto === 'Ditolak') {
      out.push({
        id: `foto-${p.id}-Ditolak`,
        jenis: 'peringatan',
        judul: 'Foto presensi ditolak',
        pesan: `${sesi} — tercatat Tidak Hadir${p.catatanValidasi ? `. ${p.catatanValidasi}` : ''}`,
        waktu: p.divalidasiPada || p.tanggal,
        tab: 'riwayat',
      })
    } else if (p.otomatis && p.status === 'Tidak Hadir') {
      out.push({
        id: `alpa-${p.id}`,
        jenis: 'peringatan',
        judul: 'Tercatat Tidak Hadir',
        pesan: `${sesi} — tidak ada presensi hingga sesi ditutup.`,
        waktu: `${p.tanggal} ${p.waktu}`,
        tab: 'riwayat',
      })
    } else if (p.dikoreksiOleh && !p.otomatis) {
      out.push({
        id: `koreksi-${p.id}-${p.status}`,
        jenis: 'info',
        judul: `Presensi dikoreksi menjadi ${p.status}`,
        pesan: `${sesi}${p.keterangan ? ` — ${p.keterangan}` : ''}`,
        waktu: p.tanggal,
        tab: 'riwayat',
      })
    }
  }
  return out
}

// ---------- Fasilitator ----------

export function notifikasiFasil(a: {
  nim: string
  izinGedung: IzinRecord[]
  presensiBerfoto: PresensiRecord[]
  sering: { penghuni: { nim: string; nama: string }; c: { 'Tidak Hadir': number } }[]
  batasTidakHadir: number
  eventList: EventAsrama[]
  today: string
  jamSekarang: string
}): Notifikasi[] {
  // Fasil diberi tahu event yang dibuat pihak lain (mis. admin untuk seluruh asrama), tanpa pengingat absen
  const out: Notifikasi[] = notifikasiEvent(a.eventList, a.nim, a.today, a.jamSekarang, false)

  for (const i of a.izinGedung) {
    if (i.statusPersetujuan !== 'Pending') continue
    const ulang = i.idIzinSebelumnya != null
    out.push({
      id: `izin-masuk-${i.id}`,
      jenis: 'permintaan',
      judul: ulang ? `Pengajuan ulang izin dari ${i.namaPenghuni}` : `Permohonan izin dari ${i.namaPenghuni}`,
      pesan: `${formatRentangIzin(i.tanggal, i.tanggalSelesai, i.sesi, i.hariBerulang)} — ${i.alasan}`,
      labelWaktu: 'Menunggu',
      tab: 'izin',
    })
  }

  // Foto terbaru lebih dulu; dibatasi agar daftar tetap ringkas
  const menunggu = a.presensiBerfoto
    .filter(p => p.statusFoto === 'Menunggu')
    .sort((x, y) => `${y.tanggal} ${y.waktu}`.localeCompare(`${x.tanggal} ${x.waktu}`))
    .slice(0, 20)
  for (const p of menunggu) {
    out.push({
      id: `foto-masuk-${p.id}`,
      jenis: 'permintaan',
      judul: `Foto presensi ${p.namaPenghuni} perlu divalidasi`,
      pesan: `Sesi ${p.sesi}, ${formatTanggal(p.tanggal)} pukul ${p.waktu}`,
      waktu: `${p.tanggal} ${p.waktu}`,
      tab: 'foto',
    })
  }

  for (const r of a.sering) {
    const n = r.c['Tidak Hadir']
    out.push({
      id: `sering-alpa-${r.penghuni.nim}-${n}`,
      jenis: 'peringatan',
      judul: `${r.penghuni.nama} sering tidak hadir`,
      pesan: `${n}× Tidak Hadir dalam 30 hari terakhir (ambang ${a.batasTidakHadir}).`,
      labelWaktu: '30 hari',
      tab: 'rekap',
    })
  }
  return out
}

// ---------- Admin ----------

export function notifikasiAdmin(a: {
  passwordDefault: number
  modeUji: ModeUji
  gedung: Gedung[]
  sesi: Sesi[]
  izin: IzinRecord[]
  presensi: PresensiRecord[]
}): Notifikasi[] {
  const out: Notifikasi[] = []
  const perlu = 'Perlu tindakan'

  if (a.passwordDefault > 0) {
    out.push({
      id: `admin-password-${a.passwordDefault}`,
      jenis: 'peringatan',
      judul: `${a.passwordDefault} akun masih memakai password default`,
      pesan: 'Minta penghuni segera mengganti password melalui menu Profil.',
      labelWaktu: perlu,
      tab: 'penghuni',
    })
  }
  if (a.modeUji.abaikanJam || a.modeUji.abaikanRadius) {
    out.push({
      id: `admin-modeuji-${a.modeUji.abaikanJam}-${a.modeUji.abaikanRadius}`,
      jenis: 'peringatan',
      judul: 'Mode uji absensi masih aktif',
      pesan: [a.modeUji.abaikanJam && 'Jam sesi diabaikan', a.modeUji.abaikanRadius && 'radius GPS diabaikan'].filter(Boolean).join(', ') + '. Matikan setelah selesai mencoba.',
      labelWaktu: perlu,
      tab: 'pengaturan',
    })
  }
  if (!a.sesi.some(s => s.aktif)) {
    out.push({ id: 'admin-sesi-kosong', jenis: 'peringatan', judul: 'Belum ada sesi presensi aktif', pesan: 'Atur jadwal sesi agar penghuni dapat melakukan presensi.', labelWaktu: perlu, tab: 'pengaturan' })
  }
  for (const g of a.gedung) {
    if (g.latitude === null || g.longitude === null) {
      out.push({ id: `admin-gps-${g.id}`, jenis: 'peringatan', judul: `Koordinat ${g.nama} belum diatur`, pesan: 'Penghuni gedung ini belum dapat presensi mandiri.', labelWaktu: perlu, tab: 'gedung' })
    }
    if (!g.nimPj) {
      out.push({ id: `admin-pj-${g.id}`, jenis: 'peringatan', judul: `${g.nama} belum punya fasilitator`, pesan: 'Tetapkan PJ gedung agar izin & foto presensi dapat divalidasi.', labelWaktu: perlu, tab: 'gedung' })
    }
  }

  const izinPending = a.izin.filter(i => i.statusPersetujuan === 'Pending').length
  if (izinPending > 0) {
    out.push({ id: `admin-izin-${izinPending}`, jenis: 'info', judul: `${izinPending} permohonan izin menunggu fasilitator`, labelWaktu: 'Menunggu', tab: 'presensi' })
  }
  const fotoPending = a.presensi.filter(p => p.statusFoto === 'Menunggu').length
  if (fotoPending > 0) {
    out.push({ id: `admin-foto-${fotoPending}`, jenis: 'info', judul: `${fotoPending} foto presensi belum divalidasi`, pesan: 'Validasi dilakukan oleh fasilitator gedung masing-masing.', labelWaktu: 'Menunggu', tab: 'presensi' })
  }
  return out
}
