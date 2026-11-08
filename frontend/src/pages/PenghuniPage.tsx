import { useState, useEffect } from 'react'
import type { AturanPresensi, CurrentUser, Gedung, HariLibur, IzinRecord, ModeUji, PresensiRecord, Sesi } from '../types'
import AppLayout, { StatCard, SectionTitle, Badge, ConfirmDialog } from '../components/AppLayout'
import { FotoBadge, SesiIcon, formatRentangIzin } from '../components/PresensiWidgets'
import KameraWajah from '../components/KameraWajah'
import { notifikasiPenghuni } from '../notifikasiPeran'
import DateInput from '../components/DateInput'
import {
  presensiList as initialPresensi,
  izinList as initialIzin,
  gedungList as initialGedung,
  sesiList as initialSesi,
  liburList as initialLibur,
} from '../data/mockData'
import { fetchPresensi, checkInApi, fetchIzin, submitIzinApi, fetchGedung, fetchSesi, fetchLibur, fetchModeUji, MODE_UJI_MATI, fetchAturanPresensi, ATURAN_PRESENSI_DEFAULT, changePasswordApi, uploadProfilePhotoApi } from '../api'
import { distanceMeters, getCurrentPosition, type GpsPosition } from '../geo'
import {
  addDays, cariLibur, jamPresensi, hitungStatus, keteranganStatus, periodeRekap, riwayatPenghuni,
  faseSesi, sesiAktif, statusSesi, toHM, todayLocal, type DataPresensi, type StatusDetail,
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
} from 'lucide-react'
import Cropper, { type Area } from 'react-easy-crop'

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-[18px] h-[18px]" /> },
  { id: 'presensi', label: 'Presensi Mandiri', icon: <UserCheck className="w-[18px] h-[18px]" /> },
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

export default function PenghuniPage({ user, onLogout }: { user: CurrentUser; onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [presensi, setPresensi] = useState<PresensiRecord[]>(initialPresensi)
  const [izinData, setIzinData] = useState<IzinRecord[]>(initialIzin.filter(i => i.nim === user.nim))
  const [sesiList, setSesiList] = useState<Sesi[]>(initialSesi)
  const [libur, setLibur] = useState<HariLibur[]>(initialLibur)
  const [gedung, setGedung] = useState<Gedung | null>(findGedung(initialGedung, user))
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
    fetchGedung().then(list => {
      const g = findGedung(list, user)
      setGedung(g)
      readLocation(g)
    })
  }, [user.nim])

  const today = todayLocal()
  const data: DataPresensi = { presensi, izin: izinData, libur }
  const sesiHariIni: SesiHariIni[] = sesiAktif(sesiList).map(sesi => {
    const detail = statusSesi(user.nim, today, sesi, data, now)
    // Mode uji: jam sesi diabaikan, sesi yang belum punya catatan dianggap sedang dibuka
    const dibukaUji = modeUji.abaikanJam && !detail.presensi && !detail.izin && !detail.libur
    return { sesi, detail: dibukaUji ? { ...detail, status: 'Belum' as const, fase: 'dibuka' as const } : detail }
  })
  const riwayat = riwayatPenghuni(user.nim, periodeRekap(today, user.tanggalMasuk), today, sesiList, data, now)
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
      {activeTab === 'riwayat' && <PenghuniRiwayat riwayat={riwayat} />}
      {activeTab === 'izin' && <PenghuniIzin izinData={izinData} setIzinData={setIzinData} user={user} sesiList={sesiAktif(sesiList)} today={today} />}
      {activeTab === 'profil' && <PenghuniProfil user={user} onLogout={onLogout} />}
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

