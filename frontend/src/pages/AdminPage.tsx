import { useState, useEffect } from 'react'
import type { CurrentUser, Penghuni, Gedung, Kamar, PresensiRecord, IzinRecord, Sesi, HariLibur, ModeUji, AturanPresensi } from '../types'
import AppLayout, { StatCard, SectionTitle, Badge, ConfirmDialog } from '../components/AppLayout'
import { RekapStats, RekapTable, SesiToggle, formatRentangIzin, type RekapRow } from '../components/PresensiWidgets'
import {
  penghuniList as initialPenghuni,
  gedungList as initialGedung,
  kamarList as initialKamar,
  presensiList as initialPresensi,
  izinList as initialIzin,
  sesiList as initialSesi,
  liburList as initialLibur,
} from '../data/mockData'
import {
  fetchPenghuni, addPenghuniApi, updatePenghuniApi, fetchGedung, fetchKamar, updateGedungApi, setPjGedungApi,
  fetchPresensi, fetchIzin, fetchSesi, saveSesiApi, fetchLibur, addLiburApi, deleteLiburApi, type ApiResult, type UbahPenghuni,
  fetchModeUji, saveModeUjiApi, MODE_UJI_MATI, resetPasswordApi,
  fetchAturanPresensi, saveAturanPresensiApi, ATURAN_PRESENSI_DEFAULT,
} from '../api'
import { getCurrentPosition } from '../geo'
import DateInput from '../components/DateInput'
import TimeInput from '../components/TimeInput'
import { notifikasiAdmin } from '../notifikasiPeran'
import {
  addDays, cariLibur, faseSesi, hitungStatus, hunianKamar, penghuniWajibAbsen, riwayatPenghuni, sesiAktif, statusSesi, todayLocal, type DataPresensi,
} from '../logic'
import {
  LayoutDashboard,
  Users,
  Building2,
  FileBarChart,
  UserPlus,
  Search,
  Building,
  DoorClosed,
  UserCheck,
  Download,
  CheckCircle2,
  XCircle,
  AlertCircle,
  TrendingUp,
  Calendar,
  FileSpreadsheet,
  X,
  MapPin,
  ShieldAlert,
  Crosshair,
  Save,
  ClipboardList,
  Settings,
  Plus,
  Trash2,
  LogOut,
  Palmtree,
  Eye,
  EyeOff,
  Clock,
  ArrowRight,
  ShieldCheck,
  FileText,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-[18px] h-[18px]" /> },
  { id: 'penghuni', label: 'Data Penghuni', icon: <Users className="w-[18px] h-[18px]" /> },
  { id: 'gedung', label: 'Gedung & Kamar', icon: <Building2 className="w-[18px] h-[18px]" /> },
  { id: 'presensi', label: 'Presensi & Izin', icon: <ClipboardList className="w-[18px] h-[18px]" /> },
  { id: 'pengaturan', label: 'Sesi & Hari Libur', icon: <Settings className="w-[18px] h-[18px]" /> },
  { id: 'laporan', label: 'Laporan Rekap', icon: <FileBarChart className="w-[18px] h-[18px]" /> },
]

const inputCls = 'w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 transition-all bg-white'
const labelCls = 'block text-xs font-bold uppercase tracking-wider text-emerald-900 mb-1.5'

// Kolom data diri penghuni, dipakai di form tambah dan ubah penghuni
type DataDiri = Pick<Penghuni, 'nim' | 'nama' | 'email' | 'noHp' | 'asal'>
const FIELD_DATA_DIRI: { key: keyof DataDiri; label: string; placeholder: string }[] = [
  { key: 'nim', label: 'NIM Mahasiswa', placeholder: 'Contoh: 2310933011' },
  { key: 'nama', label: 'Nama Lengkap', placeholder: 'Masukkan nama lengkap' },
  { key: 'email', label: 'Alamat Email', placeholder: 'mhs@student.unand.ac.id' },
  { key: 'noHp', label: 'Nomor WhatsApp / HP', placeholder: '081234567890' },
  { key: 'asal', label: 'Asal Daerah / Kota', placeholder: 'Contoh: Bukittinggi' },
]

// Pesan galat validasi data diri; `nimLama` diisi saat mengubah agar NIM sendiri tidak dianggap duplikat
function validasiDataDiri(d: DataDiri, penghuni: Penghuni[], nimLama?: string): string {
  if (!d.nim.trim() || !d.nama.trim()) return 'NIM dan nama wajib diisi.'
  if (penghuni.some(p => p.nim === d.nim.trim() && p.nim !== nimLama)) return 'NIM tersebut sudah terdaftar.'
  if (d.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim())) return 'Format email tidak valid.'
  return ''
}

function FormDataDiri({ value, onChange }: { value: DataDiri; onChange: (v: DataDiri) => void }) {
  return (
    <>
      {FIELD_DATA_DIRI.map(f => (
        <div key={f.key}>
          <label className={labelCls} style={{ fontFamily: 'Plus Jakarta Sans' }}>{f.label}</label>
          <input
            className={inputCls}
            placeholder={f.placeholder}
            value={value[f.key]}
            onChange={e => onChange({ ...value, [f.key]: e.target.value })}
          />
        </div>
      ))}
    </>
  )
}

