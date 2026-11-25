import { useState, useEffect, useRef } from 'react'
import HasilAbsen, { type HasilAbsenData } from '../components/HasilAbsen'
import type { AturanPresensi, CurrentUser, EventAsrama, Gedung, HariIso, HariLibur, IzinRecord, ModeUji, PresensiRecord, PresensiStatus, Sesi, StatusFoto, Pengumuman, RiwayatDitolak } from '../types'
import AppLayout, { StatCard, SectionTitle, Badge, ConfirmDialog } from '../components/AppLayout'
import { BuktiIzin, FotoBadge, KotakTanggalIzin, SesiIcon, TAMPILAN_STATUS_IZIN, formatRentangIzin } from '../components/PresensiWidgets'
import KameraWajah from '../components/KameraWajah'
import { notifikasiPenghuni } from '../notifikasiPeran'
import DateInput from '../components/DateInput'
import PilihBeberapaTanggal from '../components/PilihBeberapaTanggal'
import {
  presensiList as initialPresensi,
  izinList as initialIzin,
  gedungList as initialGedung,
  sesiList as initialSesi,
  liburList as initialLibur,
  eventList as initialEvent,
  presensiEventList as initialPresensiEvent,
} from '../data/mockData'
import {
  awalDemo, fetchPresensi, checkInApi, fetchIzin, submitIzinApi, batalIzinApi, adalahBuktiTersimpan, fetchGedung, fetchSesi,
  fetchLibur, fetchModeUji, MODE_UJI_MATI, fetchAturanPresensi, ATURAN_PRESENSI_DEFAULT,
  fetchEvent, absenEventApi, fetchFotoEvent, fetchPengumuman, fetchRiwayatDitolak } from '../api'
import KalenderKehadiran from '../components/KalenderKehadiran'
import { useRealtime, bilaBerubah } from '../realtime'
import KartuEvent from '../components/KartuEvent'
import { KartuGantiPassword, KartuProfil, ProfilHeader } from '../components/ProfilAkun'
import { EventPresensiModal } from '../components/EventModals'
import { PengumumanPenghuni } from '../components/Pengumuman'
import Pratinjau from '../components/Pratinjau'
import { distanceMeters, getCurrentPosition, type GpsPosition } from '../geo'
import {
  cariLibur, formatTanggal, jamPresensi, hitungStatus, keteranganStatus, periodeRekap, riwayatPenghuni,
  faseSesi, sesiAktif, statusSesi, toHM, todayLocal, type DataPresensi, type RiwayatRow, type StatusDetail,
  SEMUA_HARI, adaHariDalamRentang, hariIso, dateRangeDesc, formatRentangTanggal, teksHariBerulang, kelompokkanTanggal, HARI_RINGKASAN } from '../logic'
import {
  LayoutDashboard,
  UserCheck,
  History,
  FileText,
  User,
  MapPin,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Paperclip,
  Send,
  DoorClosed,
  Building,
  Clock,
  Sparkles,
  ShieldCheck,
  Mail,
  Compass,
  RefreshCw,
  Bell,
  Palmtree,
  Camera,
  ArrowRight,
  CalendarDays,
  Search,
  Plus,
  X,
} from 'lucide-react'

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-[18px] h-[18px]" /> },
  { id: 'presensi', label: 'Presensi Mandiri', icon: <UserCheck className="w-[18px] h-[18px]" /> },
  { id: 'event', label: 'Event Asrama', icon: <CalendarDays className="w-[18px] h-[18px]" /> },
  { id: 'riwayat', label: 'Riwayat Saya', icon: <History className="w-[18px] h-[18px]" /> },
  { id: 'izin', label: 'Pengajuan Izin', icon: <FileText className="w-[18px] h-[18px]" /> },
  { id: 'profil', label: 'Profil Saya', icon: <User className="w-[18px] h-[18px]" /> },
]

export interface GpsState {
  status: 'idle' | 'loading' | 'ok' | 'error'
  position?: GpsPosition
  distance?: number
  error?: string
}

export interface Notice {
  type: 'success' | 'error'
  text: string
}

interface SesiHariIni {
  sesi: Sesi
  detail: StatusDetail
}

function findGedung(list: Gedung[], user: CurrentUser): Gedung | null {
  return list.find(g => g.id === user.idGedung) || list.find(g => g.nama === user.namaGedung) || null
}

function hasKoordinat(g: Gedung | null): g is Gedung & { latitude: number; longitude: number } {
  return !!g && g.latitude !== null && g.longitude !== null
}

// Presensi hanya bisa dilakukan saat sesi dibuka dan belum ada status (bukan izin / libur / sudah hadir)
// Sisa menit hingga jam HH:MM hari ini (dibulatkan ke atas)
function sisaMenit(jam: string, now: Date): number {
  const [h, m] = jam.split(':').map(Number)
  const detik = (h * 60 + m) * 60 - (now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds())
  return Math.ceil(detik / 60)
}

// Foto ditolak fasil saat sesi masih dibuka -> boleh absen ulang
function bisaAbsenUlang(d: StatusDetail) {
  return d.fase === 'dibuka' && d.status === 'Tidak Hadir' && d.presensi?.statusFoto === 'Ditolak' && !d.presensi.otomatis
}

function bisaPresensi(d: StatusDetail) {
  return (d.status === 'Belum' && d.fase === 'dibuka') || bisaAbsenUlang(d)
}

function alasanTidakBisaPresensi(d: StatusDetail, sesi: Sesi): string {
  if (d.status === 'Hadir') return 'Presensi sesi ini sudah tercatat'
  if (d.status === 'Izin') return 'Anda berstatus izin pada sesi ini'
  if (d.status === 'Libur') return 'Hari libur, tidak ada kewajiban presensi'
  if (d.status === 'Tidak Hadir' && d.presensi?.statusFoto === 'Ditolak') return 'Foto ditolak dan sesi sudah ditutup'
  if (d.status === 'Tidak Hadir') return 'Sesi sudah lewat'
  if (d.fase === 'belum-dibuka') return `Sesi dibuka pukul ${sesi.jamMulai} WIB`
  return ''
}

function getStatusEvent(ev: EventAsrama, today: string, now: Date): 'Akan Datang' | 'Sedang Berlangsung' | 'Selesai' {
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  if (ev.tanggal > today) return 'Akan Datang'
  if (ev.tanggal < today) return 'Selesai'
  if (currentTime < ev.jamMulai) return 'Akan Datang'
  if (currentTime > ev.jamSelesai) return 'Selesai'
  return 'Sedang Berlangsung'
}

