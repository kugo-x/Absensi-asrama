import { useState, useEffect, useRef } from 'react'
import type { AturanPresensi, CurrentUser, EventAsrama, Gedung, HariIso, HariLibur, IzinRecord, ModeUji, PresensiRecord, Sesi } from '../types'
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
  changePasswordApi, uploadProfilePhotoApi,
  fetchEvent, absenEventApi,
} from '../api'
import KalenderKehadiran from '../components/KalenderKehadiran'
import { EventPresensiModal } from '../components/EventModals'
import { distanceMeters, getCurrentPosition, type GpsPosition } from '../geo'
import {
  addDays, cariLibur, formatTanggal, jamPresensi, hitungStatus, keteranganStatus, periodeRekap, riwayatPenghuni,
  faseSesi, sesiAktif, statusSesi, toHM, todayLocal, type DataPresensi, type StatusDetail,
  SEMUA_HARI, adaHariDalamRentang, hariIso, dateRangeDesc, formatRentangTanggal, teksHariBerulang, kelompokkanTanggal,
} from '../logic'
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
  Lock,
  Compass,
  RefreshCw,
  Bell,
  Palmtree,
  Camera,
  Eye,
  EyeOff,
  Pencil,
  ArrowRight,
  CalendarDays,
  Search,
  Plus,
  X,
} from 'lucide-react'
import Cropper, { type Area } from 'react-easy-crop'

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

function bisaPresensi(d: StatusDetail) {
  return d.status === 'Belum' && d.fase === 'dibuka'
}

function alasanTidakBisaPresensi(d: StatusDetail, sesi: Sesi): string {
  if (d.status === 'Hadir') return 'Presensi sesi ini sudah tercatat'
  if (d.status === 'Izin') return 'Anda berstatus izin pada sesi ini'
  if (d.status === 'Libur') return 'Hari libur, tidak ada kewajiban presensi'
  if (d.status === 'Tidak Hadir') return 'Sesi sudah ditutup'
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
        statusKehadiranSaya: pr ? (pr.status as 'Hadir' | 'Tidak Hadir') : ev.statusKehadiranSaya || null,
        waktuPresensiSaya: pr ? pr.waktu : ev.waktuPresensiSaya || null,
        fotoPresensiSaya: pr ? pr.foto : ev.fotoPresensiSaya || null,
      }
    })
  })
  const [presensiModalEvent, setPresensiModalEvent] = useState<EventAsrama | null>(null)
  const [gps, setGps] = useState<GpsState>({ status: 'idle' })
  const [notice, setNotice] = useState<Notice | null>(null)
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

  useEffect(() => {
    fetchPresensi().then(setPresensi)
    fetchIzin().then(data => setIzinData(data.filter(i => i.nim === user.nim)))
    fetchSesi().then(setSesiList)
    fetchLibur().then(setLibur)
    fetchModeUji().then(setModeUji)
    fetchAturanPresensi().then(setAturan)
    fetchEvent().then(res => {
      if (res && res.length > 0) {
        setEventList(res)
      }
    })
    fetchGedung().then(list => {
      const g = findGedung(list, user)
      setGedung(g)
      readLocation(g)
    })
  }, [user.nim])

  const today = todayLocal()
  const data: DataPresensi = { presensi, izin: izinData, libur }
  const sesiHariIni: SesiHariIni[] = sesiAktif(sesiList, user.namaGedung, today).map(sesi => {
    const detail = statusSesi(user.nim, today, sesi, data, now)
    // Mode uji: jam sesi diabaikan, sesi yang belum punya catatan dianggap sedang dibuka
    const dibukaUji = modeUji.abaikanJam && !detail.presensi && !detail.izin && !detail.libur
    return { sesi, detail: dibukaUji ? { ...detail, status: 'Belum' as const, fase: 'dibuka' as const } : detail }
  })
  const riwayat = riwayatPenghuni(user.nim, periodeRekap(today, user.tanggalMasuk), today, sesiList, data, now, user.namaGedung)
  // Batas akurasi GPS yang berlaku (0 = tidak diperiksa); ikut dilonggarkan mode uji "abaikan radius"
  const akurasiMaks = modeUji.abaikanRadius ? 0 : aturan.gpsAkurasiMaks
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

    if (!bisaPresensi(item.detail)) {
      setNotice({ type: 'error', text: alasanTidakBisaPresensi(item.detail, item.sesi) })
      return
    }
    if (!hasKoordinat(gedung)) {
      setNotice({ type: 'error', text: 'Koordinat gedung asrama Anda belum diatur oleh admin. Presensi belum dapat dilakukan.' })
      return
    }
    if (!foto) {
      setNotice({ type: 'error', text: 'Ambil foto wajah terlebih dahulu sebelum mengirim presensi.' })
      return
    }

    setCheckingIn(true)
    const loc = await readLocation(gedung)
    if (loc.status !== 'ok' || !loc.position || loc.distance === undefined) {
      setNotice({ type: 'error', text: loc.error || 'Lokasi tidak dapat dibaca.' })
      setCheckingIn(false)
      return
    }
    if (akurasiMaks > 0 && loc.position.accuracy > akurasiMaks) {
      setNotice({
        type: 'error',
        text: `Akurasi GPS Anda ±${Math.round(loc.position.accuracy)} m, melebihi batas ${akurasiMaks} m. Aktifkan GPS/mode akurasi tinggi, pindah ke area terbuka, lalu coba lagi.`,
      })
      setCheckingIn(false)
      return
    }
    if (loc.distance > gedung.radiusMeter && !modeUji.abaikanRadius) {
      setNotice({
        type: 'error',
        text: `Anda berada ${Math.round(loc.distance)} m dari ${gedung.nama}. Presensi hanya dapat dilakukan dalam radius ${gedung.radiusMeter} m.`,
      })
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
      setNotice({ type: 'success', text: `Presensi sesi ${sesiNama} berhasil dicatat (jarak ${Math.round(loc.distance)} m dari gedung).` })
      if (result.ok) fetchPresensi().then(setPresensi)
    } else {
      setNotice({ type: 'error', text: result.message })
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
            statusKehadiranSaya: 'Hadir' as const,
            waktuPresensiSaya: jam,
            fotoPresensiSaya: data.foto,
          }
        }
        return ev
      }))
      if (result.ok) {
        fetchEvent().then(setEventList)
      }
      return { ok: true, message: result.message || 'Presensi event berhasil dicatat!' }
    }
    return { ok: false, message: result.message || 'Gagal mengirim presensi event' }
  }

  return (
    <AppLayout user={user} onLogout={onLogout} navItems={navItems} activeTab={activeTab} onTabChange={setActiveTab}
      notifikasi={notifikasiPenghuni({ nim: user.nim, presensi, izin: izinData, sesiHampirTutup, today })}>
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
        />
      )}
      {activeTab === 'riwayat' && (
        <PenghuniRiwayat riwayat={riwayat}>
          <KalenderKehadiran nim={user.nim} sesiList={sesiList} data={data} now={now} gedung={user.namaGedung} tanggalMasuk={user.tanggalMasuk} />
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
    </AppLayout>
  )
}