export default function AdminPage({ user, onLogout }: { user: CurrentUser; onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [penghuni, setPenghuni] = useState<Penghuni[]>(initialPenghuni)
  const [gedungList, setGedungList] = useState<Gedung[]>(initialGedung)
  const [kamarList, setKamarList] = useState<Kamar[]>(initialKamar)
  const [presensi, setPresensi] = useState<PresensiRecord[]>(initialPresensi)
  const [izin, setIzin] = useState<IzinRecord[]>(initialIzin)
  const [sesiList, setSesiList] = useState<Sesi[]>(initialSesi)
  const [libur, setLibur] = useState<HariLibur[]>(initialLibur)
  const [modeUji, setModeUji] = useState<ModeUji>(MODE_UJI_MATI)
  const [aturan, setAturan] = useState<AturanPresensi>(ATURAN_PRESENSI_DEFAULT)
  const [showAddModal, setShowAddModal] = useState(false)
  const [kelola, setKelola] = useState<Penghuni | null>(null)
  const [resetTarget, setResetTarget] = useState<Penghuni | null>(null)
  const [showDefaultNotice, setShowDefaultNotice] = useState(true)
  const now = new Date()

  useEffect(() => {
    fetchPenghuni().then(setPenghuni)
    fetchGedung().then(setGedungList)
    fetchKamar().then(setKamarList)
    fetchPresensi().then(setPresensi)
    fetchIzin().then(setIzin)
    fetchSesi().then(setSesiList)
    fetchLibur().then(setLibur)
    fetchModeUji().then(setModeUji)
    fetchAturanPresensi().then(setAturan)
  }, [])

  const data: DataPresensi = { presensi, izin, libur }
  const defaultPasswordCount = penghuni.filter(p => p.role === 'penghuni' && p.statusAktif && p.passwordDefault).length
  const namaGedungKamar = (nomorKamar: string) => kamarList.find(k => k.nomorKamar === nomorKamar)?.namaGedung || ''

  const handleAddPenghuni = async (p: Penghuni) => {
    setPenghuni(prev => [...prev, p])
    setShowAddModal(false)
    await addPenghuniApi(p)
  }

  // Ubah data diri, pindah kamar, ubah peran, keluarkan, atau aktifkan kembali penghuni
  const handleUpdatePenghuni = async (nimLama: string, changes: UbahPenghuni): Promise<ApiResult> => {
    const result = await updatePenghuniApi(nimLama, changes)
    if (!result.ok && !result.offline) return result

    setPenghuni(prev => prev.map(p => p.nim === nimLama
      ? { ...p, ...changes, nomorKamar: changes.nomorKamar || '', namaGedung: changes.nomorKamar ? namaGedungKamar(changes.nomorKamar) : '' }
      : p
    ))
    // Fasil yang diturunkan / dikeluarkan otomatis dilepas dari jabatan PJ gedung
    const lepasPj = changes.role !== 'fasil' || !changes.statusAktif
    setGedungList(prev => prev.map(g => g.nimPj !== nimLama ? g
      : lepasPj ? { ...g, nimPj: null, namaPj: null } : { ...g, nimPj: changes.nim, namaPj: changes.nama }
    ))
    // NIM / nama juga tercatat di presensi & izin; ambil ulang agar ikut berubah
    if (result.ok) {
      fetchPresensi().then(setPresensi)
      fetchIzin().then(setIzin)
      fetchKamar().then(setKamarList)
    }
    setKelola(null)
    return result
  }

  const handleSaveLokasi = async (id: number, lokasi: GedungLokasi) => {
    setGedungList(prev => prev.map(g => g.id === id ? { ...g, ...lokasi } : g))
    return updateGedungApi(id, lokasi)
  }

  const handleSetPj = async (id: number, nimPj: string | null) => {
    const namaPj = penghuni.find(p => p.nim === nimPj)?.nama ?? null
    // Satu fasil hanya memegang satu gedung: lepas dari gedung lain jika dipindah
    setGedungList(prev => prev.map(g => g.id === id ? { ...g, nimPj, namaPj } : (nimPj && g.nimPj === nimPj ? { ...g, nimPj: null, namaPj: null } : g)))
    return setPjGedungApi(id, nimPj)
  }

  const handleSaveSesi = async (list: Sesi[]) => {
    setSesiList(list)
    return saveSesiApi(list)
  }

  const handleAddLibur = async (l: Omit<HariLibur, 'id'>) => {
    setLibur(prev => [...prev, { ...l, id: Date.now() }].sort((a, b) => b.tanggalMulai.localeCompare(a.tanggalMulai)))
    return addLiburApi(l)
  }

  const handleDeleteLibur = async (id: number) => {
    setLibur(prev => prev.filter(l => l.id !== id))
    await deleteLiburApi(id)
  }

  const handleSaveModeUji = async (mode: ModeUji) => {
    const result = await saveModeUjiApi(mode)
    if (result.ok || result.offline) setModeUji(mode)
    return result
  }

  const handleSaveAturan = async (next: AturanPresensi) => {
    const result = await saveAturanPresensiApi(next)
    if (result.ok || result.offline) setAturan(next)
    return result
  }

  return (
    <AppLayout user={user} onLogout={onLogout} navItems={navItems} activeTab={activeTab} onTabChange={setActiveTab}
      notifikasi={notifikasiAdmin({ passwordDefault: defaultPasswordCount, modeUji, gedung: gedungList, sesi: sesiList, izin, presensi })}>
      {showDefaultNotice && defaultPasswordCount > 0 && <DefaultPasswordNotice count={defaultPasswordCount} onClose={() => setShowDefaultNotice(false)} />}
      {activeTab === 'dashboard' && (
        <AdminDashboard
          penghuni={penghuni}
          gedungList={gedungList}
          kamarList={kamarList}
          sesiList={sesiList}
          data={data}
          now={now}
          modeUji={modeUji}
          onNavigateTab={setActiveTab}
        />
      )}
      {activeTab === 'penghuni' && (
        <AdminPenghuni penghuni={penghuni} onAddClick={() => setShowAddModal(true)} onKelola={setKelola} onResetPassword={nim => setResetTarget(penghuni.find(p => p.nim === nim) || null)} />
      )}
      {activeTab === 'gedung' && (
        <AdminGedung gedungList={gedungList} kamarList={kamarList} penghuni={penghuni} onSaveLokasi={handleSaveLokasi} onSetPj={handleSetPj} />
      )}
      {activeTab === 'presensi' && <AdminPresensiIzin penghuni={penghuni} gedungList={gedungList} sesiList={sesiList} data={data} now={now} />}
      {activeTab === 'pengaturan' && (
        <div className="space-y-5">
          <div className="grid lg:grid-cols-12 gap-5 items-stretch">
            <div className="lg:col-span-7">
              <AturanPresensiCard aturan={aturan} onSave={handleSaveAturan} />
            </div>
            <div className="lg:col-span-5">
              <ModeUjiCard modeUji={modeUji} onSave={handleSaveModeUji} />
            </div>
          </div>
          <AdminPengaturan sesiList={sesiList} libur={libur} onSaveSesi={handleSaveSesi} onAddLibur={handleAddLibur} onDeleteLibur={handleDeleteLibur} />
        </div>
      )}
      {activeTab === 'laporan' && <AdminLaporan penghuni={penghuni} gedungList={gedungList} sesiList={sesiList} data={data} now={now} />}

      {showAddModal && (
        <TambahPenghuniModal
          penghuni={penghuni}
          gedungList={gedungList}
          kamarList={kamarList}
          onClose={() => setShowAddModal(false)}
          onSave={handleAddPenghuni}
        />
      )}
      {kelola && (
        <KelolaPenghuniModal
          target={kelola}
          penghuni={penghuni}
          gedungList={gedungList}
          kamarList={kamarList}
          onClose={() => setKelola(null)}
          onSave={changes => handleUpdatePenghuni(kelola.nim, changes)}
        />
      )}
      {resetTarget && <ResetPasswordDialog target={resetTarget} onClose={() => setResetTarget(null)} />}
    </AppLayout>
  )
}

function DefaultPasswordNotice({ count, onClose }: { count: number; onClose: () => void }) {
  return (
    <div className="fixed left-4 right-4 bottom-4 sm:left-auto sm:right-5 sm:bottom-auto sm:top-20 z-40 sm:w-[min(360px,calc(100vw-2rem))] rounded-2xl border border-amber-200 bg-white p-4 shadow-xl">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">!</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-extrabold text-gray-900">Password default terdeteksi</p>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700 cursor-pointer" aria-label="Tutup pemberitahuan"><X className="h-4 w-4" /></button>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-gray-600">{count} akun penghuni aktif masih menggunakan password default <strong>penghuni123</strong>. Minta penghuni segera menggantinya melalui menu Profil.</p>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

function AdminDashboard({
  penghuni,
  gedungList,
  kamarList,
  sesiList,
  data,
  now,
  modeUji,
  onNavigateTab,
}: {
  penghuni: Penghuni[]
  gedungList: Gedung[]
  kamarList: Kamar[]
  sesiList: Sesi[]
  data: DataPresensi
  now: Date
  modeUji?: ModeUji
  onNavigateTab?: (tab: string) => void
}) {
  const today = todayLocal()
  const wajib = penghuniWajibAbsen(penghuni)
  const fasil = penghuni.filter(p => p.role === 'fasil' && p.statusAktif).length
  const kapasitas = kamarList.reduce((sum, k) => sum + k.kapasitas, 0)
  const terisi = kamarList.reduce((sum, k) => sum + hunianKamar(k, penghuni), 0)
  const persenHunian = kapasitas > 0 ? Math.round((terisi / kapasitas) * 100) : 0
  const tanpaPj = gedungList.filter(g => !g.nimPj)
  const tanpaKoordinat = gedungList.filter(g => g.latitude === null || g.longitude === null)
  const sesiHariIni = sesiAktif(sesiList)
  const liburHariIni = cariLibur(today, data.libur)

  // Hitung total akumulasi kehadiran hari ini dari seluruh sesi aktif
  const totalStatusList = sesiHariIni.flatMap(s =>
    wajib.map(p => statusSesi(p.nim, today, s, data, now).status)
  )
  const totalRekap = hitungStatus(totalStatusList)
  const sesiBerjalan = sesiHariIni.find(s => faseSesi(s, today, now) === 'dibuka')
  const presensiTerkini = [...data.presensi].slice(-6).reverse()
  const izinTerkini = [...data.izin].slice(-5).reverse()

  return (
    <div className="space-y-4">
      {/* 4 StatCards Utama */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={<Users className="w-5 h-5 text-emerald-700" />}
          label="Penghuni Wajib Absen"
          value={wajib.length}
          sub={`${penghuni.filter(p => !p.statusAktif).length} nonaktif`}
          color="#064e3b"
        />
        <StatCard
          icon={<Building className="w-5 h-5 text-blue-700" />}
          label="Gedung Asrama"
          value={gedungList.length}
          sub={`${gedungList.length - tanpaKoordinat.length} ber-GPS`}
          color="#1e40af"
        />
        <StatCard
          icon={<UserCheck className="w-5 h-5 text-amber-700" />}
          label="Fasilitator"
          value={fasil}
          sub={`${gedungList.length - tanpaPj.length} gedung ber-PJ`}
          color="#b45309"
        />
        <StatCard
          icon={<DoorClosed className="w-5 h-5 text-purple-700" />}
          label="Hunian Kamar"
          value={`${terisi}/${kapasitas}`}
          sub={`${persenHunian}% terisi`}
          color="#6b21a8"
        />
      </div>

      {/* Ringkasan Presensi Hari Ini (KPI Bar) */}
      <div className="bg-white rounded-2xl p-4 border border-gray-200/90 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>
              Presensi Hari Ini
            </span>
            {liburHariIni ? (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-sky-100 text-sky-800">
                🌴 Libur: {liburHariIni.keterangan}
              </span>
            ) : sesiBerjalan ? (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Sesi {sesiBerjalan.nama} ({sesiBerjalan.jamMulai}–{sesiBerjalan.jamSelesai})
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-500">
                {sesiHariIni.length > 0 ? 'Sesi Selesai / Belum Buka' : 'Tidak Ada Sesi Aktif'}
              </span>
            )}
          </div>

          {/* 4 Counter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
              {totalRekap.Hadir} Hadir
            </span>
            <span className="px-2 py-0.5 rounded-md bg-gray-50 border border-gray-200 text-gray-600 text-xs font-medium">
              {totalRekap.Belum} Belum
            </span>
            <span className="px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium">
              {totalRekap.Izin} Izin
            </span>
            <span className="px-2 py-0.5 rounded-md bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
              {totalRekap['Tidak Hadir']} Alpa
            </span>
            <span className="px-2.5 py-0.5 rounded-md bg-[#0e4b29] text-white text-xs font-bold shadow-2xs">
              {totalRekap.persen}%
            </span>
          </div>
        </div>

        {/* Progress Bar Akumulasi */}
        <div className="h-2 rounded-full bg-gray-100 overflow-hidden flex mt-3">
          <div
            className="h-full bg-emerald-600 transition-all duration-300"
            style={{ width: `${totalRekap.wajib > 0 ? (totalRekap.Hadir / totalRekap.wajib) * 100 : 0}%` }}
          />
          <div
            className="h-full bg-amber-400 transition-all duration-300"
            style={{ width: `${totalRekap.wajib > 0 ? (totalRekap.Izin / totalRekap.wajib) * 100 : 0}%` }}
          />
          <div
            className="h-full bg-rose-500 transition-all duration-300"
            style={{ width: `${totalRekap.wajib > 0 ? (totalRekap['Tidak Hadir'] / totalRekap.wajib) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Grid 2 Kolom: Monitoring Gedung (Kiri) & Pusat Operasional (Kanan) */}
      <div className="grid lg:grid-cols-12 gap-4 items-start">
        {/* Kolom Kiri: Kehadiran Hari Ini per Gedung */}
        <div className="lg:col-span-7 bg-white rounded-2xl p-4 border border-gray-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-gray-100">
            <h4 className="text-sm font-bold text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>
              Kehadiran per Gedung
            </h4>
            {onNavigateTab && (
              <button
                onClick={() => onNavigateTab('presensi')}
                className="text-xs font-semibold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 cursor-pointer"
              >
                <span>Detail</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="space-y-2.5">
            {gedungList.map(g => {
              const anggota = penghuniWajibAbsen(penghuni, g.nama)
              const bldgStatusList = sesiHariIni.flatMap(s =>
                anggota.map(p => statusSesi(p.nim, today, s, data, now).status)
              )
              const bldgRekap = hitungStatus(bldgStatusList)

              return (
                <div key={g.id} className="p-3 rounded-xl border border-gray-100 bg-gray-50/60 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-bold text-xs text-gray-900 truncate" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                        {g.nama}
                      </span>
                      <span className="text-[10px] text-gray-400">· {g.namaPj || 'Tanpa PJ'}</span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-bold text-emerald-900 mono">
                        {bldgRekap.persen}%
                      </span>
                      <span className="text-[11px] text-gray-400">({anggota.length} org)</span>
                    </div>
                  </div>

                  {/* Progress bar per gedung */}
                  <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden flex mb-2">
                    <div
                      className="h-full bg-emerald-600 transition-all duration-300"
                      style={{ width: `${bldgRekap.wajib > 0 ? (bldgRekap.Hadir / bldgRekap.wajib) * 100 : 0}%` }}
                    />
                    <div
                      className="h-full bg-amber-400 transition-all duration-300"
                      style={{ width: `${bldgRekap.wajib > 0 ? (bldgRekap.Izin / bldgRekap.wajib) * 100 : 0}%` }}
                    />
                    <div
                      className="h-full bg-rose-500 transition-all duration-300"
                      style={{ width: `${bldgRekap.wajib > 0 ? (bldgRekap['Tidak Hadir'] / bldgRekap.wajib) * 100 : 0}%` }}
                    />
                  </div>

                  {/* Sesi breakdown pills */}
                  {sesiHariIni.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {sesiHariIni.map(s => {
                        const c = hitungStatus(anggota.map(p => statusSesi(p.nim, today, s, data, now).status))
                        const fase = faseSesi(s, today, now)
                        return (
                          <div
                            key={s.id}
                            className="text-[10px] px-2 py-0.5 rounded-md bg-white border border-gray-200 flex items-center gap-1"
                          >
                            <span className="font-bold text-gray-700">{s.nama}:</span>
                            <span className="text-emerald-700 font-bold">{c.Hadir}H</span>
                            <span className="text-gray-300">/</span>
                            <span className="text-gray-500">{c.Belum}B</span>
                            <span className="text-gray-300">/</span>
                            <span className="text-rose-600">{c['Tidak Hadir']}A</span>
                            <span
                              className={`text-[9px] px-1 rounded font-bold uppercase ml-0.5 ${
                                fase === 'dibuka'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : fase === 'ditutup'
                                  ? 'bg-gray-100 text-gray-500'
                                  : 'bg-blue-50 text-blue-700'
                              }`}
                            >
                              {fase === 'dibuka' ? 'Buka' : fase === 'ditutup' ? 'Tutup' : 'Nanti'}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>

        {/* Kolom Kanan: Operasional & Kesiapan */}
        <div className="lg:col-span-5 space-y-3">
          {/* Status Sesi Hari Ini */}
          <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-2xs space-y-2.5">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <h4 className="text-sm font-bold text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                Jadwal Sesi
              </h4>
              {onNavigateTab && (
                <button
                  onClick={() => onNavigateTab('pengaturan')}
                  className="text-xs font-semibold text-emerald-800 hover:text-emerald-950 cursor-pointer"
                >
                  Atur
                </button>
              )}
            </div>

            <div className="divide-y divide-gray-100 text-xs">
              {sesiList.map(s => {
                const fase = s.aktif ? faseSesi(s, today, now) : null
                return (
                  <div key={s.id} className="py-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`font-bold ${s.aktif ? 'text-gray-800' : 'text-gray-400 line-through'}`}>
                        {s.nama}
                      </span>
                      <span className="mono text-[11px] text-gray-400">{s.jamMulai}–{s.jamSelesai}</span>
                    </div>

                    {s.aktif && (
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                          fase === 'dibuka'
                            ? 'bg-emerald-100 text-emerald-800 animate-pulse'
                            : fase === 'ditutup'
                            ? 'bg-gray-100 text-gray-500'
                            : 'bg-blue-50 text-blue-700'
                        }`}
                      >
                        {fase === 'dibuka' ? '🟢 Dibuka' : fase === 'ditutup' ? 'Selesai' : 'Nanti'}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Status Konfigurasi & Alerts Ringkas */}
          <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-2xs space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 text-xs">
              <span className="font-bold text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>Kesiapan Sistem</span>
              {tanpaPj.length === 0 && tanpaKoordinat.length === 0 ? (
                <span className="text-[11px] font-bold text-emerald-700">✓ Siap Operasional</span>
              ) : (
                <span className="text-[11px] font-bold text-amber-700">⚠️ Ada Kendala</span>
              )}
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-gray-50">
                <span className="text-gray-500">Mode Uji</span>
                <span className={`font-bold text-[11px] ${modeUji?.abaikanJam || modeUji?.abaikanRadius ? 'text-amber-700' : 'text-emerald-700'}`}>
                  {modeUji?.abaikanJam || modeUji?.abaikanRadius ? 'Aktif (Bypass)' : 'Nonaktif (Normal)'}
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-gray-50">
                <span className="text-gray-500">Koordinat GPS</span>
                <span className={`font-bold text-[11px] ${tanpaKoordinat.length > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                  {tanpaKoordinat.length > 0 ? `${tanpaKoordinat.length} gedung belum diset` : `${gedungList.length} gedung siap`}
                </span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-gray-500">PJ Fasilitator</span>
                <span className={`font-bold text-[11px] ${tanpaPj.length > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                  {tanpaPj.length > 0 ? `${tanpaPj.length} gedung kosong` : 'Lengkap'}
                </span>
              </div>
            </div>
          </div>

          {/* Navigasi Cepat (3 Tombol Icon) */}
          {onNavigateTab && (
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => onNavigateTab('presensi')}
                className="py-2 rounded-xl bg-white border border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/40 text-xs font-semibold text-gray-700 flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer transition-colors"
              >
                <ClipboardList className="w-3.5 h-3.5 text-emerald-700" />
                <span>Presensi</span>
              </button>
              <button
                onClick={() => onNavigateTab('penghuni')}
                className="py-2 rounded-xl bg-white border border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/40 text-xs font-semibold text-gray-700 flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer transition-colors"
              >
                <Users className="w-3.5 h-3.5 text-blue-700" />
                <span>Penghuni</span>
              </button>
              <button
                onClick={() => onNavigateTab('laporan')}
                className="py-2 rounded-xl bg-white border border-gray-200 hover:border-emerald-300 hover:bg-emerald-50/40 text-xs font-semibold text-gray-700 flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer transition-colors"
              >
                <FileBarChart className="w-3.5 h-3.5 text-purple-700" />
                <span>Rekap</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Data Penghuni
// ---------------------------------------------------------------------------

function AdminPenghuni({ penghuni, onAddClick, onKelola, onResetPassword }: {
  penghuni: Penghuni[]
  onAddClick: () => void
  onKelola: (p: Penghuni) => void
  onResetPassword: (nim: string) => void
}) {
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'aktif' | 'nonaktif' | 'semua'>('aktif')
  const [filterGedung, setFilterGedung] = useState('semua')
  const [page, setPage] = useState(1)
  const [importMessage, setImportMessage] = useState('')
  const pageSize = 8
  const q = search.toLowerCase()
  const filtered = penghuni
    .filter(p => filterStatus === 'semua' || (filterStatus === 'aktif' ? p.statusAktif : !p.statusAktif))
    .filter(p => filterGedung === 'semua' || p.namaGedung === filterGedung)
    .filter(p => p.nama.toLowerCase().includes(q) || p.nim.includes(search) || p.nomorKamar.toLowerCase().includes(q) || p.namaGedung.toLowerCase().includes(q) || p.asal.toLowerCase().includes(q))
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const rows = filtered.slice((page - 1) * pageSize, page * pageSize)

  const importSpreadsheet = (file: File | undefined) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const workbook = XLSX.read(reader.result, { type: 'array' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const sourceRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
      const normalize = (value: string) => value.trim().toLowerCase().replace(/[\s_-]+/g, '')
      const required = ['nim', 'nama']
      const imported = sourceRows.map(sourceRow => {
        const row = Object.fromEntries(Object.entries(sourceRow).map(([key, value]) => [normalize(key), String(value).trim()]))
        return { nim: row.nim || '', nama: row.nama || '', email: row.email || '', noHp: row.nohp || '', asal: row.asal || '', nomorKamar: row.nomorkamar || '', namaGedung: row.namagedung || '', statusAktif: true, role: 'penghuni' as const, tanggalMasuk: todayLocal() }
      }).filter(p => p.nim && p.nama && !penghuni.some(existing => existing.nim === p.nim))
      if (!sourceRows.length || !required.every(h => normalize(Object.keys(sourceRows[0]).find(key => normalize(key) === h) || '') === h)) return setImportMessage('File wajib memiliki kolom NIM dan Nama.')
      if (!imported.length) return setImportMessage('Tidak ada baris baru yang dapat diimpor.')
      imported.forEach(p => addPenghuniApi(p))
      setImportMessage(`${imported.length} data berhasil diimpor.`)
      window.location.reload()
    }
    reader.readAsArrayBuffer(file)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex flex-1 gap-3 flex-wrap">
          <div className="relative flex-1 max-w-md min-w-[220px]">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 transition-all font-medium placeholder:text-gray-400"
              placeholder="Cari nama, NIM, kamar, gedung, atau asal..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select className="px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700" value={filterStatus} onChange={e => setFilterStatus(e.target.value as typeof filterStatus)}>
            <option value="aktif">Penghuni Aktif</option>
            <option value="nonaktif">Nonaktif / Keluar</option>
            <option value="semua">Semua</option>
          </select>
          <select className="px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700" value={filterGedung} onChange={e => { setFilterGedung(e.target.value); setPage(1) }}>
            <option value="semua">Semua Gedung</option>
            {[...new Set(penghuni.map(p => p.namaGedung).filter(Boolean))].sort().map(gedung => <option key={gedung} value={gedung}>{gedung}</option>)}
          </select>
        </div>
        <button
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-white bg-emerald-700 hover:bg-emerald-800 transition-colors shadow-sm cursor-pointer"
          onClick={onAddClick}
          style={{ fontFamily: 'Plus Jakarta Sans' }}
        >
          <UserPlus className="w-4 h-4" />
          <span>Tambah Penghuni</span>
        </button>
        <label className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 cursor-pointer">
          <FileSpreadsheet className="w-4 h-4" /> Impor Excel / CSV
          <input type="file" accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel" className="hidden" onChange={e => importSpreadsheet(e.target.files?.[0])} />
        </label>
      </div>
      {importMessage && <p className="text-xs font-semibold text-emerald-700">{importMessage}</p>}

      <div className="bg-white rounded-2xl overflow-hidden border border-emerald-100/80 shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-emerald-50/60 border-b border-emerald-100">
                {['NIM', 'Nama Lengkap', 'Gedung', 'Kamar', 'Asal Daerah', 'Peran', 'Status', 'Aksi'].map(h => (
                  <th key={h} className="text-left px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-emerald-950" style={{ fontFamily: 'Plus Jakarta Sans' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map(p => (
                <tr key={p.nim} className="hover:bg-emerald-50/30 transition-colors">
                  <td className="px-5 py-3.5 mono text-xs font-semibold text-gray-600">{p.nim}</td>
                  <td className="px-5 py-3.5 font-bold text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>{p.nama}</td>
                  <td className="px-5 py-3.5 text-xs text-gray-600">{p.namaGedung || '-'}</td>
                  <td className="px-5 py-3.5 mono text-xs font-bold text-emerald-800">{p.nomorKamar || '-'}</td>
                  <td className="px-5 py-3.5 text-xs text-gray-600">{p.asal || '-'}</td>
                  <td className="px-5 py-3.5"><Badge status={p.role === 'fasil' ? 'Fasil' : 'Penghuni'} /></td>
                  <td className="px-5 py-3.5"><Badge status={p.statusAktif ? 'Aktif' : 'Non-aktif'} /></td>
                  <td className="px-5 py-3.5">
                    <button
                      onClick={() => onKelola(p)}
                      className="text-xs font-bold px-2.5 py-1 rounded-lg text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors cursor-pointer"
                      style={{ fontFamily: 'Plus Jakarta Sans' }}
                    >
                      Kelola
                    </button>
                    <button
                      onClick={() => onResetPassword(p.nim)}
                      className="ml-1 text-xs font-bold px-2.5 py-1 rounded-lg text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors cursor-pointer"
                    >Reset sandi</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 text-xs text-gray-500 border-t border-gray-100 font-medium bg-gray-50/50 flex flex-wrap gap-2 items-center justify-between">
          <span>Menampilkan {rows.length} dari {filtered.length} data</span>
          <div className="flex items-center gap-2">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-2 py-1 rounded border disabled:opacity-40">Sebelumnya</button>
            <span>Halaman {page} / {pageCount}</span>
            <button disabled={page === pageCount} onClick={() => setPage(p => p + 1)} className="px-2 py-1 rounded border disabled:opacity-40">Berikutnya</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Pilihan gedung & kamar dengan informasi kapasitas; kamar penuh tidak bisa dipilih
function KamarPicker({ gedungList, kamarList, penghuni, gedung, kamar, kamarSaatIni, onGedung, onKamar }: {
  gedungList: Gedung[]
  kamarList: Kamar[]
  penghuni: Penghuni[]
  gedung: string
  kamar: string
  kamarSaatIni?: string
  onGedung: (v: string) => void
  onKamar: (v: string) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className={labelCls} style={{ fontFamily: 'Plus Jakarta Sans' }}>Gedung Asrama</label>
        <select className={inputCls} value={gedung} onChange={e => { onGedung(e.target.value); onKamar('') }}>
          <option value="">Pilih Gedung</option>
          {gedungList.map(g => <option key={g.id} value={g.nama}>{g.nama}</option>)}
        </select>
      </div>
      <div>
        <label className={labelCls} style={{ fontFamily: 'Plus Jakarta Sans' }}>Nomor Kamar</label>
        <select className={inputCls} value={kamar} onChange={e => onKamar(e.target.value)}>
          <option value="">Pilih Kamar</option>
          {kamarList.filter(k => k.namaGedung === gedung).map(k => {
            const isi = hunianKamar(k, penghuni)
            const penuh = isi >= k.kapasitas && k.nomorKamar !== kamarSaatIni
            return (
              <option key={k.nomorKamar} value={k.nomorKamar} disabled={penuh}>
                {k.nomorKamar} · Lt. {k.lantai} · {isi}/{k.kapasitas}{penuh ? ' (penuh)' : ''}
              </option>
            )
          })}
        </select>
      </div>
    </div>
  )
}

function ModalShell({ title, subtitle, icon, onClose, children }: { title: string; subtitle: string; icon: React.ReactNode; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl border border-emerald-100">
        <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">{icon}</div>
            <div>
              <h3 className="font-extrabold text-base text-emerald-950" style={{ fontFamily: 'Plus Jakarta Sans' }}>{title}</h3>
              <p className="text-xs text-gray-400">{subtitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function ResetPasswordDialog({ target, onClose }: { target: Penghuni; onClose: () => void }) {
  const [password, setPassword] = useState('')
  const [adminNim, setAdminNim] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [rejection, setRejection] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!adminNim.trim() || !password) {
      setError('Username dan password admin wajib diisi.')
      return
    }
    setLoading(true)
    setError('')
    const result = await resetPasswordApi(target.nim, adminNim.trim(), password)
    setLoading(false)
    if (!result.ok) {
      setRejection(result.message)
      return
    }
    setDone(true)
  }

  return (
    <ConfirmDialog
      title={done ? 'Password Berhasil Direset' : 'Verifikasi Reset Password'}
      message={done ? `Password ${target.nama} telah direset ke password awal penghuni.` : `Verifikasi username dan password admin untuk mereset akun ${target.nama} (${target.nim}).`}
      confirmLabel={done ? 'Selesai' : 'Reset Password'}
      onCancel={onClose}
      onConfirm={done ? onClose : submit}
      loading={loading}
    >
      {!done && (
        <div>
          <label className={labelCls}>Username / NIM Admin</label>
          <input
            autoFocus
            type="text"
            value={adminNim}
            onChange={e => setAdminNim(e.target.value)}
            className={inputCls}
            placeholder="Masukkan username admin"
          />
          <label className={labelCls}>Password Admin</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submit() }}
              className={`${inputCls} pr-10`}
              placeholder="Masukkan password admin"
            />
            <button type="button" onClick={() => setShowPassword(value => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 cursor-pointer" aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}>
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {error && <p className="mt-2 text-xs font-semibold text-rose-700">{error}</p>}
          <p className="mt-2 text-[11px] text-gray-500">Password awal akun menjadi <strong>penghuni123</strong>.</p>
        </div>
      )}
      {rejection && (
        <ConfirmDialog
          title="Reset Sandi Ditolak"
          message={rejection}
          confirmLabel="Oke"
          onCancel={() => { setRejection(''); onClose() }}
          onConfirm={() => { setRejection(''); onClose() }}
        />
      )}
    </ConfirmDialog>
  )
}

function TambahPenghuniModal({ penghuni, gedungList, kamarList, onClose, onSave }: {
  penghuni: Penghuni[]
  gedungList: Gedung[]
  kamarList: Kamar[]
  onClose: () => void
  onSave: (p: Penghuni) => void
}) {
  const [form, setForm] = useState({ nim: '', nama: '', email: '', noHp: '', asal: '', namaGedung: '', nomorKamar: '' })
  const [error, setError] = useState('')

  const simpan = () => {
    const pesan = validasiDataDiri(form, penghuni) || (!form.nomorKamar ? 'Kamar wajib dipilih.' : '')
    if (pesan) {
      setError(pesan)
      return
    }
    onSave({ ...form, nim: form.nim.trim(), nama: form.nama.trim(), email: form.email.trim(), statusAktif: true, role: 'penghuni', tanggalMasuk: todayLocal() })
  }

  return (
    <ModalShell title="Tambah Penghuni Baru" subtitle="Daftarkan mahasiswa dan tempatkan ke kamar" icon={<UserPlus className="w-5 h-5" />} onClose={onClose}>
      <div className="space-y-3.5 max-h-[65vh] overflow-y-auto pr-1">
        <FormDataDiri value={form} onChange={d => setForm(prev => ({ ...prev, ...d }))} />
        <KamarPicker
          gedungList={gedungList} kamarList={kamarList} penghuni={penghuni}
          gedung={form.namaGedung} kamar={form.nomorKamar}
          onGedung={v => setForm(p => ({ ...p, namaGedung: v }))}
          onKamar={v => setForm(p => ({ ...p, nomorKamar: v }))}
        />
        <p className="text-[11px] text-gray-500">Password awal akun: <span className="mono font-semibold">penghuni123</span> (minta penghuni menggantinya).</p>
        {error && <p className="text-xs text-red-700 font-semibold">{error}</p>}
      </div>
      <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
        <button className="flex-1 py-2.5 rounded-xl font-bold text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer" onClick={onClose}>Batal</button>
        <button className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white bg-emerald-700 hover:bg-emerald-800 transition-colors shadow-sm cursor-pointer" onClick={simpan}>Simpan Penghuni</button>
      </div>
    </ModalShell>
  )
}

function KelolaPenghuniModal({ target, penghuni, gedungList, kamarList, onClose, onSave }: {
  target: Penghuni
  penghuni: Penghuni[]
  gedungList: Gedung[]
  kamarList: Kamar[]
  onClose: () => void
  onSave: (changes: UbahPenghuni) => Promise<ApiResult>
}) {
  const [dataDiri, setDataDiri] = useState<DataDiri>({ nim: target.nim, nama: target.nama, email: target.email, noHp: target.noHp, asal: target.asal })
  const [namaGedung, setNamaGedung] = useState(target.namaGedung)
  const [nomorKamar, setNomorKamar] = useState(target.nomorKamar)
  const [role, setRole] = useState(target.role)
  const [konfirmasiKeluar, setKonfirmasiKeluar] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const pjDari = gedungList.find(g => g.nimPj === target.nim)

  const kirim = async (changes: Pick<UbahPenghuni, 'nomorKamar' | 'role' | 'statusAktif'>) => {
    const pesan = validasiDataDiri(dataDiri, penghuni, target.nim)
    if (pesan) {
      setError(pesan)
      return
    }
    setSaving(true)
    setError('')
    const d = { nim: dataDiri.nim.trim(), nama: dataDiri.nama.trim(), email: dataDiri.email.trim(), noHp: dataDiri.noHp.trim(), asal: dataDiri.asal.trim() }
    const result = await onSave({ ...d, ...changes })
    // Modal ditutup oleh induk jika berhasil; tampilkan alasan jika ditolak server
    if (!result.ok && !result.offline) {
      setError(result.message)
      setSaving(false)
    }
  }

  const simpan = () => {
    if (!nomorKamar) {
      setError('Pilih kamar. Untuk mengeluarkan penghuni gunakan tombol "Keluarkan dari Asrama".')
      return
    }
    kirim({ nomorKamar, role, statusAktif: true })
  }

  return (
    <ModalShell title={`Kelola ${target.nama}`} subtitle={`${target.nim} · ${target.statusAktif ? `${target.namaGedung} / ${target.nomorKamar}` : 'Nonaktif / sudah keluar'}`} icon={<Users className="w-5 h-5" />} onClose={onClose}>
      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
        <div className="space-y-3.5">
          <p className="text-xs font-bold text-gray-700">Data Diri</p>
          <FormDataDiri value={dataDiri} onChange={setDataDiri} />
          {dataDiri.nim.trim() !== target.nim && (
            <p className="text-[11px] text-amber-700 font-semibold">
              NIM akan diubah dari {target.nim}. Riwayat presensi, izin, dan jabatan PJ ikut pindah ke NIM baru; penghuni login dengan NIM baru.
            </p>
          )}
        </div>

        <div className="pt-4 border-t border-gray-100">
          <p className="text-xs font-bold text-gray-700 mb-2">{target.statusAktif ? 'Pindah Kamar' : 'Aktifkan Kembali & Tempatkan ke Kamar'}</p>
          <KamarPicker
            gedungList={gedungList} kamarList={kamarList} penghuni={penghuni}
            gedung={namaGedung} kamar={nomorKamar} kamarSaatIni={target.statusAktif ? target.nomorKamar : undefined}
            onGedung={setNamaGedung} onKamar={v => { setNomorKamar(v); setError('') }}
          />
        </div>

        <div>
          <label className={labelCls} style={{ fontFamily: 'Plus Jakarta Sans' }}>Peran</label>
          <select className={inputCls} value={role} onChange={e => setRole(e.target.value as 'penghuni' | 'fasil')}>
            <option value="penghuni">Penghuni (wajib presensi)</option>
            <option value="fasil">Fasilitator (dapat ditetapkan sebagai PJ gedung)</option>
          </select>
          {pjDari && role === 'penghuni' && (
            <p className="text-[11px] text-amber-700 font-semibold mt-1">Penghuni ini adalah PJ {pjDari.nama}; jabatan PJ akan dilepas.</p>
          )}
        </div>

        {error && <p className="text-xs text-red-700 font-semibold">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button className="flex-1 py-2.5 rounded-xl font-bold text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer" onClick={onClose}>Batal</button>
          <button className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white bg-emerald-700 hover:bg-emerald-800 transition-colors cursor-pointer disabled:opacity-60" onClick={simpan} disabled={saving}>
            {saving ? 'Menyimpan...' : target.statusAktif ? 'Simpan Perubahan' : 'Aktifkan Kembali'}
          </button>
        </div>

        {target.statusAktif && (
          <div className="pt-4 border-t border-gray-100">
            {!konfirmasiKeluar ? (
              <button
                onClick={() => setKonfirmasiKeluar(true)}
                className="w-full py-2.5 rounded-xl font-bold text-sm text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Keluarkan dari Asrama</span>
              </button>
            ) : (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 space-y-2">
                <p className="text-xs text-rose-900 font-medium">
                  Akun akan dinonaktifkan dan kamar {target.nomorKamar} dikosongkan (misal: lulus / habis kontrak). Riwayat presensi tetap tersimpan.
                </p>
                <div className="flex gap-2">
                  <button className="flex-1 py-2 rounded-lg text-xs font-bold text-gray-700 bg-white border border-gray-200 cursor-pointer" onClick={() => setKonfirmasiKeluar(false)}>Batal</button>
                  <button className="flex-1 py-2 rounded-lg text-xs font-bold text-white bg-rose-700 hover:bg-rose-800 cursor-pointer" onClick={() => kirim({ nomorKamar: null, role: 'penghuni', statusAktif: false })} disabled={saving}>
                    Ya, Keluarkan
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </ModalShell>
  )
}

// ---------------------------------------------------------------------------
// Gedung & Kamar
// ---------------------------------------------------------------------------

type GedungLokasi = { latitude: number | null; longitude: number | null; radiusMeter: number }

function AdminGedung({ gedungList, kamarList, penghuni, onSaveLokasi, onSetPj }: {
  gedungList: Gedung[]
  kamarList: Kamar[]
  penghuni: Penghuni[]
  onSaveLokasi: (id: number, data: GedungLokasi) => Promise<ApiResult>
  onSetPj: (id: number, nimPj: string | null) => Promise<ApiResult>
}) {
  const fasilList = penghuni.filter(p => p.role === 'fasil' && p.statusAktif)

  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-2 gap-6">
        {gedungList.map(g => {
          const kamarGedung = kamarList.filter(k => k.idGedung === g.id)
          const kapasitas = kamarGedung.reduce((s, k) => s + k.kapasitas, 0)
          const terisi = kamarGedung.reduce((s, k) => s + hunianKamar(k, penghuni), 0)
          return (
            <div key={g.id} className="bg-white rounded-2xl p-6 border border-emerald-100/80 shadow-xs hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-base text-emerald-950" style={{ fontFamily: 'Plus Jakarta Sans' }}>{g.nama}</h4>
                    <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[11px] font-bold ${g.jenis === 'Putra' ? 'bg-emerald-50 text-emerald-800' : 'bg-purple-50 text-purple-800'}`}>
                      Asrama {g.jenis}
                    </span>
                  </div>
                </div>
                <span className="text-xs font-bold text-gray-600">Terisi {terisi}/{kapasitas}</span>
              </div>

              <div className="border-t border-b border-gray-100 py-3 text-sm">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">Fasil Penanggung Jawab</label>
                <select
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white outline-none focus:border-emerald-600"
                  value={g.nimPj || ''}
                  onChange={e => onSetPj(g.id, e.target.value || null)}
                >
                  <option value="">— Belum ditetapkan —</option>
                  {fasilList.map(f => {
                    const pjLain = gedungList.find(x => x.nimPj === f.nim && x.id !== g.id)
                    return <option key={f.nim} value={f.nim}>{f.nama} ({f.nim}){pjLain ? ` · saat ini PJ ${pjLain.nama}` : ''}</option>
                  })}
                </select>
                {!g.nimPj && <p className="text-[11px] text-amber-700 font-semibold mt-1">Tanpa PJ, izin penghuni gedung ini tidak dapat diproses.</p>}
              </div>

              <GedungLokasiForm gedung={g} onSave={onSaveLokasi} />

              <div className="mt-4">
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-900 mb-2.5" style={{ fontFamily: 'Plus Jakarta Sans' }}>Daftar Kamar</p>
                <div className="flex flex-wrap gap-2">
                  {kamarGedung.map(k => {
                    const isi = hunianKamar(k, penghuni)
                    const warna = isi >= k.kapasitas ? 'bg-rose-50 text-rose-800 border-rose-200' : isi === 0 ? 'bg-gray-50 text-gray-600 border-gray-200' : 'bg-emerald-50 text-emerald-800 border-emerald-100'
                    return (
                      <span key={k.nomorKamar} className={`mono text-xs font-semibold px-2.5 py-1 rounded-lg border ${warna}`} title={`Lantai ${k.lantai}`}>
                        {k.nomorKamar} · {isi}/{k.kapasitas}
                      </span>
                    )
                  })}
                </div>
                <p className="text-[11px] text-gray-400 mt-2">Merah = penuh, abu-abu = kosong.</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Form pengaturan titik koordinat (Latitude, Longitude) & Radius_meter gedung
function GedungLokasiForm({ gedung, onSave }: { gedung: Gedung; onSave: (id: number, data: GedungLokasi) => Promise<ApiResult> }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    latitude: gedung.latitude?.toString() ?? '',
    longitude: gedung.longitude?.toString() ?? '',
    radiusMeter: gedung.radiusMeter.toString(),
  })
  const [locating, setLocating] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const hasKoordinat = gedung.latitude !== null && gedung.longitude !== null

  const useMyLocation = async () => {
    setLocating(true)
    setMessage(null)
    try {
      const pos = await getCurrentPosition()
      setForm(f => ({ ...f, latitude: pos.latitude.toFixed(8), longitude: pos.longitude.toFixed(8) }))
      setMessage({ type: 'success', text: `Lokasi terbaca (akurasi ±${Math.round(pos.accuracy)} m).` })
    } catch (err) {
      setMessage({ type: 'error', text: (err as Error).message })
    }
    setLocating(false)
  }

  const handleSave = async () => {
    const lat = form.latitude.trim() === '' ? null : Number(form.latitude)
    const lng = form.longitude.trim() === '' ? null : Number(form.longitude)
    const radius = Number(form.radiusMeter)
    if ((lat === null) !== (lng === null)) {
      setMessage({ type: 'error', text: 'Latitude dan Longitude harus diisi keduanya.' })
      return
    }
    if (lat !== null && (Number.isNaN(lat) || lat < -90 || lat > 90)) {
      setMessage({ type: 'error', text: 'Latitude harus di antara -90 dan 90.' })
      return
    }
    if (lng !== null && (Number.isNaN(lng) || lng < -180 || lng > 180)) {
      setMessage({ type: 'error', text: 'Longitude harus di antara -180 dan 180.' })
      return
    }
    if (!Number.isInteger(radius) || radius < 1) {
      setMessage({ type: 'error', text: 'Radius harus bilangan bulat minimal 1 meter.' })
      return
    }
    const result = await onSave(gedung.id, { latitude: lat, longitude: lng, radiusMeter: radius })
    setMessage(result.ok || result.offline ? { type: 'success', text: 'Lokasi gedung berhasil disimpan.' } : { type: 'error', text: result.message })
    setEditing(false)
  }

  const fieldCls = 'w-full px-3 py-2 rounded-lg border border-gray-200 text-xs mono outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 transition-all'

  return (
    <div className="mt-4 p-3.5 rounded-xl bg-blue-50/40 border border-blue-100">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-bold uppercase tracking-wider text-blue-900 flex items-center gap-1.5" style={{ fontFamily: 'Plus Jakarta Sans' }}>
          <MapPin className="w-3.5 h-3.5" />
          Lokasi Geofence
        </p>
        {!editing && (
          <button onClick={() => { setEditing(true); setMessage(null) }} className="text-xs font-bold text-blue-800 hover:underline cursor-pointer">
            Atur Lokasi
          </button>
        )}
      </div>

      {!editing ? (
        <div className="space-y-1.5 text-sm">
          {hasKoordinat ? (
            <div className="flex justify-between items-center">
              <span className="text-gray-500 font-medium">Koordinat</span>
              <a href={`https://www.google.com/maps?q=${gedung.latitude},${gedung.longitude}`} target="_blank" rel="noreferrer" className="font-semibold mono text-xs text-blue-700 hover:underline">
                {Number(gedung.latitude).toFixed(6)}, {Number(gedung.longitude).toFixed(6)}
              </a>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-red-700">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Koordinat belum diatur, penghuni belum bisa presensi</span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-gray-500 font-medium">Radius Geofencing</span>
            <span className="font-bold text-blue-800">{gedung.radiusMeter} Meter</span>
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-gray-600 mb-1">Latitude</label>
              <input className={fieldCls} value={form.latitude} placeholder="-0.914488" onChange={e => setForm(f => ({ ...f, latitude: e.target.value }))} />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-600 mb-1">Longitude</label>
              <input className={fieldCls} value={form.longitude} placeholder="100.466542" onChange={e => setForm(f => ({ ...f, longitude: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-gray-600 mb-1">Radius (meter)</label>
            <input type="number" min={1} className={fieldCls} value={form.radiusMeter} onChange={e => setForm(f => ({ ...f, radiusMeter: e.target.value }))} />
          </div>
          <button
            type="button"
            onClick={useMyLocation}
            disabled={locating}
            className="w-full py-2 rounded-lg text-xs font-bold text-blue-800 bg-white border border-blue-200 hover:bg-blue-50 transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span>{locating ? 'Membaca lokasi...' : 'Gunakan Lokasi Saya Saat Ini'}</span>
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={() => { setEditing(false); setMessage(null) }} className="flex-1 py-2 rounded-lg text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer">
              Batal
            </button>
            <button type="button" onClick={handleSave} className="flex-1 py-2 rounded-lg text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 transition-colors flex items-center justify-center gap-1.5 cursor-pointer">
              <Save className="w-3.5 h-3.5" />
              <span>Simpan</span>
            </button>
          </div>
        </div>
      )}

      {message && (
        <p className={`text-[11px] font-semibold mt-2 ${message.type === 'error' ? 'text-red-700' : 'text-emerald-700'}`}>{message.text}</p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Presensi & Izin (rekap lintas gedung, hanya baca)
// ---------------------------------------------------------------------------

function AdminPresensiIzin({ penghuni, gedungList, sesiList, data, now }: {
  penghuni: Penghuni[]
  gedungList: Gedung[]
  sesiList: Sesi[]
  data: DataPresensi
  now: Date
}) {
  const today = todayLocal()
  const aktif = sesiAktif(sesiList)
  const [tanggal, setTanggal] = useState(today)
  const [sesi, setSesi] = useState(aktif[0]?.nama || '')
  const [gedung, setGedung] = useState('')
  const [filterIzin, setFilterIzin] = useState('Semua')

  const s = sesiList.find(x => x.nama === sesi)
  const rows: RekapRow[] = s
    ? penghuniWajibAbsen(penghuni, gedung || undefined).map(p => ({ penghuni: p, detail: statusSesi(p.nim, tanggal, s, data, now) }))
    : []
  const izinRows = data.izin
    .filter(i => !gedung || i.namaGedung === gedung)
    .filter(i => filterIzin === 'Semua' || i.statusPersetujuan === filterIzin)
    .sort((a, b) => b.tanggal.localeCompare(a.tanggal))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3 items-center">
        <DateInput max={today} className="px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700" value={tanggal} onChange={e => setTanggal(e.target.value)} />
        <SesiToggle sesiList={aktif} value={sesi} onChange={setSesi} />
        <select className="px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700" value={gedung} onChange={e => setGedung(e.target.value)}>
          <option value="">Seluruh Gedung</option>
          {gedungList.map(g => <option key={g.id} value={g.nama}>{g.nama}</option>)}
        </select>
      </div>

      <RekapStats rows={rows} />

      <div className="bg-white rounded-2xl overflow-hidden border border-emerald-100/80 shadow-xs">
        <div className="px-6 py-4 border-b border-emerald-100">
          <SectionTitle subtitle="Koreksi presensi dilakukan oleh fasil gedung masing-masing">Rekap Presensi — {tanggal} · Sesi {sesi}</SectionTitle>
        </div>
        <RekapTable rows={rows} showGedung />
      </div>

      <div className="bg-white rounded-2xl overflow-hidden border border-emerald-100/80 shadow-xs">
        <div className="px-6 py-4 border-b border-emerald-100 flex flex-wrap items-center justify-between gap-3">
          <SectionTitle subtitle="Seluruh pengajuan izin lintas gedung">Data Perizinan</SectionTitle>
          <div className="flex gap-2 flex-wrap">
            {['Semua', 'Pending', 'Disetujui', 'Ditolak'].map(f => (
              <button
                key={f}
                onClick={() => setFilterIzin(f)}
                className={`px-3 py-1 rounded-full text-xs font-bold cursor-pointer ${filterIzin === f ? 'bg-emerald-800 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-emerald-50/60 border-b border-emerald-100">
                {['Penghuni', 'Gedung', 'Berlaku', 'Alasan', 'Status', 'Diputuskan Oleh', 'Catatan'].map(h => (
                  <th key={h} className="text-left px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-emerald-950" style={{ fontFamily: 'Plus Jakarta Sans' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {izinRows.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-sm text-gray-400">Tidak ada data izin</td></tr>
              )}
              {izinRows.map(i => (
                <tr key={i.id} className="hover:bg-emerald-50/30">
                  <td className="px-5 py-3.5">
                    <p className="font-bold text-gray-900">{i.namaPenghuni}</p>
                    <p className="mono text-[11px] text-gray-500">{i.nim}</p>
                  </td>
                  <td className="px-5 py-3.5 text-xs text-gray-600">{i.namaGedung}</td>
                  <td className="px-5 py-3.5 text-xs text-gray-700 whitespace-nowrap">{formatRentangIzin(i.tanggal, i.tanggalSelesai, i.sesi)}</td>
                  <td className="px-5 py-3.5 text-xs text-gray-700 max-w-[240px]">{i.alasan}</td>
                  <td className="px-5 py-3.5"><Badge status={i.statusPersetujuan} /></td>
                  <td className="px-5 py-3.5 text-xs text-gray-600">{i.namaApprover ? `${i.namaApprover} · ${i.tanggalApproval}` : '–'}</td>
                  <td className="px-5 py-3.5 text-xs text-gray-500 max-w-[200px]">{i.catatanApprover || '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Pengaturan Sesi & Hari Libur
// ---------------------------------------------------------------------------

// Pengecualian aturan presensi untuk mencoba fitur absensi di luar jam sesi / jauh dari gedung
function ModeUjiCard({ modeUji, onSave }: { modeUji: ModeUji; onSave: (mode: ModeUji) => Promise<ApiResult> }) {
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const aktif = modeUji.abaikanJam || modeUji.abaikanRadius

  const ubah = async (changes: Partial<ModeUji>) => {
    setSaving(true)
    const result = await onSave({ ...modeUji, ...changes })
    setMsg(result.ok || result.offline ? { type: 'success', text: 'Tersimpan.' } : { type: 'error', text: result.message })
    setSaving(false)
  }

  return (
    <div className={`h-full rounded-2xl border p-5 shadow-2xs flex flex-col justify-between transition-colors ${aktif ? 'bg-amber-50/70 border-amber-300' : 'bg-white border-gray-200'}`}>
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${aktif ? 'bg-amber-200 text-amber-900' : 'bg-gray-100 text-gray-700'}`}>
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>Mode Uji (Bypass Aturan)</h4>
              <p className="text-[11px] text-gray-400">Pengecualian aturan untuk simulasi absensi</p>
            </div>
          </div>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider ${aktif ? 'bg-amber-200 text-amber-900 animate-pulse' : 'bg-gray-100 text-gray-500'}`}>
            {aktif ? 'AKTIF' : 'NONAKTIF'}
          </span>
        </div>

        <div className="space-y-2 mt-3">
          <label className={`p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-colors ${modeUji.abaikanJam ? 'border-amber-400 bg-white shadow-2xs' : 'border-gray-200 bg-gray-50/50 hover:bg-white'}`}>
            <div className="min-w-0">
              <span className="block text-xs font-bold text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>Abaikan Jam Sesi</span>
              <span className="block text-[11px] text-gray-500">Bisa absen kapan saja hari ini</span>
            </div>
            <input
              type="checkbox"
              className="w-4 h-4 rounded text-emerald-700 focus:ring-emerald-700 accent-emerald-700 cursor-pointer shrink-0"
              checked={modeUji.abaikanJam}
              disabled={saving}
              onChange={e => ubah({ abaikanJam: e.target.checked })}
            />
          </label>

          <label className={`p-3 rounded-xl border flex items-center justify-between gap-3 cursor-pointer transition-colors ${modeUji.abaikanRadius ? 'border-amber-400 bg-white shadow-2xs' : 'border-gray-200 bg-gray-50/50 hover:bg-white'}`}>
            <div className="min-w-0">
              <span className="block text-xs font-bold text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>Abaikan Radius GPS</span>
              <span className="block text-[11px] text-gray-500">Bisa absen di luar radius gedung</span>
            </div>
            <input
              type="checkbox"
              className="w-4 h-4 rounded text-emerald-700 focus:ring-emerald-700 accent-emerald-700 cursor-pointer shrink-0"
              checked={modeUji.abaikanRadius}
              disabled={saving}
              onChange={e => ubah({ abaikanRadius: e.target.checked })}
            />
          </label>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-[11px]">
        <p className="text-gray-400">Presensi uji ditandai label <span className="font-semibold text-gray-600">[Mode Uji]</span></p>
        {msg && <span className={`font-semibold ${msg.type === 'error' ? 'text-red-700' : 'text-emerald-700'}`}>{msg.text}</span>}
      </div>
    </div>
  )
}

// Aturan presensi: batas akurasi GPS, ambang peringatan Tidak Hadir untuk fasil, dan pengingat penghuni
function AturanPresensiCard({ aturan, onSave }: { aturan: AturanPresensi; onSave: (a: AturanPresensi) => Promise<ApiResult> }) {
  const [form, setForm] = useState<AturanPresensi>(aturan)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => setForm(aturan), [aturan])

  const simpan = async () => {
    setSaving(true)
    const result = await onSave(form)
    setMsg(result.ok || result.offline ? { type: 'success', text: 'Aturan disimpan.' } : { type: 'error', text: result.message })
    setSaving(false)
  }

  const fields: { key: keyof AturanPresensi; label: string; satuan: string; hint: string; min: number; max: number }[] = [
    { key: 'gpsAkurasiMaks', label: 'Batas Akurasi GPS', satuan: 'm', hint: '0 = tanpa batas', min: 0, max: 5000 },
    { key: 'batasTidakHadir', label: 'Ambang Alpa Fasil', satuan: 'sesi', hint: 'Per 30 hari', min: 1, max: 100 },
    { key: 'pengingatMenit', label: 'Pengingat Presensi', satuan: 'menit', hint: '0 = nonaktif', min: 0, max: 180 },
  ]

  return (
    <div className="h-full rounded-2xl p-5 border border-gray-200 bg-white shadow-2xs flex flex-col justify-between">
      <div>
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center shrink-0">
            <Settings className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>Parameter Presensi</h4>
            <p className="text-[11px] text-gray-400">Aturan toleransi GPS dan ambang notifikasi sistem</p>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-3 mt-3">
          {fields.map(f => (
            <div key={f.key} className="p-3 rounded-xl border border-gray-200 bg-gray-50/50">
              <span className="block text-xs font-bold text-gray-700 truncate" style={{ fontFamily: 'Plus Jakarta Sans' }}>{f.label}</span>
              <div className="flex items-center gap-1.5 mt-2">
                <input
                  type="number"
                  min={f.min}
                  max={f.max}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-gray-300 bg-white text-xs font-semibold text-gray-900 outline-none focus:border-emerald-700"
                  value={form[f.key]}
                  disabled={saving}
                  onChange={e => { setForm(prev => ({ ...prev, [f.key]: Number(e.target.value) })); setMsg(null) }}
                />
                <span className="text-[11px] font-semibold text-gray-500 shrink-0">{f.satuan}</span>
              </div>
              <span className="block text-[10px] text-gray-400 mt-1">{f.hint}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
        {msg ? (
          <p className={`text-xs font-semibold ${msg.type === 'error' ? 'text-red-700' : 'text-emerald-700'}`}>{msg.text}</p>
        ) : (
          <span className="text-[11px] text-gray-400">Berlaku untuk seluruh gedung</span>
        )}
        <button
          onClick={simpan}
          disabled={saving}
          className="px-4 py-1.5 rounded-lg font-bold text-xs text-white bg-[#0e4b29] hover:bg-[#0b3c20] transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
          style={{ fontFamily: 'Plus Jakarta Sans' }}
        >
          {saving ? 'Menyimpan...' : 'Simpan Aturan'}
        </button>
      </div>
    </div>
  )
}

function AdminPengaturan({ sesiList, libur, onSaveSesi, onAddLibur, onDeleteLibur }: {
  sesiList: Sesi[]
  libur: HariLibur[]
  onSaveSesi: (list: Sesi[]) => Promise<ApiResult>
  onAddLibur: (l: Omit<HariLibur, 'id'>) => Promise<ApiResult>
  onDeleteLibur: (id: number) => void
}) {
  const [draft, setDraft] = useState<Sesi[]>(sesiList)
  const [sesiMsg, setSesiMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [liburForm, setLiburForm] = useState({ tanggalMulai: '', tanggalSelesai: '', keterangan: '' })
  const [liburMsg, setLiburMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => setDraft(sesiList), [sesiList])

  const updateDraft = (id: number, changes: Partial<Sesi>) => setDraft(prev => prev.map(s => s.id === id ? { ...s, ...changes } : s))

  const simpanSesi = async () => {
    const nama = draft.map(s => s.nama.trim().toLowerCase())
    if (draft.some(s => !s.nama.trim() || !s.jamMulai || !s.jamSelesai)) {
      setSesiMsg({ type: 'error', text: 'Nama dan jam setiap sesi wajib diisi.' })
      return
    }
    if (new Set(nama).size !== nama.length) {
      setSesiMsg({ type: 'error', text: 'Nama sesi tidak boleh sama.' })
      return
    }
    if (draft.some(s => s.jamSelesai <= s.jamMulai)) {
      setSesiMsg({ type: 'error', text: 'Jam selesai harus setelah jam mulai.' })
      return
    }
    const aktif = sesiAktif(draft)
    if (aktif.some((s, i) => i > 0 && s.jamMulai <= aktif[i - 1].jamSelesai)) {
      setSesiMsg({ type: 'error', text: 'Jam sesi aktif tidak boleh saling tumpang tindih.' })
      return
    }
    const result = await onSaveSesi(draft.map(s => ({ ...s, nama: s.nama.trim() })))
    setSesiMsg(result.ok || result.offline ? { type: 'success', text: 'Jadwal sesi disimpan.' } : { type: 'error', text: result.message })
  }

  const tambahLibur = async () => {
    const selesai = liburForm.tanggalSelesai || liburForm.tanggalMulai
    if (!liburForm.tanggalMulai || !liburForm.keterangan.trim()) {
      setLiburMsg({ type: 'error', text: 'Tanggal mulai dan keterangan wajib diisi.' })
      return
    }
    if (selesai < liburForm.tanggalMulai) {
      setLiburMsg({ type: 'error', text: 'Tanggal selesai tidak boleh sebelum tanggal mulai.' })
      return
    }
    const result = await onAddLibur({ tanggalMulai: liburForm.tanggalMulai, tanggalSelesai: selesai, keterangan: liburForm.keterangan.trim() })
    setLiburMsg(result.ok || result.offline ? { type: 'success', text: 'Hari libur ditambahkan.' } : { type: 'error', text: result.message })
    setLiburForm({ tanggalMulai: '', tanggalSelesai: '', keterangan: '' })
  }

  const fieldCls = 'px-3 py-1.5 rounded-lg border border-gray-300 text-xs outline-none focus:border-emerald-700 bg-white'

  return (
    <div className="grid lg:grid-cols-2 gap-5 items-start">
      {/* Jadwal Sesi */}
      <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div>
            <h4 className="text-sm font-bold text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>Jadwal Sesi Presensi</h4>
            <p className="text-[11px] text-gray-400">Atur jam operasional presensi harian</p>
          </div>
          <span className="text-xs font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            {draft.filter(s => s.aktif).length} sesi aktif
          </span>
        </div>

        <div className="space-y-2.5">
          {draft.map(s => (
            <div key={s.id} className={`p-3 rounded-xl border transition-colors ${s.aktif ? 'border-emerald-200 bg-emerald-50/20' : 'border-gray-200 bg-gray-50/60 opacity-75'}`}>
              <div className="grid grid-cols-2 sm:grid-cols-[1fr_auto_auto] gap-2 items-center">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Nama Sesi</label>
                  <input className={`${fieldCls} w-full font-semibold text-gray-800`} value={s.nama} onChange={e => updateDraft(s.id, { nama: e.target.value })} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Mulai</label>
                  <TimeInput className={fieldCls} value={s.jamMulai} onChange={e => updateDraft(s.id, { jamMulai: e.target.value })} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Selesai</label>
                  <TimeInput className={fieldCls} value={s.jamSelesai} onChange={e => updateDraft(s.id, { jamSelesai: e.target.value })} />
                </div>
              </div>
              <div className="mt-2.5 pt-2 border-t border-gray-200/60 flex items-center justify-between">
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-3.5 h-3.5 rounded text-emerald-700 accent-emerald-700 cursor-pointer"
                    checked={s.aktif}
                    onChange={e => updateDraft(s.id, { aktif: e.target.checked })}
                  />
                  <span>Wajib Presensi</span>
                </label>
                <span className="text-[10px] font-medium text-gray-400">{s.aktif ? 'Aktif' : 'Nonaktif'}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 pt-2 border-t border-gray-100">
          <button
            onClick={() => setDraft(prev => [...prev, { id: Date.now(), nama: '', jamMulai: '', jamSelesai: '', aktif: true }])}
            className="flex-1 py-2 rounded-lg text-xs font-bold text-emerald-800 bg-white border border-emerald-200 hover:bg-emerald-50 flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
            style={{ fontFamily: 'Plus Jakarta Sans' }}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Sesi</span>
          </button>
          <button
            onClick={simpanSesi}
            className="flex-1 py-2 rounded-lg text-xs font-bold text-white bg-[#0e4b29] hover:bg-[#0b3c20] flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
            style={{ fontFamily: 'Plus Jakarta Sans' }}
          >
            <Save className="w-3.5 h-3.5" />
            <span>Simpan Jadwal</span>
          </button>
        </div>
        {sesiMsg && <p className={`text-xs font-semibold ${sesiMsg.type === 'error' ? 'text-red-700' : 'text-emerald-700'}`}>{sesiMsg.text}</p>}
      </div>

      {/* Hari Libur & Kalender */}
      <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div>
            <h4 className="text-sm font-bold text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>Hari Libur & Cuti</h4>
            <p className="text-[11px] text-gray-400">Periode bebas presensi (tidak dihitung alpa)</p>
          </div>
          <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
            {libur.length} periode
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Mulai</label>
              <DateInput className={`${fieldCls} w-full`} value={liburForm.tanggalMulai} onChange={e => setLiburForm(f => ({ ...f, tanggalMulai: e.target.value }))} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Selesai</label>
              <DateInput clearable min={liburForm.tanggalMulai} className={`${fieldCls} w-full`} value={liburForm.tanggalSelesai} onChange={e => setLiburForm(f => ({ ...f, tanggalSelesai: e.target.value }))} />
            </div>
          </div>
          <input className={`${fieldCls} w-full`} placeholder="Keterangan libur (cth: Libur Semester Ganjil)" value={liburForm.keterangan} onChange={e => setLiburForm(f => ({ ...f, keterangan: e.target.value }))} />
          <button
            onClick={tambahLibur}
            className="w-full py-2 rounded-lg text-xs font-bold text-white bg-[#0e4b29] hover:bg-[#0b3c20] flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
            style={{ fontFamily: 'Plus Jakarta Sans' }}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Hari Libur</span>
          </button>
          {liburMsg && <p className={`text-xs font-semibold ${liburMsg.type === 'error' ? 'text-red-700' : 'text-emerald-700'}`}>{liburMsg.text}</p>}
        </div>

        <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
          {libur.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-6 border border-dashed border-gray-200 rounded-xl">
              Belum ada hari libur yang tercatat
            </p>
          )}
          {libur.map(l => (
            <div key={l.id} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border border-sky-100 bg-sky-50/50 hover:bg-sky-50 transition-colors">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                  <Palmtree className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-gray-900 truncate" style={{ fontFamily: 'Plus Jakarta Sans' }}>{l.keterangan}</p>
                  <p className="text-[11px] text-gray-500 mono">{l.tanggalMulai === l.tanggalSelesai ? l.tanggalMulai : `${l.tanggalMulai} s/d ${l.tanggalSelesai}`}</p>
                </div>
              </div>
              <button onClick={() => onDeleteLibur(l.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer shrink-0" title="Hapus">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Laporan
// ---------------------------------------------------------------------------

type ExportFormat = 'csv' | 'xlsx' | 'doc' | 'pdf'

function downloadReport(filename: string, headers: string[], rows: unknown[][], format: ExportFormat, title: string) {
  const escapeCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`
  const content = [headers, ...rows].map(row => row.map(escapeCell).join(',')).join('\r\n')
  if (format === 'xlsx') {
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows])
    worksheet['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: headers.length - 1 } }) }
    worksheet['!cols'] = headers.map((header, index) => ({
      wch: Math.min(32, Math.max(header.length + 2, ...rows.slice(0, 100).map(row => String(row[index] ?? '').length + 2))),
    }))
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Laporan')
    XLSX.writeFile(workbook, filename)
    return
  }

  if (format === 'pdf') {
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    pdf.setFontSize(14)
    pdf.text(title, 14, 14)
    pdf.setFontSize(8)
    pdf.text(`Dicetak ${new Intl.DateTimeFormat('id-ID', { dateStyle: 'long' }).format(new Date())}`, 14, 20)
    autoTable(pdf, {
      head: [headers],
      body: rows.map(row => row.map(value => String(value ?? ''))),
      startY: 25,
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 2, overflow: 'linebreak' },
      headStyles: { fillColor: [6, 95, 70], textColor: 255 },
      alternateRowStyles: { fillColor: [240, 253, 244] },
      margin: { left: 10, right: 10 },
    })
    pdf.save(filename)
    return
  }

  if (format === 'doc') {
    const tableRows = [headers, ...rows].map((row, index) => `<tr>${row.map(value => index === 0 ? `<th>${String(value ?? '')}</th>` : `<td>${String(value ?? '')}</td>`).join('')}</tr>`).join('')
    const html = `<html><head><meta charset="utf-8"><style>body{font-family:Arial;color:#19352a}h1{font-size:18pt}p{font-size:9pt;color:#666}table{border-collapse:collapse;font-family:Arial;font-size:10pt;width:100%}th,td{border:1px solid #9bb5a5;padding:6px;text-align:left}th{background:#065f46;color:#fff}tr:nth-child(even){background:#f0fdf4}</style></head><body><h1>${title}</h1><p>Dicetak ${new Intl.DateTimeFormat('id-ID', { dateStyle: 'long' }).format(new Date())}</p><table>${tableRows}</table></body></html>`
    const blob = new Blob([html], { type: 'application/msword' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
    return
  }

  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function AdminLaporan({ penghuni, gedungList, sesiList, data, now }: {
  penghuni: Penghuni[]
  gedungList: Gedung[]
  sesiList: Sesi[]
  data: DataPresensi
  now: Date
}) {
  const today = todayLocal()
  const awalBulan = `${today.slice(0, 8)}01`
  const namaBulan = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(now)

  // Statistik bulan berjalan dihitung dari status turunan setiap penghuni wajib absen
  const statusPerGedung = gedungList.map(g => ({
    gedung: g,
    statuses: penghuniWajibAbsen(penghuni, g.nama).flatMap(p =>
      riwayatPenghuni(p.nim, p.tanggalMasuk > awalBulan ? p.tanggalMasuk : awalBulan, today, sesiList, data, now).map(r => r.detail.status)
    ),
  }))
  const perGedung = statusPerGedung.map(({ gedung, statuses }) => ({ gedung, c: hitungStatus(statuses) }))
  const total = hitungStatus(statusPerGedung.flatMap(x => x.statuses))
  const pctTidakHadir = total.wajib > 0 ? Math.round((total['Tidak Hadir'] / total.wajib) * 100) : 0
  const izinBulanIni = data.izin.filter(i => i.tanggal >= awalBulan).length
  const terbaik = perGedung.filter(x => x.c.wajib > 0).sort((a, b) => b.c.persen - a.c.persen)[0]

  const ekspor = (title: string, format: ExportFormat) => {
    let headers: string[] = []
    let rows: unknown[][] = []

    if (title === 'Presensi Harian' || title === 'Presensi Mingguan') {
      const mulai = title === 'Presensi Harian' ? today : addDays(today, -6)
      headers = ['Tanggal', 'Sesi', 'NIM', 'Nama', 'Gedung', 'Kamar', 'Status', 'Waktu', 'Keterangan']
      rows = data.presensi
        .filter(p => p.tanggal >= mulai && p.tanggal <= today)
        .sort((a, b) => `${a.tanggal}${a.sesi}`.localeCompare(`${b.tanggal}${b.sesi}`))
        .map(p => [p.tanggal, p.sesi, p.nim, p.namaPenghuni, p.namaGedung, p.nomorKamar, p.status, p.waktu, p.keterangan])
    } else if (title === 'Rekap Perizinan') {
      headers = ['NIM', 'Nama', 'Gedung', 'Kamar', 'Tanggal Mulai', 'Tanggal Selesai', 'Sesi', 'Alasan', 'Status', 'Catatan']
      rows = data.izin.map(i => [i.nim, i.namaPenghuni, i.namaGedung, i.nomorKamar, i.tanggal, i.tanggalSelesai, i.sesi || 'Semua sesi', i.alasan, i.statusPersetujuan, i.catatanApprover || ''])
    } else if (title === 'Daftar Penghuni') {
      headers = ['NIM', 'Nama', 'Email', 'No. HP', 'Asal', 'Peran', 'Status', 'Gedung', 'Kamar', 'Tanggal Masuk']
      rows = penghuni.map(p => [p.nim, p.nama, p.email, p.noHp, p.asal, p.role, p.statusAktif ? 'Aktif' : 'Nonaktif', p.namaGedung, p.nomorKamar, p.tanggalMasuk])
    } else if (title === 'Statistik Gedung') {
      headers = ['Gedung', 'Hadir', 'Tidak Hadir', 'Izin', 'Belum', 'Total Wajib', 'Persentase Hadir']
      rows = perGedung.map(x => [x.gedung.nama, x.c.Hadir, x.c['Tidak Hadir'], x.c.Izin, x.c.Belum, x.c.wajib, `${x.c.persen}%`])
    } else {
      headers = ['NIM', 'Nama', 'Hadir', 'Tidak Hadir', 'Izin', 'Belum', 'Total Wajib', 'Persentase Hadir']
      rows = penghuniWajibAbsen(penghuni).map(p => {
        const stats = hitungStatus(riwayatPenghuni(p.nim, p.tanggalMasuk > awalBulan ? p.tanggalMasuk : awalBulan, today, sesiList, data, now).map(r => r.detail.status))
        return [p.nim, p.nama, stats.Hadir, stats['Tidak Hadir'], stats.Izin, stats.Belum, stats.wajib, `${stats.persen}%`]
      })
    }

    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    downloadReport(`${slug}-${today}.${format}`, headers, rows, format, title)
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 border border-emerald-100/80 shadow-xs">
        <SectionTitle subtitle="Unduh rekapitulasi data kehadiran dalam format spreadsheet">Ekspor Dokumen & Laporan</SectionTitle>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { title: 'Presensi Harian', desc: 'Rekap kehadiran mahasiswa hari ini', icon: <FileSpreadsheet className="w-5 h-5 text-emerald-700" /> },
            { title: 'Presensi Mingguan', desc: 'Ringkasan kehadiran 7 hari terakhir', icon: <Calendar className="w-5 h-5 text-blue-700" /> },
            { title: 'Rekap Perizinan', desc: 'Data pengajuan izin & status persetujuan', icon: <FileBarChart className="w-5 h-5 text-amber-700" /> },
            { title: 'Daftar Penghuni', desc: 'Data lengkap penghuni seluruh gedung', icon: <Users className="w-5 h-5 text-purple-700" /> },
            { title: 'Statistik Gedung', desc: 'Analisis persentase per gedung', icon: <Building className="w-5 h-5 text-emerald-700" /> },
            { title: 'Laporan Bulanan', desc: 'Laporan komprehensif bulan berjalan', icon: <TrendingUp className="w-5 h-5 text-rose-700" /> },
          ].map(item => (
            <div key={item.title} className="p-4 rounded-xl border border-emerald-100 bg-emerald-50/30 hover:bg-emerald-50/70 transition-all flex flex-col justify-between group">
              <div>
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center border border-emerald-100 mb-3 shadow-2xs">{item.icon}</div>
                <h5 className="font-bold text-sm text-emerald-950 mb-1" style={{ fontFamily: 'Plus Jakarta Sans' }}>{item.title}</h5>
                <p className="text-xs text-gray-500 leading-relaxed font-medium">{item.desc}</p>
              </div>
              <div className="mt-4 grid grid-cols-4 gap-1.5">
                {([
                  ['csv', 'CSV'],
                  ['xlsx', 'Excel'],
                  ['doc', 'Word'],
                  ['pdf', 'PDF'],
                ] as const).map(([format, label]) => (
                  <button
                    key={format}
                    onClick={() => ekspor(item.title, format)}
                    className="py-2 px-1 rounded-lg text-[11px] font-bold text-emerald-800 bg-white border border-emerald-200 hover:bg-emerald-700 hover:text-white transition-all flex items-center justify-center gap-1 shadow-2xs cursor-pointer"
                    style={{ fontFamily: 'Plus Jakarta Sans' }}
                    title={`Unduh ${item.title} sebagai ${label}`}
                  >
                    {format === 'pdf' ? <Download className="w-3 h-3" /> : null}
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 border border-emerald-100/80 shadow-xs">
        <SectionTitle subtitle="Dihitung dari sesi wajib bulan berjalan (libur tidak dihitung)">Statistik Kehadiran {namaBulan}</SectionTitle>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={<CheckCircle2 className="w-6 h-6 text-emerald-700" />} label="Rata-rata Hadir" value={`${total.persen}%`} sub={`${total.Hadir} dari ${total.wajib} sesi`} color="#047857" />
          <StatCard icon={<XCircle className="w-6 h-6 text-rose-700" />} label="Ketidakhadiran" value={`${pctTidakHadir}%`} sub="Tanpa keterangan" color="#dc2626" />
          <StatCard icon={<AlertCircle className="w-6 h-6 text-amber-700" />} label="Pengajuan Izin" value={izinBulanIni} sub={namaBulan} color="#b45309" />
          <StatCard icon={<Building className="w-6 h-6 text-purple-700" />} label="Gedung Terbaik" value={terbaik ? terbaik.gedung.nama.replace('Asrama ', '') : '-'} sub={terbaik ? `Tingkat ${terbaik.c.persen}%` : 'Belum ada data'} color="#6b21a8" />
        </div>
        <div className="mt-5 space-y-3">
          {perGedung.map(({ gedung, c }) => (
            <div key={gedung.id}>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-bold text-gray-800">{gedung.nama}</span>
                <span className="text-xs text-gray-500">{c.persen}% · {c['Tidak Hadir']} alpa · {c.Izin} izin</span>
              </div>
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full bg-emerald-600" style={{ width: `${c.persen}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