export default function PenghuniPage({ user, onLogout }: { user: CurrentUser; onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [presensi, setPresensi] = useState<PresensiRecord[]>(awalDemo(initialPresensi))
  const [izinData, setIzinData] = useState<IzinRecord[]>(initialIzin.filter(i => i.nim === user.nim))
  const [sesiList, setSesiList] = useState<Sesi[]>(awalDemo(initialSesi))
  const [libur, setLibur] = useState<HariLibur[]>(awalDemo(initialLibur))
  const [gedung, setGedung] = useState<Gedung | null>(findGedung(initialGedung, user))
  const [eventList, setEventList] = useState<EventAsrama[]>(() => {
    const base = awalDemo(initialEvent)
    return base.map(ev => {
      const pr = initialPresensiEvent.find(p => p.idEvent === ev.id && p.nim === user.nim)
      return {
        ...ev,
        statusKehadiran: pr ? (pr.status as 'Hadir' | 'Tidak Hadir') : (ev.statusKehadiran ?? 'Belum Absen'),
        presensiSaya: pr ?? ev.presensiSaya ?? null,
      }
    })
  })
  const [presensiModalEvent, setPresensiModalEvent] = useState<EventAsrama | null>(null)
  const [gps, setGps] = useState<GpsState>({ status: 'idle' })
  const [notice, setNotice] = useState<Notice | null>(null)
  const [hasilAbsen, setHasilAbsen] = useState<HasilAbsenData | null>(null)
  const [checkingIn, setCheckingIn] = useState(false)
  const [foto, setFoto] = useState<string | null>(null)
  const [sesiAwal, setSesiAwal] = useState('')
  const [modeUji, setModeUji] = useState<ModeUji>(MODE_UJI_MATI)
  const [aturan, setAturan] = useState<AturanPresensi>(ATURAN_PRESENSI_DEFAULT)
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    // Perbarui jam agar status sesi (dibuka / ditutup) ikut berubah
    const timer = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(timer)
  }, [])

  // Realtime: keputusan izin, validasi foto, event, jadwal & libur ikut berubah tanpa refresh
  useRealtime(() => {
    setNow(new Date())
    fetchPresensi().then(bilaBerubah(setPresensi))
    fetchIzin().then(data => bilaBerubah(setIzinData)(data.filter(i => i.nim === user.nim)))
    fetchEvent().then(bilaBerubah(setEventList))
    fetchSesi().then(bilaBerubah(setSesiList))
    fetchLibur().then(bilaBerubah(setLibur))
    fetchModeUji().then(bilaBerubah(setModeUji))
    fetchPengumuman().then(bilaBerubah(setPengumuman))
    fetchRiwayatDitolak().then(bilaBerubah(setDitolak))
  })
  // Pengumuman yang berlaku untuk gedung penghuni (server sudah menyaring yang kedaluwarsa)
  const [pengumuman, setPengumuman] = useState<Pengumuman[]>([])
  useEffect(() => { fetchPengumuman().then(setPengumuman) }, [])
  // Percobaan absen yang ditolak lalu diulang: tetap tampil di log riwayat sebagai baris tersendiri
  const [ditolak, setDitolak] = useState<RiwayatDitolak[]>([])
  useEffect(() => { fetchRiwayatDitolak().then(setDitolak) }, [])

  useEffect(() => {
    fetchPresensi().then(setPresensi)
    fetchIzin().then(data => setIzinData(data.filter(i => i.nim === user.nim)))
    fetchSesi().then(setSesiList)
    fetchLibur().then(setLibur)
    fetchModeUji().then(setModeUji)
    fetchAturanPresensi().then(setAturan)
    // Daftar kosong dari server juga dipakai, agar event yang sudah dihapus ikut hilang
    fetchEvent().then(setEventList)
    fetchGedung().then(list => {
      const g = findGedung(list, user)
      setGedung(g)
      readLocation(g)
    })
  }, [user.nim])

  const today = todayLocal()
  const data: DataPresensi = { presensi, izin: izinData, libur }
  // Tanpa kamar = belum wajib presensi (server juga tidak membuat alpa & menolak presensinya)
  const berkamar = !!user.nomorKamar
  const sesiHariIni: SesiHariIni[] = (berkamar ? sesiAktif(sesiList, user.namaGedung, today) : []).map(sesi => {
    const detail = statusSesi(user.nim, today, sesi, data, now)
    // Mode uji: jam sesi diabaikan, sesi yang belum punya catatan dianggap sedang dibuka
    const dibukaUji = modeUji.abaikanJam && !detail.presensi && !detail.izin && !detail.libur
    // Mode uji: foto ditolak tetap bisa absen ulang walau jam sesi sudah lewat (sama seperti server)
    const ulangUji = modeUji.abaikanJam && !detail.libur && detail.presensi?.statusFoto === 'Ditolak' && !detail.presensi.otomatis
    return { sesi, detail: dibukaUji ? { ...detail, status: 'Belum' as const, fase: 'dibuka' as const } : ulangUji ? { ...detail, fase: 'dibuka' as const } : detail }
  })
  // Periode ringkasan sama dengan dashboard fasil & admin
  const riwayat = riwayatPenghuni(user.nim, periodeRekap(today, user.tanggalMasuk, HARI_RINGKASAN), today, sesiList, data, now, user.namaGedung)
    // Tanpa kamar: hanya catatan yang benar-benar ada (mis. dari saat masih berkamar), tanpa "tidak hadir" buatan
    .filter(r => berkamar || !!r.detail.presensi)
  // Batas akurasi GPS yang berlaku (0 = tidak diperiksa); ikut dilonggarkan mode uji "abaikan radius"
  // Parameter akurasi dihapus: presensi hanya mengikat radius gedung
  const akurasiMaks = 0
  // Pengingat: sesi yang benar-benar sedang dibuka (bukan karena mode uji), belum presensi, dan hampir ditutup
  const sesiHampirTutup = aturan.pengingatMenit > 0
    ? sesiHariIni
        .filter(({ sesi, detail }) => detail.status === 'Belum' && faseSesi(sesi, today, now) === 'dibuka')
        .map(({ sesi }) => ({ sesi, sisa: sisaMenit(sesi.jamSelesai, now) }))
        .filter(({ sisa }) => sisa <= aturan.pengingatMenit)
    : []

  // Membaca lokasi GPS lalu menghitung jarak ke titik koordinat gedung
  const readLocation = async (target: Gedung | null = gedung): Promise<GpsState> => {
    setGps(prev => ({ ...prev, status: 'loading', error: undefined }))
    try {
      const position = await getCurrentPosition()
      const distance = hasKoordinat(target)
        ? distanceMeters(position.latitude, position.longitude, target.latitude, target.longitude)
        : undefined
      const next: GpsState = { status: 'ok', position, distance }
      setGps(next)
      return next
    } catch (err) {
      const next: GpsState = { status: 'error', error: (err as Error).message }
      setGps(next)
      return next
    }
  }

  const handleCheckIn = async (sesiNama: string) => {
    const item = sesiHariIni.find(s => s.sesi.nama === sesiNama)
    if (!item || checkingIn) return
    setNotice(null)
    const gagal = (text: string) => {
      setNotice({ type: 'error', text })
      setHasilAbsen({ jenis: 'gagal', judul: 'Presensi gagal dikirim', pesan: text })
    }

    if (!bisaPresensi(item.detail)) {
      gagal(alasanTidakBisaPresensi(item.detail, item.sesi))
      return
    }
    if (!hasKoordinat(gedung)) {
      gagal('Koordinat gedung asrama Anda belum diatur oleh admin. Presensi belum dapat dilakukan.')
      return
    }
    if (!foto) {
      gagal('Ambil foto wajah terlebih dahulu sebelum mengirim presensi.')
      return
    }

    setCheckingIn(true)
    const loc = await readLocation(gedung)
    if (loc.status !== 'ok' || !loc.position || loc.distance === undefined) {
      gagal(loc.error || 'Lokasi tidak dapat dibaca.')
      setCheckingIn(false)
      return
    }
    if (akurasiMaks > 0 && loc.position.accuracy > akurasiMaks) {
      gagal(
        `Akurasi GPS Anda ±${Math.round(loc.position.accuracy)} m, melebihi batas ${akurasiMaks} m. Aktifkan GPS/mode akurasi tinggi, pindah ke area terbuka, lalu coba lagi.`,
      )
      setCheckingIn(false)
      return
    }
    if (loc.distance > gedung.radiusMeter && !modeUji.abaikanRadius) {
      gagal(
        `Anda berada ${Math.round(loc.distance)} m dari ${gedung.nama}. Presensi hanya dapat dilakukan dalam radius ${gedung.radiusMeter} m.`,
      )
      setCheckingIn(false)
      return
    }

    const result = await checkInApi({
      nim: user.nim,
      sesi: sesiNama,
      tanggal: today,
      latitude: loc.position.latitude,
      longitude: loc.position.longitude,
      akurasi: loc.position.accuracy,
      fotoWajah: foto,
      keterangan: 'Presensi mandiri web',
    })
    if (result.ok || result.offline) {
      const record: PresensiRecord = {
        id: Date.now(), nim: user.nim, namaPenghuni: user.nama, nomorKamar: user.nomorKamar || '', namaGedung: user.namaGedung || '',
        tanggal: today, sesi: sesiNama, waktu: toHM(new Date()),
        latitude: loc.position.latitude, longitude: loc.position.longitude, akurasiMeter: loc.position.accuracy,
        status: 'Hadir', fotoWajah: foto, keterangan: 'Presensi mandiri web', statusFoto: 'Menunggu',
      }
      setPresensi(prev => [record, ...prev.filter(p => !(p.nim === user.nim && p.tanggal === today && p.sesi === sesiNama))])
      setFoto(null)
      const ulang = bisaAbsenUlang(item.detail)
      setNotice({ type: 'success', text: `${ulang ? 'Absen ulang' : 'Presensi'} sesi ${sesiNama} berhasil dicatat (jarak ${Math.round(loc.distance)} m dari gedung). Foto menunggu validasi fasil.` })
      setHasilAbsen(result.ok
        ? { jenis: 'sukses', judul: `${ulang ? 'Absen ulang' : 'Presensi'} berhasil terkirim`, pesan: `Sesi ${sesiNama} tercatat pukul ${record.waktu} WIB, ${Math.round(loc.distance)} m dari gedung. Foto Anda menunggu validasi fasil.` }
        : { jenis: 'offline', judul: 'Presensi disimpan sementara', pesan: `Server belum dapat dihubungi. Presensi sesi ${sesiNama} disimpan di perangkat ini.` })
      if (result.ok) fetchPresensi().then(setPresensi)
    } else {
      gagal(result.message)
    }
    setCheckingIn(false)
  }

  const handleAbsenEvent = async (data: { idEvent: number; latitude: number; longitude: number; foto: string }) => {
    const result = await absenEventApi(data)
    if (result.ok || result.offline) {
      const jam = toHM(new Date())
      setEventList(prev => prev.map(ev => {
        if (ev.id === data.idEvent) {
          return {
            ...ev,
            statusKehadiran: 'Hadir' as const,
            presensiSaya: {
              id: ev.presensiSaya?.id ?? 0,
              idEvent: data.idEvent,
              nim: user.nim,
              tanggal: todayLocal(),
              waktu: jam,
              latitude: data.latitude,
              longitude: data.longitude,
              jarakMeter: null,
              foto: data.foto,
              status: 'Hadir',
              keterangan: null,
              statusFoto: 'Menunggu',
              catatanValidasi: null,
            },
          }
        }
        return ev
      }))
      if (result.ok) {
        fetchEvent().then(setEventList)
      }
      const pesan = result.message || 'Presensi event berhasil dicatat. Foto menunggu validasi fasil.'
      const judulEv = eventList.find(ev => ev.id === data.idEvent)?.judul ?? 'event'
      setNotice({ type: 'success', text: pesan })
      setHasilAbsen(result.ok
        ? { jenis: 'sukses', judul: 'Absen event berhasil terkirim', pesan: `Kehadiran Anda di ${judulEv} tercatat pukul ${jam} WIB. Foto Anda menunggu validasi fasil.` }
        : { jenis: 'offline', judul: 'Absen event disimpan sementara', pesan: 'Server belum dapat dihubungi. Absen disimpan di perangkat ini.' })
      return { ok: true, message: pesan }
    }
    const pesanGagal = result.message || 'Gagal mengirim presensi event'
    setHasilAbsen({ jenis: 'gagal', judul: 'Absen event gagal dikirim', pesan: pesanGagal })
    return { ok: false, message: pesanGagal }
  }

  return (
    <AppLayout user={user} onLogout={onLogout} navItems={navItems} activeTab={activeTab} onTabChange={setActiveTab}
      notifikasi={notifikasiPenghuni({ nim: user.nim, presensi, izin: izinData, sesiHampirTutup, today, eventList, jamSekarang: toHM(now), pengumuman })}>
      {/* Belum ditempatkan di kamar: belum ada kewajiban presensi */}
      {!user.nomorKamar && (
        <div className="mb-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs font-medium flex items-start gap-2.5">
          <Building className="w-4 h-4 text-slate-500 shrink-0 mt-px" />
          <span>
            <strong className="font-bold">Anda belum ditempatkan di kamar.</strong> Kewajiban presensi dimulai setelah admin menempatkan Anda di kamar.
            Jika sudah ditempatkan, keluar lalu masuk kembali agar data kamar diperbarui.
          </span>
        </div>
      )}
      {(modeUji.abaikanJam || modeUji.abaikanRadius) && (
        <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            Mode uji absensi aktif: {[modeUji.abaikanJam && 'jam sesi diabaikan', modeUji.abaikanRadius && 'radius GPS diabaikan'].filter(Boolean).join(' dan ')}.
            Presensi yang dikirim ditandai [Mode Uji].
          </span>
        </div>
      )}
      {sesiHampirTutup.map(({ sesi, sisa }) => (
        <div key={sesi.id} className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 text-xs font-semibold flex flex-col sm:flex-row sm:items-center gap-2">
          <span className="flex items-center gap-2 flex-1">
            <Bell className="w-4 h-4 text-rose-600 shrink-0" />
            <span>
              Sesi {sesi.nama} ditutup pukul {sesi.jamSelesai} WIB ({sisa <= 0 ? 'kurang dari 1 menit lagi' : `${sisa} menit lagi`}) dan Anda belum presensi.
              Setelah ditutup, Anda tercatat Tidak Hadir.
            </span>
          </span>
          {activeTab !== 'presensi' && (
            <button
              onClick={() => { setSesiAwal(sesi.nama); setNotice(null); setActiveTab('presensi') }}
              className="shrink-0 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold cursor-pointer"
            >
              Presensi sekarang
            </button>
          )}
        </div>
      ))}
      {activeTab === 'dashboard' && (
        <PenghuniDashboard
          user={user}
          sesiHariIni={sesiHariIni}
          riwayat={riwayat}
          ditolak={ditolak}
          izinData={izinData}
          liburHariIni={cariLibur(today, libur)}
          onBukaPresensi={sesiNama => {
            // Presensi butuh foto wajah, jadi arahkan ke halaman presensi dengan sesi terpilih
            setSesiAwal(sesiNama)
            setNotice(null)
            setActiveTab('presensi')
          }}
          gedung={gedung}
          notice={notice}
          today={today}
          onNavigateTab={setActiveTab}
          eventList={eventList}
          onBukaPresensiEvent={ev => setPresensiModalEvent(ev)}
          now={now}
          pengumuman={pengumuman}
        />
      )}
      {activeTab === 'presensi' && (
        <PenghuniPresensi
          sesiHariIni={sesiHariIni}
          sesiAwal={sesiAwal}
          abaikanRadius={modeUji.abaikanRadius}
          akurasiMaks={akurasiMaks}
          foto={foto}
          onFotoChange={setFoto}
          onCheckIn={handleCheckIn}
          checkingIn={checkingIn}
          gedung={gedung}
          gps={gps}
          notice={notice}
          onRefreshLocation={() => readLocation()}
        />
      )}
      {activeTab === 'event' && (
        <PenghuniEvent
          eventList={eventList}
          user={user}
          onBukaAbsen={ev => setPresensiModalEvent(ev)}
          today={today}
          now={now}
          liburHariIni={cariLibur(today, libur)}
          notice={notice}
        />
      )}
      {activeTab === 'riwayat' && (
        <PenghuniRiwayat riwayat={riwayat} ditolak={ditolak} eventSaya={eventMilik(eventList, user, gedung?.id || user.idGedung)}>
          <KalenderKehadiran nim={user.nim} sesiList={sesiList} data={data} now={now} gedung={user.namaGedung} tanggalMasuk={user.tanggalMasuk} hanyaTercatat={!berkamar}
            eventSaya={eventMilik(eventList, user, gedung?.id || user.idGedung).filter(ev => ev.presensiSaya).map(ev => ({ tanggal: ev.presensiSaya!.tanggal || ev.tanggal, judul: ev.judul, status: ev.presensiSaya!.status, jam: ev.presensiSaya!.foto ? (ev.presensiSaya!.waktu || '').slice(0, 5) : '' }))} />
        </PenghuniRiwayat>
      )}
      {activeTab === 'izin' && <PenghuniIzin izinData={izinData} setIzinData={setIzinData} user={user} sesiList={sesiAktif(sesiList, user.namaGedung)} today={today} />}
      {activeTab === 'profil' && <PenghuniProfil user={user} onLogout={onLogout} />}
      {presensiModalEvent && (
        <EventPresensiModal
          event={presensiModalEvent}
          penghuniNim={user.nim}
          onClose={() => setPresensiModalEvent(null)}
          onSuccess={() => {
            setPresensiModalEvent(null)
            fetchEvent().then(setEventList)
          }}
          onAbsen={handleAbsenEvent}
        />
      )}
      {hasilAbsen && <HasilAbsen data={hasilAbsen} onClose={() => setHasilAbsen(null)} />}
    </AppLayout>
  )
}

function NoticeBox({ notice }: { notice: Notice | null }) {
  if (!notice) return null
  const isError = notice.type === 'error'
  return (
    <div className={`p-3 rounded-lg border text-xs font-semibold flex items-start gap-2 ${
      isError ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
    }`}>
      {isError ? <XCircle className="w-4 h-4 shrink-0 text-rose-600" /> : <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />}
      <span>{notice.text}</span>
    </div>
  )
}

// Event yang berlaku untuk penghuni: event seluruh asrama atau event gedungnya
function eventMilik(list: EventAsrama[], user: CurrentUser, idGedung?: number | null): EventAsrama[] {
  return list.filter(ev =>
    ev.tipe === 'seluruh' ||
    (!!ev.idGedung && !!idGedung && ev.idGedung === idGedung) ||
    (!!ev.namaGedung && !!user.namaGedung && ev.namaGedung === user.namaGedung)
  )
}

// Absen event dibuka saat berlangsung, bukan hari libur, belum hadir (atau fotonya ditolak -> absen ulang)
function bisaAbsenEvent(ev: EventAsrama, today: string, now: Date, libur?: HariLibur): boolean {
  if (getStatusEvent(ev, today, now) !== 'Sedang Berlangsung') return false
  if (ev.tanggal === today && libur) return false
  if (ev.statusKehadiran === 'Hadir') return false
  return ev.statusKehadiran !== 'Tidak Hadir' || ev.presensiSaya?.statusFoto === 'Ditolak'
}

// Satu baris log presensi: presensi harian per sesi atau absen event
interface LogPresensi {
  kunci: string
  tanggal: string
  urut: string
  jenis: 'harian' | 'event'
  judul: string
  jadwal: string
  jam: string
  status: PresensiStatus
  statusFoto?: StatusFoto | null
  catatan?: string | null
  keterangan: string
  otomatis?: boolean
  // Percobaan lama yang fotonya ditolak lalu diganti absen ulang
  arsip?: boolean
}

function susunLog(riwayat: RiwayatRow[], eventSaya: EventAsrama[], ditolak: RiwayatDitolak[] = []): LogPresensi[] {
  const harian: LogPresensi[] = riwayat.map(({ tanggal, sesi, detail }) => ({
    kunci: `h-${tanggal}-${sesi.nama}`,
    tanggal,
    urut: `${sesi.jamMulai}|${jamPresensi(detail.presensi)}`,
    jenis: 'harian',
    judul: `Sesi ${sesi.nama}`,
    jadwal: `${sesi.jamMulai}–${sesi.jamSelesai}`,
    jam: jamPresensi(detail.presensi),
    status: detail.status,
    statusFoto: detail.presensi?.statusFoto,
    catatan: detail.presensi?.catatanValidasi,
    keterangan: keteranganStatus(detail),
    otomatis: !!detail.presensi?.otomatis,
  }))
  const event: LogPresensi[] = eventSaya
    .filter(ev => ev.presensiSaya)
    .map(ev => {
      const pr = ev.presensiSaya!
      return {
        kunci: `e-${ev.id}`,
        tanggal: pr.tanggal || ev.tanggal,
        urut: `${ev.jamMulai}|${(pr.waktu || '').slice(0, 5)}`,
        jenis: 'event' as const,
        judul: ev.judul,
        jadwal: `${ev.jamMulai}–${ev.jamSelesai} · ${ev.lokasi}`,
        jam: pr.foto ? (pr.waktu || '').slice(0, 5) : '',
        status: pr.status,
        statusFoto: pr.statusFoto,
        catatan: pr.catatanValidasi,
        keterangan: pr.keterangan || '',
      }
    })
  // Arsip percobaan yang ditolak: diletakkan tepat di bawah percobaan penggantinya (urut jam masuk)
  const arsip: LogPresensi[] = ditolak.map(d => {
    const jam = (d.waktu || '').slice(0, 5)
    const catatan = `Foto ditolak${d.namaValidator ? ` oleh ${d.namaValidator}` : ''}, lalu absen ulang`
    if (d.jenis === 'event') {
      const ev = eventSaya.find(e => e.id === d.idEvent)
      return {
        kunci: `x-${d.id}`, tanggal: d.tanggal, urut: `${ev?.jamMulai ?? jam}|${jam}`, jenis: 'event', arsip: true,
        judul: d.judulEvent || ev?.judul || 'Event', jadwal: ev ? `${ev.jamMulai}–${ev.jamSelesai} · ${ev.lokasi}` : 'Event',
        jam, status: 'Tidak Hadir', statusFoto: 'Ditolak', catatan: d.catatanValidasi, keterangan: catatan,
      }
    }
    const sesi = riwayat.find(r => r.tanggal === d.tanggal && r.sesi.nama === d.sesi)?.sesi
    return {
      kunci: `x-${d.id}`, tanggal: d.tanggal, urut: `${sesi?.jamMulai ?? jam}|${jam}`, jenis: 'harian', arsip: true,
      judul: `Sesi ${d.sesi ?? '–'}`, jadwal: sesi ? `${sesi.jamMulai}–${sesi.jamSelesai}` : 'Presensi harian',
      jam, status: 'Tidak Hadir', statusFoto: 'Ditolak', catatan: d.catatanValidasi, keterangan: catatan,
    }
  })
  return [...harian, ...event, ...arsip].sort((a, b) => b.tanggal.localeCompare(a.tanggal) || b.urut.localeCompare(a.urut))
}

