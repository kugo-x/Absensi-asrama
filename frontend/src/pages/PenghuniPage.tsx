import { useState, useEffect } from 'react'
import type { CurrentUser, IzinRecord, PresensiRecord } from '../types'
import AppLayout, { StatCard, SectionTitle, Badge } from '../components/AppLayout'
import { presensiList as initialPresensi, izinList as initialIzin, TODAY } from '../data/mockData'
import { fetchPresensi, checkInApi, fetchIzin, submitIzinApi } from '../api'
import { 
  LayoutDashboard, 
  UserCheck, 
  History, 
  FileText, 
  User, 
  Sun, 
  Moon, 
  MapPin, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Calendar, 
  Paperclip, 
  Send, 
  DoorClosed, 
  Building, 
  Clock, 
  Sparkles, 
  ShieldCheck,
  Mail,
  Plus,
  Lock,
  Compass
} from 'lucide-react'

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-[18px] h-[18px]" /> },
  { id: 'presensi', label: 'Presensi Mandiri', icon: <UserCheck className="w-[18px] h-[18px]" /> },
  { id: 'riwayat', label: 'Riwayat Saya', icon: <History className="w-[18px] h-[18px]" /> },
  { id: 'izin', label: 'Pengajuan Izin', icon: <FileText className="w-[18px] h-[18px]" /> },
  { id: 'profil', label: 'Profil Saya', icon: <User className="w-[18px] h-[18px]" /> },
]

export default function PenghuniPage({ user, onLogout }: { user: CurrentUser; onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [presensi, setPresensi] = useState<PresensiRecord[]>(initialPresensi)
  const [izinData, setIzinData] = useState<IzinRecord[]>(initialIzin.filter(i => i.nim === user.nim))
  
  const todayStr = new Date().toISOString().slice(0, 10)
  const myPresensi = presensi.filter(p => p.nim === user.nim)
  const [checkedIn, setCheckedIn] = useState({ 
    Subuh: myPresensi.some(p => (p.tanggal === todayStr || p.tanggal === TODAY) && p.sesi === 'Subuh' && p.status === 'Hadir'), 
    Malam: myPresensi.some(p => (p.tanggal === todayStr || p.tanggal === TODAY) && p.sesi === 'Malam' && p.status === 'Hadir') 
  })
  const [checkingIn, setCheckingIn] = useState(false)

  useEffect(() => {
    fetchPresensi().then(data => {
      if (data && data.length > 0) {
        setPresensi(data)
        const myData = data.filter(p => p.nim === user.nim)
        setCheckedIn({
          Subuh: myData.some(p => (p.tanggal === todayStr || p.tanggal === TODAY) && p.sesi === 'Subuh' && p.status === 'Hadir'),
          Malam: myData.some(p => (p.tanggal === todayStr || p.tanggal === TODAY) && p.sesi === 'Malam' && p.status === 'Hadir')
        })
      }
    })
    fetchIzin().then(data => {
      if (data && data.length > 0) setIzinData(data.filter(i => i.nim === user.nim))
    })
  }, [user.nim])

  const todaySubuh = myPresensi.find(p => (p.tanggal === todayStr || p.tanggal === TODAY) && p.sesi === 'Subuh')
  const todayMalam = myPresensi.find(p => (p.tanggal === todayStr || p.tanggal === TODAY) && p.sesi === 'Malam')
  const totalHadir = myPresensi.filter(p => p.status === 'Hadir').length
  const totalIzin = izinData.filter(i => i.statusPersetujuan === 'Disetujui').length

  const handleCheckIn = async (sesi: 'Subuh' | 'Malam') => {
    if (checkedIn[sesi] || checkingIn) return
    setCheckingIn(true)
    setCheckedIn(prev => ({ ...prev, [sesi]: true }))
    await checkInApi({ nim: user.nim, sesi, tanggal: todayStr, status: 'Hadir', keterangan: 'Presensi mandiri web' })
    fetchPresensi().then(data => {
      if (data && data.length > 0) setPresensi(data)
    })
    setCheckingIn(false)
  }

  const now = new Date()
  const hour = now.getHours()
  const activeSesi: 'Subuh' | 'Malam' | null = (hour >= 4 && hour < 6) ? 'Subuh' : (hour >= 18 && hour < 21) ? 'Malam' : null

  return (
    <AppLayout user={user} onLogout={onLogout} navItems={navItems} activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'dashboard' && (
        <PenghuniDashboard
          user={user}
          todaySubuh={todaySubuh}
          todayMalam={todayMalam}
          totalHadir={totalHadir}
          totalIzin={totalIzin}
          myPresensi={myPresensi}
          checkedIn={checkedIn}
          onCheckIn={handleCheckIn}
          checkingIn={checkingIn}
          activeSesi={activeSesi}
        />
      )}
      {activeTab === 'presensi' && (
        <PenghuniPresensi
          checkedIn={checkedIn}
          onCheckIn={handleCheckIn}
          checkingIn={checkingIn}
          activeSesi={activeSesi}
          user={user}
        />
      )}
      {activeTab === 'riwayat' && <PenghuniRiwayat presensi={myPresensi} />}
      {activeTab === 'izin' && <PenghuniIzin izinData={izinData} setIzinData={setIzinData} user={user} />}
      {activeTab === 'profil' && <PenghuniProfil user={user} />}
    </AppLayout>
  )
}