function NoticeBox({ notice }: { notice: Notice | null }) {
  if (!notice) return null
  const isError = notice.type === 'error'
  return (
    <div className={`p-3 rounded-lg border text-xs font-semibold flex items-start gap-2 ${
      isError ? 'bg-red-50 border-red-200 text-red-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
    }`}>
      {isError ? <XCircle className="w-4 h-4 shrink-0 text-red-600" /> : <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />}
      <span>{notice.text}</span>
    </div>
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
}: {
  user: CurrentUser
  sesiHariIni: SesiHariIni[]
  riwayat: ReturnType<typeof riwayatPenghuni>
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
}) {
  const rekap = hitungStatus(riwayat.map(r => r.detail.status))
  // Pemberitahuan keputusan izin dalam 7 hari terakhir
  const pemberitahuan = izinData.filter(i => i.statusPersetujuan !== 'Pending' && (i.tanggalApproval || '') >= addDays(today, -7))
  // Foto presensi yang ditolak fasil dalam 7 hari terakhir (presensi menjadi Tidak Hadir)
  const fotoDitolak = riwayat
    .map(r => r.detail.presensi)
    .filter((p): p is NonNullable<typeof p> => !!p && p.statusFoto === 'Ditolak' && (p.divalidasiPada || '') >= addDays(today, -7))

  // Ambil 5 riwayat presensi yang relevan / terbaru
  const riwayatTerkini = riwayat.filter(r => r.detail.status !== 'Belum').slice(0, 5)

  // Event yang relevan untuk penghuni
  const userGedungId = gedung?.id || user.idGedung
  const eventSaya = (eventList || []).filter(ev =>
    ev.tipe === 'seluruh' ||
    (ev.idGedung && userGedungId && ev.idGedung === userGedungId) ||
    (ev.namaGedung && user.namaGedung && ev.namaGedung === user.namaGedung)
  )

  const eventSedangBerlangsung = eventSaya.find(
    ev => getStatusEvent(ev, today, now || new Date()) === 'Sedang Berlangsung' && ev.statusKehadiranSaya !== 'Hadir'
  )

  const eventTerdekat = eventSaya
    .filter(ev => getStatusEvent(ev, today, now || new Date()) !== 'Selesai')
    .sort((a, b) => a.tanggal.localeCompare(b.tanggal) || a.jamMulai.localeCompare(b.jamMulai))
    .slice(0, 3)

  return (
    <div className="space-y-4">
      {/* Welcome Banner Ringkas */}
      <div
        className="rounded-2xl p-5 lg:p-6 text-white relative overflow-hidden shadow-xs"
        style={{ background: 'linear-gradient(135deg, #064e3b 0%, #065f46 60%, #047857 100%)' }}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 backdrop-blur-md text-emerald-200 text-xs font-semibold mb-2 border border-white/10">
              <Sparkles className="w-3 h-3 text-emerald-300" />
              <span>Mahasiswa Penghuni Asrama</span>
            </div>
            <h2 className="text-xl lg:text-2xl font-bold tracking-tight" style={{ fontFamily: 'Plus Jakarta Sans' }}>
              Selamat Datang, {user.nama}!
            </h2>
            <p className="text-emerald-100/80 text-xs mt-1 flex items-center gap-2">
              <span className="font-semibold text-white">Kamar {user.nomorKamar || '-'}</span>
              <span>•</span>
              <span>{user.namaGedung || '-'}</span>
            </p>
          </div>

          {/* 3 Stats di Kanan Banner */}
          <div className="grid grid-cols-3 gap-2 w-full lg:w-auto">
            {[
              { label: 'Kehadiran 30 Hari', value: `${rekap.persen}%` },
              { label: 'Tidak Hadir', value: `${rekap['Tidak Hadir']} Sesi` },
              { label: 'Izin', value: `${rekap.Izin} Sesi` },
            ].map(s => (
              <div key={s.label} className="px-3.5 py-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 text-center min-w-[90px]">
                <p className="text-[10px] font-medium text-emerald-200/90">{s.label}</p>
                <p className="text-base lg:text-lg font-extrabold text-white mt-0.5" style={{ fontFamily: 'Plus Jakarta Sans' }}>{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Banner Peringatan Event Sedang Berlangsung */}
      {eventSedangBerlangsung && (
        <div className="bg-amber-500/10 border border-amber-300 rounded-2xl p-4 text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
              <CalendarDays className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-amber-200/80 text-amber-900 font-extrabold text-[10px] uppercase tracking-wider">
                  Event Sedang Berlangsung
                </span>
                <span className="text-xs text-amber-800 font-medium">
                  {eventSedangBerlangsung.jamMulai} – {eventSedangBerlangsung.jamSelesai} WIB
                </span>
              </div>
              <h4 className="font-bold text-sm text-gray-900 mt-0.5" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                {eventSedangBerlangsung.judul}
              </h4>
              <p className="text-xs text-gray-600 flex items-center gap-1 mt-0.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                <span>{eventSedangBerlangsung.lokasi} (Radius: {eventSedangBerlangsung.radiusMeter}m)</span>
              </p>
            </div>
          </div>
          {onBukaPresensiEvent && (
            <button
              type="button"
              onClick={() => onBukaPresensiEvent(eventSedangBerlangsung)}
              className="px-4 py-2 rounded-xl bg-[#0e4b29] hover:bg-[#0b3c20] text-white text-xs font-bold shrink-0 flex items-center gap-1.5 shadow-2xs cursor-pointer transition-colors"
              style={{ fontFamily: 'Plus Jakarta Sans' }}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Presensi Event Sekarang</span>
            </button>
          )}
        </div>
      )}

      {/* Pemberitahuan keputusan izin / foto ditolak */}
      {fotoDitolak.length > 0 && (
        <div className="bg-white rounded-xl p-3.5 border border-red-200 shadow-2xs">
          <div className="flex items-center gap-2 mb-2">
            <Camera className="w-4 h-4 text-red-700" />
            <h4 className="font-bold text-xs text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>Foto Presensi Ditolak</h4>
          </div>
          <div className="space-y-1.5">
            {fotoDitolak.map(p => (
              <div key={p.id} className="p-2.5 rounded-lg border text-xs bg-red-50/60 border-red-100 flex items-center justify-between">
                <span>{formatTanggal(p.tanggal)} · Sesi {p.sesi} divalidasi tidak sah{p.catatanValidasi ? `: ${p.catatanValidasi}` : ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {pemberitahuan.length > 0 && (
        <div className="bg-white rounded-xl p-3.5 border border-blue-100 shadow-2xs">
          <div className="flex items-center gap-2 mb-2">
            <Bell className="w-4 h-4 text-blue-700" />
            <h4 className="font-bold text-xs text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>Pemberitahuan Izin</h4>
          </div>
          <div className="space-y-1.5">
            {pemberitahuan.map(i => (
              <div key={i.id} className={`p-2.5 rounded-lg border text-xs flex items-center justify-between gap-2 ${i.statusPersetujuan === 'Disetujui' ? 'bg-blue-50/60 border-blue-100' : 'bg-red-50/60 border-red-100'}`}>
                <div className="flex items-center gap-2">
                  <Badge status={i.statusPersetujuan} />
                  <span className="font-medium text-gray-800">{formatRentangIzin(i.tanggal, i.tanggalSelesai, i.sesi, i.hariBerulang)} — {i.alasan}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Layout Grid 12 Kolom Memenuhi Layar */}
      <div className="grid lg:grid-cols-12 gap-4 items-start">
        {/* Kolom Kiri: Sesi Presensi & Riwayat Terkini */}
        <div className="lg:col-span-8 space-y-4">
          {/* Sesi Presensi Hari Ini */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                Status Presensi Hari Ini
              </h3>
              {liburHariIni && (
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-sky-100 text-sky-800 flex items-center gap-1">
                  <Palmtree className="w-3 h-3 text-sky-600" />
                  <span>Libur: {liburHariIni.keterangan}</span>
                </span>
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              {sesiHariIni.map(({ sesi, detail }) => {
                const boleh = bisaPresensi(detail)
                return (
                  <div
                    key={sesi.id}
                    className={`bg-white rounded-2xl p-4 border shadow-2xs transition-all flex flex-col justify-between ${
                      detail.status === 'Hadir' ? 'border-emerald-300 bg-emerald-50/20' : 'border-gray-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center border border-gray-100 text-gray-700">
                            <SesiIcon nama={sesi.nama} className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="font-bold text-sm text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                              Sesi {sesi.nama}
                            </h4>
                            <p className="text-[11px] text-gray-400 mono">{sesi.jamMulai} – {sesi.jamSelesai} WIB</p>
                          </div>
                        </div>
                        <Badge status={detail.status} />
                      </div>

                      {/* Keterangan Status Presensi */}
                      {jamPresensi(detail.presensi) && detail.presensi?.statusFoto !== 'Ditolak' ? (
                        <p className="text-[11px] text-emerald-800 font-medium bg-emerald-50 px-2.5 py-1 rounded-lg">
                          ✓ Tercatat pukul {jamPresensi(detail.presensi)} WIB
                        </p>
                      ) : detail.presensi?.statusFoto === 'Ditolak' ? (
                        <p className="text-[11px] text-rose-800 font-medium bg-rose-50 px-2.5 py-1 rounded-lg">
                          ✗ Foto ditolak: {detail.presensi.catatanValidasi || 'Tidak sesuai'}
                        </p>
                      ) : detail.status === 'Tidak Hadir' ? (
                        <p className="text-[11px] text-rose-700 font-medium bg-rose-50/60 px-2.5 py-1 rounded-lg">
                          Tidak hadir hingga sesi ditutup
                        </p>
                      ) : detail.status === 'Izin' ? (
                        <p className="text-[11px] text-amber-800 font-medium bg-amber-50 px-2.5 py-1 rounded-lg">
                          Izin disetujui
                        </p>
                      ) : null}
                    </div>

                    {boleh ? (
                      <button
                        onClick={() => onBukaPresensi(sesi.nama)}
                        className="w-full mt-3 py-2 px-3 rounded-lg text-xs font-bold text-white bg-[#0e4b29] hover:bg-[#0b3c20] transition-colors shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
                        style={{ fontFamily: 'Plus Jakarta Sans' }}
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Presensi Sekarang</span>
                      </button>
                    ) : detail.status === 'Belum' ? (
                      <p className="mt-2 text-[11px] text-gray-400 font-medium text-center">
                        {alasanTidakBisaPresensi(detail, sesi)}
                      </p>
                    ) : null}
                  </div>
                )
              })}
            </div>
            {notice && <div className="mt-3"><NoticeBox notice={notice} /></div>}
          </div>

          {/* Geofence Notice Ringkas */}
          <div className="rounded-xl px-3.5 py-2.5 bg-emerald-50/70 border border-emerald-200/80 flex items-center gap-2 text-xs text-emerald-900">
            <MapPin className="w-4 h-4 text-emerald-700 shrink-0" />
            <span className="text-[11px] font-medium leading-tight">
              <strong>Radius GPS:</strong> Maks. {gedung?.radiusMeter ?? 50}m dari {gedung?.nama || 'Asrama'}. Pastikan akses lokasi browser diizinkan.
            </span>
          </div>

          {/* Log Presensi Terbaru */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-2xs overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/70 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-700" />
                <h4 className="font-bold text-xs text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                  Aktivitas Presensi Terakhir Anda
                </h4>
              </div>
              {onNavigateTab && (
                <button
                  onClick={() => onNavigateTab('riwayat')}
                  className="text-xs font-semibold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 cursor-pointer"
                >
                  <span>Lihat Semua Riwayat</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="divide-y divide-gray-100 text-xs">
              {riwayatTerkini.length === 0 ? (
                <div className="py-7 text-center text-gray-400">
                  <Clock className="w-6 h-6 mx-auto mb-1 text-gray-300" />
                  <p className="text-xs">Belum ada aktivitas presensi yang tercatat</p>
                </div>
              ) : (
                riwayatTerkini.map(({ tanggal, sesi, detail }) => (
                  <div key={`${tanggal}-${sesi.nama}`} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50/60 transition-colors">
                    <div className="flex items-center gap-3">
                      <Badge status={detail.status} />
                      <div>
                        <p className="font-bold text-gray-800" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                          Sesi {sesi.nama}
                        </p>
                        <p className="text-[11px] text-gray-400">{formatTanggal(tanggal)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      {jamPresensi(detail.presensi) ? (
                        <p className="text-xs font-bold text-emerald-900 mono">{jamPresensi(detail.presensi)} WIB</p>
                      ) : (
                        <p className="text-[11px] text-gray-400">{keteranganStatus(detail)}</p>
                      )}
                      {detail.presensi?.statusFoto && (
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                          detail.presensi.statusFoto === 'Diterima' ? 'text-emerald-700 bg-emerald-50' :
                          detail.presensi.statusFoto === 'Ditolak' ? 'text-red-700 bg-red-50' : 'text-amber-700 bg-amber-50'
                        }`}>
                          Foto: {detail.presensi.statusFoto}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Kolom Kanan: Informasi Kamar & Izin Cepat */}
        <div className="lg:col-span-4 space-y-4">
          {/* Info Gedung & Kamar Asrama */}
          <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <h4 className="font-bold text-xs text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                Informasi Hunian Asrama
              </h4>
              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Aktif
              </span>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-gray-50">
                <span className="text-gray-500">Gedung</span>
                <span className="font-bold text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>{user.namaGedung || '-'}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-gray-50">
                <span className="text-gray-500">Nomor Kamar</span>
                <span className="font-bold text-emerald-800 mono">{user.nomorKamar || '-'}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-gray-50">
                <span className="text-gray-500">Fasilitator Gedung</span>
                <span className="font-semibold text-gray-800">{gedung?.namaPj || 'Fasilitator Gedung'}</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-gray-50">
                <span className="text-gray-500">Radius Absen GPS</span>
                <span className="font-semibold text-gray-800">{gedung?.radiusMeter ?? 50} meter</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-gray-500">Jam Malam Asrama</span>
                <span className="font-bold text-gray-700">22:00 WIB</span>
              </div>
            </div>
          </div>

          {/* Event & Kegiatan Terdekat */}
          <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div className="flex items-center gap-1.5">
                <CalendarDays className="w-4 h-4 text-emerald-700" />
                <h4 className="font-bold text-xs text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                  Event & Kegiatan Asrama
                </h4>
              </div>
              {onNavigateTab && (
                <button
                  onClick={() => onNavigateTab('event')}
                  className="text-xs font-semibold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 cursor-pointer"
                >
                  <span>Lihat Semua</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {eventTerdekat.length === 0 ? (
              <div className="py-4 text-center text-gray-400">
                <CalendarDays className="w-6 h-6 mx-auto mb-1 text-gray-300" />
                <p className="text-xs">Tidak ada event mendatang</p>
              </div>
            ) : (
              <div className="space-y-2">
                {eventTerdekat.map(ev => {
                  const st = getStatusEvent(ev, today, now || new Date())
                  return (
                    <div key={ev.id} className="p-2.5 rounded-xl border border-gray-100 bg-gray-50/70 text-xs flex flex-col gap-1">
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            ev.tipe === 'seluruh'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-purple-50 text-purple-800 border border-purple-200'
                          }`}
                        >
                          {ev.tipe === 'seluruh' ? 'Seluruh Asrama' : `Gedung ${ev.namaGedung || ''}`}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            st === 'Sedang Berlangsung'
                              ? 'bg-amber-100 text-amber-900 animate-pulse'
                              : 'bg-blue-50 text-blue-800'
                          }`}
                        >
                          {st}
                        </span>
                      </div>
                      <p className="font-bold text-gray-800 truncate" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                        {ev.judul}
                      </p>
                      <div className="flex items-center justify-between text-[11px] text-gray-500">
                        <span>{formatTanggal(ev.tanggal)} • {ev.jamMulai} WIB</span>
                        {ev.statusKehadiranSaya === 'Hadir' ? (
                          <span className="text-emerald-700 font-bold">✓ Hadir</span>
                        ) : st === 'Sedang Berlangsung' && onBukaPresensiEvent ? (
                          <button
                            type="button"
                            onClick={() => onBukaPresensiEvent(ev)}
                            className="font-bold text-emerald-800 hover:text-emerald-950 underline cursor-pointer"
                          >
                            Absen
                          </button>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Permohonan Izin Terkini & Quick Action */}
          <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <h4 className="font-bold text-xs text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                Permohonan Izin Terakhir
              </h4>
              {onNavigateTab && (
                <button
                  onClick={() => onNavigateTab('izin')}
                  className="text-xs font-semibold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 cursor-pointer"
                >
                  <span>Ajukan Baru</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {izinData.length === 0 ? (
              <div className="py-4 text-center text-gray-400">
                <FileText className="w-6 h-6 mx-auto mb-1 text-gray-300" />
                <p className="text-xs">Belum ada pengajuan izin aktif</p>
              </div>
            ) : (
              <div className="space-y-2">
                {izinData.slice(0, 3).map(i => (
                  <div key={i.id} className="p-2.5 rounded-xl border border-gray-100 bg-gray-50/70 text-xs">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="font-bold text-gray-800 truncate" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                        {formatRentangIzin(i.tanggal, i.tanggalSelesai, i.sesi, i.hariBerulang)}
                      </span>
                      <Badge status={i.statusPersetujuan} />
                    </div>
                    <p className="text-gray-600 truncate text-[11px]">{i.alasan}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Aturan Singkat Presensi */}
          <div className="p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-100 text-xs text-emerald-900 space-y-1.5">
            <div className="font-bold text-emerald-950 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              <span>Panduan Singkat Presensi</span>
            </div>
            <ul className="text-[11px] text-emerald-800/90 space-y-1 list-disc list-inside">
              <li>Presensi mandiri dibuka sesuai jadwal sesi.</li>
              <li>Pastikan berada dalam radius {gedung?.radiusMeter ?? 50}m.</li>
              <li>Ambil foto selfie jelas dan langsung dari kamera.</li>
            </ul>
          </div>
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
  const [selectedSesi, setSelectedSesi] = useState<string>(sesiAwal || sesiDibuka?.sesi.nama || sesiHariIni[0]?.sesi.nama || '')
  const selected = sesiHariIni.find(s => s.sesi.nama === selectedSesi)
  const koordinatSiap = hasKoordinat(gedung)
  const radius = gedung?.radiusMeter ?? 0
  const inRadius = gps.distance !== undefined && gps.distance <= radius
  // Lebar bar: jarak relatif terhadap 2x radius, agar posisi di luar radius tetap terlihat
  const barPct = gps.distance !== undefined && radius > 0 ? Math.min(100, (gps.distance / (radius * 2)) * 100) : 0
  const bisa = !!selected && bisaPresensi(selected.detail)
  const diluarRadius = gps.status === 'ok' && !inRadius && !abaikanRadius

  return (
    <div className="grid min-w-0 grid-cols-1 gap-6 w-full items-start lg:grid-cols-12">
      {/* Kolom Kiri: Form & Aksi Presensi */}
      <div className="lg:col-span-7 space-y-6">
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-2xs">
          <SectionTitle subtitle="Presensi hanya dapat dilakukan saat sesi sedang dibuka">
            Lakukan Presensi Mandiri
          </SectionTitle>

          <div className="grid sm:grid-cols-2 gap-3 mb-6">
            {sesiHariIni.map(({ sesi, detail }) => {
              const isSelected = selectedSesi === sesi.nama
              return (
                <button
                  key={sesi.id}
                  type="button"
                  onClick={() => setSelectedSesi(sesi.nama)}
                  className={`p-4 rounded-xl text-left border transition-all cursor-pointer ${
                    isSelected ? 'border-emerald-700 bg-emerald-50/50 shadow-2xs ring-1 ring-emerald-700' : 'border-gray-200 bg-white hover:border-emerald-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center border border-gray-200 mb-2.5">
                      <SesiIcon nama={sesi.nama} className="w-5 h-5" />
                    </div>
                    {detail.fase === 'dibuka' && <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">DIBUKA</span>}
                  </div>
                  <div className="font-bold text-sm text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>Sesi {sesi.nama}</div>
                  <div className="text-xs text-gray-500 font-medium">{sesi.jamMulai} – {sesi.jamSelesai} WIB</div>
                  <div className="mt-2"><Badge status={detail.status} /></div>
                </button>
              )
            })}
          </div>

          {/* Lokasi GPS perangkat vs titik koordinat gedung */}
          <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 mb-4">
            <div className="flex items-center justify-between mb-2 gap-2">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-emerald-700" />
                <span className="text-xs font-bold text-gray-800" style={{ fontFamily: 'Plus Jakarta Sans' }}>Lokasi GPS Anda</span>
              </div>
              <div className="flex items-center gap-2">
                {gps.status === 'ok' && gps.distance !== undefined && (
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${
                    inRadius ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-red-100 text-red-800 border-red-200'
                  }`}>
                    {inRadius ? 'Dalam Radius' : 'Di Luar Radius'} ({Math.round(gps.distance)} m)
                  </span>
                )}
                <button
                  type="button"
                  onClick={onRefreshLocation}
                  disabled={gps.status === 'loading'}
                  className="p-1 rounded text-gray-500 hover:text-emerald-700 hover:bg-white transition-colors cursor-pointer disabled:opacity-50"
                  title="Perbarui lokasi"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${gps.status === 'loading' ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            <p className="text-sm font-bold text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>{gedung?.nama || 'Gedung belum terdaftar'}</p>
            {koordinatSiap ? (
              <p className="mono text-xs text-gray-500 mt-0.5">
                Titik gedung: {gedung.latitude!.toFixed(6)}, {gedung.longitude!.toFixed(6)} · Batas: {radius} m
              </p>
            ) : (
              <p className="text-xs text-red-700 mt-0.5 font-medium">Koordinat gedung belum diatur admin, presensi belum dapat dilakukan.</p>
            )}

            {gps.status === 'loading' && (
              <div className="text-xs text-gray-500 mt-2.5 flex items-center gap-1.5">
                <div className="w-3 h-3 border-2 border-emerald-700 border-t-transparent rounded-full animate-spin" />
                <span>Membaca lokasi perangkat...</span>
              </div>
            )}
            {gps.status === 'error' && <p className="text-xs text-red-700 mt-2.5 font-medium">{gps.error}</p>}
            {gps.status === 'ok' && gps.position && (
              <>
                <p className="mono text-xs text-gray-500 mt-2.5">
                  Posisi Anda: {gps.position.latitude.toFixed(6)}, {gps.position.longitude.toFixed(6)} · Akurasi ±{Math.round(gps.position.accuracy)} m
                </p>
                {akurasiMaks > 0 && gps.position.accuracy > akurasiMaks && (
                  <p className="text-xs text-red-700 mt-1 font-semibold">
                    Akurasi lokasi melebihi batas {akurasiMaks} m. Aktifkan GPS/mode akurasi tinggi atau pindah ke area terbuka, lalu klik perbarui lokasi.
                  </p>
                )}
                {gps.distance !== undefined && (
                  <div className="mt-2.5 relative h-2 rounded-full bg-gray-200 overflow-hidden">
                    <div className={`h-full rounded-full ${inRadius ? 'bg-emerald-700' : 'bg-red-600'}`} style={{ width: `${barPct}%` }} />
                    {/* Penanda batas radius (di tengah bar) */}
                    <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-gray-500" />
                  </div>
                )}
              </>
            )}
          </div>

          {bisa && <div className="mb-4"><KameraWajah foto={foto} onChange={onFotoChange} disabled={checkingIn} /></div>}

          {notice && <div className="mb-4"><NoticeBox notice={notice} /></div>}

          <button
            type="button"
            onClick={() => selected && onCheckIn(selected.sesi.nama)}
            disabled={!bisa || checkingIn || !koordinatSiap || diluarRadius || !foto}
            className="w-full py-3 px-4 rounded-lg font-bold text-xs text-white bg-[#0e4b29] hover:bg-[#0b3c20] transition-colors shadow-2xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ fontFamily: 'Plus Jakarta Sans' }}
          >
            {!selected ? (
              <span>Belum ada sesi aktif yang diatur</span>
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
                <span>Kirim Presensi Sekarang (Sesi {selected.sesi.nama})</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Kolom Kanan: Ketentuan */}
      <div className="lg:col-span-5 space-y-6">
        <div className="p-5 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-950 space-y-2">
          <p className="font-bold flex items-center gap-1.5 text-amber-950" style={{ fontFamily: 'Plus Jakarta Sans' }}>
            <AlertCircle className="w-4 h-4 text-amber-700" />
            Ketentuan & Kebijakan Absensi Asrama:
          </p>
          <ul className="space-y-1.5 text-amber-900 leading-relaxed list-disc list-inside">
            <li>Presensi hanya sah jika koordinat GPS berada dalam radius {radius || '-'} m dari gedung.</li>
            <li>Setiap presensi wajib disertai foto wajah yang diambil langsung dari kamera.</li>
            <li>
              Presensi hanya dapat dilakukan pada jam sesi:{' '}
              {sesiHariIni.map(s => `${s.sesi.nama} ${s.sesi.jamMulai}–${s.sesi.jamSelesai}`).join(', ')} WIB.
            </li>
            <li>Sesi yang terlewat tanpa izin otomatis tercatat <strong>Tidak Hadir</strong>.</li>
            <li>Dilarang keras menitipkan absensi atau menggunakan pemalsu lokasi.</li>
            <li>Jika berhalangan, ajukan izin pada menu <strong>Pengajuan Izin</strong> sebelum sesi dimulai.</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

function PenghuniRiwayat({ riwayat, children }: { riwayat: ReturnType<typeof riwayatPenghuni>; children?: React.ReactNode }) {
  const c = hitungStatus(riwayat.map(r => r.detail.status))

  return (
    <div className="space-y-6 w-full">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<CheckCircle2 className="w-5 h-5 text-emerald-700" />} label="Total Hadir" value={c.Hadir} color="#0e4b29" />
        <StatCard icon={<XCircle className="w-5 h-5 text-rose-700" />} label="Tidak Hadir" value={c['Tidak Hadir']} color="#dc2626" />
        <StatCard icon={<FileText className="w-5 h-5 text-amber-700" />} label="Izin" value={c.Izin} color="#b45309" />
        <StatCard icon={<Palmtree className="w-5 h-5 text-sky-700" />} label="Libur" value={c.Libur} color="#0369a1" />
      </div>

      <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-2xs">
        <div className="flex items-center justify-between mb-2">
          <SectionTitle subtitle={`Hadir ${c.Hadir} dari ${c.wajib} sesi wajib (30 hari terakhir, libur tidak dihitung)`}>
            Persentase Tingkat Kehadiran
          </SectionTitle>
          <span className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>{c.persen}%</span>
        </div>
        <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
          <div className="h-full rounded-full bg-emerald-700 transition-all duration-300" style={{ width: `${c.persen}%` }} />
        </div>
      </div>

      {children}

      <div className="bg-white rounded-xl overflow-hidden border border-gray-200 shadow-2xs">
        <div className="px-5 py-4 border-b border-gray-200">
          <SectionTitle subtitle="Seluruh sesi wajib Anda, termasuk sesi yang terlewat">Log Riwayat Presensi</SectionTitle>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {['Tanggal', 'Sesi', 'Waktu Masuk', 'Lokasi Presensi', 'Status', 'Validasi Foto', 'Keterangan'].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider" style={{ fontFamily: 'Plus Jakarta Sans' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {riwayat.map(({ tanggal, sesi, detail }) => {
                const rec = detail.presensi
                return (
                  <tr key={`${tanggal}-${sesi.nama}`} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 font-semibold text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>{formatTanggal(tanggal)}</td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-200">
                        <SesiIcon nama={sesi.nama} className="w-3 h-3" />
                        <span>{sesi.nama}</span>
                      </span>
                    </td>
                    <td className="px-5 py-3 mono text-xs text-gray-600">{jamPresensi(rec) || '–'}</td>
                    <td className="px-5 py-3 mono text-[11px] text-gray-500">
                      {rec && rec.latitude !== null && rec.longitude !== null ? `${Number(rec.latitude).toFixed(5)}, ${Number(rec.longitude).toFixed(5)}` : '–'}
                    </td>
                    <td className="px-5 py-3"><Badge status={detail.status} /></td>
                    <td className="px-5 py-3 text-xs">
                      {rec?.statusFoto ? (
                        <div className="space-y-1">
                          <FotoBadge status={rec.statusFoto} />
                          {rec.catatanValidasi && <p className="text-gray-600 max-w-[220px]">Catatan fasil: {rec.catatanValidasi}</p>}
                        </div>
                      ) : <span className="text-gray-300">–</span>}
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-500">{keteranganStatus(detail) || '–'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
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
      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg font-bold text-sm text-white bg-[#0e4b29] hover:bg-[#0b3c20] transition-colors shadow-2xs cursor-pointer shrink-0"
      style={{ fontFamily: 'Plus Jakarta Sans' }}
    >
      <Plus className="w-4 h-4" />
      <span>Ajukan Izin</span>
    </button>
  )

  return (
    <div className="w-full space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<FileText className="w-5 h-5 text-gray-600" />} label="Total Pengajuan" value={jumlah.Semua} />
        <StatCard icon={<Clock className="w-5 h-5 text-orange-600" />} label="Menunggu" value={jumlah.Pending} color="#c2410c" />
        <StatCard icon={<CheckCircle2 className="w-5 h-5 text-blue-700" />} label="Disetujui" value={jumlah.Disetujui} color="#1d4ed8" />
        <StatCard icon={<XCircle className="w-5 h-5 text-red-600" />} label="Ditolak" value={jumlah.Ditolak} color="#dc2626" />
      </div>

      {notice && <NoticeBox notice={notice} />}

      <div className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden">
        <div className="px-5 pt-4 pb-4 border-b border-gray-100">
          <div className="flex items-start justify-between gap-3">
            <SectionTitle subtitle="Status terbaru setiap pengajuan izin Anda">Riwayat Pengajuan Izin</SectionTitle>
            {tombolAjukan}
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

          <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Saring status izin">
            {(['Semua', 'Pending', 'Disetujui', 'Ditolak'] as const).map(f => {
              const aktif = filter === f
              return (
                <button
                  key={f}
                  type="button"
                  role="tab"
                  aria-selected={aktif}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border cursor-pointer transition-colors ${aktif ? 'bg-[#0e4b29] text-white border-[#0e4b29]' : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-300'}`}
                  style={{ fontFamily: 'Plus Jakarta Sans' }}
                >
                  {f === 'Semua' ? 'Semua' : TAMPILAN_STATUS_IZIN[f].label}
                  <span className={`ml-1.5 ${aktif ? 'text-emerald-100' : 'text-gray-400'}`}>{jumlahTersaring[f]}</span>
                </button>
              )
            })}
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
                          <p className={`text-xs mt-1 break-words ${i.statusPersetujuan === 'Ditolak' ? 'text-red-700' : 'text-blue-800'}`}>
                            <span className="font-semibold">Catatan fasilitator:</span> {i.catatanApprover}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-1.5 text-[11px] text-gray-500">
                          {i.fileBukti && (
                            <BuktiIzin fileBukti={i.fileBukti} className="inline-flex items-center gap-1 font-semibold text-blue-700" />
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
                              className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold text-red-700 border border-red-200 bg-white hover:bg-red-50 cursor-pointer transition-colors"
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
                              className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold text-white bg-[#0e4b29] hover:bg-[#0b3c20] cursor-pointer transition-colors"
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
  const wajib = <span className="text-red-500">*</span>
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
        <div className="px-5 sm:px-6 py-4 bg-gradient-to-r from-emerald-800 to-emerald-950 text-white flex items-center justify-between gap-3 shrink-0">
          <div>
            <h3 id="judul-form-izin" className="text-lg font-extrabold tracking-tight" style={{ fontFamily: 'Plus Jakarta Sans' }}>{dasar ? 'Ajukan Ulang Izin' : 'Ajukan Izin'}</h3>
            <p className="text-xs text-emerald-200 mt-0.5">Pengajuan akan ditinjau oleh fasilitator gedung Anda</p>
          </div>
          <button
            type="button"
            onClick={mintaTutup}
            aria-label="Tutup"
            className="p-1.5 rounded-lg text-emerald-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
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
                <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-blue-200 bg-blue-50/60">
                  <div className="w-9 h-9 rounded-md bg-white border border-blue-200 flex items-center justify-center shrink-0">
                    <Paperclip className="w-4 h-4 text-blue-700" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-blue-900">Memakai bukti dari izin sebelumnya</p>
                    <BuktiIzin fileBukti={dasar.fileBukti} className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700" />
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
                  <button type="button" onClick={hapusBukti} className="text-xs font-semibold text-red-600 hover:underline cursor-pointer shrink-0">Hapus</button>
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
            className="flex-1 sm:flex-none rounded-xl px-4 py-2.5 font-bold text-sm text-white bg-[#0e4b29] hover:bg-[#0b3c20] transition-colors shadow-2xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
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

async function getCroppedPhoto(imageSrc: string, crop: Area): Promise<string> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image()
    element.onload = () => resolve(element)
    element.onerror = reject
    element.src = imageSrc
  })
  const canvas = document.createElement('canvas')
  const scale = Math.min(1, 640 / crop.width, 640 / crop.height)
  canvas.width = Math.round(crop.width * scale)
  canvas.height = Math.round(crop.height * scale)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas foto tidak tersedia.')
  context.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.9)
}

function PenghuniProfil({ user, onLogout }: { user: CurrentUser; onLogout: () => void }) {
  const [passwordLama, setPasswordLama] = useState('')
  const [passwordBaru, setPasswordBaru] = useState('')
  const [konfirmasi, setKonfirmasi] = useState('')
  const [fotoProfil, setFotoProfil] = useState(user.fotoProfil || '')
  const [fotoDipilih, setFotoDipilih] = useState<string | null>(null)
  const [pendingFoto, setPendingFoto] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [passwordChanged, setPasswordChanged] = useState(false)
  const [confirmPasswordChange, setConfirmPasswordChange] = useState(false)
  const [savingFoto, setSavingFoto] = useState(false)
  const [showPassword, setShowPassword] = useState<number | null>(null)
  const [notice, setNotice] = useState('')

  const simpanPassword = async () => {
    setNotice('')
    if (passwordBaru.length < 8) return setNotice('Password baru minimal 8 karakter.')
    if (passwordBaru !== konfirmasi) return setNotice('Konfirmasi password tidak sama.')
    setConfirmPasswordChange(true)
  }

  const ubahPassword = async () => {
    const result = await changePasswordApi(user.nim, passwordLama, passwordBaru)
    setNotice(result.message)
    if (result.ok) {
      setConfirmPasswordChange(false)
      setPasswordLama('')
      setPasswordBaru('')
      setKonfirmasi('')
      setPasswordChanged(true)
    }
  }

  const pilihFoto = (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) return setNotice('File foto harus berupa gambar.')
    const reader = new FileReader()
    reader.onload = async () => {
      const foto = String(reader.result)
      setFotoDipilih(foto)
      setCrop({ x: 0, y: 0 })
      setZoom(1)
    }
    reader.readAsDataURL(file)
  }

  const selesaiCrop = async () => {
    if (!fotoDipilih || !croppedAreaPixels) return
    try {
      setPendingFoto(await getCroppedPhoto(fotoDipilih, croppedAreaPixels))
      setFotoDipilih(null)
    } catch {
      setNotice('Foto tidak dapat diproses.')
    }
  }

  const konfirmasiFoto = async () => {
    if (!pendingFoto) return
    const foto = pendingFoto
    setSavingFoto(true)
    try {
      const result = await uploadProfilePhotoApi(user.nim, foto)
      if (result.ok || result.offline) {
        setFotoProfil(foto)
        setPendingFoto(null)
        const saved = JSON.parse(localStorage.getItem('sip-asrama-user') || '{}')
        localStorage.setItem('sip-asrama-user', JSON.stringify({ ...saved, fotoProfil: foto }))
        window.dispatchEvent(new Event('profile-updated'))
      }
      setNotice(result.message)
    } catch {
      setNotice('Foto profil gagal disimpan. Coba lagi.')
    } finally {
      setSavingFoto(false)
    }
  }

  return (
    <div className="grid lg:grid-cols-12 gap-5 w-full items-start">
      {/* Kolom Kiri: Kartu Identitas Digital Penghuni & Status Layanan */}
      <div className="lg:col-span-4 space-y-4">
        <div className="bg-white rounded-2xl border border-gray-200/90 shadow-2xs overflow-hidden">
          {/* Banner Kartu */}
          <div className="bg-gradient-to-br from-[#0e4b29] via-[#125832] to-[#176d3e] p-6 text-white text-center relative">
            <div className="absolute top-3 right-3 opacity-20">
              <Building className="w-16 h-16 text-white" />
            </div>

            <div className="relative inline-block mx-auto mb-3">
              <label
                htmlFor="profile-photo-input"
                className="relative w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-bold bg-white/10 backdrop-blur-md text-white border-2 border-white/30 shadow-md overflow-hidden cursor-pointer group transition-transform hover:scale-105"
                title="Klik untuk ganti foto profil"
              >
                {fotoProfil ? (
                  <img src={fotoProfil} alt="Foto profil" className="w-full h-full object-cover" />
                ) : (
                  user.nama.charAt(0).toUpperCase()
                )}
                <input id="profile-photo-input" type="file" accept="image/*" className="hidden" onChange={e => pilihFoto(e.target.files?.[0])} />
                <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="w-5 h-5 text-white" />
                  <span className="text-[10px] text-white font-medium mt-0.5">Ubah</span>
                </div>
              </label>
              <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm border-2 border-[#0e4b29]">
                <Pencil className="h-3 w-3" />
              </span>
            </div>

            <h3 className="font-bold text-base text-white truncate" style={{ fontFamily: 'Plus Jakarta Sans' }}>
              {user.nama}
            </h3>
            <p className="mono text-xs text-emerald-100/90 mt-0.5 tracking-wide">{user.nim}</p>

            <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-xs font-semibold text-emerald-50">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Penghuni Asrama Aktif</span>
            </div>
          </div>

          {/* Info Lokasi & Detail Kamar */}
          <div className="p-4 space-y-3 bg-gray-50/50">
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="p-3 bg-white rounded-xl border border-gray-200/80 shadow-2xs">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Gedung</p>
                <p className="text-xs font-bold text-emerald-950 mt-0.5 truncate" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                  {user.namaGedung || '-'}
                </p>
              </div>
              <div className="p-3 bg-white rounded-xl border border-gray-200/80 shadow-2xs">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Kamar</p>
                <p className="text-xs font-bold text-emerald-950 mt-0.5 truncate" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                  {user.nomorKamar || '-'}
                </p>
              </div>
            </div>

            <div className="px-3 py-2 bg-emerald-50/80 border border-emerald-100 rounded-xl flex items-center justify-between text-xs text-emerald-900">
              <span className="font-medium text-[11px]">Terdaftar sejak</span>
              <span className="font-bold mono text-[11px]">{user.tanggalMasuk || '-'}</span>
            </div>
          </div>
        </div>

        {/* Info Layanan Asrama */}
        <div className="bg-white rounded-2xl p-4 border border-gray-200/90 shadow-2xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-gray-100">
            <h5 className="font-bold text-xs text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>
              Ketentuan & Fasilitas Kamar
            </h5>
            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              TA 2026/2027
            </span>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between py-1 border-b border-gray-50">
              <span className="text-gray-500">Kapasitas Standar</span>
              <span className="font-semibold text-gray-800">2 Orang / Kamar</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-gray-50">
              <span className="text-gray-500">Kunci Gerbang Malam</span>
              <span className="font-bold text-emerald-800">22:00 WIB</span>
            </div>
            <div className="flex items-center justify-between py-1 border-b border-gray-50">
              <span className="text-gray-500">Izin Menginap Luar</span>
              <span className="font-semibold text-gray-800">Wajib Menu Izin</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-gray-500">Layanan Darurat</span>
              <span className="font-semibold text-gray-800">Pos Pengelola Asrama</span>
            </div>
          </div>
        </div>
      </div>

      {/* Kolom Kanan: Rincian Data Pribadi & Form Keamanan */}
      <div className="lg:col-span-8 space-y-4">
        {/* Data Informasi Akun */}
        <div className="bg-white rounded-2xl border border-gray-200/90 shadow-2xs overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/70 flex items-center justify-between">
            <div>
              <h4 className="text-sm font-bold text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                Informasi Data Pribadi
              </h4>
              <p className="text-[11px] text-gray-400">Detail identitas penghuni terdaftar di sistem asrama</p>
            </div>
            <Badge status="Aktif" />
          </div>

          <div className="divide-y divide-gray-100 text-xs">
            {[
              { label: 'Alamat Email', value: user.email, icon: <Mail className="w-4 h-4 text-emerald-700" /> },
              { label: 'Nomor WhatsApp / HP', value: user.noHp || '-', icon: <User className="w-4 h-4 text-emerald-700" /> },
              { label: 'Asal Daerah', value: user.asal || '-', icon: <MapPin className="w-4 h-4 text-emerald-700" /> },
              { label: 'Gedung Asrama', value: user.namaGedung || '-', icon: <Building className="w-4 h-4 text-emerald-700" /> },
              { label: 'Nomor Kamar', value: user.nomorKamar || '-', icon: <DoorClosed className="w-4 h-4 text-emerald-700" /> },
              { label: 'Status Verifikasi Akun', value: 'Terverifikasi (NIM Aktif)', icon: <ShieldCheck className="w-4 h-4 text-emerald-700" /> },
            ].map((row, idx) => (
              <div key={idx} className="flex items-center px-5 py-3 hover:bg-gray-50/60 transition-colors">
                <div className="flex items-center gap-2.5 w-48 shrink-0 text-gray-500 font-medium">
                  {row.icon}
                  <span>{row.label}</span>
                </div>
                <div className="flex-1 min-w-0 font-semibold text-gray-900 truncate" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                  {row.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Keamanan & Ganti Password */}
        <div className="bg-white rounded-2xl border border-gray-200/90 shadow-2xs overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/70 flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-800">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                Keamanan & Ganti Password
              </h4>
              <p className="text-[11px] text-gray-400">Perbarui kata sandi akun secara berkala</p>
            </div>
          </div>

          <div className="p-5 space-y-4">
            <div className="grid sm:grid-cols-3 gap-3">
              {[
                { label: 'Password Lama', placeholder: 'Masukkan password lama' },
                { label: 'Password Baru', placeholder: 'Minimal 8 karakter' },
                { label: 'Konfirmasi Baru', placeholder: 'Ulangi password baru' },
              ].map((f, index) => (
                <div key={f.label}>
                  <label className="block text-xs font-semibold text-gray-700 mb-1" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                    {f.label}
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type={showPassword === index ? 'text' : 'password'}
                      className="w-full px-3 py-2 pr-8 rounded-lg border border-gray-300 text-xs text-gray-800 outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700 transition-colors placeholder:text-gray-400"
                      placeholder={f.placeholder}
                      value={[passwordLama, passwordBaru, konfirmasi][index]}
                      onChange={e => [setPasswordLama, setPasswordBaru, setKonfirmasi][index](e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(showPassword === index ? null : index)}
                      className="absolute right-2.5 text-gray-400 hover:text-gray-700 cursor-pointer"
                      aria-label={showPassword === index ? 'Sembunyikan password' : 'Tampilkan password'}
                    >
                      {showPassword === index ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-100">
              <p className="text-[11px] text-gray-400">Setelah password diubah, Anda akan diminta login ulang demi keamanan.</p>
              <div className="flex items-center gap-3">
                {notice && <p className="text-xs font-semibold text-emerald-700">{notice}</p>}
                <button
                  type="button"
                  onClick={simpanPassword}
                  className="py-2 px-5 rounded-lg font-bold text-xs text-white bg-[#0e4b29] hover:bg-[#0b3c20] transition-colors shadow-2xs cursor-pointer"
                  style={{ fontFamily: 'Plus Jakarta Sans' }}
                >
                  Simpan Perubahan
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      {confirmPasswordChange && (
        <ConfirmDialog
          title="Konfirmasi Perubahan Password"
          message="Password belum diubah. Tekan Oke untuk menyimpan password baru, atau Batal untuk tetap menggunakan password lama."
          confirmLabel="Oke"
          onCancel={() => setConfirmPasswordChange(false)}
          onConfirm={ubahPassword}
        />
      )}
      {fotoDipilih && (
        <ConfirmDialog
          title="Sesuaikan Foto Profil"
          message="Geser dan atur ukuran foto sebelum melanjutkan."
          confirmLabel="Gunakan Foto Ini"
          onCancel={() => setFotoDipilih(null)}
          onConfirm={selesaiCrop}
        >
          <div className="relative h-64 overflow-hidden rounded-xl bg-gray-900">
            <Cropper
              image={fotoDipilih}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="rect"
              showGrid
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_, pixels) => setCroppedAreaPixels(pixels)}
            />
          </div>
          <label className="mt-4 block text-xs font-bold text-gray-700">
            Zoom
            <input type="range" min={1} max={3} step={0.1} value={zoom} onChange={e => setZoom(Number(e.target.value))} className="mt-2 w-full accent-emerald-700" />
          </label>
        </ConfirmDialog>
      )}
      {pendingFoto && (
        <ConfirmDialog
          title="Konfirmasi Foto Profil"
          message="Gunakan foto ini sebagai foto profil akun Anda?"
          confirmLabel="Simpan Foto"
          onCancel={() => setPendingFoto(null)}
          onConfirm={konfirmasiFoto}
          loading={savingFoto}
        >
          <img src={pendingFoto} alt="Pratinjau foto profil" className="mx-auto h-40 w-40 rounded-xl object-cover border border-emerald-100" />
        </ConfirmDialog>
      )}
      {passwordChanged && (
        <ConfirmDialog
          title="Password Akun Berhasil Diubah"
          message="Demi keamanan, Anda akan logout dan perlu login kembali dengan password baru."
          confirmLabel="Oke"
          hideCancel
          onCancel={onLogout}
          onConfirm={onLogout}
        />
      )}
    </div>
  )
}

function PenghuniEvent({
  eventList,
  user,
  onBukaAbsen,
  today,
  now,
}: {
  eventList: EventAsrama[]
  user: CurrentUser
  onBukaAbsen: (ev: EventAsrama) => void
  today: string
  now: Date
}) {
  const [filterKategori, setFilterKategori] = useState<'semua' | 'seluruh' | 'gedung'>('semua')
  const [filterStatus, setFilterStatus] = useState<string>('semua')
  const [cari, setCari] = useState('')

  // Event yang relevan untuk penghuni: event seluruh asrama atau event gedung tempat tinggalnya
  const eventSaya = eventList.filter(ev =>
    ev.tipe === 'seluruh' ||
    (ev.idGedung && user.idGedung && ev.idGedung === user.idGedung) ||
    (ev.namaGedung && user.namaGedung && ev.namaGedung === user.namaGedung)
  )

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
  const hadirCount = eventSaya.filter(ev => ev.statusKehadiranSaya === 'Hadir').length

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div
        className="rounded-2xl p-6 text-white relative overflow-hidden shadow-xs"
        style={{ background: 'linear-gradient(135deg, #064e3b 0%, #065f46 60%, #047857 100%)' }}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/10 backdrop-blur-md text-emerald-200 text-xs font-semibold mb-2 border border-white/10">
              <CalendarDays className="w-3.5 h-3.5 text-emerald-300" />
              <span>Kegiatan & Agenda Asrama</span>
            </div>
            <h2 className="text-xl lg:text-2xl font-bold tracking-tight" style={{ fontFamily: 'Plus Jakarta Sans' }}>
              Pengumuman & Daftar Event
            </h2>
            <p className="text-emerald-100/80 text-xs mt-1 max-w-xl">
              Ikuti kegiatan asrama dan lakukan presensi kehadiran tepat waktu dengan validasi GPS lokasi dan verifikasi foto wajah.
            </p>
          </div>

          {/* 4 Stat Mini Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full lg:w-auto">
            {[
              { label: 'Total Event', value: totalEvent },
              { label: 'Sedang Berlangsung', value: sedangBerlangsung },
              { label: 'Akan Datang', value: akanDatang },
              { label: 'Kehadiran Saya', value: `${hadirCount} Event` },
            ].map(s => (
              <div key={s.label} className="px-3.5 py-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/10 text-center min-w-[85px]">
                <p className="text-[10px] font-medium text-emerald-200/90">{s.label}</p>
                <p className="text-base lg:text-lg font-extrabold text-white mt-0.5" style={{ fontFamily: 'Plus Jakarta Sans' }}>{s.value}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

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
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari event, kegiatan, lokasi..."
            value={cari}
            onChange={e => setCari(e.target.value)}
            className="pl-8 pr-3 py-1.5 rounded-xl border border-gray-200 text-xs outline-none focus:border-emerald-600 w-52 sm:w-72 bg-gray-50/50"
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
        <div className="grid md:grid-cols-2 gap-5">
          {filtered.map(ev => {
            const st = getStatusEvent(ev, today, now)
            const sudahHadir = ev.statusKehadiranSaya === 'Hadir'
            const tidakHadir = ev.statusKehadiranSaya === 'Tidak Hadir'
            const bisaAbsen = st === 'Sedang Berlangsung' && !sudahHadir

            return (
              <div
                key={ev.id}
                className={`bg-white rounded-2xl p-5 border shadow-2xs hover:shadow-md transition-shadow flex flex-col justify-between ${
                  st === 'Sedang Berlangsung' && !sudahHadir
                    ? 'border-amber-300 ring-2 ring-amber-300/30'
                    : 'border-gray-200'
                }`}
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          ev.tipe === 'seluruh'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-purple-50 text-purple-800 border border-purple-200'
                        }`}
                      >
                        {ev.tipe === 'seluruh' ? 'Seluruh Asrama' : `Gedung ${ev.namaGedung || ''}`}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          st === 'Sedang Berlangsung'
                            ? 'bg-amber-100 text-amber-900 border border-amber-300 animate-pulse'
                            : st === 'Akan Datang'
                            ? 'bg-blue-50 text-blue-800 border border-blue-200'
                            : 'bg-gray-100 text-gray-700 border border-gray-200'
                        }`}
                      >
                        {st}
                      </span>
                    </div>

                    {/* Attendance Badge */}
                    <div>
                      {sudahHadir ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Hadir</span>
                        </span>
                      ) : tidakHadir ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-rose-50 text-rose-800 border border-rose-200">
                          <XCircle className="w-3.5 h-3.5 text-rose-600" />
                          <span>Tidak Hadir</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                          <span>Belum Absen</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Title and Description */}
                  <h4 className="font-extrabold text-base text-gray-900 mb-1.5" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                    {ev.judul}
                  </h4>
                  {ev.deskripsi && (
                    <p className="text-xs text-gray-600 mb-4 line-clamp-2 leading-relaxed">
                      {ev.deskripsi}
                    </p>
                  )}

                  {/* Details Grid */}
                  <div className="space-y-2 p-3 bg-gray-50/70 rounded-xl border border-gray-100 text-xs mb-4">
                    <div className="flex items-center gap-2 text-gray-700">
                      <Clock className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      <span className="font-semibold">{formatTanggal(ev.tanggal)}</span>
                      <span className="text-gray-400">•</span>
                      <span className="mono font-bold text-gray-900">{ev.jamMulai} – {ev.jamSelesai} WIB</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-700">
                      <MapPin className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      <span className="font-medium text-gray-900">{ev.lokasi}</span>
                      <span className="text-gray-400">•</span>
                      <span className="text-[11px] text-gray-500 font-semibold">Radius: {ev.radiusMeter}m</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-500 text-[11px]">
                      <User className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span>Penyelenggara: <strong className="text-gray-700">{ev.namaPembuat || (ev.tipe === 'seluruh' ? 'Pengelola Asrama' : 'Fasilitator Gedung')}</strong></span>
                    </div>
                  </div>
                </div>

                {/* Bottom CTA / Status Info */}
                <div className="pt-2 border-t border-gray-100">
                  {sudahHadir ? (
                    <div className="p-2.5 rounded-xl bg-emerald-50/80 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Kehadiran Anda telah tercatat</span>
                      </span>
                      {ev.waktuPresensiSaya && (
                        <span className="mono text-[11px] font-bold text-emerald-800">
                          {ev.waktuPresensiSaya} WIB
                        </span>
                      )}
                    </div>
                  ) : bisaAbsen ? (
                    <button
                      type="button"
                      onClick={() => onBukaAbsen(ev)}
                      className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-[#0e4b29] hover:bg-[#0b3c20] transition-colors shadow-2xs flex items-center justify-center gap-2 cursor-pointer"
                      style={{ fontFamily: 'Plus Jakarta Sans' }}
                    >
                      <UserCheck className="w-4 h-4" />
                      <span>Presensi Event Sekarang (GPS & Selfie)</span>
                    </button>
                  ) : st === 'Akan Datang' ? (
                    <div className="p-2.5 rounded-xl bg-blue-50/60 border border-blue-100 text-blue-900 text-xs font-medium flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-blue-600 shrink-0" />
                      <span>Presensi akan dibuka pada hari pelaksanaan pukul {ev.jamMulai} WIB</span>
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-xl bg-gray-50 border border-gray-200 text-gray-600 text-xs font-medium flex items-center gap-1.5">
                      <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
                      <span>Event telah selesai. Sesi presensi ditutup.</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