function IkonLog({ item }: { item: LogPresensi }) {
  return (
    <span className="w-8 h-8 shrink-0 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-600">
      {item.jenis === 'event' ? <CalendarDays className="w-4 h-4" /> : <SesiIcon nama={item.judul.replace(/^Sesi /, '')} className="w-4 h-4" />}
    </span>
  )
}

function PenghuniDashboard({
  user,
  sesiHariIni,
  riwayat,
  izinData,
  liburHariIni,
  onBukaPresensi,
  gedung,
  notice,
  today,
  onNavigateTab,
  eventList,
  onBukaPresensiEvent,
  now,
  pengumuman = [],
  ditolak = [],
}: {
  user: CurrentUser
  sesiHariIni: SesiHariIni[]
  riwayat: ReturnType<typeof riwayatPenghuni>
  ditolak?: RiwayatDitolak[]
  izinData: IzinRecord[]
  liburHariIni?: HariLibur
  onBukaPresensi: (sesi: string) => void
  gedung: Gedung | null
  notice: Notice | null
  today: string
  onNavigateTab?: (tab: string) => void
  eventList?: EventAsrama[]
  onBukaPresensiEvent?: (ev: EventAsrama) => void
  now?: Date
  pengumuman?: Pengumuman[]
}) {
  const jam = now || new Date()
  const rekap = hitungStatus(riwayat.map(r => r.detail.status))
  const eventSaya = eventMilik(eventList || [], user, gedung?.id || user.idGedung)
  const eventAktif = eventSaya.filter(ev => bisaAbsenEvent(ev, today, jam, liburHariIni))
  const eventTerdekat = eventSaya
    .filter(ev => getStatusEvent(ev, today, jam) !== 'Selesai')
    .sort((a, b) => a.tanggal.localeCompare(b.tanggal) || a.jamMulai.localeCompare(b.jamMulai))
    .slice(0, 3)
  const logTerkini = susunLog(riwayat.filter(r => r.detail.status !== 'Belum'), eventSaya, ditolak).slice(0, 6)
  const izinTerakhir = [...izinData].sort((a, b) => b.id - a.id).slice(0, 3)
  const inisial = user.nama.split(/\s+/).filter(Boolean).slice(0, 2).map(k => k[0]?.toUpperCase()).join('')

  const ubin = [
    { label: 'Kehadiran', nilai: `${rekap.persen}%`, ikon: <ShieldCheck className="w-4 h-4" />, warna: 'bg-gray-100 text-gray-700' },
    { label: 'Hadir', nilai: rekap.Hadir, ikon: <CheckCircle2 className="w-4 h-4" />, warna: 'bg-emerald-50 text-emerald-700' },
    { label: 'Tidak hadir', nilai: rekap['Tidak Hadir'], ikon: <XCircle className="w-4 h-4" />, warna: 'bg-rose-50 text-rose-600' },
    { label: 'Izin', nilai: rekap.Izin, ikon: <FileText className="w-4 h-4" />, warna: 'bg-amber-50 text-amber-700' },
  ]
  const tombolLink = 'text-xs font-bold text-gray-600 hover:text-gray-900 inline-flex items-center gap-1 cursor-pointer'

  return (
    <div className="space-y-5">
      {/* Identitas + ringkasan 30 hari */}
      <div className="rounded-2xl bg-gradient-to-br from-[#0f3e2d] via-[#17603d] to-[#27a150] text-white p-5 sm:p-6 shadow-md flex flex-col lg:flex-row lg:items-center gap-5">
        <div className="flex items-center gap-4 min-w-0 lg:mr-auto">
          <span className="w-14 h-14 shrink-0 rounded-2xl bg-white/15 border border-white/25 text-white flex items-center justify-center text-lg font-extrabold" style={{ fontFamily: 'Plus Jakarta Sans' }}>{inisial || 'P'}</span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-emerald-200">{formatTanggal(today)} · ringkasan {HARI_RINGKASAN} hari terakhir</p>
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight truncate" style={{ fontFamily: 'Plus Jakarta Sans' }}>{user.nama}</h2>
            <p className="text-sm text-emerald-100/90 truncate"><span className="mono">{user.nim}</span> · Kamar {user.nomorKamar || '–'} · {user.namaGedung || 'Belum ada gedung'}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 lg:w-[560px]">
          {ubin.map(u => (
            <div key={u.label} className="px-3.5 py-3 rounded-xl bg-white/10 border border-white/15">
              <p className="text-[11px] font-semibold text-emerald-100/90 truncate">{u.label}</p>
              <p className="mt-0.5 text-2xl font-extrabold text-white tabular-nums" style={{ fontFamily: 'Plus Jakarta Sans' }}>{u.nilai}</p>
            </div>
          ))}
        </div>
      </div>

      <PengumumanPenghuni daftar={pengumuman} />

      {/* Perlu perhatian: event yang sedang dibuka */}
      {eventAktif.map(ev => (
        <div key={ev.id} className="bg-[#fff] border border-amber-300 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 shadow-2xs">
          <span className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0"><CalendarDays className="w-5 h-5" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
              {ev.presensiSaya?.statusFoto === 'Ditolak' ? 'Foto ditolak · absen ulang' : 'Event sedang berlangsung'}
            </p>
            <p className="text-sm font-bold text-gray-900 truncate" style={{ fontFamily: 'Plus Jakarta Sans' }}>{ev.judul}</p>
            <p className="text-xs text-gray-500 truncate">{ev.jamMulai}–{ev.jamSelesai} WIB · {ev.lokasi}</p>
          </div>
          {onBukaPresensiEvent && (
            <button
              type="button"
              onClick={() => onBukaPresensiEvent(ev)}
              className="px-4 py-2.5 rounded-xl bg-[#141a17] hover:bg-[#2a332e] text-white text-xs font-bold shrink-0 inline-flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer transition-colors"
            >
              <UserCheck className="w-4 h-4" />
              <span>Absen Event</span>
            </button>
          )}
        </div>
      ))}

      <div className="grid lg:grid-cols-3 gap-5 items-start">
        {/* Kolom utama */}
        <div className="lg:col-span-2 space-y-5 min-w-0">
          <KartuProfil
            ikon={<Clock />}
            judul="Presensi Hari Ini"
            sub={formatTanggal(today)}
            className="h-auto!"
            kanan={liburHariIni ? (
              <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 inline-flex items-center gap-1">
                <Palmtree className="w-3 h-3" />Libur: {liburHariIni.keterangan}
              </span>
            ) : undefined}
          >
            <div className="p-5 space-y-3">
              {sesiHariIni.length === 0 ? (
                <p className="text-xs text-gray-500">Tidak ada sesi presensi untuk gedung Anda hari ini.</p>
              ) : (
                <div className="grid sm:grid-cols-2 gap-3">
                  {sesiHariIni.map(({ sesi, detail }) => {
                    const boleh = bisaPresensi(detail)
                    const ditolak = detail.presensi?.statusFoto === 'Ditolak'
                    const jamMasuk = jamPresensi(detail.presensi)
                    const ket = ditolak
                      ? `Foto ditolak${detail.presensi?.catatanValidasi ? `: ${detail.presensi.catatanValidasi}` : ''}`
                      : jamMasuk ? `Tercatat pukul ${jamMasuk} WIB${detail.presensi?.statusFoto === 'Menunggu' ? ' · foto menunggu validasi' : ''}`
                      : detail.status === 'Izin' ? 'Izin disetujui'
                      : detail.status === 'Belum' && !boleh ? alasanTidakBisaPresensi(detail, sesi)
                      : detail.status === 'Tidak Hadir' ? 'Tidak ada presensi hingga sesi ditutup'
                      : detail.status === 'Libur' ? 'Tidak ada kewajiban presensi' : 'Sesi sedang dibuka'
                    return (
                      <div key={sesi.id} className="rounded-xl border border-gray-200 p-4 flex flex-col gap-3">
                        <div className="flex items-center gap-3">
                          <span className="w-9 h-9 shrink-0 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-700"><SesiIcon nama={sesi.nama} className="w-4 h-4" /></span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>Sesi {sesi.nama}</p>
                            <p className="text-[11px] text-gray-400 mono">{sesi.jamMulai}–{sesi.jamSelesai} WIB</p>
                          </div>
                          <Badge status={detail.status} />
                        </div>
                        <p className={`text-[11px] font-medium ${ditolak ? 'text-rose-700' : 'text-gray-500'}`}>{ket}</p>
                        {boleh && (
                          <button
                            onClick={() => onBukaPresensi(sesi.nama)}
                            className="w-full py-2 rounded-lg text-xs font-bold text-white bg-[#141a17] hover:bg-[#2a332e] transition-colors shadow-2xs inline-flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>{ditolak ? 'Absen Ulang' : 'Presensi Sekarang'}</span>
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
              {notice && <NoticeBox notice={notice} />}
            </div>
          </KartuProfil>

          <KartuProfil
            ikon={<History />}
            judul="Aktivitas Terakhir"
            sub="Presensi harian & absen event"
            className="h-auto!"
            kanan={onNavigateTab && <button type="button" onClick={() => onNavigateTab('riwayat')} className={tombolLink}>Semua riwayat<ArrowRight className="w-3.5 h-3.5" /></button>}
          >
            {logTerkini.length === 0 ? (
              <p className="px-5 py-8 text-center text-xs text-gray-400">Belum ada aktivitas presensi.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {logTerkini.map(item => (
                  <li key={item.kunci} className="px-5 py-3 flex items-center gap-3">
                    <IkonLog item={item} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 truncate">{item.judul}</p>
                      <p className="text-[11px] text-gray-500">{formatTanggal(item.tanggal)}{item.jam ? ` · masuk ${item.jam}` : ''}</p>
                    </div>
                    {item.statusFoto && item.statusFoto !== 'Diterima' && <span className="hidden sm:inline"><FotoBadge status={item.statusFoto} /></span>}
                    <Badge status={item.status} />
                  </li>
                ))}
              </ul>
            )}
          </KartuProfil>
        </div>

        {/* Kolom samping */}
        <div className="space-y-5 min-w-0">
          <KartuProfil
            ikon={<CalendarDays />}
            judul="Event Terdekat"
            className="h-auto!"
            kanan={onNavigateTab && <button type="button" onClick={() => onNavigateTab('event')} className={tombolLink}>Semua<ArrowRight className="w-3.5 h-3.5" /></button>}
          >
            {eventTerdekat.length === 0 ? (
              <p className="px-5 py-6 text-center text-xs text-gray-400">Tidak ada event mendatang.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {eventTerdekat.map(ev => {
                  const st = getStatusEvent(ev, today, jam)
                  return (
                    <li key={ev.id} className="px-5 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-gray-900 truncate">{ev.judul}</p>
                        {ev.statusKehadiran === 'Hadir'
                          ? <span className="text-[11px] font-bold text-emerald-700 shrink-0">Hadir</span>
                          : st === 'Sedang Berlangsung'
                            ? <span className="text-[11px] font-bold text-amber-700 shrink-0">Berlangsung</span>
                            : null}
                      </div>
                      <p className="text-[11px] text-gray-500 truncate">{ev.tanggal === today ? 'Hari ini' : formatTanggal(ev.tanggal)} · {ev.jamMulai}–{ev.jamSelesai} · {ev.lokasi}</p>
                    </li>
                  )
                })}
              </ul>
            )}
          </KartuProfil>

          <KartuProfil
            ikon={<FileText />}
            judul="Izin Terakhir"
            className="h-auto!"
            kanan={onNavigateTab && <button type="button" onClick={() => onNavigateTab('izin')} className={tombolLink}>Ajukan<ArrowRight className="w-3.5 h-3.5" /></button>}
          >
            {izinTerakhir.length === 0 ? (
              <p className="px-5 py-6 text-center text-xs text-gray-400">Belum ada pengajuan izin.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {izinTerakhir.map(i => (
                  <li key={i.id} className="px-5 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-gray-900 truncate">{formatRentangIzin(i.tanggal, i.tanggalSelesai, i.sesi, i.hariBerulang)}</p>
                      <Badge status={i.statusPersetujuan} />
                    </div>
                    <p className="text-[11px] text-gray-500 truncate">{i.alasan}</p>
                  </li>
                ))}
              </ul>
            )}
          </KartuProfil>

          <KartuProfil ikon={<Building />} judul="Hunian" className="h-auto!">
            <dl className="px-5 py-3 text-xs divide-y divide-gray-50">
              {[
                ['Gedung', user.namaGedung || '–'],
                ['Kamar', user.nomorKamar || '–'],
                ['Fasilitator', gedung?.namaPj || '–'],
                ['Radius presensi', gedung ? `${gedung.radiusMeter} m dari gedung` : '–'],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-3 py-2">
                  <dt className="text-gray-500">{k}</dt>
                  <dd className="font-semibold text-gray-900 text-right truncate">{v}</dd>
                </div>
              ))}
            </dl>
          </KartuProfil>
        </div>
      </div>
    </div>
  )
}

function PenghuniPresensi({ sesiHariIni, sesiAwal, abaikanRadius, akurasiMaks, foto, onFotoChange, onCheckIn, checkingIn, gedung, gps, notice, onRefreshLocation }: {
  sesiHariIni: SesiHariIni[]
  sesiAwal: string
  abaikanRadius: boolean
  akurasiMaks: number
  foto: string | null
  onFotoChange: (foto: string | null) => void
  onCheckIn: (sesi: string) => void
  checkingIn: boolean
  gedung: Gedung | null
  gps: GpsState
  notice: Notice | null
  onRefreshLocation: () => void
}) {
  const sesiDibuka = sesiHariIni.find(s => s.detail.fase === 'dibuka')
  const [selectedSesi, setSelectedSesi] = useState<string>(sesiAwal || sesiHariIni.find(x => bisaPresensi(x.detail))?.sesi.nama || sesiDibuka?.sesi.nama || sesiHariIni[0]?.sesi.nama || '')
  const selected = sesiHariIni.find(s => s.sesi.nama === selectedSesi)
  // Sesi terpilih jadi tidak bisa (mis. baru saja absen) -> pindah ke sesi lain yang masih bisa
  const kunciSesi = sesiHariIni.map(x => `${x.sesi.nama}:${x.detail.status}:${x.detail.fase}`).join('|')
  useEffect(() => {
    if (selected && bisaPresensi(selected.detail)) return
    const lain = sesiHariIni.find(x => bisaPresensi(x.detail))
    if (lain) setSelectedSesi(lain.sesi.nama)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kunciSesi])
  const koordinatSiap = hasKoordinat(gedung)
  const radius = gedung?.radiusMeter ?? 0
  const inRadius = gps.distance !== undefined && gps.distance <= radius
  // Lebar bar: jarak relatif terhadap 2x radius, agar posisi di luar radius tetap terlihat
  const barPct = gps.distance !== undefined && radius > 0 ? Math.min(100, (gps.distance / (radius * 2)) * 100) : 0
  const bisa = !!selected && bisaPresensi(selected.detail)
  const diluarRadius = gps.status === 'ok' && !inRadius && !abaikanRadius

  return (
    <div className="space-y-5 w-full min-w-0">
      {/* Baris 1: pilih sesi (selebar halaman) */}
      <KartuProfil ikon={<Clock />} judul="Lakukan Presensi Mandiri" sub="Presensi hanya dapat dilakukan saat sesi sedang dibuka">
        <div className="p-5">
          {sesiHariIni.length === 0 ? (
            <p className="text-xs text-gray-500">Belum ada sesi presensi yang berlaku untuk gedung Anda hari ini.</p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {sesiHariIni.map(({ sesi, detail }) => {
                const dapat = bisaPresensi(detail)
                const isSelected = selectedSesi === sesi.nama && dapat
                return (
                  <button
                    key={sesi.id}
                    type="button"
                    disabled={!dapat}
                    aria-disabled={!dapat}
                    onClick={() => setSelectedSesi(sesi.nama)}
                    className={`flex items-center gap-4 p-4 rounded-xl text-left border transition-all ${
                      !dapat ? 'border-gray-200 bg-gray-50 opacity-70 cursor-not-allowed'
                        : isSelected ? 'border-emerald-600 bg-emerald-50/60 ring-1 ring-emerald-600 cursor-pointer' : 'border-gray-200 bg-white hover:border-emerald-300 cursor-pointer'
                    }`}
                  >
                    <div className="w-11 h-11 shrink-0 rounded-xl bg-white flex items-center justify-center border border-gray-200">
                      <SesiIcon nama={sesi.nama} className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="font-bold text-sm text-gray-900 whitespace-nowrap" style={{ fontFamily: 'Plus Jakarta Sans' }}>Sesi {sesi.nama}</span>
                        {detail.fase === 'dibuka' && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">DIBUKA</span>}
                      </div>
                      <div className="text-xs text-gray-500 font-medium">{sesi.jamMulai} – {sesi.jamSelesai} WIB</div>
                      {!dapat && <div className="text-[11px] text-gray-400 mt-0.5 truncate">{alasanTidakBisaPresensi(detail, sesi)}</div>}
                      {bisaAbsenUlang(detail) && <div className="text-[11px] text-rose-700 font-semibold mt-0.5">Foto ditolak · silakan absen ulang</div>}
                    </div>
                    <Badge status={detail.status} />
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </KartuProfil>

      {/* Baris 2: foto wajah | lokasi + ketentuan (tinggi sama) */}
      <div className="grid lg:grid-cols-2 gap-5 items-stretch">
        <KartuProfil
          ikon={<Camera />}
          judul="Foto Wajah"
          sub="Diambil langsung dari kamera sebagai bukti kehadiran"
          kanan={foto ? <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-800 border-emerald-200">Foto siap dikirim</span> : undefined}
        >
          <div className="p-5 flex-1 flex flex-col">
            {bisa ? (
              <KameraWajah foto={foto} onChange={onFotoChange} disabled={checkingIn} polos />
            ) : (
              <div className="flex-1 min-h-56 rounded-xl border border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center text-center px-6 py-10">
                <Camera className="w-8 h-8 text-gray-300" />
                <p className="mt-3 text-sm font-semibold text-gray-600">Kamera belum tersedia</p>
                <p className="mt-1 text-xs text-gray-400 max-w-xs">
                  {selected ? alasanTidakBisaPresensi(selected.detail, selected.sesi) : 'Belum ada sesi aktif yang diatur.'}
                </p>
              </div>
            )}
          </div>
        </KartuProfil>

        <div className="flex flex-col gap-5">
          <KartuProfil
            ikon={<Compass />}
            judul="Lokasi GPS Anda"
            sub={gedung?.nama || 'Gedung belum terdaftar'}
            className="h-auto! shrink-0"
            kanan={
              <div className="flex items-center gap-2">
                {gps.status === 'ok' && gps.distance !== undefined && (
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                    inRadius ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-rose-50 text-rose-800 border-rose-200'
                  }`}>
                    {inRadius ? 'Dalam radius' : 'Di luar radius'} · {Math.round(gps.distance)} m
                  </span>
                )}
                <button
                  type="button"
                  onClick={onRefreshLocation}
                  disabled={gps.status === 'loading'}
                  className="p-1.5 rounded-lg text-gray-500 hover:text-emerald-700 hover:bg-gray-100 transition-colors cursor-pointer disabled:opacity-50"
                  title="Perbarui lokasi"
                  aria-label="Perbarui lokasi"
                >
                  <RefreshCw className={`w-4 h-4 ${gps.status === 'loading' ? 'animate-spin' : ''}`} />
                </button>
              </div>
            }
          >
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 min-w-0">
                  <p className="text-[11px] text-gray-500">Titik gedung</p>
                  <p className="mono text-xs font-semibold text-gray-800 mt-0.5 truncate">
                    {koordinatSiap ? `${gedung.latitude!.toFixed(5)}, ${gedung.longitude!.toFixed(5)}` : 'Belum diatur'}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 min-w-0">
                  <p className="text-[11px] text-gray-500">Posisi Anda</p>
                  <p className="mono text-xs font-semibold text-gray-800 mt-0.5 truncate">
                    {gps.status === 'ok' && gps.position ? `${gps.position.latitude.toFixed(5)}, ${gps.position.longitude.toFixed(5)}` : gps.status === 'loading' ? 'Membaca…' : '-'}
                  </p>
                </div>
              </div>

              {!koordinatSiap && <p className="text-xs text-rose-700 font-medium">{gedung ? 'Koordinat gedung belum diatur admin, presensi belum dapat dilakukan.' : 'Anda belum ditempatkan di kamar, presensi belum dapat dilakukan.'}</p>}
              {gps.status === 'error' && <p className="text-xs text-rose-700 font-medium">{gps.error}</p>}
              {gps.status === 'ok' && gps.position && akurasiMaks > 0 && gps.position.accuracy > akurasiMaks && (
                <p className="text-xs text-rose-700 font-semibold">
                  Akurasi lokasi melebihi batas {akurasiMaks} m. Aktifkan GPS/mode akurasi tinggi atau pindah ke area terbuka, lalu perbarui lokasi.
                </p>
              )}

              <div>
                <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1.5">
                  <span>Jarak ke gedung{gps.status === 'ok' && gps.position ? ` · akurasi ±${Math.round(gps.position.accuracy)} m` : ''}</span>
                  <span>batas {radius || '-'} m</span>
                </div>
                <div className="relative h-2 rounded-full bg-gray-200 overflow-hidden">
                  {gps.distance !== undefined && (
                    <div className={`h-full rounded-full ${inRadius ? 'bg-emerald-600' : 'bg-rose-600'}`} style={{ width: `${barPct}%` }} />
                  )}
                  {/* Penanda batas radius (di tengah bar) */}
                  <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-gray-500" />
                </div>
              </div>
            </div>
          </KartuProfil>

          <KartuProfil ikon={<AlertCircle />} judul="Ketentuan Presensi" sub="Baca sebelum melakukan presensi" className="h-auto! flex-1">
            <ul className="p-5 flex-1 flex flex-col justify-between gap-2.5 text-xs text-gray-600 leading-relaxed">
              {[
                <>Presensi hanya sah jika lokasi GPS berada dalam radius <strong className="text-gray-900">{radius || '-'} m</strong> dari gedung.</>,
                <>Setiap presensi wajib disertai foto wajah yang diambil langsung dari kamera.</>,
                <>Jam sesi hari ini: <strong className="text-gray-900">{sesiHariIni.map(x => `${x.sesi.nama} ${x.sesi.jamMulai}–${x.sesi.jamSelesai}`).join(', ') || '-'}</strong> WIB.</>,
                <>Sesi yang terlewat tanpa izin otomatis tercatat <strong className="text-gray-900">Tidak Hadir</strong>.</>,
                <>Dilarang menitipkan absensi atau memakai pemalsu lokasi.</>,
                <>Berhalangan? Ajukan izin di menu <strong className="text-gray-900">Pengajuan Izin</strong> sebelum sesi dimulai.</>,
              ].map((isi, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="mt-0.5 w-5 h-5 shrink-0 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                  <span>{isi}</span>
                </li>
              ))}
            </ul>
          </KartuProfil>
        </div>
      </div>

      {/* Baris 3: kirim (selebar halaman) */}
      {selected && bisaAbsenUlang(selected.detail) && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-medium flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <span>
            Foto presensi sesi {selected.sesi.nama} ditolak fasil{selected.detail.presensi?.catatanValidasi ? `: "${selected.detail.presensi.catatanValidasi}"` : ''}.
            Anda bisa absen ulang sampai pukul {selected.sesi.jamSelesai} WIB.
          </span>
        </div>
      )}
      {notice && <NoticeBox notice={notice} />}
      <button
        type="button"
        onClick={() => selected && onCheckIn(selected.sesi.nama)}
        disabled={!bisa || checkingIn || !koordinatSiap || diluarRadius || !foto}
        className="w-full py-3.5 px-4 rounded-xl font-bold text-sm text-white bg-[#141a17] hover:bg-[#2a332e] transition-colors shadow-2xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ fontFamily: 'Plus Jakarta Sans' }}
      >
        {!selected ? (
          <span>{gedung ? 'Belum ada sesi aktif yang diatur' : 'Belum ditempatkan di kamar'}</span>
        ) : !bisa ? (
          <>
            <AlertCircle className="w-4 h-4" />
            <span>{alasanTidakBisaPresensi(selected.detail, selected.sesi)}</span>
          </>
        ) : checkingIn ? (
          <>
            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span>Memvalidasi Lokasi GPS...</span>
          </>
        ) : diluarRadius ? (
          <>
            <XCircle className="w-4 h-4" />
            <span>Anda Berada di Luar Radius Asrama</span>
          </>
        ) : !foto ? (
          <>
            <Camera className="w-4 h-4" />
            <span>Ambil Foto Wajah Terlebih Dahulu</span>
          </>
        ) : (
          <>
            <MapPin className="w-4 h-4" />
            <span>{bisaAbsenUlang(selected.detail) ? 'Kirim Absen Ulang' : 'Kirim Presensi Sekarang'} (Sesi {selected.sesi.nama})</span>
          </>
        )}
      </button>
    </div>
  )
}

const PILIHAN_BARIS_LOG = [10, 25, 50, 100]

function PenghuniRiwayat({ riwayat, ditolak = [], eventSaya, children }: { riwayat: ReturnType<typeof riwayatPenghuni>; ditolak?: RiwayatDitolak[]; eventSaya: EventAsrama[]; children?: React.ReactNode }) {
  const c = hitungStatus(riwayat.map(r => r.detail.status))
  const [cari, setCari] = useState('')
  const [jenis, setJenis] = useState<'' | 'harian' | 'event'>('')
  const [status, setStatus] = useState<'' | PresensiStatus>('')
  const [perHalaman, setPerHalaman] = useState(10)
  const [halaman, setHalaman] = useState(1)

  // Lingkaran persentase (SVG)
  const R = 42
  const keliling = 2 * Math.PI * R
  const warnaPersen = c.persen >= 80 ? '#22993b' : c.persen >= 60 ? '#d97706' : '#e11d48'
  const ringkas = [
    { label: 'Hadir', nilai: c.Hadir, ikon: <CheckCircle2 className="w-4 h-4" />, warna: 'bg-emerald-50 text-emerald-700' },
    { label: 'Tidak hadir', nilai: c['Tidak Hadir'], ikon: <XCircle className="w-4 h-4" />, warna: 'bg-rose-50 text-rose-600' },
    { label: 'Izin', nilai: c.Izin, ikon: <FileText className="w-4 h-4" />, warna: 'bg-amber-50 text-amber-700' },
    { label: 'Libur', nilai: c.Libur, ikon: <Palmtree className="w-4 h-4" />, warna: 'bg-slate-100 text-slate-600' },
  ]

  const log = susunLog(riwayat, eventSaya, ditolak)
  const kata = cari.trim().toLowerCase()
  const hasil = log.filter(x =>
    (!jenis || x.jenis === jenis) &&
    (!status || x.status === status) &&
    (!kata || `${x.judul} ${formatTanggal(x.tanggal)} ${x.tanggal} ${x.keterangan} ${x.catatan ?? ''}`.toLowerCase().includes(kata)))
  useEffect(() => setHalaman(1), [kata, jenis, status, perHalaman])
  const jumlahHalaman = Math.max(1, Math.ceil(hasil.length / perHalaman))
  const aktif = Math.min(halaman, jumlahHalaman)
  const dari = (aktif - 1) * perHalaman
  const tampil = hasil.slice(dari, dari + perHalaman)
  const jumlahEvent = log.filter(x => x.jenis === 'event' && !x.arsip).length
  const kontrol = 'px-3 py-2.5 rounded-xl border border-gray-200 bg-[#fff] text-sm font-medium text-gray-700 outline-none focus:border-emerald-600 cursor-pointer'
  const tombolHal = 'px-3 py-1.5 rounded-lg border border-gray-200 bg-[#fff] font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'

  return (
    <div className="space-y-5 w-full">
      {/* Ringkasan 30 hari: lingkaran persentase + rincian status */}
      <div className="bg-white rounded-2xl border border-gray-200/90 shadow-2xs p-5 flex flex-col md:flex-row md:items-center gap-5">
        <div className="flex items-center gap-4 md:pr-6 md:border-r md:border-gray-100 shrink-0">
          <div className="relative w-28 h-28 shrink-0">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              <circle cx="50" cy="50" r={R} fill="none" stroke="var(--color-gray-100)" strokeWidth="10" />
              <circle
                cx="50" cy="50" r={R} fill="none" stroke={warnaPersen} strokeWidth="10" strokeLinecap="round"
                strokeDasharray={keliling} strokeDashoffset={keliling * (1 - c.persen / 100)}
                style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.22, 1, 0.36, 1)' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-extrabold text-gray-900 tabular-nums" style={{ fontFamily: 'Plus Jakarta Sans' }}>{c.persen}%</span>
              <span className="text-[10px] font-semibold text-gray-400">hadir</span>
            </div>
          </div>
          <div>
            <h3 className="text-base font-extrabold text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>Tingkat Kehadiran</h3>
            <p className="text-xs text-gray-500 mt-0.5">Hadir {c.Hadir} dari {c.wajib} sesi wajib</p>
            <p className="text-[11px] text-gray-400">30 hari terakhir · libur tidak dihitung</p>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 flex-1">
          {ringkas.map(x => (
            <div key={x.label} className="p-3.5 rounded-xl bg-gray-50/70 border border-gray-100">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-gray-600">{x.label}</span>
                <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${x.warna}`}>{x.ikon}</span>
              </div>
              <p className="mt-1 text-2xl font-extrabold text-gray-900 tabular-nums" style={{ fontFamily: 'Plus Jakarta Sans' }}>{x.nilai}</p>
            </div>
          ))}
        </div>
      </div>

      {children}

      {/* Log riwayat: presensi harian + absen event */}
      <div className="bg-white rounded-2xl overflow-hidden border border-gray-200/90 shadow-2xs">
        <div className="px-5 py-4 border-b border-gray-100 flex flex-col xl:flex-row xl:items-center gap-3">
          <div className="xl:mr-auto">
            <h3 className="text-base font-extrabold text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>Log Riwayat Presensi</h3>
            <p className="text-xs text-gray-500">{riwayat.length} sesi harian · {jumlahEvent} absen event{ditolak.length > 0 ? ` · ${ditolak.length} percobaan ditolak` : ''}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-60">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={cari}
                onChange={e => setCari(e.target.value)}
                placeholder="Cari tanggal, sesi, event..."
                aria-label="Cari riwayat"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 bg-[#fff] text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 transition-all placeholder:text-gray-400"
              />
            </div>
            <select value={jenis} onChange={e => setJenis(e.target.value as typeof jenis)} className={kontrol} aria-label="Jenis presensi">
              <option value="">Semua jenis</option>
              <option value="harian">Presensi harian</option>
              <option value="event">Absen event</option>
            </select>
            <select value={status} onChange={e => setStatus(e.target.value as typeof status)} className={kontrol} aria-label="Status">
              <option value="">Semua status</option>
              <option value="Hadir">Hadir</option>
              <option value="Tidak Hadir">Tidak hadir</option>
              <option value="Izin">Izin</option>
              <option value="Libur">Libur</option>
              <option value="Belum">Belum absen</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50/70 border-b border-gray-100">
                {['Tanggal & kegiatan', 'Jenis', 'Waktu masuk', 'Status', 'Validasi foto', 'Keterangan'].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tampil.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-gray-400">{log.length === 0 ? 'Belum ada riwayat presensi.' : 'Tidak ada riwayat yang cocok dengan filter.'}</td></tr>
              )}
              {tampil.map(x => (
                <tr key={x.kunci} className={`hover:bg-gray-50/80 transition-colors ${x.arsip ? 'bg-rose-50/30' : ''}`}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <IkonLog item={x} />
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 whitespace-nowrap" style={{ fontFamily: 'Plus Jakarta Sans' }}>{formatTanggal(x.tanggal)}</p>
                        <p className="text-[11px] text-gray-500 max-w-[260px] truncate">{x.judul} · {x.jadwal}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${x.jenis === 'event' ? 'bg-slate-50 text-slate-700 border-slate-200' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                      {x.jenis === 'event' ? 'Event' : 'Harian'}
                    </span>
                  </td>
                  <td className="px-5 py-3 mono text-xs font-semibold text-gray-700">{x.jam || <span className="text-gray-300">–</span>}</td>
                  <td className="px-5 py-3 whitespace-nowrap"><Badge status={x.status} /></td>
                  <td className="px-5 py-3 text-xs">
                    {x.statusFoto ? (
                      <div className="space-y-1">
                        <FotoBadge status={x.statusFoto} />
                        {x.catatan && <p className="text-gray-600 max-w-[220px]">Catatan fasil: {x.catatan}</p>}
                      </div>
                    ) : <span className="text-gray-300">–</span>}
                  </td>
                  <td className={`px-5 py-3 text-xs ${x.otomatis ? 'text-gray-400' : 'text-gray-600'}`}>{x.keterangan || <span className="text-gray-300">–</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {hasil.length > 0 && (
          <div className="px-5 py-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <label className="inline-flex items-center gap-2">
                <span>Tampilkan</span>
                <select value={perHalaman} onChange={e => setPerHalaman(Number(e.target.value))} aria-label="Jumlah baris per halaman"
                  className="px-2 py-1.5 rounded-lg border border-gray-200 bg-[#fff] text-xs font-semibold text-gray-800 outline-none focus:border-emerald-600 cursor-pointer">
                  {PILIHAN_BARIS_LOG.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                <span>baris</span>
              </label>
              <span>Menampilkan {dari + 1}–{dari + tampil.length} dari {hasil.length}</span>
            </div>
            {jumlahHalaman > 1 && (
              <div className="flex items-center gap-1.5">
                <button type="button" className={tombolHal} disabled={aktif === 1} onClick={() => setHalaman(aktif - 1)}>‹ Sebelumnya</button>
                <span className="px-2 font-semibold text-gray-700 tabular-nums">{aktif} / {jumlahHalaman}</span>
                <button type="button" className={tombolHal} disabled={aktif === jumlahHalaman} onClick={() => setHalaman(aktif + 1)}>Berikutnya ›</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function formatUkuranBerkas(byte: number): string {
  return byte < 1024 * 1024 ? `${Math.max(1, Math.round(byte / 1024))} KB` : `${(byte / (1024 * 1024)).toFixed(1)} MB`
}

// "2026-11" → "November 2026"
function namaBulan(yyyyMm: string): string {
  const [y, m] = yyyyMm.split('-').map(Number)
  return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date(y, m - 1, 1))
}

function PenghuniIzin({ izinData, setIzinData, user, sesiList, today }: {
  izinData: IzinRecord[]
  setIzinData: (fn: (prev: IzinRecord[]) => IzinRecord[]) => void
  user: CurrentUser
  sesiList: Sesi[]
  today: string
}) {
  const [formTerbuka, setFormTerbuka] = useState(false)
  // Izin ditolak yang sedang diajukan ulang (null = pengajuan baru biasa)
  const [dasarUlang, setDasarUlang] = useState<IzinRecord | null>(null)
  const [batalTarget, setBatalTarget] = useState<IzinRecord | null>(null)
  const [membatalkan, setMembatalkan] = useState(false)
  const [filter, setFilter] = useState<'Semua' | IzinRecord['statusPersetujuan']>('Semua')
  // Penelusuran riwayat: teks (alasan/catatan/tanggal), satu tanggal tertentu, atau satu bulan ('semua' | 'YYYY-MM')
  const [cari, setCari] = useState('')
  const [tanggalCari, setTanggalCari] = useState('')
  const [periode, setPeriode] = useState('semua')
  const [notice, setNotice] = useState<Notice | null>(null)
  // Izin yang baru dikirim disorot sebentar agar mudah ditemukan di riwayat
  const [sorotId, setSorotId] = useState<number | null>(null)

  useEffect(() => {
    if (sorotId === null) return
    document.getElementById(`izin-${sorotId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const t = setTimeout(() => setSorotId(null), 4000)
    return () => clearTimeout(t)
  }, [sorotId])

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), 6000)
    return () => clearTimeout(t)
  }, [notice])

  const bukaForm = (dasar: IzinRecord | null) => {
    setDasarUlang(dasar)
    setFormTerbuka(true)
  }

  // Batalkan izin yang masih menunggu: tunggu server, lalu muat ulang riwayat
  const handleBatal = async () => {
    if (!batalTarget) return
    setMembatalkan(true)
    const result = await batalIzinApi(batalTarget.id)
    if (result.ok) {
      const milikSaya = (await fetchIzin()).filter(i => i.nim === user.nim)
      setIzinData(() => milikSaya)
    } else if (result.offline) {
      setIzinData(prev => prev.filter(i => i.id !== batalTarget.id))
    }
    setNotice(result.ok || result.offline
      ? { type: 'success', text: 'Pengajuan izin dibatalkan.' }
      : { type: 'error', text: result.message })
    setMembatalkan(false)
    setBatalTarget(null)
  }

  // izinOffline terisi hanya di mode demo; selain itu riwayat dimuat ulang dari server
  const handleTerkirim = async (izinOffline: IzinRecord[] | null) => {
    let idBaru: number | null
    if (izinOffline) {
      setIzinData(prev => [...izinOffline, ...prev])
      idBaru = izinOffline[0]?.id ?? null
    } else {
      // Muat ulang agar id & nama berkas bukti sesuai yang tersimpan; id terbesar = pengajuan terbaru
      const milikSaya = (await fetchIzin()).filter(i => i.nim === user.nim)
      setIzinData(() => milikSaya)
      idBaru = milikSaya.reduce<number | null>((maks, i) => (maks === null || i.id > maks ? i.id : maks), null)
    }
    setFormTerbuka(false)
    resetSaringan()
    setSorotId(idBaru)
    setNotice({ type: 'success', text: 'Permohonan izin terkirim dan menunggu persetujuan fasilitator.' })
  }

  function resetSaringan() {
    setFilter('Semua')
    setCari('')
    setTanggalCari('')
    setPeriode('semua')
  }

  const hitung = (list: IzinRecord[]): Record<'Semua' | IzinRecord['statusPersetujuan'], number> => ({
    Semua: list.length,
    Pending: list.filter(i => i.statusPersetujuan === 'Pending').length,
    Disetujui: list.filter(i => i.statusPersetujuan === 'Disetujui').length,
    Ditolak: list.filter(i => i.statusPersetujuan === 'Ditolak').length,
  })
  // Kartu statistik = seluruh izin; angka di tombol status mengikuti periode & pencarian
  const jumlah = hitung(izinData)

  // Pilihan periode: bulan-bulan yang memiliki izin, terbaru di atas
  const daftarBulan = [...new Set(izinData.flatMap(i => [i.tanggal.slice(0, 7), (i.tanggalSelesai || i.tanggal).slice(0, 7)]))].sort().reverse()
  const batasPeriode: [string, string] | null =
    tanggalCari ? [tanggalCari, tanggalCari]
      : periode === 'semua' ? null
        : [`${periode}-01`, `${periode}-31`]
  const kataCari = cari.trim().toLowerCase()
  // Izin masuk periode bila rentang tanggalnya bersinggungan (izin 30 Okt–2 Nov ikut di November).
  // Teks pencarian juga dicocokkan dengan tanggal yang ditampilkan, mis. "29 nov" atau "nov 2026".
  const tersaring = izinData.filter(i =>
    (!batasPeriode || (i.tanggal <= batasPeriode[1] && (i.tanggalSelesai || i.tanggal) >= batasPeriode[0])) &&
    (!kataCari || `${i.alasan} ${i.catatanApprover ?? ''} ${formatRentangTanggal(i.tanggal, i.tanggalSelesai)}`.toLowerCase().includes(kataCari)))
  const adaSaringan = filter !== 'Semua' || batasPeriode !== null || kataCari !== ''
  const jumlahTersaring = hitung(tersaring)

  const daftar = (filter === 'Semua' ? tersaring : tersaring.filter(i => i.statusPersetujuan === filter))
    .sort((a, b) => b.tanggal.localeCompare(a.tanggal) || b.id - a.id)
  // Dikelompokkan per bulan tanggal mulai izin agar riwayat panjang mudah dipindai
  const kelompokBulan: { bulan: string; izin: IzinRecord[] }[] = []
  for (const i of daftar) {
    const akhir = kelompokBulan[kelompokBulan.length - 1]
    if (akhir?.bulan === i.tanggal.slice(0, 7)) akhir.izin.push(i)
    else kelompokBulan.push({ bulan: i.tanggal.slice(0, 7), izin: [i] })
  }

  const berlakuHariIni = (i: IzinRecord) =>
    i.statusPersetujuan === 'Disetujui' && i.tanggal <= today && today <= (i.tanggalSelesai || i.tanggal) &&
    (!i.hariBerulang?.length || i.hariBerulang.includes(hariIso(today)))

  const chipCls = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border'
  const saringCls = 'w-full px-3 py-2 rounded-lg border border-gray-300 hover:border-gray-400 text-sm text-gray-800 bg-white outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15 transition-colors placeholder:text-gray-400'
  const tombolAjukan = (
    <button
      type="button"
      onClick={() => bukaForm(null)}
      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg font-bold text-sm text-white bg-[#141a17] hover:bg-[#2a332e] transition-colors shadow-2xs cursor-pointer shrink-0"
      style={{ fontFamily: 'Plus Jakarta Sans' }}
    >
      <Plus className="w-4 h-4" />
      <span>Ajukan Izin</span>
    </button>
  )

  return (
    <div className="w-full space-y-6">
      {/* Ubin status = ringkasan angka sekaligus penyaring (seperti Manajemen Izin fasil) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" role="tablist" aria-label="Saring status izin">
        {([
          { status: 'Semua', label: 'Semua', ket: 'Seluruh pengajuan', ikon: <FileText className="w-4 h-4" />, warna: 'bg-gray-100 text-gray-600', aktifCls: 'border-gray-800 ring-2 ring-gray-800/10' },
          { status: 'Pending', label: 'Menunggu', ket: 'Belum diputuskan', ikon: <Clock className="w-4 h-4" />, warna: 'bg-amber-50 text-amber-700', aktifCls: 'border-amber-400 ring-2 ring-amber-400/20' },
          { status: 'Disetujui', label: 'Disetujui', ket: 'Izin diterima', ikon: <CheckCircle2 className="w-4 h-4" />, warna: 'bg-emerald-50 text-emerald-700', aktifCls: 'border-emerald-500 ring-2 ring-emerald-500/20' },
          { status: 'Ditolak', label: 'Ditolak', ket: 'Izin tidak diterima', ikon: <XCircle className="w-4 h-4" />, warna: 'bg-rose-50 text-rose-600', aktifCls: 'border-rose-400 ring-2 ring-rose-400/20' },
        ] as const).map(u => {
          const aktif = filter === u.status
          return (
            <button
              key={u.status}
              type="button"
              role="tab"
              aria-selected={aktif}
              onClick={() => setFilter(u.status)}
              className={`text-left bg-[#fff] rounded-2xl border p-4 shadow-2xs transition-all cursor-pointer hover:-translate-y-0.5 hover:shadow-md ${aktif ? u.aktifCls : 'border-gray-200/90'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-gray-600">{u.label}</span>
                <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${u.warna}`}>{u.ikon}</span>
              </div>
              <p className="mt-1 text-2xl font-extrabold text-gray-900 tabular-nums" style={{ fontFamily: 'Plus Jakarta Sans' }}>{jumlahTersaring[u.status]}</p>
              <p className="text-[11px] text-gray-400">{u.ket}{jumlahTersaring[u.status] !== jumlah[u.status] ? ` · dari ${jumlah[u.status]}` : ''}</p>
            </button>
          )
        })}
      </div>

      {notice && <NoticeBox notice={notice} />}

      <div className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden">
        <div className="px-5 pt-4 pb-4 border-b border-gray-100">
          <div className="flex items-start justify-between gap-3">
            <SectionTitle subtitle="Status terbaru setiap pengajuan izin Anda">Riwayat Pengajuan Izin</SectionTitle>
            {izinData.length > 0 && tombolAjukan}
          </div>

          {izinData.length > 0 && (
            <div className="space-y-2 mb-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="search"
                    value={cari}
                    onChange={e => setCari(e.target.value)}
                    placeholder="Cari alasan, catatan, atau tanggal (mis. 29 Nov)..."
                    aria-label="Cari izin"
                    className={`${saringCls} pl-9`}
                  />
                </div>
                <div className="grid grid-cols-2 sm:flex gap-2">
                  {/* Tanggal tertentu & bulan saling menggantikan agar tidak bertentangan */}
                  <div className="sm:w-48">
                    <DateInput clearable placeholder="Cari tanggal" className={saringCls} value={tanggalCari} onChange={e => { setTanggalCari(e.target.value); if (e.target.value) setPeriode('semua') }} />
                  </div>
                  <select value={periode} onChange={e => { setPeriode(e.target.value); setTanggalCari('') }} aria-label="Bulan izin" className={`${saringCls} sm:w-44`}>
                    <option value="semua">Semua bulan</option>
                    {daftarBulan.map(b => <option key={b} value={b}>{namaBulan(b)}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-gray-600">{filter === 'Semua' ? 'Semua status' : TAMPILAN_STATUS_IZIN[filter].label}</span>
            {adaSaringan && (
              <span className="ml-auto flex items-center gap-2 text-xs text-gray-500">
                <span>{daftar.length} dari {izinData.length} izin</span>
                <button type="button" onClick={resetSaringan} className="font-semibold text-emerald-700 hover:underline cursor-pointer">Reset filter</button>
              </span>
            )}
          </div>
        </div>

        <div className="p-4 space-y-5">
          {daftar.length === 0 && (
            <div className="py-12 text-center">
              <FileText className="w-10 h-10 text-gray-200 mx-auto mb-2" />
              {izinData.length === 0 ? (
                <>
                  <p className="text-sm text-gray-500 font-medium">Belum ada pengajuan izin</p>
                  <p className="text-xs text-gray-400 mt-1 mb-4">Ajukan izin jika Anda berhalangan mengikuti sesi presensi.</p>
                  {tombolAjukan}
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-500 font-medium">Tidak ada izin yang cocok dengan filter</p>
                  <p className="text-xs text-gray-400 mt-1 mb-4">Coba ubah periode, kata pencarian, atau status.</p>
                  <button type="button" onClick={resetSaringan} className="rounded-lg px-3.5 py-2 text-sm font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 cursor-pointer">Reset filter</button>
                </>
              )}
            </div>
          )}

          {kelompokBulan.map(g => (
            <section key={g.bulan} aria-label={namaBulan(g.bulan)}>
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 px-1 mb-2" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                {namaBulan(g.bulan)} <span className="font-semibold normal-case tracking-normal text-gray-400">· {g.izin.length} izin</span>
              </h4>
              <div className="space-y-2">
                {g.izin.map(i => {
                  const tampil = TAMPILAN_STATUS_IZIN[i.statusPersetujuan]
                  const rutin = teksHariBerulang(i.hariBerulang)
                  const diputuskan = i.statusPersetujuan !== 'Pending'
                  // Satu izin yang ditolak hanya bisa diajukan ulang sekali
                  const sudahDiulang = i.statusPersetujuan === 'Ditolak' && izinData.some(x => x.idIzinSebelumnya === i.id)
                  return (
                    <div
                      key={i.id}
                      id={`izin-${i.id}`}
                      className={`flex gap-3 p-3 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-all duration-500 ${sorotId === i.id ? 'ring-2 ring-emerald-500/50' : ''}`}
                    >
                      <KotakTanggalIzin izin={i} />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs text-gray-500 pt-0.5">
                            <span className="font-bold text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>{formatRentangTanggal(i.tanggal, i.tanggalSelesai)}</span>
                            {' · '}{i.sesi ? `Sesi ${i.sesi}` : 'Seharian'}
                            {rutin && <> · {rutin}</>}
                            {i.idIzinSebelumnya != null && <> · <span className="font-semibold text-emerald-700">Pengajuan ulang</span></>}
                          </p>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {berlakuHariIni(i) && (
                              <span className={`${chipCls} bg-amber-50 border-amber-200 text-amber-800 hidden sm:inline-flex`}>Berlaku hari ini</span>
                            )}
                            <span className={`${chipCls} ${tampil.pill}`} style={{ fontFamily: 'Plus Jakarta Sans' }}>{tampil.label}</span>
                          </div>
                        </div>

                        <p className="text-sm text-gray-800 leading-snug mt-1 break-words">{i.alasan}</p>

                        {i.catatanApprover && (
                          <p className={`text-xs mt-1 break-words ${i.statusPersetujuan === 'Ditolak' ? 'text-rose-700' : 'text-slate-800'}`}>
                            <span className="font-semibold">Catatan fasilitator:</span> {i.catatanApprover}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-1.5 text-[11px] text-gray-500">
                          {i.fileBukti && (
                            <BuktiIzin fileBukti={i.fileBukti} className="inline-flex items-center gap-1 font-semibold text-slate-700" />
                          )}
                          {diputuskan && (
                            <span className="inline-flex items-center gap-1">
                              <User className="w-3 h-3 shrink-0" />
                              {tampil.label} oleh {i.namaApprover || 'fasilitator'}{i.tanggalApproval ? ` · ${formatTanggal(i.tanggalApproval, 'tanpaHari')}` : ''}
                            </span>
                          )}

                          {/* Aksi: batalkan selama belum diputuskan, ajukan ulang bila ditolak */}
                          {i.statusPersetujuan === 'Pending' && (
                            <button
                              type="button"
                              onClick={() => setBatalTarget(i)}
                              className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold text-rose-700 border border-rose-200 bg-white hover:bg-rose-50 cursor-pointer transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                              Batalkan
                            </button>
                          )}
                          {i.statusPersetujuan === 'Ditolak' && (sudahDiulang ? (
                            <span className="ml-auto text-[11px] font-semibold text-gray-400">Sudah diajukan ulang</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => bukaForm(i)}
                              className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold text-white bg-[#141a17] hover:bg-[#2a332e] cursor-pointer transition-colors"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              Ajukan Ulang
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      </div>

      {formTerbuka && (
        <FormIzinModal
          izinData={izinData}
          user={user}
          sesiList={sesiList}
          today={today}
          dasar={dasarUlang}
          onClose={() => setFormTerbuka(false)}
          onTerkirim={handleTerkirim}
        />
      )}

      {batalTarget && (
        <ConfirmDialog
          title="Batalkan pengajuan izin?"
          message={`Izin ${formatRentangIzin(batalTarget.tanggal, batalTarget.tanggalSelesai, batalTarget.sesi, batalTarget.hariBerulang)} akan dihapus dan tidak lagi ditinjau fasilitator.`}
          confirmLabel="Ya, batalkan"
          loading={membatalkan}
          onCancel={() => { if (!membatalkan) setBatalTarget(null) }}
          onConfirm={handleBatal}
        />
      )}
    </div>
  )
}

// Pop-up formulir pengajuan izin; di HP tampil satu layar penuh, ketentuan di panel samping (bawah di HP)
function FormIzinModal({ izinData, user, sesiList, today, dasar, onClose, onTerkirim }: {
  izinData: IzinRecord[]
  user: CurrentUser
  sesiList: Sesi[]
  today: string
  // Izin ditolak yang diajukan ulang: isian diisi dari izin ini, izin lama tetap tersimpan apa adanya
  dasar: IzinRecord | null
  onClose: () => void
  onTerkirim: (izinOffline: IzinRecord[] | null) => Promise<void>
}) {
  // mode 'rentang' = tanggal mulai–selesai berurutan, 'beberapa' = tanggal terpisah yang dipilih di kalender.
  // buktiFile = data URL berkas bukti, buktiNama = nama berkas asli (untuk tampilan)
  const kosong = {
    mode: 'rentang' as 'rentang' | 'beberapa', tanggal: '', tanggalSelesai: '', tanggalList: [] as string[],
    sesi: '', alasan: '', buktiFile: '', buktiNama: '', buktiUkuran: 0,
  }
  // Pengajuan ulang: tanggal yang sudah lewat tidak bisa diajukan lagi, jadi hanya sisa rentang yang belum lewat
  const selesaiDasar = dasar ? dasar.tanggalSelesai || dasar.tanggal : ''
  const tanggalDasarLewat = !!dasar && selesaiDasar < today
  const [form, setForm] = useState(() => {
    if (!dasar) return kosong
    const mulai = dasar.tanggal < today ? today : dasar.tanggal
    return {
      ...kosong,
      tanggal: tanggalDasarLewat ? '' : mulai,
      tanggalSelesai: tanggalDasarLewat || selesaiDasar === mulai ? '' : selesaiDasar,
      sesi: dasar.sesi ?? '',
      alasan: dasar.alasan,
    }
  })
  // Pakai lagi berkas bukti izin lama selama penghuni tidak menggantinya
  const [pakaiBuktiLama, setPakaiBuktiLama] = useState(!!dasar && adalahBuktiTersimpan(dasar.fileBukti))
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  // Ganti key untuk mengosongkan <input type="file"> setelah dihapus / ditolak
  const [inputBuktiKey, setInputBuktiKey] = useState(0)
  const [seretBerkas, setSeretBerkas] = useState(false)
  const [konfirmasiTutup, setKonfirmasiTutup] = useState(false)
  const noticeRef = useRef<HTMLDivElement>(null)

  const adaIsian = form.alasan.trim() !== '' || form.tanggal !== '' || form.tanggalSelesai !== '' || form.tanggalList.length > 0 || form.sesi !== '' || form.buktiNama !== ''

  // Isian yang belum dikirim tidak langsung dibuang: minta konfirmasi dulu
  const mintaTutup = () => {
    if (submitting) return
    if (adaIsian) setKonfirmasiTutup(true)
    else onClose()
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (konfirmasiTutup) setKonfirmasiTutup(false)
      else mintaTutup()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  // Pesan error berada di bawah isian yang bisa digulir: pastikan terlihat
  useEffect(() => {
    if (notice) noticeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [notice])

  const pilihBukti = (file: File | undefined) => {
    setNotice(null)
    if (!file) return
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) {
      setNotice({ type: 'error', text: 'Berkas bukti harus PDF, JPG, atau PNG.' })
      setInputBuktiKey(k => k + 1)
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setNotice({ type: 'error', text: 'Ukuran berkas bukti maksimal 2 MB.' })
      setInputBuktiKey(k => k + 1)
      return
    }
    const reader = new FileReader()
    reader.onload = () => setForm(p => ({ ...p, buktiFile: String(reader.result), buktiNama: file.name, buktiUkuran: file.size }))
    reader.onerror = () => setNotice({ type: 'error', text: 'Berkas bukti gagal dibaca.' })
    reader.readAsDataURL(file)
  }

  const hapusBukti = () => {
    setForm(p => ({ ...p, buktiFile: '', buktiNama: '', buktiUkuran: 0 }))
    setInputBuktiKey(k => k + 1)
  }

  // Tanggal izin sebagai daftar rentang berurutan (mode beberapa tanggal bisa menghasilkan lebih dari satu)
  const rentang: [string, string][] = form.mode === 'beberapa'
    ? kelompokkanTanggal(form.tanggalList)
    : form.tanggal ? [[form.tanggal, form.tanggalSelesai || form.tanggal]] : []
  const jumlahHari = form.mode === 'beberapa'
    ? form.tanggalList.length
    : rentang.length && rentang[0][1] >= rentang[0][0] ? dateRangeDesc(rentang[0][0], rentang[0][1]).length : 0

  const handleSubmit = async () => {
    setNotice(null)
    const sesi = form.sesi || null
    if (rentang.length === 0) {
      setNotice({ type: 'error', text: form.mode === 'beberapa' ? 'Pilih minimal satu tanggal izin.' : 'Tanggal mulai izin wajib diisi.' })
      return
    }
    if (!form.alasan.trim()) {
      setNotice({ type: 'error', text: 'Alasan izin wajib diisi.' })
      return
    }
    if (rentang[0][0] < today) {
      setNotice({ type: 'error', text: 'Izin tidak dapat diajukan untuk tanggal yang sudah lewat.' })
      return
    }
    if (rentang.some(([dari, sampai]) => sampai < dari)) {
      setNotice({ type: 'error', text: 'Tanggal selesai tidak boleh sebelum tanggal mulai.' })
      return
    }
    // Cegah pengajuan ganda pada tanggal/sesi yang sudah diajukan atau disetujui
    const bentrok = izinData.find(i => {
      if (i.statusPersetujuan === 'Ditolak' || (i.sesi && sesi && i.sesi !== sesi)) return false
      const akhirLama = i.tanggalSelesai || i.tanggal
      return rentang.some(([dari0, sampai0]) => {
        const dari = dari0 > i.tanggal ? dari0 : i.tanggal
        const sampai = sampai0 < akhirLama ? sampai0 : akhirLama
        // Izin rutin lama hanya berlaku pada hari tertentu dalam rentangnya
        return dari <= sampai && adaHariDalamRentang(dari, sampai, i.hariBerulang?.length ? i.hariBerulang : SEMUA_HARI)
      })
    })
    if (bentrok) {
      setNotice({ type: 'error', text: `Sudah ada izin ${TAMPILAN_STATUS_IZIN[bentrok.statusPersetujuan].label.toLowerCase()} pada ${formatRentangIzin(bentrok.tanggal, bentrok.tanggalSelesai, bentrok.sesi, bentrok.hariBerulang)}.` })
      return
    }

    setSubmitting(true)
    const umum = {
      nim: user.nim, alasan: form.alasan, sesi, buktiFile: form.buktiFile || null,
      idIzinSebelumnya: dasar?.id ?? null, pakaiBuktiLama: pakaiBuktiLama && !form.buktiFile,
    }
    const result = await submitIzinApi(form.mode === 'beberapa'
      ? { ...umum, tanggalList: form.tanggalList }
      : { ...umum, tanggal: rentang[0][0], tanggalSelesai: rentang[0][1] })
    if (result.ok) {
      await onTerkirim(null)
      return
    }
    if (result.offline) {
      await onTerkirim(rentang.map(([dari, sampai], n) => ({
        id: Date.now() + n, nim: user.nim, namaPenghuni: user.nama, nomorKamar: user.nomorKamar || '', namaGedung: user.namaGedung || '',
        alasan: form.alasan, tanggal: dari, tanggalSelesai: sampai, sesi, statusPersetujuan: 'Pending',
        fileBukti: form.buktiNama || (umum.pakaiBuktiLama && dasar ? dasar.fileBukti : ''), idIzinSebelumnya: dasar?.id ?? null,
      })))
      return
    }
    setNotice({ type: 'error', text: result.message })
    setSubmitting(false)
  }

  // hover:border-* juga membuat tombol DateInput lolos dari aturan tema kaca yang memutihkan garis tepi
  const inputCls = 'w-full px-3 py-2.5 rounded-lg border border-gray-300 hover:border-gray-400 text-sm text-gray-800 bg-white outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15 transition-colors placeholder:text-gray-400'
  const labelCls = 'block text-xs font-semibold text-gray-700 mb-1.5'
  const wajib = <span className="text-rose-500">*</span>
  // Scrollbar tipis abu-abu (scrollbar global berwarna hijau terang tampak seperti garis pemisah)
  const scrollTipisCls = '[scrollbar-width:thin] [scrollbar-color:#d1d5db_transparent] [&::-webkit-scrollbar-thumb]:bg-gray-300'

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center bg-black/50 backdrop-blur-xs sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="judul-form-izin"
      onMouseDown={e => { if (e.target === e.currentTarget) mintaTutup() }}
    >
      {/* Sengaja bg-[#fff], bukan bg-white: tema kaca (index.css) membuat .bg-white di modal tembus pandang
          sehingga form tampak abu-abu kusam di atas latar gelap */}
      <div className="bg-[#fff] w-full sm:max-w-3xl h-full sm:h-auto sm:max-h-[90vh] sm:rounded-2xl shadow-2xl sm:border border-emerald-100 overflow-hidden flex flex-col">
        <div className="px-5 sm:px-6 py-4 modal-header bg-white border-b border-gray-100 text-gray-900 gap-3 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-10 h-10 shrink-0 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center"><FileText className="w-5 h-5" /></span>
            <div className="min-w-0">
              <h3 id="judul-form-izin" className="text-base font-extrabold text-gray-900 tracking-tight" style={{ fontFamily: 'Plus Jakarta Sans' }}>{dasar ? 'Ajukan Ulang Izin' : 'Ajukan Izin'}</h3>
              <p className="text-xs text-gray-500 mt-0.5">Pengajuan akan ditinjau oleh fasilitator gedung Anda</p>
            </div>
          </div>
          <button
            type="button"
            onClick={mintaTutup}
            aria-label="Tutup"
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Di HP seluruh isi digulir bersama; di layar lebar form & ketentuan bergulir masing-masing */}
        <div className={`flex-1 min-h-0 overflow-y-auto md:overflow-hidden md:flex ${scrollTipisCls}`}>
          <div className={`md:flex-1 md:min-w-0 md:overflow-y-auto p-5 sm:p-6 space-y-4 ${scrollTipisCls}`}>
            {dasar && (
              <div className="px-3.5 py-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
                <p className="font-bold" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                  Izin {formatRentangTanggal(dasar.tanggal, dasar.tanggalSelesai)} sebelumnya ditolak
                </p>
                {dasar.catatanApprover && <p><span className="font-semibold">Catatan fasilitator:</span> {dasar.catatanApprover}</p>}
                <p className="text-amber-800">
                  Perbaiki isian sesuai catatan, lalu kirim ulang. Izin yang ditolak tetap tersimpan di riwayat.
                  {tanggalDasarLewat && ' Tanggal izin sebelumnya sudah lewat, pilih tanggal baru.'}
                </p>
              </div>
            )}
            <div>
              <label className={labelCls} style={{ fontFamily: 'Plus Jakarta Sans' }}>Tanggal Izin {wajib}</label>
              <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-gray-100 mb-3" role="radiogroup" aria-label="Cara memilih tanggal">
                {([['rentang', 'Rentang tanggal'], ['beberapa', 'Beberapa tanggal']] as const).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    role="radio"
                    aria-checked={form.mode === mode}
                    onClick={() => setForm(p => ({ ...p, mode }))}
                    className={`py-2 rounded-md text-xs font-semibold cursor-pointer transition-colors ${form.mode === mode ? 'bg-white text-emerald-800 shadow-2xs' : 'text-gray-600 hover:text-gray-900'}`}
                    style={{ fontFamily: 'Plus Jakarta Sans' }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {form.mode === 'rentang' ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="block text-[11px] font-semibold text-gray-500 mb-1">Mulai</span>
                      <DateInput min={today} className={inputCls} value={form.tanggal} onChange={e => setForm(p => ({ ...p, tanggal: e.target.value }))} />
                    </div>
                    <div>
                      <span className="block text-[11px] font-semibold text-gray-500 mb-1">Selesai</span>
                      <DateInput clearable min={form.tanggal || today} className={inputCls} value={form.tanggalSelesai} onChange={e => setForm(p => ({ ...p, tanggalSelesai: e.target.value }))} />
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1.5">Untuk izin beberapa hari berturut-turut. Kosongkan tanggal selesai jika hanya satu hari.</p>
                </>
              ) : (
                <PilihBeberapaTanggal value={form.tanggalList} onChange={tanggalList => setForm(p => ({ ...p, tanggalList }))} min={today} />
              )}
            </div>

            <div>
              <label className={labelCls} style={{ fontFamily: 'Plus Jakarta Sans' }}>Sesi</label>
              <select className={inputCls} value={form.sesi} onChange={e => setForm(p => ({ ...p, sesi: e.target.value }))}>
                <option value="">Seharian (semua sesi)</option>
                {sesiList.map(s => <option key={s.id} value={s.nama}>Sesi {s.nama} ({s.jamMulai}–{s.jamSelesai})</option>)}
              </select>
            </div>

            {jumlahHari > 0 && (
              <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-xs text-gray-700">
                <CalendarDays className="w-4 h-4 text-emerald-700 shrink-0 mt-px" />
                <span>
                  <strong>{jumlahHari} hari</strong> izin · {rentang.map(([dari, sampai]) => formatRentangTanggal(dari, sampai)).join(', ')} · {form.sesi ? `Sesi ${form.sesi}` : 'Seharian'}
                </span>
              </div>
            )}

            <div>
              <label className={labelCls} style={{ fontFamily: 'Plus Jakarta Sans' }}>Alasan / Keperluan {wajib}</label>
              <textarea
                className={`${inputCls} resize-y min-h-[88px]`}
                rows={3}
                placeholder="Misal: sakit, kuliah malam, keperluan keluarga..."
                value={form.alasan}
                onChange={e => setForm(p => ({ ...p, alasan: e.target.value }))}
              />
            </div>

            <div>
              <label className={labelCls} style={{ fontFamily: 'Plus Jakarta Sans' }}>
                Berkas Bukti <span className="font-normal text-gray-400">(opsional)</span>
              </label>
              {pakaiBuktiLama && !form.buktiNama && dasar ? (
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50/60">
                  <div className="w-9 h-9 rounded-md bg-white border border-slate-200 flex items-center justify-center shrink-0">
                    <Paperclip className="w-4 h-4 text-slate-700" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-900">Memakai bukti dari izin sebelumnya</p>
                    <BuktiIzin fileBukti={dasar.fileBukti} className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700" />
                  </div>
                  <button type="button" onClick={() => setPakaiBuktiLama(false)} className="text-xs font-semibold text-gray-600 hover:underline cursor-pointer shrink-0">Ganti</button>
                </div>
              ) : form.buktiNama ? (
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-emerald-200 bg-emerald-50/60">
                  <div className="w-9 h-9 rounded-md bg-white border border-emerald-200 flex items-center justify-center shrink-0">
                    <Paperclip className="w-4 h-4 text-emerald-700" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-emerald-900 truncate" title={form.buktiNama}>{form.buktiNama}</p>
                    <p className="text-[11px] text-emerald-700">{formatUkuranBerkas(form.buktiUkuran)}</p>
                  </div>
                  <button type="button" onClick={hapusBukti} className="text-xs font-semibold text-rose-600 hover:underline cursor-pointer shrink-0">Hapus</button>
                </div>
              ) : (
                <label
                  onDragOver={e => { e.preventDefault(); setSeretBerkas(true) }}
                  onDragLeave={() => setSeretBerkas(false)}
                  onDrop={e => { e.preventDefault(); setSeretBerkas(false); pilihBukti(e.dataTransfer.files?.[0]) }}
                  className={`flex flex-col items-center justify-center gap-1 px-3 py-5 rounded-lg border-2 border-dashed text-center cursor-pointer transition-colors ${seretBerkas ? 'border-emerald-600 bg-emerald-50' : 'border-gray-300 hover:border-emerald-600 hover:bg-gray-50'}`}
                >
                  <Paperclip className="w-5 h-5 text-gray-400" />
                  <span className="text-xs font-semibold text-gray-700">Klik untuk memilih atau seret berkas ke sini</span>
                  <span className="text-[11px] text-gray-500">Surat dokter, tiket, dll. · PDF, JPG, PNG · maks. 2 MB</span>
                  <input key={inputBuktiKey} type="file" accept="application/pdf,image/jpeg,image/png" className="sr-only" onChange={e => pilihBukti(e.target.files?.[0])} />
                </label>
              )}
            </div>

            {notice && <div ref={noticeRef}><NoticeBox notice={notice} /></div>}
          </div>

          <aside className={`md:w-64 shrink-0 border-t md:border-t-0 md:border-l border-emerald-100 bg-[#f4f8f6] p-5 sm:p-6 md:overflow-y-auto ${scrollTipisCls}`}>
            <h4 className="text-sm font-bold text-gray-900 flex items-center gap-1.5 mb-3" style={{ fontFamily: 'Plus Jakarta Sans' }}>
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              <span>Ketentuan Izin</span>
            </h4>
            <ol className="space-y-3">
              {[
                'Ajukan izin sebelum sesi presensi yang bersangkutan dimulai.',
                'Izin sakit atau pulang kampung lebih dari 1 hari wajib menyertakan bukti/surat keterangan.',
                'Keputusan persetujuan sepenuhnya ditentukan oleh fasilitator gedung Anda.',
                'Izin yang disetujui otomatis mengubah status presensi menjadi Izin (bebas alpa).',
              ].map((teks, n) => (
                <li key={n} className="flex gap-2.5 text-xs text-gray-600 leading-relaxed">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold flex items-center justify-center shrink-0">{n + 1}</span>
                  <span>{teks}</span>
                </li>
              ))}
            </ol>
            <p className="mt-4 pt-3 border-t border-gray-200 text-[11px] text-gray-500 leading-relaxed">
              Berhalangan di tanggal yang tidak berurutan? Pilih <strong>Beberapa tanggal</strong> agar cukup sekali mengajukan.
            </p>
          </aside>
        </div>

        <div className="px-5 sm:px-6 py-4 border-t border-gray-100 bg-[#fff] flex justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={mintaTutup}
            disabled={submitting}
            className="rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-200 cursor-pointer disabled:opacity-60"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 sm:flex-none rounded-xl px-4 py-2.5 font-bold text-sm text-white bg-[#141a17] hover:bg-[#2a332e] transition-colors shadow-2xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            style={{ fontFamily: 'Plus Jakarta Sans' }}
          >
            <Send className="w-4 h-4" />
            <span>{submitting ? 'Mengirim...' : 'Kirim Permohonan'}</span>
          </button>
        </div>
      </div>

      {konfirmasiTutup && (
        <ConfirmDialog
          title="Tutup formulir izin?"
          message="Isian formulir belum dikirim dan akan hilang jika ditutup."
          confirmLabel="Ya, tutup"
          onCancel={() => setKonfirmasiTutup(false)}
          onConfirm={onClose}
        />
      )}
    </div>
  )
}

function PenghuniProfil({ user, onLogout }: { user: CurrentUser; onLogout: () => void }) {
  const [pesanFoto, setPesanFoto] = useState('')

  const dataPribadi = [
    { label: 'Alamat Email', value: user.email || '-', icon: <Mail className="w-4 h-4" /> },
    { label: 'Nomor WhatsApp / HP', value: user.noHp || '-', icon: <User className="w-4 h-4" /> },
    { label: 'Asal Daerah', value: user.asal || '-', icon: <MapPin className="w-4 h-4" /> },
    { label: 'Gedung Asrama', value: user.namaGedung || '-', icon: <Building className="w-4 h-4" /> },
    { label: 'Nomor Kamar', value: user.nomorKamar || '-', icon: <DoorClosed className="w-4 h-4" /> },
    { label: 'Status Akun', value: 'Terverifikasi (NIM aktif)', icon: <ShieldCheck className="w-4 h-4" /> },
  ]
  const ketentuan = [
    { label: 'Kapasitas standar', value: '2 orang / kamar' },
    { label: 'Kunci gerbang malam', value: '22:00 WIB', sorot: true },
    { label: 'Izin menginap di luar', value: 'Wajib lewat menu Izin' },
    { label: 'Layanan darurat', value: 'Pos Pengelola Asrama' },
  ]

  return (
    <div className="space-y-5 w-full">
      {/* Baris 1: identitas selebar halaman */}
      <ProfilHeader
        user={user}
        peran="Penghuni Asrama Aktif"
        keterangan={user.namaGedung || undefined}
        onPesan={setPesanFoto}
        stats={[
          { label: 'Kamar', nilai: user.nomorKamar || '-' },
          { label: 'Terdaftar sejak', nilai: <span className="text-base">{user.tanggalMasuk ? formatTanggal(user.tanggalMasuk, 'tanpaHari') : '-'}</span> },
          { label: 'Status akun', nilai: 'Aktif' },
        ]}
      />

      {/* Baris 2: data pribadi | ketentuan (tinggi sama) */}
      <div className="grid lg:grid-cols-2 gap-5 items-stretch">
        <KartuProfil ikon={<User />} judul="Informasi Data Pribadi" sub="Identitas penghuni yang terdaftar di sistem" kanan={<Badge status="Aktif" />}>
          <div className="flex-1 flex flex-col divide-y divide-gray-100">
            {dataPribadi.map(row => (
              <div key={row.label} className="flex-1 flex items-center gap-3 px-5 py-3 text-xs">
                <span className="w-8 h-8 shrink-0 rounded-lg bg-gray-50 border border-gray-100 text-emerald-700 flex items-center justify-center">{row.icon}</span>
                <span className="w-40 shrink-0 text-gray-500 font-medium">{row.label}</span>
                <span className="flex-1 min-w-0 text-right font-semibold text-gray-900 truncate" style={{ fontFamily: 'Plus Jakarta Sans' }}>{row.value}</span>
              </div>
            ))}
          </div>
        </KartuProfil>

        <KartuProfil
          ikon={<Building />}
          judul="Ketentuan & Fasilitas Kamar"
          sub="Aturan yang berlaku untuk penghuni"
          kanan={<span className="px-2.5 py-1 rounded-full text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200">TA 2026/2027</span>}
        >
          <div className="flex-1 flex flex-col divide-y divide-gray-100">
            {ketentuan.map(k => (
              <div key={k.label} className="flex-1 flex items-center justify-between gap-3 px-5 py-3 text-xs">
                <span className="text-gray-500 font-medium">{k.label}</span>
                <span className={`font-semibold text-right ${k.sorot ? 'text-emerald-800' : 'text-gray-900'}`} style={{ fontFamily: 'Plus Jakarta Sans' }}>{k.value}</span>
              </div>
            ))}
          </div>
        </KartuProfil>
      </div>

      {/* Baris 3: keamanan selebar halaman */}
      <KartuGantiPassword user={user} onLogout={onLogout} pesanLuar={pesanFoto} />
    </div>
  )
}

// Foto bukti absen event (diambil dengan token); klik untuk membuka pop-up
function FotoBuktiEvent({ foto, judul }: { foto: string; judul: string }) {
  const [src, setSrc] = useState<string | null>(foto.startsWith('data:') ? foto : null)
  const [gagal, setGagal] = useState(false)
  const [buka, setBuka] = useState(false)
  useEffect(() => {
    if (foto.startsWith('data:')) { setSrc(foto); return }
    let aktif = true
    let dibuat: string | null = null
    setGagal(false)
    fetchFotoEvent(foto).then(url => {
      if (!aktif) { if (url?.startsWith('blob:')) URL.revokeObjectURL(url); return }
      if (url?.startsWith('blob:')) dibuat = url
      setSrc(url)
      setGagal(!url)
    })
    return () => { aktif = false; if (dibuat) URL.revokeObjectURL(dibuat) }
  }, [foto])
  return (
    <>
      <button type="button" onClick={() => setBuka(true)} className="w-9 h-9 shrink-0 rounded-lg overflow-hidden border border-gray-200 bg-gray-100 flex items-center justify-center cursor-zoom-in" title="Lihat foto bukti" aria-label="Lihat foto bukti">
        {src ? <img src={src} alt="Foto bukti absen" className="w-full h-full object-cover" /> : <Camera className="w-4 h-4 text-gray-400" />}
      </button>
      {buka && <Pratinjau judul="Foto bukti absen event" keterangan={judul} url={src} gagal={gagal} onClose={() => setBuka(false)} />}
    </>
  )
}

function PenghuniEvent({
  eventList,
  user,
  onBukaAbsen,
  today,
  now,
  liburHariIni,
  notice,
}: {
  eventList: EventAsrama[]
  user: CurrentUser
  onBukaAbsen: (ev: EventAsrama) => void
  today: string
  now: Date
  liburHariIni?: HariLibur
  notice?: Notice | null
}) {
  const [filterKategori, setFilterKategori] = useState<'semua' | 'seluruh' | 'gedung'>('semua')
  const [filterStatus, setFilterStatus] = useState<string>('semua')
  const [cari, setCari] = useState('')

  // Event yang relevan untuk penghuni: event seluruh asrama atau event gedung tempat tinggalnya
  const eventSaya = eventMilik(eventList, user, user.idGedung)

  const filtered = eventSaya.filter(ev => {
    const st = getStatusEvent(ev, today, now)
    if (filterKategori === 'seluruh' && ev.tipe !== 'seluruh') return false
    if (filterKategori === 'gedung' && ev.tipe !== 'gedung') return false
    if (filterStatus !== 'semua' && st !== filterStatus) return false
    if (cari.trim()) {
      const q = cari.toLowerCase()
      return (
        ev.judul.toLowerCase().includes(q) ||
        (ev.deskripsi || '').toLowerCase().includes(q) ||
        ev.lokasi.toLowerCase().includes(q)
      )
    }
    return true
  })

  // Statistik ringkas penghuni
  const totalEvent = eventSaya.length
  const sedangBerlangsung = eventSaya.filter(ev => getStatusEvent(ev, today, now) === 'Sedang Berlangsung').length
  const akanDatang = eventSaya.filter(ev => getStatusEvent(ev, today, now) === 'Akan Datang').length
  const hadirCount = eventSaya.filter(ev => ev.statusKehadiran === 'Hadir').length

  return (
    <div className="space-y-6">
      {/* Kepala halaman: judul + ringkasan (hijau hanya dipakai di dashboard) */}
      <div className="bg-[#fff] rounded-2xl border border-gray-200/90 shadow-2xs p-5 flex flex-col lg:flex-row lg:items-center gap-5">
        <div className="lg:mr-auto min-w-0">
          <h2 className="text-lg font-extrabold text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>Pengumuman & Daftar Event</h2>
          <p className="text-xs text-gray-500 mt-0.5 max-w-xl">Ikuti kegiatan asrama dan lakukan presensi tepat waktu dengan lokasi GPS dan foto wajah.</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 lg:w-[620px]">
          {[
            { label: 'Total event', value: totalEvent, ikon: <CalendarDays className="w-4 h-4" />, warna: 'bg-gray-100 text-gray-700' },
            { label: 'Berlangsung', value: sedangBerlangsung, ikon: <Clock className="w-4 h-4" />, warna: 'bg-amber-50 text-amber-700' },
            { label: 'Akan datang', value: akanDatang, ikon: <CalendarDays className="w-4 h-4" />, warna: 'bg-slate-100 text-slate-700' },
            { label: 'Dihadiri', value: hadirCount, ikon: <CheckCircle2 className="w-4 h-4" />, warna: 'bg-emerald-50 text-emerald-700' },
          ].map(x => (
            <div key={x.label} className="p-3.5 rounded-xl bg-gray-50/70 border border-gray-100">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-gray-500 truncate">{x.label}</span>
                <span className={`w-7 h-7 shrink-0 rounded-lg flex items-center justify-center ${x.warna}`}>{x.ikon}</span>
              </div>
              <p className="mt-1 text-2xl font-extrabold text-gray-900 tabular-nums" style={{ fontFamily: 'Plus Jakarta Sans' }}>{x.value}</p>
            </div>
          ))}
        </div>
      </div>

      {notice && <NoticeBox notice={notice} />}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Filter Kategori */}
          <div className="flex rounded-xl bg-gray-100 p-1 text-xs font-bold text-gray-600">
            <button
              type="button"
              onClick={() => setFilterKategori('semua')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                filterKategori === 'semua' ? 'bg-white text-emerald-900 shadow-xs' : 'hover:text-gray-900'
              }`}
            >
              Semua
            </button>
            <button
              type="button"
              onClick={() => setFilterKategori('seluruh')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                filterKategori === 'seluruh' ? 'bg-white text-emerald-900 shadow-xs' : 'hover:text-gray-900'
              }`}
            >
              Seluruh Asrama
            </button>
            <button
              type="button"
              onClick={() => setFilterKategori('gedung')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                filterKategori === 'gedung' ? 'bg-white text-emerald-900 shadow-xs' : 'hover:text-gray-900'
              }`}
            >
              Gedung {user.namaGedung ? `(${user.namaGedung})` : 'Saya'}
            </button>
          </div>

          {/* Filter Status */}
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs bg-white outline-none focus:border-emerald-600 font-medium"
          >
            <option value="semua">Semua Status</option>
            <option value="Sedang Berlangsung">Sedang Berlangsung</option>
            <option value="Akan Datang">Akan Datang</option>
            <option value="Selesai">Selesai</option>
          </select>
        </div>

        {/* Input Pencarian */}
        <div className="relative w-full sm:w-auto">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari event, kegiatan, lokasi..."
            value={cari}
            onChange={e => setCari(e.target.value)}
            className="pl-8 pr-3 py-2 rounded-xl border border-gray-200 text-xs outline-none focus:border-emerald-600 w-full sm:w-72 bg-gray-50/50"
          />
        </div>
      </div>

      {/* Grid Daftar Event */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-200 shadow-2xs">
          <CalendarDays className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h4 className="font-extrabold text-base text-gray-800 mb-1" style={{ fontFamily: 'Plus Jakarta Sans' }}>
            Tidak Ada Event yang Sesuai
          </h4>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            {cari || filterStatus !== 'semua' || filterKategori !== 'semua'
              ? 'Coba atur ulang filter pencarian Anda untuk melihat event lainnya.'
              : 'Belum ada pengumuman atau agenda kegiatan asrama yang terjadwal.'}
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map(ev => {
            const st = getStatusEvent(ev, today, now)
            const sudahHadir = ev.statusKehadiran === 'Hadir'
            const fotoDitolak = ev.presensiSaya?.statusFoto === 'Ditolak'
            const tidakHadir = ev.statusKehadiran === 'Tidak Hadir'
            // Hari libur: semua absen (termasuk event) dimatikan
            const libur = ev.tanggal === today && !!liburHariIni
            const bisaAbsen = st === 'Sedang Berlangsung' && !libur && (!sudahHadir && (!tidakHadir || fotoDitolak))
            const statusFoto = ev.presensiSaya?.statusFoto

            return (
              <KartuEvent
                key={ev.id}
                ev={ev}
                status={st}
                sorot={st === 'Sedang Berlangsung' && !sudahHadir}
                penyelenggara={`Penyelenggara: ${ev.namaPembuat || (ev.tipe === 'seluruh' ? 'Pengelola Asrama' : 'Fasilitator Gedung')}`}
                kehadiran={
                  sudahHadir ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-600 text-white shadow-sm">
                      <CheckCircle2 className="w-3.5 h-3.5" />Hadir
                    </span>
                  ) : tidakHadir ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-600 text-white shadow-sm">
                      <XCircle className="w-3.5 h-3.5" />Tidak Hadir
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#fff] text-amber-800 border border-amber-200 shadow-sm">
                      <AlertCircle className="w-3.5 h-3.5" />Belum absen
                    </span>
                  )
                }
              >
                {/* Bottom CTA / Status Info */}
                <div className="pt-2 border-t border-gray-100">
                  {sudahHadir ? (
                    <div className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 ${statusFoto === 'Menunggu' ? 'bg-amber-50/70 border-amber-200' : 'bg-emerald-50/70 border-emerald-200'}`}>
                      <span className="flex items-center gap-2 min-w-0">
                        {statusFoto === 'Menunggu'
                          ? <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                          : <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                        <span className="min-w-0">
                          <span className={`block font-semibold truncate ${statusFoto === 'Menunggu' ? 'text-amber-900' : 'text-emerald-900'}`}>
                            {statusFoto === 'Menunggu' ? 'Tercatat · menunggu validasi foto' : 'Kehadiran tercatat'}
                          </span>
                          {ev.presensiSaya?.waktu && <span className="block text-[11px] text-gray-500">Absen pukul {ev.presensiSaya.waktu.slice(0, 5)} WIB</span>}
                        </span>
                      </span>
                      {ev.presensiSaya?.foto && <FotoBuktiEvent foto={ev.presensiSaya.foto} judul={ev.judul} />}
                    </div>
                  ) : bisaAbsen ? (
                    <div className="space-y-2">
                      {fotoDitolak && (
                        <p className="text-[11px] text-rose-700 font-semibold">Foto ditolak{ev.presensiSaya?.catatanValidasi ? `: ${ev.presensiSaya.catatanValidasi}` : ''}. Silakan absen ulang.</p>
                      )}
                    <button
                      type="button"
                      onClick={() => onBukaAbsen(ev)}
                      className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-[#141a17] hover:bg-[#2a332e] transition-colors shadow-2xs flex items-center justify-center gap-2 cursor-pointer"
                      style={{ fontFamily: 'Plus Jakarta Sans' }}
                    >
                      <UserCheck className="w-4 h-4" />
                      <span>{fotoDitolak ? 'Absen Ulang Event' : 'Presensi Event Sekarang'}</span>
                    </button>
                    </div>
                  ) : libur && st !== 'Selesai' ? (
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs font-medium flex items-center gap-1.5">
                      <CalendarDays className="w-4 h-4 text-slate-500 shrink-0" />
                      <span>Hari libur ({liburHariIni?.keterangan}) · absen event dinonaktifkan</span>
                    </div>
                  ) : tidakHadir ? (
                    <div className="p-2.5 rounded-xl bg-rose-50/70 border border-rose-200 text-rose-900 text-xs font-medium flex items-center gap-1.5">
                      <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
                      <span>{fotoDitolak ? `Foto ditolak${ev.presensiSaya?.catatanValidasi ? `: ${ev.presensiSaya.catatanValidasi}` : ''} · event sudah selesai` : 'Tercatat tidak hadir'}</span>
                    </div>
                  ) : st === 'Akan Datang' ? (
                    <div className="p-2.5 rounded-xl bg-slate-50/60 border border-slate-100 text-slate-900 text-xs font-medium flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-slate-600 shrink-0" />
                      <span>Presensi akan dibuka pada hari pelaksanaan pukul {ev.jamMulai} WIB</span>
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-600 text-xs font-medium flex items-center gap-1.5">
                      <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
                      <span>Event telah selesai. Sesi presensi ditutup.</span>
                    </div>
                  )}
                </div>
              </KartuEvent>
            )
          })}
        </div>
      )}
    </div>
  )
}