function PenghuniDashboard({ user, todaySubuh, todayMalam, totalHadir, totalIzin, myPresensi, checkedIn, onCheckIn, checkingIn, activeSesi }: any) {
  const pctHadir = myPresensi.length > 0 ? Math.round((totalHadir / myPresensi.length) * 100) : 0

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div 
        className="rounded-3xl p-6 lg:p-8 text-white relative overflow-hidden shadow-lg border border-emerald-500/20"
        style={{ background: 'linear-gradient(135deg, #064e3b 0%, #065f46 60%, #047857 100%)' }}
      >
        <div className="absolute -top-12 -right-12 w-64 h-64 rounded-full bg-emerald-400/10 blur-2xl pointer-events-none" />
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-emerald-200 text-xs font-bold mb-3 border border-white/15">
            <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
            <span>Mahasiswa Penghuni Asrama</span>
          </div>
          <h2 className="text-2xl lg:text-3xl font-extrabold tracking-tight" style={{ fontFamily: 'Plus Jakarta Sans' }}>
            Selamat Datang, {user.nama}!
          </h2>
          <p className="text-emerald-100/80 text-sm mt-1 flex items-center gap-2">
            <span>Kamar {user.nomorKamar || '101-PA'}</span>
            <span>•</span>
            <span>{user.namaGedung || 'Asrama Putra A'}</span>
          </p>

          <div className="mt-6 grid grid-cols-3 gap-3 max-w-lg">
            <div className="p-3.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 text-center">
              <p className="text-[11px] font-medium text-emerald-200/80">Kehadiran</p>
              <p className="text-xl lg:text-2xl font-extrabold text-white mt-0.5" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                {pctHadir}%
              </p>
            </div>
            <div className="p-3.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 text-center">
              <p className="text-[11px] font-medium text-emerald-200/80">Total Hadir</p>
              <p className="text-xl lg:text-2xl font-extrabold text-white mt-0.5" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                {totalHadir} Sesi
              </p>
            </div>
            <div className="p-3.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 text-center">
              <p className="text-[11px] font-medium text-emerald-200/80">Izin Disetujui</p>
              <p className="text-xl lg:text-2xl font-extrabold text-white mt-0.5" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                {totalIzin} Kali
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Sesi Presensi Hari Ini */}
      <div>
        <SectionTitle subtitle="Status kehadiran Anda pada sesi Subuh dan Malam hari ini">
          Status Presensi Hari Ini
        </SectionTitle>
        <div className="grid sm:grid-cols-2 gap-4">
          {([
            { 
              sesi: 'Subuh', 
              jam: '04:00 – 06:00 WIB', 
              data: todaySubuh, 
              key: 'Subuh' as const, 
              icon: <Sun className="w-5 h-5 text-amber-500" />,
              border: todaySubuh?.status === 'Hadir' || checkedIn['Subuh'] ? 'border-emerald-300 bg-emerald-50/20' : 'border-emerald-100'
            },
            { 
              sesi: 'Malam', 
              jam: '18:00 – 20:30 WIB', 
              data: todayMalam, 
              key: 'Malam' as const, 
              icon: <Moon className="w-5 h-5 text-blue-500" />,
              border: todayMalam?.status === 'Hadir' || checkedIn['Malam'] ? 'border-emerald-300 bg-emerald-50/20' : 'border-emerald-100'
            },
          ] as const).map(item => {
            const isHadir = item.data?.status === 'Hadir' || checkedIn[item.key]
            const isIzin = item.data?.status === 'Izin'

            return (
              <div 
                key={item.sesi} 
                className={`bg-white rounded-2xl p-5 border ${item.border} shadow-xs hover:shadow-md transition-all flex flex-col justify-between`}
              >
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center border border-gray-100">
                        {item.icon}
                      </div>
                      <div>
                        <h4 className="font-extrabold text-base text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                          Sesi {item.sesi}
                        </h4>
                        <p className="text-xs text-gray-400 font-medium">{item.jam}</p>
                      </div>
                    </div>
                    {isHadir ? (
                      <Badge status="Hadir" />
                    ) : isIzin ? (
                      <Badge status="Izin" />
                    ) : (
                      <Badge status="Belum" />
                    )}
                  </div>

                  {item.data?.waktu && (
                    <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-semibold flex items-center gap-2 mb-3">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Tercatat pada pukul {item.data.waktu} WIB</span>
                    </div>
                  )}

                  {checkedIn[item.key] && !item.data?.waktu && (
                    <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-semibold flex items-center gap-2 mb-3">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Berhasil absen hari ini</span>
                    </div>
                  )}
                </div>

                {!isHadir && !isIzin && (
                  <button
                    onClick={() => onCheckIn(item.key)}
                    disabled={checkingIn}
                    className="w-full mt-3 py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 transition-colors shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                    style={{ fontFamily: 'Plus Jakarta Sans' }}
                  >
                    <UserCheck className="w-4 h-4" />
                    <span>{checkingIn ? 'Memverifikasi Lokasi...' : `Presensi Sesi ${item.sesi}`}</span>
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Geofence Notice */}
      <div className="rounded-2xl p-4 bg-emerald-50/80 border border-emerald-200/80 flex items-start gap-3">
        <MapPin className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
        <div className="text-xs text-emerald-950 font-medium leading-relaxed">
          <strong className="font-bold text-emerald-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>Verifikasi Radius GPS Aktif:</strong> Presensi mandiri divalidasi dengan radius 50 meter dari titik koordinat gedung asrama Anda. Pastikan izin akses lokasi pada browser Anda telah diizinkan.
        </div>
      </div>
    </div>
  )
}

function PenghuniPresensi({ checkedIn, onCheckIn, checkingIn, activeSesi, user }: any) {
  const [selectedSesi, setSelectedSesi] = useState<'Subuh' | 'Malam'>('Subuh')

  return (
    <div className="grid lg:grid-cols-12 gap-6 w-full items-start">
      {/* Kolom Kiri: Form & Aksi Presensi */}
      <div className="lg:col-span-7 space-y-6">
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-2xs">
          <SectionTitle subtitle="Pilih sesi yang ingin divalidasi kehadirannya saat ini">
            Lakukan Presensi Mandiri
          </SectionTitle>

          <div className="grid sm:grid-cols-2 gap-3 mb-6">
            {(['Subuh', 'Malam'] as const).map(s => {
              const isSelected = selectedSesi === s
              const isDone = checkedIn[s]
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSelectedSesi(s)}
                  className={`p-4 rounded-xl text-left border transition-all cursor-pointer ${
                    isSelected 
                      ? 'border-emerald-700 bg-emerald-50/50 shadow-2xs ring-1 ring-emerald-700' 
                      : 'border-gray-200 bg-white hover:border-emerald-300'
                  }`}
                >
                  <div className="w-9 h-9 rounded-lg bg-gray-50 flex items-center justify-center border border-gray-200 mb-2.5">
                    {s === 'Subuh' ? <Sun className="w-5 h-5 text-amber-600" /> : <Moon className="w-5 h-5 text-blue-600" />}
                  </div>
                  <div className="font-bold text-sm text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                    Sesi {s}
                  </div>
                  <div className="text-xs text-gray-500 font-medium">
                    {s === 'Subuh' ? '04:00 – 06:00 WIB' : '18:00 – 20:30 WIB'}
                  </div>
                  {isDone && (
                    <div className="mt-2 text-xs font-bold text-emerald-800 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Sudah Hadir</span>
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {/* GPS location simulation */}
          <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 mb-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-emerald-700" />
                <span className="text-xs font-bold text-gray-800" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                  Lokasi GPS Terdeteksi
                </span>
              </div>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                Dalam Radius (12m)
              </span>
            </div>
            <p className="text-sm font-bold text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>
              {user.namaGedung || 'Asrama Putra A UNAND'}
            </p>
            <p className="mono text-xs text-gray-500 mt-0.5">
              Koordinat: -0.914488, 100.466542 · Batas Maksimum: 50 Meter
            </p>
            <div className="mt-2.5 h-2 rounded-full bg-gray-200 overflow-hidden">
              <div className="h-full rounded-full bg-emerald-700 w-3/4" />
            </div>
          </div>

          <button
            type="button"
            onClick={() => onCheckIn(selectedSesi)}
            disabled={checkedIn[selectedSesi] || checkingIn}
            className="w-full py-3 px-4 rounded-lg font-bold text-xs text-white bg-[#0e4b29] hover:bg-[#0b3c20] transition-colors shadow-2xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ fontFamily: 'Plus Jakarta Sans' }}
          >
            {checkedIn[selectedSesi] ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Presensi Sesi {selectedSesi} Sudah Tercatat</span>
              </>
            ) : checkingIn ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Memvalidasi Lokasi GPS...</span>
              </>
            ) : (
              <>
                <MapPin className="w-4 h-4" />
                <span>Kirim Presensi Sekarang (Sesi {selectedSesi})</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Kolom Kanan: Panduan & Informasi Tambahan */}
      <div className="lg:col-span-5 space-y-6">
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-2xs">
          <SectionTitle subtitle="Status absensi pada tanggal hari ini">
            Status Kehadiran Hari Ini
          </SectionTitle>
          <div className="space-y-3">
            <div className="p-3.5 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Sun className="w-5 h-5 text-amber-600" />
                <div>
                  <p className="text-xs font-bold text-gray-800" style={{ fontFamily: 'Plus Jakarta Sans' }}>Sesi Subuh</p>
                  <p className="text-[11px] text-gray-500">04:00 – 06:00 WIB</p>
                </div>
              </div>
              <Badge status={checkedIn['Subuh'] ? 'Hadir' : 'Belum'} />
            </div>

            <div className="p-3.5 rounded-lg border border-gray-200 bg-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Moon className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-xs font-bold text-gray-800" style={{ fontFamily: 'Plus Jakarta Sans' }}>Sesi Malam</p>
                  <p className="text-[11px] text-gray-500">18:00 – 20:30 WIB</p>
                </div>
              </div>
              <Badge status={checkedIn['Malam'] ? 'Hadir' : 'Belum'} />
            </div>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-950 space-y-2">
          <p className="font-bold flex items-center gap-1.5 text-amber-950" style={{ fontFamily: 'Plus Jakarta Sans' }}>
            <AlertCircle className="w-4 h-4 text-amber-700" />
            Ketentuan & Kebijakan Absensi Asrama:
          </p>
          <ul className="space-y-1.5 text-amber-900 leading-relaxed list-disc list-inside">
            <li>Presensi hanya sah jika koordinat GPS berada dalam radius 50m gedung.</li>
            <li>Wajib hadir di setiap sesi pagi dan malam sesuai batas jam yang ditentukan.</li>
            <li>Dilarang keras menitipkan absensi atau menggunakan pemalsu lokasi.</li>
            <li>Jika berhalangan, ajukan permohonan pada menu <strong>Pengajuan Izin</strong> sebelum sesi ditutup.</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

function PenghuniRiwayat({ presensi }: { presensi: PresensiRecord[] }) {
  const hadir = presensi.filter(p => p.status === 'Hadir').length
  const tidakHadir = presensi.filter(p => p.status === 'Tidak Hadir').length
  const izin = presensi.filter(p => p.status === 'Izin').length
  const pct = presensi.length > 0 ? Math.round((hadir / presensi.length) * 100) : 0

  return (
    <div className="space-y-6 w-full">
      <div className="grid grid-cols-3 gap-4">
        <StatCard 
          icon={<CheckCircle2 className="w-5 h-5 text-emerald-700" />} 
          label="Total Hadir" 
          value={hadir} 
          color="#0e4b29"
        />
        <StatCard 
          icon={<XCircle className="w-5 h-5 text-rose-700" />} 
          label="Tidak Hadir" 
          value={tidakHadir} 
          color="#dc2626" 
        />
        <StatCard 
          icon={<FileText className="w-5 h-5 text-amber-700" />} 
          label="Total Izin" 
          value={izin} 
          color="#b45309" 
        />
      </div>

      <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-2xs">
        <div className="flex items-center justify-between mb-2">
          <SectionTitle subtitle={`Rekap kehadiran Anda dari total ${presensi.length} sesi yang tercatat`}>
            Persentase Tingkat Kehadiran
          </SectionTitle>
          <span className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>
            {pct}%
          </span>
        </div>
        <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
          <div 
            className="h-full rounded-full bg-emerald-700 transition-all duration-300" 
            style={{ width: `${pct}%` }} 
          />
        </div>
      </div>

      <div className="bg-white rounded-xl overflow-hidden border border-gray-200 shadow-2xs">
        <div className="px-5 py-4 border-b border-gray-200">
          <SectionTitle subtitle="Daftar seluruh catatan kehadiran harian Anda">
            Log Riwayat Presensi
          </SectionTitle>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {['Tanggal', 'Sesi', 'Waktu Masuk', 'Status', 'Keterangan'].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {presensi.map(p => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 font-semibold text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>{p.tanggal}</td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-800 border border-gray-200">
                      {p.sesi === 'Subuh' ? <Sun className="w-3 h-3 text-amber-600" /> : <Moon className="w-3 h-3 text-blue-600" />}
                      <span>{p.sesi}</span>
                    </span>
                  </td>
                  <td className="px-5 py-3 mono text-xs text-gray-600">{p.waktu || '–'}</td>
                  <td className="px-5 py-3"><Badge status={p.status} /></td>
                  <td className="px-5 py-3 text-xs text-gray-500">{p.keterangan || '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function PenghuniIzin({ izinData, setIzinData, user }: { izinData: IzinRecord[]; setIzinData: (fn: any) => void; user: CurrentUser }) {
  const [form, setForm] = useState({ alasan: '', tanggal: '', tanggalAkhir: '', fileBukti: '' })
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!form.alasan || !form.tanggal || !form.tanggalAkhir) return
    setSubmitting(true)
    const newIzin: IzinRecord = {
      id: Date.now(),
      nim: user.nim,
      namaPenghuni: user.nama,
      nomorKamar: user.nomorKamar || '',
      namaGedung: user.namaGedung || '',
      alasan: form.alasan,
      tanggal: form.tanggal,
      tanggalAkhir: form.tanggalAkhir,
      fileBukti: form.fileBukti,
      statusPersetujuan: 'Pending',
    }
    setIzinData((prev: IzinRecord[]) => [newIzin, ...prev])
    await submitIzinApi({
      nim: user.nim,
      alasan: form.alasan,
      tanggal: form.tanggal,
      fileBukti: form.fileBukti
    })
    setForm({ alasan: '', tanggal: '', tanggalAkhir: '', fileBukti: '' })
    setSubmitting(false)
  }

  return (
    <div className="grid lg:grid-cols-12 gap-6 w-full items-start">
      {/* Kolom Kiri: Form Pengajuan Izin */}
      <div className="lg:col-span-5">
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-2xs">
          <SectionTitle subtitle="Isi rincian permohonan izin tidak masuk asrama">
            Formulir Pengajuan Izin
          </SectionTitle>
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                  Tanggal Mulai
                </label>
                <input 
                  type="date" 
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-xs text-gray-800 outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700 transition-colors" 
                  value={form.tanggal} 
                  onChange={e => setForm(p => ({ ...p, tanggal: e.target.value }))} 
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                  Tanggal Selesai
                </label>
                <input 
                  type="date" 
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-xs text-gray-800 outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700 transition-colors" 
                  value={form.tanggalAkhir} 
                  onChange={e => setForm(p => ({ ...p, tanggalAkhir: e.target.value }))} 
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                Alasan / Keperluan Izin
              </label>
              <textarea
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-xs text-gray-800 outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700 transition-colors placeholder:text-gray-400"
                rows={4}
                placeholder="Tuliskan keterangan lengkap alasan izin (misal: sakit, ada keperluan keluarga mendesak)..."
                value={form.alasan}
                onChange={e => setForm(p => ({ ...p, alasan: e.target.value }))}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                Nama Berkas Bukti (PDF / JPG)
              </label>
              <div className="relative flex items-center">
                <Paperclip className="w-4 h-4 absolute left-3 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Contoh: surat_dokter.pdf"
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 text-xs text-gray-800 outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700 transition-colors placeholder:text-gray-400"
                  value={form.fileBukti}
                  onChange={e => setForm(p => ({ ...p, fileBukti: e.target.value }))}
                />
              </div>
            </div>

            <button 
              type="button"
              disabled={submitting}
              className="w-full py-2.5 px-4 rounded-lg font-bold text-xs text-white bg-[#0e4b29] hover:bg-[#0b3c20] transition-colors shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60" 
              onClick={handleSubmit}
              style={{ fontFamily: 'Plus Jakarta Sans' }}
            >
              <Send className="w-3.5 h-3.5" />
              <span>{submitting ? 'Mengirim Permohonan...' : 'Kirim Permohonan Izin'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Kolom Kanan: Riwayat Pengajuan Izin */}
      <div className="lg:col-span-7 space-y-4">
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-2xs">
          <SectionTitle subtitle="Daftar pengajuan izin dan status persetujuan dari fasilitator">
            Riwayat Permohonan Izin ({izinData.length})
          </SectionTitle>

          <div className="space-y-3">
            {izinData.length === 0 && (
              <div className="p-8 text-center border border-dashed border-gray-200 rounded-lg">
                <p className="text-xs text-gray-400 font-medium">Belum ada riwayat pengajuan izin yang tercatat</p>
              </div>
            )}
            {izinData.map(i => (
              <div key={i.id} className="p-4 rounded-lg border border-gray-200 bg-gray-50/50 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between gap-3 mb-1.5">
                  <div className="flex items-center gap-2">
                    <Badge status={i.statusPersetujuan} />
                    <span className="mono text-[11px] text-gray-400">ID #{i.id}</span>
                  </div>
                  <span className="text-[11px] font-medium text-gray-500">
                    {i.tanggal} s/d {i.tanggalAkhir}
                  </span>
                </div>
                <p className="text-xs font-semibold text-gray-900 leading-relaxed mt-2">{i.alasan}</p>
                <div className="flex flex-wrap items-center gap-3 mt-3 text-[11px] text-gray-500">
                  {i.fileBukti && (
                    <span className="inline-flex items-center gap-1 text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      <Paperclip className="w-3 h-3" />
                      <span>{i.fileBukti}</span>
                    </span>
                  )}
                  {i.namaApprover && (
                    <span className="inline-flex items-center gap-1 text-emerald-800">
                      <User className="w-3 h-3" />
                      <span>Approver: {i.namaApprover}</span>
                    </span>
                  )}
                </div>
                {i.keteranganPenolakan && (
                  <p className="text-xs mt-2.5 p-2 rounded bg-red-50 text-red-700 border border-red-200">
                    Catatan Penolakan: {i.keteranganPenolakan}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function PenghuniProfil({ user }: { user: CurrentUser }) {
  return (
    <div className="grid lg:grid-cols-12 gap-6 w-full items-start">
      {/* Kolom Kiri: Informasi Identitas Penghuni */}
      <div className="lg:col-span-6 bg-white rounded-xl p-5 border border-gray-200 shadow-2xs space-y-5">
        <SectionTitle subtitle="Informasi akun mahasiswa penghuni asrama yang terdaftar">
          Data Identitas Diri
        </SectionTitle>

        <div className="flex items-center gap-4 p-4 rounded-lg bg-gray-50 border border-gray-200">
          <div className="w-14 h-14 rounded-lg flex items-center justify-center text-xl font-bold bg-[#0e4b29] text-white shrink-0" style={{ fontFamily: 'Plus Jakarta Sans' }}>
            {user.nama.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-base text-gray-900 truncate" style={{ fontFamily: 'Plus Jakarta Sans' }}>
              {user.nama}
            </h3>
            <p className="mono text-xs text-gray-500">{user.nim}</p>
            <div className="mt-1.5">
              <Badge status="Aktif" />
            </div>
          </div>
        </div>

        <div className="space-y-2.5 text-xs">
          {[
            { label: 'Alamat Email', value: user.email, icon: <Mail className="w-4 h-4 text-emerald-700" /> },
            { label: 'Gedung Asrama', value: user.namaGedung || 'Asrama Putra A', icon: <Building className="w-4 h-4 text-emerald-700" /> },
            { label: 'Nomor Kamar', value: user.nomorKamar || '101-PA', icon: <DoorClosed className="w-4 h-4 text-emerald-700" /> },
            { label: 'Status Akun', value: 'Mahasiswa / Penghuni Terdaftar', icon: <ShieldCheck className="w-4 h-4 text-emerald-700" /> },
          ].map(row => (
            <div key={row.label} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 bg-white">
              <div className="w-7 h-7 rounded bg-gray-100 flex items-center justify-center shrink-0">
                {row.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{row.label}</p>
                <p className="text-xs font-semibold text-gray-800 truncate" style={{ fontFamily: 'Plus Jakarta Sans' }}>{row.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Kolom Kanan: Pengaturan Keamanan & Password */}
      <div className="lg:col-span-6 bg-white rounded-xl p-5 border border-gray-200 shadow-2xs space-y-4">
        <SectionTitle subtitle="Ganti kata sandi secara berkala untuk menjaga keamanan akun Anda">
          Keamanan & Ubah Password
        </SectionTitle>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1" style={{ fontFamily: 'Plus Jakarta Sans' }}>
              Password Saat Ini
            </label>
            <div className="relative flex items-center">
              <Lock className="w-4 h-4 absolute left-3 text-gray-400 pointer-events-none" />
              <input 
                type="password" 
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 text-xs text-gray-800 outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700 transition-colors placeholder:text-gray-400" 
                placeholder="Masukkan password lama" 
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1" style={{ fontFamily: 'Plus Jakarta Sans' }}>
              Password Baru
            </label>
            <div className="relative flex items-center">
              <Lock className="w-4 h-4 absolute left-3 text-gray-400 pointer-events-none" />
              <input 
                type="password" 
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 text-xs text-gray-800 outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700 transition-colors placeholder:text-gray-400" 
                placeholder="Minimal 8 karakter" 
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1" style={{ fontFamily: 'Plus Jakarta Sans' }}>
              Konfirmasi Password Baru
            </label>
            <div className="relative flex items-center">
              <Lock className="w-4 h-4 absolute left-3 text-gray-400 pointer-events-none" />
              <input 
                type="password" 
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 text-xs text-gray-800 outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700 transition-colors placeholder:text-gray-400" 
                placeholder="Ulangi password baru" 
              />
            </div>
          </div>
          <button 
            type="button"
            onClick={() => alert('Fitur ubah password berhasil disimulasikan!')}
            className="w-full mt-2 py-2.5 rounded-lg font-bold text-xs text-white bg-[#0e4b29] hover:bg-[#0b3c20] transition-colors shadow-2xs cursor-pointer"
            style={{ fontFamily: 'Plus Jakarta Sans' }}
          >
            Simpan Perubahan Password
          </button>
        </div>

        <div className="p-3.5 rounded-lg bg-gray-50 border border-gray-200 text-xs text-gray-600 space-y-1">
          <p className="font-bold text-gray-700">Tips Keamanan Akun:</p>
          <p>• Gunakan kombinasi huruf besar, huruf kecil, dan angka.</p>
          <p>• Jangan membagikan akun dan password Anda kepada siapapun.</p>
        </div>
      </div>
    </div>
  )
}