function PenghuniDashboard({ user, sesiHariIni, riwayat, izinData, liburHariIni, onBukaPresensi, gedung, notice, today, onNavigateTab }: {
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
                <span>{p.tanggal} · Sesi {p.sesi} divalidasi tidak sah{p.catatanValidasi ? `: ${p.catatanValidasi}` : ''}</span>
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
                  <span className="font-medium text-gray-800">{formatRentangIzin(i.tanggal, i.tanggalSelesai, i.sesi)} — {i.alasan}</span>
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
                        <p className="text-[11px] text-gray-400">{tanggal}</p>
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
                        {formatRentangIzin(i.tanggal, i.tanggalSelesai, i.sesi)}
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

function PenghuniRiwayat({ riwayat }: { riwayat: ReturnType<typeof riwayatPenghuni> }) {
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
                    <td className="px-5 py-3 font-semibold text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>{tanggal}</td>
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

function PenghuniIzin({ izinData, setIzinData, user, sesiList, today }: {
  izinData: IzinRecord[]
  setIzinData: (fn: (prev: IzinRecord[]) => IzinRecord[]) => void
  user: CurrentUser
  sesiList: Sesi[]
  today: string
}) {
  const kosong = { alasan: '', tanggal: '', tanggalSelesai: '', sesi: '', fileBukti: '' }
  const [form, setForm] = useState(kosong)
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)

  const handleSubmit = async () => {
    setNotice(null)
    const tanggalSelesai = form.tanggalSelesai || form.tanggal
    const sesi = form.sesi || null
    if (!form.alasan.trim() || !form.tanggal) {
      setNotice({ type: 'error', text: 'Tanggal mulai dan alasan izin wajib diisi.' })
      return
    }
    if (form.tanggal < today) {
      setNotice({ type: 'error', text: 'Izin tidak dapat diajukan untuk tanggal yang sudah lewat.' })
      return
    }
    if (tanggalSelesai < form.tanggal) {
      setNotice({ type: 'error', text: 'Tanggal selesai tidak boleh sebelum tanggal mulai.' })
      return
    }
    // Cegah pengajuan ganda pada tanggal/sesi yang sudah diajukan atau disetujui
    const bentrok = izinData.find(i => i.statusPersetujuan !== 'Ditolak' &&
      i.tanggal <= tanggalSelesai && form.tanggal <= (i.tanggalSelesai || i.tanggal) &&
      (!i.sesi || !sesi || i.sesi === sesi))
    if (bentrok) {
      setNotice({ type: 'error', text: `Sudah ada izin ${bentrok.statusPersetujuan.toLowerCase()} pada ${formatRentangIzin(bentrok.tanggal, bentrok.tanggalSelesai, bentrok.sesi)}.` })
      return
    }

    setSubmitting(true)
    const newIzin: IzinRecord = {
      id: Date.now(), nim: user.nim, namaPenghuni: user.nama, nomorKamar: user.nomorKamar || '', namaGedung: user.namaGedung || '',
      alasan: form.alasan, tanggal: form.tanggal, tanggalSelesai, sesi, fileBukti: form.fileBukti, statusPersetujuan: 'Pending',
    }
    const result = await submitIzinApi({ nim: user.nim, alasan: form.alasan, tanggal: form.tanggal, tanggalSelesai, sesi, fileBukti: form.fileBukti })
    if (result.ok || result.offline) {
      setIzinData(prev => [newIzin, ...prev])
      setForm(kosong)
      setNotice({ type: 'success', text: 'Permohonan izin terkirim dan menunggu persetujuan fasilitator.' })
    } else {
      setNotice({ type: 'error', text: result.message })
    }
    setSubmitting(false)
  }

  const inputCls = 'w-full px-3 py-2 rounded-lg border border-gray-300 text-xs text-gray-800 outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700 transition-colors placeholder:text-gray-400'
  const labelCls = 'block text-xs font-semibold text-gray-700 mb-1'

  return (
    <div className="w-full space-y-4">
      {/* Banner info ringkas */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center gap-2.5">
        <FileText className="w-4 h-4 text-emerald-700 shrink-0" />
        <p className="text-xs text-emerald-800">Izin yang disetujui fasilitator otomatis mengubah status presensi menjadi <strong>Izin</strong>. Ajukan sebelum sesi dimulai.</p>
      </div>

      <div className="grid lg:grid-cols-5 gap-4 items-start">
        {/* Kolom Kiri: Form Pengajuan */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/60">
              <p className="text-sm font-bold text-gray-800" style={{ fontFamily: 'Plus Jakarta Sans' }}>Formulir Pengajuan Izin</p>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls} style={{ fontFamily: 'Plus Jakarta Sans' }}>Tgl Mulai</label>
                  <DateInput min={today} className={inputCls} value={form.tanggal} onChange={e => setForm(p => ({ ...p, tanggal: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls} style={{ fontFamily: 'Plus Jakarta Sans' }}>Tgl Selesai</label>
                  <DateInput clearable min={form.tanggal || today} className={inputCls} value={form.tanggalSelesai} onChange={e => setForm(p => ({ ...p, tanggalSelesai: e.target.value }))} />
                </div>
              </div>
              <p className="text-[10px] text-gray-400 -mt-1">Kosongkan jika izin hanya satu hari.</p>

              <div>
                <label className={labelCls} style={{ fontFamily: 'Plus Jakarta Sans' }}>Sesi</label>
                <select className={`${inputCls} bg-white`} value={form.sesi} onChange={e => setForm(p => ({ ...p, sesi: e.target.value }))}>
                  <option value="">Seharian (semua sesi)</option>
                  {sesiList.map(s => <option key={s.id} value={s.nama}>Sesi {s.nama} ({s.jamMulai}–{s.jamSelesai})</option>)}
                </select>
              </div>

              <div>
                <label className={labelCls} style={{ fontFamily: 'Plus Jakarta Sans' }}>Alasan / Keperluan</label>
                <textarea
                  className={inputCls}
                  rows={3}
                  placeholder="Misal: sakit, kuliah malam, keperluan keluarga..."
                  value={form.alasan}
                  onChange={e => setForm(p => ({ ...p, alasan: e.target.value }))}
                />
              </div>

              <div>
                <label className={labelCls} style={{ fontFamily: 'Plus Jakarta Sans' }}>Berkas Bukti (opsional)</label>
                <div className="relative flex items-center">
                  <Paperclip className="w-3.5 h-3.5 absolute left-3 text-gray-400 pointer-events-none" />
                  <input type="text" placeholder="surat_dokter.pdf" className={`${inputCls} pl-8`} value={form.fileBukti} onChange={e => setForm(p => ({ ...p, fileBukti: e.target.value }))} />
                </div>
              </div>

              {notice && <NoticeBox notice={notice} />}

              <button
                type="button"
                disabled={submitting}
                className="w-full py-2 px-4 rounded-lg font-bold text-xs text-white bg-[#0e4b29] hover:bg-[#0b3c20] transition-colors shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                onClick={handleSubmit}
                style={{ fontFamily: 'Plus Jakarta Sans' }}
              >
                <Send className="w-3.5 h-3.5" />
                <span>{submitting ? 'Mengirim...' : 'Kirim Permohonan Izin'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Kolom Kanan: Riwayat */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/60 flex items-center justify-between">
              <p className="text-sm font-bold text-gray-800" style={{ fontFamily: 'Plus Jakarta Sans' }}>Riwayat Permohonan Izin</p>
              <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{izinData.length} pengajuan</span>
            </div>
            <div className="divide-y divide-gray-100">
              {izinData.length === 0 && (
                <div className="py-8 text-center">
                  <FileText className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                  <p className="text-xs text-gray-400 font-medium">Belum ada riwayat pengajuan izin</p>
                </div>
              )}
              {izinData.map(i => (
                <div key={i.id} className="px-4 py-3 hover:bg-gray-50/70 transition-colors">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <Badge status={i.statusPersetujuan} />
                      {i.statusPersetujuan === 'Disetujui' && i.tanggal <= today && today <= (i.tanggalSelesai || i.tanggal) && (
                        <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">Berlaku hari ini</span>
                      )}
                    </div>
                    <span className="text-[11px] font-medium text-gray-400 shrink-0">{formatRentangIzin(i.tanggal, i.tanggalSelesai, i.sesi)}</span>
                  </div>
                  <p className="text-xs text-gray-700 leading-relaxed">{i.alasan}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[11px]">
                    {i.fileBukti && (
                      <span className="inline-flex items-center gap-1 text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                        <Paperclip className="w-3 h-3" />
                        <span>{i.fileBukti}</span>
                      </span>
                    )}
                    {i.namaApprover && (
                      <span className="inline-flex items-center gap-1 text-gray-500">
                        <User className="w-3 h-3" />
                        <span>{i.statusPersetujuan === 'Ditolak' ? 'Ditolak' : 'Disetujui'} oleh {i.namaApprover}{i.tanggalApproval ? ` · ${i.tanggalApproval}` : ''}</span>
                      </span>
                    )}
                  </div>
                  {i.catatanApprover && (
                    <p className={`text-[11px] mt-2 px-2.5 py-1.5 rounded border ${i.statusPersetujuan === 'Ditolak' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-blue-50 text-blue-800 border-blue-100'}`}>
                      💬 {i.catatanApprover}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Panduan Singkat & Ringkasan Izin */}
          <div className="p-4 rounded-xl bg-gray-50/80 border border-gray-200 text-xs text-gray-700 space-y-2 mt-4">
            <h5 className="font-bold text-gray-900 flex items-center gap-1.5" style={{ fontFamily: 'Plus Jakarta Sans' }}>
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              <span>Ketentuan Pengajuan Izin Asrama</span>
            </h5>
            <ul className="text-[11px] text-gray-600 space-y-1 list-disc list-inside leading-relaxed">
              <li>Permohonan izin diajukan sebelum sesi presensi yang bersangkutan dimulai.</li>
              <li>Izin sakit atau pulang kampung lebih dari 1 hari wajib menyertakan bukti/surat keterangan.</li>
              <li>Keputusan persetujuan izin sepenuhnya ditentukan oleh Fasilitator Gedung Anda.</li>
              <li>Izin yang disetujui otomatis mengubah status presensi menjadi <strong>Izin</strong> (bebas alpa).</li>
            </ul>
          </div>
        </div>
      </div>
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
  canvas.width = crop.width
  canvas.height = crop.height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas foto tidak tersedia.')
  context.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height)
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
    const result = await uploadProfilePhotoApi(user.nim, foto)
    if (result.ok || result.offline) {
      setFotoProfil(foto)
      setPendingFoto(null)
      const saved = JSON.parse(localStorage.getItem('sip-asrama-user') || '{}')
      localStorage.setItem('sip-asrama-user', JSON.stringify({ ...saved, fotoProfil: foto }))
      window.dispatchEvent(new Event('profile-updated'))
    }
    setNotice(result.message)
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
                className="relative w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-bold bg-white/10 backdrop-blur-md text-white border-2 border-white/30 shadow-md overflow-hidden cursor-pointer group transition-transform hover:scale-105"
                title="Klik untuk ganti foto profil"
              >
                {fotoProfil ? (
                  <img src={fotoProfil} alt="Foto profil" className="w-full h-full object-cover" />
                ) : (
                  user.nama.charAt(0).toUpperCase()
                )}
                <input type="file" accept="image/*" className="hidden" onChange={e => pilihFoto(e.target.files?.[0])} />
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
              cropShape="round"
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
