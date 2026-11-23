import { useState, useEffect, useMemo, type ReactNode } from 'react'
import type { CurrentUser, Penghuni, Gedung, Kamar, PresensiRecord, PresensiStatus, IzinRecord, Sesi, HariLibur, ModeUji, AturanPresensi, EventAsrama, RekapEventResult, GedungInput, KamarInput, EventInput, FotoEvent, Pengumuman } from '../types'
import AppLayout, { StatCard, SectionTitle, Badge, ConfirmDialog } from '../components/AppLayout'
import { BuktiIzin, KotakTanggalIzin, RekapTableBerhalaman, SesiToggle, UbinStatusRekap, type FilterStatusRekap, formatRentangIzin, type RekapRow } from '../components/PresensiWidgets'
import { BarisSaringIzin, KosongSaringIzin, useSaringIzin } from '../components/SaringIzin'
import { BilahKomposisi, DaftarMeter, GrafikTrenKehadiran, HistogramSebaran, PetaPanasPola, TARGET_KEHADIRAN, WARNA_STATUS_GRAFIK, hitungPolaMingguan } from '../components/GrafikKehadiran'
import logoUnand from '../assets/logo-unand.png'
import { PanelTrenKehadiran } from '../components/TrenKehadiran'
import HalamanLogAktivitas from '../components/LogAktivitas'
import { PilihPeriodeLaporan, labelPeriodeLaporan, rentangLaporan, type SaringPeriode } from '../components/SaringLaporan'
import {
  penghuniList as initialPenghuni,
  gedungList as initialGedung,
  kamarList as initialKamar,
  presensiList as initialPresensi,
  izinList as initialIzin,
  sesiList as initialSesi,
  liburList as initialLibur,
  eventList as initialEvent,
} from '../data/mockData'
import {
  fetchPenghuni, addPenghuniApi, updatePenghuniApi, fetchGedung, fetchKamar, updateGedungApi, setPjGedungApi,
  addGedungApi, updateGedungFullApi, deleteGedungApi, addKamarApi, updateKamarApi, deleteKamarApi,
  fetchEvent, addEventApi, updateEventApi, deleteEventApi, fetchRekapEvent,
  fetchPresensi, fetchIzin, fetchSesi, saveSesiApi, fetchLibur, addLiburApi, deleteLiburApi, updateLiburApi, type ApiResult, type UbahPenghuni,
  fetchModeUji, saveModeUjiApi, MODE_UJI_MATI, resetPasswordApi,
  fetchAturanPresensi, saveAturanPresensiApi, ATURAN_PRESENSI_DEFAULT, awalDemo, seedDatabaseApi, fetchFotoValidasiEvent, fetchPengumuman, addPengumumanApi, updatePengumumanApi, deletePengumumanApi } from '../api'
import MapPicker from '../components/MapPicker'
import { KelolaPengumuman } from '../components/Pengumuman'
import RekapSemester from '../components/RekapSemester'
import { EventFormModal, EventRekapModal } from '../components/EventModals'
import { GedungFormModal, KamarFormModal } from '../components/GedungKamarModals'
import { getCurrentPosition } from '../geo'
import DateInput from '../components/DateInput'
import TimeInput from '../components/TimeInput'
import { notifikasiAdmin } from '../notifikasiPeran'
import { JadwalMalamAdmin } from '../components/JadwalMalam'
import { useRealtime, bilaBerubah } from '../realtime'
import { KartuProfil } from '../components/ProfilAkun'
import KartuEvent, { UbinBuatEvent } from '../components/KartuEvent'
import { unduhLaporan, type ExportFormat, type LaporanFormal } from '../ekspor'
import * as XLSX from 'xlsx'
import {
  addDays, cariLibur, faseSesi, formatTanggal, hitungStatus, hunianKamar, penghuniWajibAbsen, namaSesiAktif, riwayatPenghuni, sesiAktif, sesiPadaTanggal, sesiUntuk, statusSesi, todayLocal, type DataPresensi,
  jamPresensi, keteranganStatus, maxDate, formatRentangTanggal, dateRangeDesc, kehadiranHariIni, kehadiranGabungan, HARI_RINGKASAN, periodeRekap } from '../logic'
import {
  LayoutDashboard,
  Users,
  Building2,
  ChevronDown,
  ChevronLeft,
  KeyRound,
  UserX,
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
  CalendarDays,
  Sparkles,
  Edit,
  ChevronRight,
  Megaphone,
} from 'lucide-react'

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-[18px] h-[18px]" /> },
  { id: 'penghuni', label: 'Data Penghuni', icon: <Users className="w-[18px] h-[18px]" /> },
  { id: 'gedung', label: 'Gedung & Kamar', icon: <Building2 className="w-[18px] h-[18px]" /> },
  { id: 'event', label: 'Event Asrama', icon: <CalendarDays className="w-[18px] h-[18px]" /> },
  { id: 'pengumuman', label: 'Pengumuman', icon: <Megaphone className="w-[18px] h-[18px]" /> },
  { id: 'presensi', label: 'Presensi & Izin', icon: <ClipboardList className="w-[18px] h-[18px]" /> },
  { id: 'pengaturan', label: 'Sesi & Hari Libur', icon: <Settings className="w-[18px] h-[18px]" /> },
  { id: 'laporan', label: 'Laporan Rekap', icon: <FileBarChart className="w-[18px] h-[18px]" /> },
  { id: 'log', label: 'Log Aktivitas', icon: <ShieldCheck className="w-[18px] h-[18px]" /> },
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
  const [presensi, setPresensi] = useState<PresensiRecord[]>(awalDemo(initialPresensi))
  const [izin, setIzin] = useState<IzinRecord[]>(initialIzin)
  const [sesiList, setSesiList] = useState<Sesi[]>(awalDemo(initialSesi))
  const [libur, setLibur] = useState<HariLibur[]>(awalDemo(initialLibur))
  const [eventList, setEventList] = useState<EventAsrama[]>(awalDemo(initialEvent))
  const [modeUji, setModeUji] = useState<ModeUji>(MODE_UJI_MATI)
  const [aturan, setAturan] = useState<AturanPresensi>(ATURAN_PRESENSI_DEFAULT)
  const [showAddModal, setShowAddModal] = useState(false)
  const [kelola, setKelola] = useState<Penghuni | null>(null)
  const [resetTarget, setResetTarget] = useState<Penghuni | null>(null)
  const [showDefaultNotice, setShowDefaultNotice] = useState(true)

  // Modals Modul 2
  const [gedungModal, setGedungModal] = useState<{ open: boolean; gedung: Gedung | null }>({ open: false, gedung: null })
  const [kamarModal, setKamarModal] = useState<{ open: boolean; kamar: Kamar | null; defaultGedungId?: number }>({ open: false, kamar: null })
  const [eventModal, setEventModal] = useState<{ open: boolean; event: EventAsrama | null }>({ open: false, event: null })
  const [rekapModal, setRekapModal] = useState<{ open: boolean; rekap: RekapEventResult | null }>({ open: false, rekap: null })
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; title: string; message: string; onConfirm: () => void }>({ open: false, title: '', message: '', onConfirm: () => {} })

  const now = new Date()

  useEffect(() => {
    fetchPenghuni().then(setPenghuni)
    fetchGedung().then(setGedungList)
    fetchKamar().then(setKamarList)
    fetchPresensi().then(setPresensi)
    fetchIzin().then(setIzin)
    fetchSesi().then(setSesiList)
    fetchLibur().then(setLibur)
    fetchEvent().then(setEventList)
    fetchModeUji().then(setModeUji)
    fetchAturanPresensi().then(setAturan)
  }, [])

  // Realtime: data seluruh asrama diperbarui berkala tanpa refresh halaman
  const [, setDetak] = useState(0)
  useRealtime(() => {
    setDetak(n => n + 1)
    fetchPenghuni().then(bilaBerubah(setPenghuni))
    fetchGedung().then(bilaBerubah(setGedungList))
    fetchKamar().then(bilaBerubah(setKamarList))
    fetchPresensi().then(bilaBerubah(setPresensi))
    fetchIzin().then(bilaBerubah(setIzin))
    fetchSesi().then(bilaBerubah(setSesiList))
    fetchLibur().then(bilaBerubah(setLibur))
    fetchEvent().then(bilaBerubah(setEventList))
    fetchModeUji().then(bilaBerubah(setModeUji))
    fetchFotoValidasiEvent().then(bilaBerubah(setFotoEvent))
    fetchPengumuman().then(bilaBerubah(setPengumuman))
  })
  const [pengumuman, setPengumuman] = useState<Pengumuman[]>([])
  useEffect(() => { fetchPengumuman().then(setPengumuman) }, [])
  // Foto absen event seluruh gedung (admin hanya melihat jumlahnya; validasi oleh fasil)
  const [fotoEvent, setFotoEvent] = useState<FotoEvent[]>([])
  useEffect(() => { fetchFotoValidasiEvent().then(setFotoEvent) }, [])

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
      fetchPenghuni().then(setPenghuni)
      fetchGedung().then(setGedungList)
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
    const res = await setPjGedungApi(id, nimPj)
    if (res.ok || res.offline) {
      fetchGedung().then(setGedungList)
      fetchPenghuni().then(setPenghuni)
    } else {
      alert(res.message || 'Gagal mengubah PJ gedung.')
      fetchGedung().then(setGedungList)
    }
    return res
  }

  // Sesi & libur: tunggu server dulu, lalu ambil ulang dari DB (id asli, nilai tersimpan).
  // Perubahan lokal tanpa server hanya di mode demo (result.offline).
  const handleSaveSesi = async (list: Sesi[]) => {
    const result = await saveSesiApi(list)
    if (result.ok) fetchSesi().then(setSesiList)
    else if (result.offline) setSesiList(prev => [...list, ...prev.filter(s => s.idGedung != null)])
    return result
  }

  const handleAddLibur = async (l: Omit<HariLibur, 'id'>) => {
    const result = await addLiburApi(l)
    if (result.ok) fetchLibur().then(setLibur)
    else if (result.offline) setLibur(prev => [...prev, { ...l, id: Date.now() }].sort((a, b) => b.tanggalMulai.localeCompare(a.tanggalMulai)))
    return result
  }

  const handleUpdateLibur = async (l: HariLibur) => {
    const result = await updateLiburApi(l)
    if (result.ok) fetchLibur().then(setLibur)
    else if (result.offline) setLibur(prev => prev.map(x => x.id === l.id ? l : x))
    return result
  }

  const handleDeleteLibur = async (id: number) => {
    const result = await deleteLiburApi(id)
    if (result.ok) fetchLibur().then(setLibur)
    else if (result.offline) setLibur(prev => prev.filter(l => l.id !== id))
    return result
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

  const [loadingSeed, setLoadingSeed] = useState(false)
  const handleSeed = async () => {
    if (!confirm('Apakah Anda ingin mengisi database framework dengan data contoh bawaan (gedung, kamar, penghuni, event)?')) return
    setLoadingSeed(true)
    const res = await seedDatabaseApi()
    setLoadingSeed(false)
    alert(res.message)
    fetchPenghuni().then(setPenghuni)
    fetchGedung().then(setGedungList)
    fetchKamar().then(setKamarList)
    fetchPresensi().then(setPresensi)
    fetchIzin().then(setIzin)
    fetchEvent().then(setEventList)
    fetchSesi().then(setSesiList)
    fetchLibur().then(setLibur)
  }

  // Modul 2 Handlers
  const handleSaveGedung = async (data: GedungInput & { id?: number }): Promise<ApiResult> => {
    const res = data.id ? await updateGedungFullApi(data.id, data) : await addGedungApi(data)
    if (res.ok || res.offline) {
      fetchGedung().then(setGedungList)
      fetchKamar().then(setKamarList)
      fetchPenghuni().then(setPenghuni)
    }
    return res
  }

  const handleDeleteGedung = (g: Gedung) => {
    const kamarCount = kamarList.filter(k => k.idGedung === g.id).length
    if (kamarCount > 0) {
      alert(`Gedung "${g.nama}" tidak dapat dihapus karena masih memiliki ${kamarCount} kamar terdaftar. Hapus atau pindahkan kamar terlebih dahulu.`)
      return
    }
    setConfirmDialog({
      open: true,
      title: 'Hapus Gedung',
      message: `Apakah Anda yakin ingin menghapus gedung "${g.nama}"?`,
      onConfirm: async () => {
        const res = await deleteGedungApi(g.id)
        if (res.ok || res.offline) {
          fetchGedung().then(setGedungList)
        } else {
          alert(res.message || 'Gagal menghapus gedung.')
        }
        setConfirmDialog(c => ({ ...c, open: false }))
      },
    })
  }

  const handleSaveKamar = async (data: KamarInput, isEdit: boolean): Promise<ApiResult> => {
    const res = isEdit ? await updateKamarApi(data) : await addKamarApi(data)
    if (res.ok || res.offline) {
      fetchKamar().then(setKamarList)
      fetchGedung().then(setGedungList)
    }
    return res
  }

  const handleDeleteKamar = (nomorKamar: string) => {
    const k = kamarList.find(x => x.nomorKamar === nomorKamar)
    const isi = k ? hunianKamar(k, penghuni) : 0
    if (isi > 0) {
      alert(`Kamar ${nomorKamar} masih ditempati oleh ${isi} penghuni aktif. Pindahkan penghuni terlebih dahulu sebelum menghapus kamar.`)
      return
    }
    setConfirmDialog({
      open: true,
      title: 'Hapus Kamar',
      message: `Apakah Anda yakin ingin menghapus kamar ${nomorKamar}?`,
      onConfirm: async () => {
        const res = await deleteKamarApi(nomorKamar)
        if (res.ok || res.offline) {
          fetchKamar().then(setKamarList)
          fetchGedung().then(setGedungList)
        } else {
          alert(res.message || 'Gagal menghapus kamar.')
        }
        setConfirmDialog(c => ({ ...c, open: false }))
      },
    })
  }

  const handleSaveEvent = async (data: EventInput): Promise<ApiResult> => {
    const res = eventModal.event ? await updateEventApi(eventModal.event.id, data) : await addEventApi(data)
    if (res.ok || res.offline) {
      fetchEvent().then(setEventList)
    }
    return res
  }

  const handleDeleteEvent = (ev: EventAsrama) => {
    setConfirmDialog({
      open: true,
      title: 'Hapus Event Asrama',
      message: `Apakah Anda yakin ingin menghapus event "${ev.judul}"? Catatan presensi peserta untuk event ini juga akan ikut terhapus.`,
      onConfirm: async () => {
        const res = await deleteEventApi(ev.id)
        if (res.ok || res.offline) {
          fetchEvent().then(setEventList)
        } else {
          alert(res.message || 'Gagal menghapus event.')
        }
        setConfirmDialog(c => ({ ...c, open: false }))
      },
    })
  }

  const muatPengumuman = () => fetchPengumuman().then(setPengumuman)
  const handleHapusPengumuman = (p: Pengumuman) => {
    setConfirmDialog({
      open: true,
      title: 'Hapus Pengumuman',
      message: `Hapus pengumuman "${p.judul}"? Penghuni tidak akan melihatnya lagi.`,
      onConfirm: async () => {
        const res = await deletePengumumanApi(p.id)
        if (res.ok || res.offline) muatPengumuman()
        else alert(res.message || 'Gagal menghapus pengumuman.')
        setConfirmDialog(c => ({ ...c, open: false }))
      },
    })
  }

  const handleViewRekap = async (ev: EventAsrama) => {
    const rekap = await fetchRekapEvent(ev.id)
    if (rekap) {
      setRekapModal({ open: true, rekap })
    } else {
      alert('Gagal memuat rekap event.')
    }
  }

  return (
    <AppLayout user={user} onLogout={onLogout} navItems={navItems} activeTab={activeTab} onTabChange={setActiveTab}
      notifikasi={notifikasiAdmin({ passwordDefault: defaultPasswordCount, modeUji, gedung: gedungList, sesi: sesiList, izin, presensi })}>
      {showDefaultNotice && defaultPasswordCount > 0 && <DefaultPasswordNotice count={defaultPasswordCount} onClose={() => setShowDefaultNotice(false)} />}
      {activeTab === 'dashboard' && (
        <AdminDashboard
          admin={user}
          penghuni={penghuni}
          gedungList={gedungList}
          kamarList={kamarList}
          sesiList={sesiList}
          data={data}
          now={now}
          modeUji={modeUji}
          fotoEventMenunggu={fotoEvent.filter(f => f.statusFoto === 'Menunggu').length}
          onNavigateTab={setActiveTab}
          onSeed={handleSeed}
          loadingSeed={loadingSeed}
        />
      )}
      {activeTab === 'penghuni' && (
        <AdminPenghuni penghuni={penghuni} gedungList={gedungList} kamarList={kamarList} onImported={() => { fetchPenghuni().then(setPenghuni); fetchKamar().then(setKamarList) }} onAddClick={() => setShowAddModal(true)} onKelola={setKelola} onResetPassword={nim => setResetTarget(penghuni.find(p => p.nim === nim) || null)} />
      )}
      {activeTab === 'gedung' && (
        <AdminGedung
          gedungList={gedungList}
          kamarList={kamarList}
          penghuni={penghuni}
          onSaveLokasi={handleSaveLokasi}
          onSetPj={handleSetPj}
          onTambahGedung={() => setGedungModal({ open: true, gedung: null })}
          onEditGedung={g => setGedungModal({ open: true, gedung: g })}
          onHapusGedung={handleDeleteGedung}
          onTambahKamar={defaultGedungId => setKamarModal({ open: true, kamar: null, defaultGedungId })}
          onEditKamar={k => setKamarModal({ open: true, kamar: k })}
          onHapusKamar={handleDeleteKamar}
          onSeed={handleSeed}
          loadingSeed={loadingSeed}
        />
      )}
      {activeTab === 'pengumuman' && (
        <KelolaPengumuman
          daftar={pengumuman}
          peran="admin"
          nimSaya={user.nim}
          gedungList={gedungList}
          onTambah={async d => { const r = await addPengumumanApi(d); if (r.ok) muatPengumuman(); return r }}
          onUbah={async (id, d) => { const r = await updatePengumumanApi(id, d); if (r.ok) muatPengumuman(); return r }}
          onHapus={handleHapusPengumuman}
        />
      )}
      {activeTab === 'event' && (
        <AdminEvent
          eventList={eventList}
          gedungList={gedungList}
          onTambahEvent={() => setEventModal({ open: true, event: null })}
          onEditEvent={ev => setEventModal({ open: true, event: ev })}
          onHapusEvent={handleDeleteEvent}
          onLihatRekap={handleViewRekap}
        />
      )}
      {activeTab === 'presensi' && <AdminPresensiIzin penghuni={penghuni} gedungList={gedungList} sesiList={sesiList} data={data} now={now} />}
      {activeTab === 'pengaturan' && (
        <div className="space-y-5">
          <AdminPengaturan sesiList={sesiList} gedungList={gedungList} libur={libur} onSaveSesi={handleSaveSesi} onAddLibur={handleAddLibur} onUpdateLibur={handleUpdateLibur} onDeleteLibur={handleDeleteLibur} />
          <ModeUjiCard modeUji={modeUji} onSave={handleSaveModeUji} />
        </div>
      )}
      {activeTab === 'log' && <HalamanLogAktivitas />}
      {activeTab === 'laporan' && <AdminLaporan admin={user} penghuni={penghuni} gedungList={gedungList} sesiList={sesiList} data={data} now={now} />}

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

      {/* Modals Modul 2 */}
      {gedungModal.open && (
        <GedungFormModal
          gedung={gedungModal.gedung}
          fasilList={penghuni.filter(p => p.role === 'fasil' && p.statusAktif)}
          onClose={() => setGedungModal({ open: false, gedung: null })}
          onSave={handleSaveGedung}
        />
      )}

      {kamarModal.open && (
        <KamarFormModal
          kamar={kamarModal.kamar}
          gedungList={gedungList}
          penghuni={penghuni}
          onTempatkan={(p, nomorKamar) => handleUpdatePenghuni(p.nim, {
            nim: p.nim, nama: p.nama, email: p.email, noHp: p.noHp, asal: p.asal, role: p.role,
            statusAktif: true, nomorKamar, jenisKelamin: p.jenisKelamin ?? undefined,
          })}
          defaultGedungId={kamarModal.defaultGedungId}
          onClose={() => setKamarModal({ open: false, kamar: null })}
          onSave={handleSaveKamar}
        />
      )}

      {eventModal.open && (
        <EventFormModal
          event={eventModal.event}
          gedungList={gedungList}
          role="admin"
          onClose={() => setEventModal({ open: false, event: null })}
          onSave={handleSaveEvent}
        />
      )}

      {rekapModal.open && rekapModal.rekap && (
        <EventRekapModal
          rekap={rekapModal.rekap}
          onClose={() => setRekapModal({ open: false, rekap: null })}
        />
      )}

      {confirmDialog.open && (
        <ConfirmDialog
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmLabel="Hapus"
          isDestructive
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(c => ({ ...c, open: false }))}
        />
      )}
    </AppLayout>
  )
}

function DefaultPasswordNotice({ count, onClose }: { count: number; onClose: () => void }) {
  return (
    <div className="fixed left-3 right-3 bottom-3 sm:left-auto sm:right-5 sm:bottom-5 z-40 sm:w-[min(360px,calc(100vw-2rem))] rounded-2xl border border-amber-200 bg-[#fff] p-3 sm:p-4 shadow-xl">
      <div className="flex items-center sm:items-start gap-3">
        <div className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 font-bold">!</div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold text-gray-900">Password default terdeteksi</p>
          {/* Di HP cukup satu baris agar tidak menutupi isi halaman */}
          <p className="sm:hidden text-[11px] text-gray-600 truncate">{count} akun penghuni masih memakai <strong>penghuni123</strong></p>
          <p className="hidden sm:block mt-1 text-xs leading-relaxed text-gray-600">{count} akun penghuni aktif masih menggunakan password default <strong>penghuni123</strong>. Minta penghuni segera menggantinya melalui menu Profil.</p>
        </div>
        <button type="button" onClick={onClose} className="-m-1 p-2 shrink-0 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 cursor-pointer self-start" aria-label="Tutup pemberitahuan"><X className="h-4 w-4" /></button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

function AdminDashboard({
  admin,
  penghuni,
  gedungList,
  kamarList,
  sesiList,
  data,
  now,
  modeUji,
  fotoEventMenunggu = 0,
  onNavigateTab,
  onSeed,
  loadingSeed,
}: {
  admin: CurrentUser
  penghuni: Penghuni[]
  gedungList: Gedung[]
  kamarList: Kamar[]
  sesiList: Sesi[]
  data: DataPresensi
  now: Date
  modeUji?: ModeUji
  fotoEventMenunggu?: number
  onNavigateTab?: (tab: string) => void
  onSeed?: () => void
  loadingSeed?: boolean
}) {
  const today = todayLocal()
  const [rentangGedung, setRentangGedung] = useState<'hari-ini' | '7-hari' | '30-hari'>('30-hari')
  const buka = (tab: string) => onNavigateTab?.(tab)

  const wajib = penghuniWajibAbsen(penghuni)
  const fasil = penghuni.filter(p => p.role === 'fasil' && p.statusAktif).length
  const kapasitas = kamarList.reduce((sum, k) => sum + k.kapasitas, 0)
  const terisi = kamarList.reduce((sum, k) => sum + hunianKamar(k, penghuni), 0)
  const persenHunian = kapasitas > 0 ? Math.round((terisi / kapasitas) * 100) : 0
  const tanpaPj = gedungList.filter(g => !g.nimPj)
  const tanpaKoordinat = gedungList.filter(g => g.latitude === null || g.longitude === null)
  // Sesi global + absen malam tiap gedung (jam malam berbeda per gedung)
  const sesiHariIni = sesiList.filter(s => s.aktif).flatMap(s => sesiPadaTanggal(s, today) ?? []).sort((a, b) => a.jamMulai.localeCompare(b.jamMulai))
  const liburHariIni = cariLibur(today, data.libur)

  // Status hari ini: setiap penghuni pada setiap sesi wajib gedungnya
  const statusHariIni = wajib.flatMap(p => sesiAktif(sesiList, p.namaGedung, today).map(s => ({ p, status: statusSesi(p.nim, today, s, data, now).status })))
  // Rumus sama dengan dashboard fasil: hadir / sesi wajib hari ini (libur tidak dihitung)
  const rekapHariIni = kehadiranHariIni(statusHariIni.map(x => x.status))
  const persenHariIni = rekapHariIni.persen
  const sesiBerjalan = sesiHariIni.filter(s => faseSesi(s, today, now) === 'dibuka')

  // Riwayat 7 hari tiap penghuni (sejak tanggal masuknya) untuk perbandingan gedung
  const awalTren = addDays(today, -6)
  const riwayat7 = wajib.map(p => ({
    p,
    riwayat: riwayatPenghuni(p.nim, p.tanggalMasuk ? maxDate(awalTren, p.tanggalMasuk) : awalTren, today, sesiList, data, now, p.namaGedung),
  }))
  // Rekap 30 hari tiap penghuni: periode & rumus sama dengan dashboard fasil dan penghuni
  const rekap30 = wajib.map(p => ({
    p,
    c: hitungStatus(riwayatPenghuni(p.nim, periodeRekap(today, p.tanggalMasuk, HARI_RINGKASAN), today, sesiList, data, now, p.namaGedung).map(r => r.detail.status)),
  }))
  const kehadiran30 = kehadiranGabungan(rekap30.map(x => x.c))
  const perbandinganGedung = gedungList.map(g => {
    const anggota = new Set(wajib.filter(p => p.namaGedung === g.nama).map(p => p.nim))
    if (rentangGedung === '30-hari') {
      const k = kehadiranGabungan(rekap30.filter(x => anggota.has(x.p.nim)).map(x => x.c))
      return { label: g.nama, sub: `${anggota.size} penghuni`, c: { ...hitungStatus([]), Hadir: k.hadir, wajib: k.wajib, persen: k.persen } }
    }
    const statuses = rentangGedung === 'hari-ini'
      ? statusHariIni.filter(x => anggota.has(x.p.nim)).map(x => x.status)
      : riwayat7.filter(x => anggota.has(x.p.nim)).flatMap(x => x.riwayat.map(r => r.detail.status))
    return { label: g.nama, sub: `${anggota.size} penghuni`, c: rentangGedung === 'hari-ini' ? kehadiranHariIni(statuses) : hitungStatus(statuses) }
  }).sort((a, b) => b.c.persen - a.c.persen)

  const izinMenunggu = data.izin.filter(i => i.statusPersetujuan === 'Pending')
  // Foto presensi harian + foto absen event (sama dengan hitungan di dashboard fasil)
  const fotoMenunggu = data.presensi.filter(r => r.statusFoto === 'Menunggu').length + fotoEventMenunggu
  const modeUjiAktif = !!(modeUji?.abaikanJam || modeUji?.abaikanRadius)
  const izinTerbaru = [...data.izin].sort((a, b) => b.id - a.id).slice(0, 5)

  const perhatian = [
    modeUjiAktif && { kunci: 'uji', ikon: <AlertCircle className="w-4 h-4 text-amber-700" />, judul: 'Mode uji presensi masih aktif', ket: [modeUji?.abaikanJam && 'jam sesi diabaikan', modeUji?.abaikanRadius && 'radius GPS diabaikan'].filter(Boolean).join(', '), tab: 'pengaturan' },
    sesiHariIni.length === 0 && !liburHariIni && { kunci: 'sesi', ikon: <Clock className="w-4 h-4 text-amber-700" />, judul: 'Tidak ada sesi presensi hari ini', ket: 'Periksa jadwal sesi aktif', tab: 'pengaturan' },
    tanpaPj.length > 0 && { kunci: 'pj', ikon: <UserCheck className="w-4 h-4 text-rose-600" />, judul: `${tanpaPj.length} gedung belum punya fasilitator`, ket: 'Izin & foto penghuninya tidak dapat diproses', tab: 'gedung' },
    tanpaKoordinat.length > 0 && { kunci: 'gps', ikon: <Building className="w-4 h-4 text-rose-600" />, judul: `${tanpaKoordinat.length} gedung belum diatur koordinatnya`, ket: 'Penghuninya belum dapat presensi mandiri', tab: 'gedung' },
    izinMenunggu.length > 0 && { kunci: 'izin', ikon: <FileBarChart className="w-4 h-4 text-amber-600" />, judul: `${izinMenunggu.length} izin menunggu fasilitator`, ket: 'Diputuskan oleh fasil gedung masing-masing', tab: 'presensi' },
    fotoMenunggu > 0 && { kunci: 'foto', ikon: <UserCheck className="w-4 h-4 text-amber-600" />, judul: `${fotoMenunggu} foto belum divalidasi`, ket: `Presensi harian & absen event · divalidasi fasil gedung masing-masing`, tab: 'presensi' },
  ].filter(Boolean) as { kunci: string; ikon: React.ReactNode; judul: string; ket: string; tab: string }[]


  const kartuCls = 'bg-white rounded-2xl border border-gray-200 shadow-2xs'
  const judulKartu = 'font-bold text-sm text-gray-900'
  const tautan = 'text-xs font-bold text-emerald-700 hover:underline cursor-pointer flex items-center gap-0.5 shrink-0'

  return (
    <div className="space-y-5">
      {/* Banner Seeder bila database kosong */}
      {(gedungList.length === 0 || penghuni.length === 0) && onSeed && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 shadow-2xs">
          <div className="text-[13px]">
            <p className="font-bold text-emerald-800">Database Anda saat ini masih kosong</p>
            <p className="text-emerald-700/90">Klik tombol di samping untuk langsung mengisi database dengan data contoh (gedung, kamar, penghuni, sesi, dan event asrama).</p>
          </div>
          <button
            type="button"
            onClick={onSeed}
            disabled={loadingSeed}
            className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 cursor-pointer shadow-xs transition"
          >
            {loadingSeed ? 'Mengisi database...' : 'Jalankan Seeder (Isi Data Contoh)'}
          </button>
        </div>
      )}

      {/* Header: identitas asrama & angka utama */}
      <div className="rounded-2xl bg-gradient-to-br from-[#0f3e2d] via-[#17603d] to-[#27a150] text-white p-5 sm:p-6 shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-2xl bg-white/95 p-1.5 shrink-0 shadow-sm flex items-center justify-center">
              <img src={logoUnand} alt="Logo Universitas Andalas" className="h-full w-auto object-contain" />
            </div>
            <div>
              <p className="text-xs font-semibold text-emerald-200">{formatTanggal(today)}</p>
              <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight mt-0.5" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                {admin.nama}
              </h2>
              <p className="text-sm text-emerald-100/90 mt-0.5">Pengelola Asrama Mahasiswa · Universitas Andalas</p>
              {liburHariIni && (
                <span className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-900">
                  Hari ini libur: {liburHariIni.keterangan}
                </span>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3 lg:w-[640px]">
            {[
              { label: 'Kehadiran', nilai: `${kehadiran30.persen}%`, ket: `${HARI_RINGKASAN} hari terakhir`, tab: 'laporan' },
              { label: 'Penghuni', nilai: wajib.length, ket: `${penghuni.filter(p => !p.statusAktif).length} nonaktif`, tab: 'penghuni' },
              { label: 'Gedung', nilai: gedungList.length, ket: `${gedungList.length - tanpaPj.length} ber-PJ`, tab: 'gedung' },
              { label: 'Fasilitator', nilai: fasil, ket: 'aktif', tab: 'penghuni' },
              { label: 'Hunian', nilai: `${persenHunian}%`, ket: `${terisi}/${kapasitas} tempat`, tab: 'gedung' },
            ].map(x => (
              <button key={x.label} type="button" onClick={() => buka(x.tab)} className={`text-left rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 px-3 py-2.5 cursor-pointer transition-colors ${x.label === 'Kehadiran' ? 'col-span-2 sm:col-span-1' : ''}`}>
                <p className="text-[11px] font-semibold text-emerald-200">{x.label}</p>
                <p className="text-xl font-extrabold leading-tight" style={{ fontFamily: 'Plus Jakarta Sans' }}>{x.nilai}</p>
                <p className="text-[10px] text-emerald-100/70">{x.ket}</p>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Presensi hari ini */}
        <div className={`${kartuCls} p-5 lg:col-span-2`}>
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <p className={judulKartu} style={{ fontFamily: 'Plus Jakarta Sans' }}>Presensi Hari Ini · Seluruh Asrama</p>
              <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5">
                {sesiBerjalan.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                {sesiBerjalan.length > 0
                  ? <span className="font-semibold text-emerald-700">{sesiBerjalan.length} sesi sedang dibuka</span>
                  : <span>{sesiHariIni.length > 0 ? 'Tidak ada sesi yang sedang dibuka' : 'Tidak ada sesi hari ini'}</span>}
              </p>
            </div>
            <button type="button" onClick={() => buka('presensi')} className={tautan}>Detail <ArrowRight className="w-3.5 h-3.5" /></button>
          </div>

          <div className="space-y-5">
            <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
              <span className="text-5xl font-extrabold text-gray-900 leading-none" style={{ fontFamily: 'Plus Jakarta Sans' }}>{rekapHariIni.total > 0 ? `${persenHariIni}%` : '–'}</span>
              <span className="text-sm text-gray-500 pb-1">
                {rekapHariIni.total > 0
                  ? <>hadir · <strong className="text-gray-800">{rekapHariIni.Hadir}</strong> dari {rekapHariIni.total} sesi wajib hari ini</>
                  : <>tidak ada sesi wajib hari ini{rekapHariIni.Libur > 0 ? ' (hari libur)' : ''}</>}
              </span>
            </div>

            <BilahKomposisi
              bagian={[
                { label: 'Hadir', nilai: rekapHariIni.Hadir, warna: WARNA_STATUS_GRAFIK.Hadir },
                { label: 'Izin & libur', nilai: rekapHariIni.Izin + rekapHariIni.Libur, warna: WARNA_STATUS_GRAFIK.Izin },
                { label: 'Tidak hadir', nilai: rekapHariIni['Tidak Hadir'], warna: WARNA_STATUS_GRAFIK['Tidak Hadir'] },
                { label: 'Belum presensi', nilai: rekapHariIni.Belum, warna: '#d1d5db', teksGelap: true },
              ]}
            />

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-semibold text-gray-700">Jadwal sesi hari ini</p>
                  <button type="button" onClick={() => buka('pengaturan')} className="px-2 -mx-2 text-[11px] font-bold text-emerald-700 hover:underline cursor-pointer">Atur</button>
                </div>
                {sesiHariIni.length === 0 ? (
                  <p className="text-xs text-gray-400">{liburHariIni ? 'Libur, tidak ada sesi wajib.' : 'Belum ada sesi aktif.'}</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {sesiHariIni.map(s => {
                      const fase = faseSesi(s, today, now)
                      return (
                        <span key={`${s.id}-${s.namaGedung ?? ''}`} className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-semibold border ${fase === 'dibuka' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : fase === 'ditutup' ? 'bg-gray-50 border-gray-200 text-gray-500' : 'bg-slate-50 border-slate-100 text-slate-800'}`}>
                          {fase === 'dibuka' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                          {s.nama}{s.namaGedung ? ` · ${s.namaGedung.replace('Asrama ', '')}` : ''}
                          <span className="mono font-normal opacity-75">{s.jamMulai}–{s.jamSelesai}</span>
                        </span>
                      )
                    })}
                  </div>
                )}
              </div>
          </div>
        </div>

        {/* Perlu perhatian */}
        <div className={`${kartuCls} p-5`}>
          <p className={`${judulKartu} mb-3`} style={{ fontFamily: 'Plus Jakarta Sans' }}>Perlu Perhatian</p>
          {perhatian.length === 0 ? (
            <div className="py-6 text-center">
              <CheckCircle2 className="w-9 h-9 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm font-semibold text-gray-800">Sistem siap operasional</p>
              <p className="text-xs text-gray-500 mt-0.5">Semua gedung ber-PJ dan berkoordinat.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {perhatian.map(t => (
                <button
                  key={t.kunci}
                  type="button"
                  onClick={() => buka(t.tab)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-left cursor-pointer transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center shrink-0">{t.ikon}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-gray-900">{t.judul}</p>
                    <p className="text-[11px] text-gray-500 truncate">{t.ket}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-5 gap-5">
        {/* Tren kehadiran: 7 hari / 12 minggu / 6 bulan, seluruh asrama atau per gedung */}
        <div className={`${kartuCls} p-5 lg:col-span-3`}>
          <PanelTrenKehadiran penghuni={wajib} sesiList={sesiList} data={data} now={now} gedungList={gedungList} />
        </div>

        {/* Perbandingan gedung */}
        <div className={`${kartuCls} p-5 lg:col-span-2`}>
          <div className="flex items-start justify-between gap-3 mb-1">
            <p className={judulKartu} style={{ fontFamily: 'Plus Jakarta Sans' }}>Kehadiran per Gedung</p>
            <div className="flex rounded-lg bg-gray-100 p-0.5 shrink-0" role="radiogroup" aria-label="Rentang perbandingan">
              {([['hari-ini', 'Hari ini'], ['7-hari', '7 hari'], ['30-hari', '30 hari']] as const).map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={rentangGedung === k}
                  onClick={() => setRentangGedung(k)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold cursor-pointer transition-colors ${rentangGedung === k ? 'bg-white text-emerald-800 shadow-2xs' : 'text-gray-600 hover:text-gray-900'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-gray-500 mb-4">Diurutkan dari kehadiran tertinggi</p>
          <DaftarMeter data={perbandinganGedung} kosong="Belum ada gedung" />
        </div>
      </div>

      {/* Izin terbaru */}
      <div className={`${kartuCls} p-5`}>
        <div className="flex items-center justify-between gap-3 mb-3">
          <p className={judulKartu} style={{ fontFamily: 'Plus Jakarta Sans' }}>Pengajuan Izin Terbaru</p>
          <button type="button" onClick={() => buka('presensi')} className={tautan}>Semua izin <ArrowRight className="w-3.5 h-3.5" /></button>
        </div>
        {izinTerbaru.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">Belum ada pengajuan izin.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {izinTerbaru.map(i => (
              <div key={i.id} className="py-2.5 flex items-center gap-3">
                <KotakTanggalIzin izin={i} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900 truncate">{i.namaPenghuni} <span className="text-xs font-normal text-gray-400">· {i.namaGedung}</span></p>
                  <p className="text-xs text-gray-500 truncate">{formatRentangTanggal(i.tanggal, i.tanggalSelesai)} · {i.alasan}</p>
                </div>
                <Badge status={i.statusPersetujuan} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Data Penghuni
// ---------------------------------------------------------------------------

// Template impor penghuni: kolom harus persis seperti ini
const KOLOM_TEMPLATE = ['NIM', 'Nama Lengkap', 'Jenis Kelamin (L/P)', 'Email', 'No HP', 'Asal Daerah', 'Nomor Kamar'] as const

function unduhTemplateImpor() {
  const data = XLSX.utils.aoa_to_sheet([[...KOLOM_TEMPLATE]])
  data['!cols'] = KOLOM_TEMPLATE.map(k => ({ wch: Math.max(14, k.length + 4) }))
  const petunjuk = XLSX.utils.aoa_to_sheet([
    ['Petunjuk pengisian template impor penghuni'],
    [],
    ['Kolom', 'Wajib', 'Keterangan'],
    ['NIM', 'Ya', 'Huruf/angka tanpa spasi, belum terdaftar'],
    ['Nama Lengkap', 'Ya', ''],
    ['Jenis Kelamin (L/P)', 'Ya', 'L = laki-laki, P = perempuan; harus sesuai jenis gedung kamar'],
    ['Email', 'Tidak', ''],
    ['No HP', 'Tidak', ''],
    ['Asal Daerah', 'Tidak', ''],
    ['Nomor Kamar', 'Ya', 'Harus sudah terdaftar di menu Gedung & Kamar dan masih ada tempat'],
    [],
    ['Isi data mulai baris 2 pada sheet "Data". Jangan mengubah judul kolom. Password awal: penghuni123'],
  ])
  petunjuk['!cols'] = [{ wch: 22 }, { wch: 8 }, { wch: 70 }]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, data, 'Data')
  XLSX.utils.book_append_sheet(wb, petunjuk, 'Petunjuk')
  XLSX.writeFile(wb, 'template-impor-penghuni.xlsx')
}

function AdminPenghuni({ penghuni, gedungList = [], kamarList = [], onImported, onAddClick, onKelola, onResetPassword }: {
  penghuni: Penghuni[]
  gedungList?: Gedung[]
  kamarList?: Kamar[]
  onImported?: () => void
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
    .filter(p => filterGedung === 'semua' || (filterGedung === '' ? !p.nomorKamar : p.namaGedung === filterGedung))
    .filter(p => p.nama.toLowerCase().includes(q) || p.nim.includes(search) || p.nomorKamar.toLowerCase().includes(q) || p.namaGedung.toLowerCase().includes(q) || p.asal.toLowerCase().includes(q))
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const rows = filtered.slice((page - 1) * pageSize, page * pageSize)

  const [mengimpor, setMengimpor] = useState(false)
  const importSpreadsheet = (file: File | undefined) => {
    if (!file) return
    setImportMessage('')
    const reader = new FileReader()
    reader.onload = async () => {
      let baris: unknown[][]
      try {
        const workbook = XLSX.read(reader.result, { type: 'array' })
        const sheet = workbook.Sheets['Data'] ?? workbook.Sheets[workbook.SheetNames[0]]
        baris = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })
      } catch {
        return setImportMessage('Berkas tidak dapat dibaca. Gunakan template .xlsx dari tombol "Template".')
      }
      const norm = (v: unknown) => String(v ?? '').trim().toLowerCase()
      const header = (baris[0] ?? []).map(norm)
      const hilang = KOLOM_TEMPLATE.filter(k => !header.includes(k.toLowerCase()))
      if (hilang.length > 0) {
        return setImportMessage(`Format tidak sesuai template. Kolom tidak ditemukan: ${hilang.join(', ')}. Unduh template lalu salin data ke sana.`)
      }
      const kol = (nama: string) => header.indexOf(nama.toLowerCase())
      const isi = baris.slice(1).filter(b => b.some(v => String(v ?? '').trim() !== ''))
      if (isi.length === 0) return setImportMessage('Template kosong: isi data mulai baris 2.')

      const terpakai = new Map(kamarList.map(k => [k.nomorKamar, hunianKamar(k, penghuni)]))
      const nimDipakai = new Set(penghuni.map(p => p.nim))
      const gagal: string[] = []
      const siap: Partial<Penghuni>[] = []
      isi.forEach((b, i) => {
        const nomorBaris = i + 2
        const ambil = (k: string) => String(b[kol(k)] ?? '').trim()
        const nim = ambil('NIM'), nama = ambil('Nama Lengkap'), kamar = ambil('Nomor Kamar').toUpperCase()
        const jkMentah = ambil('Jenis Kelamin (L/P)').toUpperCase()
        const jk = jkMentah.startsWith('L') ? 'L' : jkMentah.startsWith('P') ? 'P' : ''
        const k = kamarList.find(x => x.nomorKamar.toUpperCase() === kamar)
        const g = k ? gedungList.find(x => x.id === k.idGedung) : undefined
        const alasan = !nim || !nama ? 'NIM & nama wajib diisi'
          : !/^[A-Za-z0-9]+$/.test(nim) ? 'NIM hanya huruf/angka'
          : nimDipakai.has(nim) ? `NIM ${nim} sudah terdaftar`
          : !jk ? 'jenis kelamin harus L atau P'
          : !k ? `kamar "${kamar || '-'}" tidak ditemukan`
          : g && (jk === 'P') !== (g.jenis === 'Putri') ? `kamar ${k.nomorKamar} ada di asrama ${g.jenis.toLowerCase()}`
          : (terpakai.get(k.nomorKamar) ?? 0) >= k.kapasitas ? `kamar ${k.nomorKamar} penuh`
          : ''
        if (alasan) {
          gagal.push(`baris ${nomorBaris}: ${alasan}`)
          return
        }
        nimDipakai.add(nim)
        terpakai.set(k!.nomorKamar, (terpakai.get(k!.nomorKamar) ?? 0) + 1)
        siap.push({ nim, nama, jenisKelamin: jk as 'L' | 'P', email: ambil('Email'), noHp: ambil('No HP'), asal: ambil('Asal Daerah'), nomorKamar: k!.nomorKamar, statusAktif: true, role: 'penghuni' })
      })

      setMengimpor(true)
      let berhasil = 0
      for (const p of siap) {
        const r = await addPenghuniApi(p)
        if (r.ok || r.offline) berhasil++
        else gagal.push(`${p.nim}: ${r.message}`)
      }
      setMengimpor(false)
      onImported?.()
      setImportMessage(`${berhasil} dari ${isi.length} baris berhasil diimpor.${gagal.length ? ` Gagal: ${gagal.slice(0, 5).join('; ')}${gagal.length > 5 ? `; dan ${gagal.length - 5} lainnya` : ''}.` : ''}`)
    }
    reader.readAsArrayBuffer(file)
  }

  const jumlah = {
    aktif: penghuni.filter(p => p.statusAktif).length,
    nonaktif: penghuni.filter(p => !p.statusAktif).length,
    semua: penghuni.length,
  }
  const fasilAktif = penghuni.filter(p => p.statusAktif && p.role === 'fasil').length
  const ubin: { nilai: typeof filterStatus; label: string; ket: string; ikon: ReactNode; warna: string; aktifCls: string }[] = [
    { nilai: 'aktif', label: 'Aktif', ket: `${jumlah.aktif - fasilAktif} penghuni · ${fasilAktif} fasil`, ikon: <UserCheck className="w-4 h-4" />, warna: 'bg-emerald-50 text-emerald-700', aktifCls: 'border-emerald-500 ring-2 ring-emerald-500/20' },
    { nilai: 'nonaktif', label: 'Nonaktif / keluar', ket: 'Tidak lagi tinggal di asrama', ikon: <UserX className="w-4 h-4" />, warna: 'bg-gray-100 text-gray-600', aktifCls: 'border-gray-500 ring-2 ring-gray-500/15' },
    { nilai: 'semua', label: 'Semua', ket: 'Seluruh akun terdaftar', ikon: <Users className="w-4 h-4" />, warna: 'bg-slate-100 text-slate-700', aktifCls: 'border-slate-500 ring-2 ring-slate-500/15' },
  ]
  const inisialNama = (nama: string) => nama.split(' ').filter(Boolean).slice(0, 2).map(k => k[0]).join('').toUpperCase()
  const saringCls = 'px-3.5 py-2.5 rounded-xl border border-gray-200 bg-[#fff] text-sm font-medium text-gray-700 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/15'

  return (
    <div className="space-y-5">
      {/* Ubin status = ringkasan sekaligus penyaring */}
      <div className="grid grid-cols-3 gap-3" role="tablist" aria-label="Saring status penghuni">
        {ubin.map(u => {
          const aktif = filterStatus === u.nilai
          return (
            <button
              key={u.nilai}
              type="button"
              role="tab"
              aria-selected={aktif}
              onClick={() => { setFilterStatus(u.nilai); setPage(1) }}
              className={`text-left bg-[#fff] rounded-2xl border p-3 sm:p-4 shadow-2xs transition-all cursor-pointer hover:-translate-y-0.5 hover:shadow-md ${aktif ? u.aktifCls : 'border-gray-200/90'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-gray-600 sm:truncate">{u.label}</span>
                <span className={`hidden sm:flex w-8 h-8 shrink-0 rounded-lg items-center justify-center ${u.warna}`}>{u.ikon}</span>
              </div>
              <p className="mt-1 text-2xl font-extrabold text-gray-900 tabular-nums" style={{ fontFamily: 'Plus Jakarta Sans' }}>{jumlah[u.nilai]}</p>
              <p className="hidden sm:block text-[11px] text-gray-400 truncate">{u.ket}</p>
            </button>
          )
        })}
      </div>

      <div className="bg-white rounded-2xl overflow-hidden border border-gray-200/90 shadow-2xs">
        {/* Pencarian, filter & aksi */}
        <div className="px-5 py-4 border-b border-gray-100 flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              className={`${saringCls} w-full pl-10 placeholder:text-gray-400`}
              placeholder="Cari nama, NIM, kamar, gedung, atau asal..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select className={saringCls} value={filterGedung} onChange={e => { setFilterGedung(e.target.value); setPage(1) }} aria-label="Gedung">
              <option value="semua">Semua gedung</option>
              {gedungList.map(g => <option key={g.id} value={g.nama}>{g.nama}</option>)}
              <option value="">Belum ada kamar</option>
            </select>
            <button
              type="button"
              onClick={unduhTemplateImpor}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-gray-700 bg-[#fff] hover:bg-gray-50 border border-gray-200 cursor-pointer"
              title="Unduh template impor (.xlsx)"
            >
              <Download className="w-4 h-4" /> Template
            </button>
            <label className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-emerald-800 bg-[#fff] hover:bg-emerald-50 border border-emerald-200 ${mengimpor ? 'opacity-60 pointer-events-none' : 'cursor-pointer'}`} title="Impor dari template">
              <FileSpreadsheet className="w-4 h-4" /> {mengimpor ? 'Mengimpor…' : 'Impor'}
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => { importSpreadsheet(e.target.files?.[0]); e.target.value = '' }} />
            </label>
            <button
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-white bg-[#141a17] hover:bg-[#2a332e] transition-colors shadow-sm cursor-pointer"
              onClick={onAddClick}
              style={{ fontFamily: 'Plus Jakarta Sans' }}
            >
              <UserPlus className="w-4 h-4" />
              <span>Tambah Penghuni</span>
            </button>
          </div>
        </div>
        {importMessage && <p className={`px-5 pt-3 text-xs font-semibold ${/Gagal|tidak|Format|kosong/.test(importMessage) ? 'text-amber-700' : 'text-emerald-700'}`}>{importMessage}</p>}

        {/* HP: kartu per penghuni */}
        <ul className="md:hidden divide-y divide-gray-100">
          {rows.length === 0 && (
            <li className="px-4 py-10 text-center">
              <Users className="w-7 h-7 text-gray-300 mx-auto" />
              <p className="mt-2 text-sm font-semibold text-gray-600">Tidak ada data yang cocok</p>
              <p className="text-xs text-gray-400">Ubah kata kunci atau filter di atas.</p>
            </li>
          )}
          {rows.map(p => (
            <li key={p.nim} className={`px-4 py-3.5 ${p.statusAktif ? '' : 'opacity-70'}`}>
              <div className="flex items-start gap-3">
                <span className={`w-10 h-10 shrink-0 rounded-full flex items-center justify-center text-xs font-bold ${p.role === 'fasil' ? 'bg-slate-100 text-slate-700' : 'bg-emerald-100 text-emerald-800'}`}>{inisialNama(p.nama)}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-bold text-gray-900 truncate" style={{ fontFamily: 'Plus Jakarta Sans' }}>{p.nama}</p>
                    <Badge status={p.statusAktif ? 'Aktif' : 'Non-aktif'} />
                  </div>
                  <p className="text-[11px] text-gray-500"><span className="mono">{p.nim}</span>{p.jenisKelamin ? ` · ${p.jenisKelamin === 'P' ? 'Perempuan' : 'Laki-laki'}` : ''}</p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    <span className="px-1.5 py-0.5 rounded bg-gray-100 text-[10px] font-semibold text-gray-700">{p.nomorKamar ? `Kamar ${p.nomorKamar}` : 'Belum ada kamar'}</span>
                    {p.namaGedung && <span className="px-1.5 py-0.5 rounded bg-gray-100 text-[10px] font-semibold text-gray-700">{p.namaGedung}</span>}
                    {p.role === 'fasil' && <span className="px-1.5 py-0.5 rounded bg-slate-100 text-[10px] font-bold text-slate-700">Fasil{gedungList.some(g => g.nimPj === p.nim) ? ' · PJ' : ''}</span>}
                    {!p.jenisKelamin && <span className="px-1.5 py-0.5 rounded bg-amber-50 text-[10px] font-semibold text-amber-700">L/P belum diisi</span>}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2.5">
                <button onClick={() => onKelola(p)} className="inline-flex items-center justify-center gap-1.5 text-xs font-bold py-2 rounded-lg text-gray-800 bg-[#fff] border border-gray-200 hover:bg-gray-50 cursor-pointer">
                  <Edit className="w-3.5 h-3.5" />Kelola
                </button>
                <button onClick={() => onResetPassword(p.nim)} className="inline-flex items-center justify-center gap-1.5 text-xs font-bold py-2 rounded-lg text-amber-800 bg-[#fff] border border-amber-200 hover:bg-amber-50 cursor-pointer">
                  <KeyRound className="w-3.5 h-3.5" />Reset sandi
                </button>
              </div>
            </li>
          ))}
        </ul>
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/70">
                {['Penghuni', 'L/P', 'Kamar', 'Asal Daerah', 'Peran', 'Status', ''].map((h, i) => (
                  <th key={h || i} className={`px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-500 ${h ? 'text-left' : 'text-right'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center">
                    <Users className="w-7 h-7 text-gray-300 mx-auto" />
                    <p className="mt-2 text-sm font-semibold text-gray-600">Tidak ada data yang cocok</p>
                    <p className="text-xs text-gray-400">Ubah kata kunci atau filter di atas.</p>
                  </td>
                </tr>
              )}
              {rows.map(p => (
                <tr key={p.nim} className={`hover:bg-gray-50/80 transition-colors ${p.statusAktif ? '' : 'opacity-70'}`}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold ${p.role === 'fasil' ? 'bg-slate-100 text-slate-700' : 'bg-emerald-100 text-emerald-800'}`}>{inisialNama(p.nama)}</span>
                      <div className="min-w-0">
                        <p className="font-bold text-gray-900 truncate" style={{ fontFamily: 'Plus Jakarta Sans' }}>{p.nama}</p>
                        <p className="mono text-[11px] text-gray-500">{p.nim}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    {p.jenisKelamin
                      ? <span className={`inline-flex w-7 h-7 rounded-lg items-center justify-center text-xs font-bold ${p.jenisKelamin === 'P' ? 'bg-slate-100 text-slate-700' : 'bg-emerald-50 text-emerald-800'}`} title={p.jenisKelamin === 'P' ? 'Perempuan' : 'Laki-laki'}>{p.jenisKelamin}</span>
                      : <span className="text-[11px] font-semibold text-amber-700" title="Lengkapi lewat tombol Kelola">belum diisi</span>}
                  </td>
                  <td className="px-5 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <p className="mono text-xs font-bold text-emerald-800">{p.nomorKamar || '–'}</p>
                      {gedungList.some(g => g.nimPj === p.nim) && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">PJ</span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-500">{p.namaGedung || 'Belum ada kamar'}</p>
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-600">{p.asal || '–'}</td>
                  <td className="px-5 py-3"><Badge status={p.role === 'fasil' ? 'Fasil' : 'Penghuni'} /></td>
                  <td className="px-5 py-3"><Badge status={p.statusAktif ? 'Aktif' : 'Non-aktif'} /></td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => onKelola(p)}
                        className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg text-emerald-800 bg-[#fff] border border-emerald-200 hover:bg-emerald-50 transition-colors cursor-pointer"
                        style={{ fontFamily: 'Plus Jakarta Sans' }}
                      >
                        <Edit className="w-3.5 h-3.5" />Kelola
                      </button>
                      <button
                        onClick={() => onResetPassword(p.nim)}
                        title="Reset sandi"
                        className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg text-amber-800 bg-[#fff] border border-amber-200 hover:bg-amber-50 transition-colors cursor-pointer"
                      >
                        <KeyRound className="w-3.5 h-3.5" />Reset sandi
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 text-xs text-gray-500 border-t border-gray-100 flex flex-wrap gap-2 items-center justify-between">
          <span>Menampilkan {filtered.length === 0 ? 0 : (page - 1) * pageSize + 1}–{(page - 1) * pageSize + rows.length} dari {filtered.length} data</span>
          {pageCount > 1 && (
            <div className="flex items-center gap-1.5">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-semibold border border-gray-200 bg-[#fff] hover:bg-gray-50 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"><ChevronLeft className="w-3.5 h-3.5" />Sebelumnya</button>
              <span className="px-2 font-semibold text-gray-700">{page} / {pageCount}</span>
              <button disabled={page === pageCount} onClick={() => setPage(p => p + 1)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-semibold border border-gray-200 bg-[#fff] hover:bg-gray-50 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">Berikutnya<ChevronRight className="w-3.5 h-3.5" /></button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Pilihan gedung & kamar dengan informasi kapasitas; kamar penuh tidak bisa dipilih
// Pilihan jenis kelamin (L/P)
function PilihGender({ value, onChange }: { value: 'L' | 'P' | '' | null | undefined; onChange: (v: 'L' | 'P') => void }) {
  return (
    <div>
      <label className={labelCls} style={{ fontFamily: 'Plus Jakarta Sans' }}>Jenis Kelamin</label>
      <div className="grid grid-cols-2 gap-2">
        {([['L', 'Laki-laki'], ['P', 'Perempuan']] as const).map(([v, label]) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            aria-pressed={value === v}
            className={`py-2.5 rounded-xl border text-sm font-bold cursor-pointer transition-colors ${value === v ? 'bg-[#141a17] border-[#141a17] text-white' : 'bg-[#fff] border-gray-200 text-gray-700 hover:border-emerald-300'}`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

const gedungCocok = (g: Gedung, jk?: 'L' | 'P' | '' | null) => !jk || (jk === 'P') === (g.jenis === 'Putri')

function KamarPicker({ gedungList, kamarList, penghuni, gedung, kamar, kamarSaatIni, onGedung, onKamar, jenisKelamin }: {
  // Hanya gedung yang sesuai gender ditampilkan
  jenisKelamin?: 'L' | 'P' | '' | null
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
          <option value="">{jenisKelamin ? 'Pilih Gedung' : 'Pilih jenis kelamin dulu'}</option>
          {gedungList.filter(g => gedungCocok(g, jenisKelamin)).map(g => <option key={g.id} value={g.nama}>{g.nama}</option>)}
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
        <div className="modal-header flex items-center justify-between gap-3 -mx-6 -mt-6 px-6 py-4 border-b border-gray-100 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 shrink-0 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center">{icon}</div>
            <div>
              <h3 className="font-extrabold text-base text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>{title}</h3>
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
            <button type="button" onClick={() => setShowPassword(value => !value)} className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 rounded-lg text-gray-400 hover:text-gray-700 cursor-pointer" aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}>
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
  const [form, setForm] = useState({ nim: '', nama: '', email: '', noHp: '', asal: '', namaGedung: '', nomorKamar: '', jenisKelamin: '' as 'L' | 'P' | '' })
  const [error, setError] = useState('')

  const simpan = () => {
    const pesan = validasiDataDiri(form, penghuni) || (!form.jenisKelamin ? 'Jenis kelamin wajib dipilih.' : '') || (!form.nomorKamar ? 'Kamar wajib dipilih.' : '')
    if (pesan) {
      setError(pesan)
      return
    }
    onSave({ ...form, jenisKelamin: form.jenisKelamin || null, nim: form.nim.trim(), nama: form.nama.trim(), email: form.email.trim(), statusAktif: true, role: 'penghuni', tanggalMasuk: todayLocal() })
  }

  return (
    <ModalShell title="Tambah Penghuni Baru" subtitle="Daftarkan mahasiswa dan tempatkan ke kamar" icon={<UserPlus className="w-5 h-5" />} onClose={onClose}>
      <div className="space-y-3.5 max-h-[65vh] overflow-y-auto pr-1">
        <FormDataDiri value={form} onChange={d => setForm(prev => ({ ...prev, ...d }))} />
        <PilihGender value={form.jenisKelamin} onChange={v => setForm(p => ({ ...p, jenisKelamin: v, ...(gedungList.find(g => g.nama === p.namaGedung && !gedungCocok(g, v)) ? { namaGedung: '', nomorKamar: '' } : {}) }))} />
        <KamarPicker
          jenisKelamin={form.jenisKelamin}
          gedungList={gedungList} kamarList={kamarList} penghuni={penghuni}
          gedung={form.namaGedung} kamar={form.nomorKamar}
          onGedung={v => setForm(p => ({ ...p, namaGedung: v }))}
          onKamar={v => setForm(p => ({ ...p, nomorKamar: v }))}
        />
        <p className="text-[11px] text-gray-500">Password awal akun: <span className="mono font-semibold">penghuni123</span> (minta penghuni menggantinya).</p>
        {error && <p className="text-xs text-rose-700 font-semibold">{error}</p>}
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
  const [jk, setJk] = useState<'L' | 'P' | ''>(target.jenisKelamin ?? '')
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
    if (!jk) {
      setError('Jenis kelamin wajib dipilih.')
      setSaving(false)
      return
    }
    const result = await onSave({ ...d, ...changes, jenisKelamin: jk })
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
          <PilihGender value={jk} onChange={v => {
            setJk(v)
            if (gedungList.find(g => g.nama === namaGedung && !gedungCocok(g, v))) { setNamaGedung(''); setNomorKamar('') }
          }} />
          {!target.jenisKelamin && <p className="text-[11px] text-amber-700 font-semibold">Jenis kelamin akun ini belum diisi.</p>}
          {dataDiri.nim.trim() !== target.nim && (
            <p className="text-[11px] text-amber-700 font-semibold">
              NIM akan diubah dari {target.nim}. Riwayat presensi, izin, dan jabatan PJ ikut pindah ke NIM baru; penghuni login dengan NIM baru.
            </p>
          )}
        </div>

        <div className="pt-4 border-t border-gray-100">
          <p className="text-xs font-bold text-gray-700 mb-2">{target.statusAktif ? 'Pindah Kamar' : 'Aktifkan Kembali & Tempatkan ke Kamar'}</p>
          <KamarPicker
            jenisKelamin={jk}
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

        {error && <p className="text-xs text-rose-700 font-semibold">{error}</p>}

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

function AdminGedung({
  gedungList,
  kamarList,
  penghuni,
  onSaveLokasi,
  onSetPj,
  onTambahGedung,
  onEditGedung,
  onHapusGedung,
  onTambahKamar,
  onEditKamar,
  onHapusKamar,
  onSeed,
  loadingSeed,
}: {
  gedungList: Gedung[]
  kamarList: Kamar[]
  penghuni: Penghuni[]
  onSaveLokasi: (id: number, data: GedungLokasi) => Promise<ApiResult>
  onSetPj: (id: number, nimPj: string | null) => Promise<ApiResult>
  onTambahGedung: () => void
  onEditGedung: (gedung: Gedung) => void
  onHapusGedung: (gedung: Gedung) => void
  onTambahKamar: (defaultGedungId?: number) => void
  onEditKamar: (kamar: Kamar) => void
  onHapusKamar: (nomorKamar: string) => void
  onSeed?: () => void
  loadingSeed?: boolean
}) {
  const fasilList = penghuni.filter(p => p.role === 'fasil' && p.statusAktif)
  // Detail (PJ, geofence, daftar kamar) hanya dibuka bila perlu agar kartu tetap ringkas
  const [terbuka, setTerbuka] = useState<Set<number>>(new Set())
  const toggle = (id: number) => setTerbuka(prev => {
    const baru = new Set(prev)
    if (baru.has(id)) baru.delete(id)
    else baru.add(id)
    return baru
  })
  const semuaTerbuka = gedungList.length > 0 && gedungList.every(g => terbuka.has(g.id))

  return (
    <div className="space-y-5">
      {/* Header aksi */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4.5 rounded-2xl border border-emerald-100/90 shadow-xs">
        <div>
          <h3 className="text-base font-extrabold text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>Gedung & Kamar</h3>
          <p className="text-xs text-gray-500 mt-0.5">{gedungList.length} gedung · {kamarList.length} kamar</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setTerbuka(semuaTerbuka ? new Set() : new Set(gedungList.map(g => g.id)))}
            className="px-3.5 py-2 rounded-xl bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${semuaTerbuka ? 'rotate-180' : ''}`} />
            <span>{semuaTerbuka ? 'Tutup semua detail' : 'Buka semua detail'}</span>
          </button>
          <button
            type="button"
            onClick={() => onTambahKamar()}
            className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-700" />
            <span>Tambah Kamar</span>
          </button>
          <button
            type="button"
            onClick={onTambahGedung}
            className="px-3.5 py-2 rounded-xl bg-[#141a17] hover:bg-[#2a332e] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Gedung</span>
          </button>
        </div>
      </div>

      {gedungList.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center space-y-3">
          <Building2 className="w-12 h-12 text-gray-400 mx-auto" />
          <h4 className="text-base font-bold text-gray-800">Belum Ada Gedung</h4>
          <p className="text-xs text-gray-500 max-w-md mx-auto">
            Database gedung asrama masih kosong. Anda dapat menambahkan gedung baru secara manual atau menjalankan seeder untuk mengisi data contoh otomatis.
          </p>
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            <button
              type="button"
              onClick={onTambahGedung}
              className="px-4 py-2 rounded-xl bg-[#141a17] hover:bg-[#2a332e] text-white text-xs font-bold cursor-pointer transition shadow-xs flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Gedung Baru</span>
            </button>
            {onSeed && (
              <button
                type="button"
                onClick={onSeed}
                disabled={loadingSeed}
                className="px-4 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-bold cursor-pointer transition"
              >
                {loadingSeed ? 'Mengisi database...' : '⚡ Jalankan Seeder'}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-5 items-start">
        {gedungList.map(g => {
          const kamarGedung = kamarList.filter(k => k.idGedung === g.id)
          const kapasitas = kamarGedung.reduce((sum, k) => sum + k.kapasitas, 0)
          const terisi = kamarGedung.reduce((sum, k) => sum + hunianKamar(k, penghuni), 0)
          const persen = kapasitas > 0 ? Math.round((terisi / kapasitas) * 100) : 0
          const adaLokasi = g.latitude !== null && g.longitude !== null
          const buka = terbuka.has(g.id)
          return (
            <div key={g.id} className="bg-white rounded-2xl border border-emerald-100/80 shadow-xs hover:shadow-md transition-shadow overflow-hidden">
              {/* Ringkasan */}
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100 shrink-0">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-extrabold text-base text-gray-900 truncate" style={{ fontFamily: 'Plus Jakarta Sans' }}>{g.nama}</h4>
                      <p className="text-xs text-gray-500 truncate">
                        {g.namaPj ? <>PJ <span className="font-semibold text-gray-700">{g.namaPj}</span></> : <span className="font-semibold text-amber-700">Belum ada PJ</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${g.jenis === 'Putra' ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-50 text-slate-800'}`}>{g.jenis}</span>
                    <button type="button" onClick={() => onEditGedung(g)} title="Edit gedung" aria-label={`Edit ${g.nama}`}
                      className="p-1.5 rounded-lg text-gray-500 hover:text-emerald-700 hover:bg-emerald-50 cursor-pointer transition-colors">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => onHapusGedung(g)} title="Hapus gedung" aria-label={`Hapus ${g.nama}`}
                      className="p-1.5 rounded-lg text-gray-500 hover:text-rose-700 hover:bg-rose-50 cursor-pointer transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Angka utama */}
                <div className="mt-4 grid grid-cols-3 gap-2.5">
                  {[
                    { label: 'Kamar', nilai: kamarGedung.length },
                    { label: 'Penghuni', nilai: `${terisi}/${kapasitas}` },
                    { label: 'Radius', nilai: adaLokasi ? `${g.radiusMeter} m` : '—' },
                  ].map(st => (
                    <div key={st.label} className="px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-100">
                      <p className="text-[11px] text-gray-500">{st.label}</p>
                      <p className="text-base font-extrabold text-gray-900 tabular-nums" style={{ fontFamily: 'Plus Jakarta Sans' }}>{st.nilai}</p>
                    </div>
                  ))}
                </div>

                {/* Keterisian */}
                <div className="mt-3.5">
                  <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1">
                    <span>Keterisian</span>
                    <span className="font-bold text-gray-700 tabular-nums">{persen}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div className={`h-full rounded-full ${persen >= 100 ? 'bg-rose-500' : 'bg-emerald-600'}`} style={{ width: `${Math.min(100, persen)}%` }} />
                  </div>
                </div>

                {(!g.nimPj || !adaLokasi) && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {!g.nimPj && <span className="px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-[11px] font-semibold text-amber-800">Tetapkan PJ</span>}
                    {!adaLokasi && <span className="px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-[11px] font-semibold text-amber-800">Atur lokasi presensi</span>}
                  </div>
                )}
              </div>

              {/* Tombol detail */}
              <button
                type="button"
                onClick={() => toggle(g.id)}
                aria-expanded={buka}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 border-t border-gray-100 text-xs font-bold text-emerald-800 hover:bg-emerald-50/60 cursor-pointer transition-colors"
              >
                <span>{buka ? 'Sembunyikan detail' : 'Detail: PJ, lokasi & kamar'}</span>
                <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${buka ? 'rotate-180' : ''}`} />
              </button>

              {/* Detail */}
              {buka && (
                <div className="px-5 pb-5 pt-4 border-t border-gray-100 space-y-4 bg-gray-50/40">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1.5">Fasil penanggung jawab</label>
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

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-gray-700">Kamar ({kamarGedung.length})</p>
                      <button type="button" onClick={() => onTambahKamar(g.id)}
                        className="text-[11px] font-bold text-emerald-700 hover:underline flex items-center gap-1 cursor-pointer">
                        <Plus className="w-3 h-3" />
                        <span>Tambah</span>
                      </button>
                    </div>
                    {kamarGedung.length === 0 ? (
                      <p className="text-xs text-gray-400">Belum ada kamar.</p>
                    ) : (
                      <div className="rounded-xl border border-gray-200 bg-[#fff] divide-y divide-gray-100 overflow-hidden">
                        {kamarGedung.map(k => {
                          const isiKamar = penghuni.filter(p => p.statusAktif && p.nomorKamar === k.nomorKamar)
                          const isi = isiKamar.length
                          const titik = isi >= k.kapasitas ? 'bg-rose-400' : isi === 0 ? 'bg-gray-300' : 'bg-emerald-400'
                          return (
                            <div key={k.nomorKamar} className="flex items-start gap-3 px-3 py-2.5">
                              <div className="w-24 shrink-0">
                                <p className="flex items-center gap-1.5 mono text-xs font-bold text-gray-900"><span className={`w-2 h-2 rounded-full ${titik}`} />{k.nomorKamar}</p>
                                <p className="text-[11px] text-gray-500 mt-0.5">Lt {k.lantai} · {isi}/{k.kapasitas}</p>
                              </div>
                              <div className="flex-1 min-w-0 flex flex-wrap gap-1">
                                {isiKamar.length === 0
                                  ? <span className="text-[11px] text-gray-400 py-0.5">Kosong</span>
                                  : isiKamar.map(p => (
                                    <span key={p.nim} className="px-2 py-0.5 rounded-md bg-gray-50 border border-gray-100 text-[11px] font-medium text-gray-700" title={p.nim}>
                                      {p.nama}{p.role === 'fasil' ? ' · fasil' : ''}
                                    </span>
                                  ))}
                              </div>
                              <div className="flex items-center gap-0.5 shrink-0">
                                <button type="button" onClick={() => onEditKamar(k)} title="Edit kamar & penghuni" aria-label={`Edit kamar ${k.nomorKamar}`} className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-700 hover:bg-emerald-50 cursor-pointer">
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                <button type="button" onClick={() => onHapusKamar(k.nomorKamar)} title="Hapus kamar" aria-label={`Hapus kamar ${k.nomorKamar}`} className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                    <div className="mt-2 flex items-center gap-3 text-[11px] text-gray-400">
                      <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-400" />penuh</span>
                      <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" />terisi</span>
                      <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-300" />kosong</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Form pengaturan titik koordinat (Latitude, Longitude) & Radius_meter gedung dengan Leaflet MapPicker
function GedungLokasiForm({ gedung, onSave }: { gedung: Gedung; onSave: (id: number, data: GedungLokasi) => Promise<ApiResult> }) {
  const [editing, setEditing] = useState(false)
  const [lat, setLat] = useState<number | null>(gedung.latitude)
  const [lng, setLng] = useState<number | null>(gedung.longitude)
  const [radiusMeter, setRadiusMeter] = useState(gedung.radiusMeter)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const hasKoordinat = gedung.latitude !== null && gedung.longitude !== null

  const handleSave = async () => {
    if ((lat === null) !== (lng === null)) {
      setMessage({ type: 'error', text: 'Latitude dan Longitude harus diisi keduanya.' })
      return
    }
    if (lat !== null && (lat < -90 || lat > 90 || lng! < -180 || lng! > 180)) {
      setMessage({ type: 'error', text: 'Koordinat tidak valid.' })
      return
    }
    if (radiusMeter < 1) {
      setMessage({ type: 'error', text: 'Radius harus bilangan bulat minimal 1 meter.' })
      return
    }
    const result = await onSave(gedung.id, { latitude: lat, longitude: lng, radiusMeter })
    setMessage(result.ok || result.offline ? { type: 'success', text: 'Lokasi gedung berhasil disimpan.' } : { type: 'error', text: result.message })
    setEditing(false)
  }

  return (
    <div className="mt-4 p-3.5 rounded-xl bg-slate-50/40 border border-slate-100">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5" style={{ fontFamily: 'Plus Jakarta Sans' }}>
          <MapPin className="w-3.5 h-3.5 text-slate-700" />
          Lokasi Geofence Presensi
        </p>
        {!editing && (
          <button onClick={() => { setEditing(true); setMessage(null); setLat(gedung.latitude); setLng(gedung.longitude); setRadiusMeter(gedung.radiusMeter) }} className="text-xs font-bold text-slate-800 hover:underline cursor-pointer">
            Atur Lokasi di Peta
          </button>
        )}
      </div>

      {!editing ? (
        <div className="space-y-1.5 text-sm">
          {hasKoordinat ? (
            <div className="flex justify-between items-center">
              <span className="text-gray-500 font-medium">Koordinat</span>
              <a href={`https://www.google.com/maps?q=${gedung.latitude},${gedung.longitude}`} target="_blank" rel="noreferrer" className="font-semibold mono text-xs text-slate-700 hover:underline">
                {Number(gedung.latitude).toFixed(6)}, {Number(gedung.longitude).toFixed(6)}
              </a>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-700">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Koordinat belum diatur, penghuni belum bisa presensi</span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-gray-500 font-medium">Radius Geofencing</span>
            <span className="font-bold text-slate-800">{gedung.radiusMeter} Meter</span>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <MapPicker
            latitude={lat}
            longitude={lng}
            radiusMeter={radiusMeter}
            onChange={(newLat, newLng) => { setLat(newLat); setLng(newLng) }}
            onRadiusChange={setRadiusMeter}
            height="220px"
            title={`Atur Lokasi ${gedung.nama}`}
          />
          <div className="flex gap-2">
            <button type="button" onClick={() => { setEditing(false); setMessage(null) }} className="flex-1 py-2 rounded-lg text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer">
              Batal
            </button>
            <button type="button" onClick={handleSave} className="flex-1 py-2 rounded-lg text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 transition-colors flex items-center justify-center gap-1.5 cursor-pointer">
              <Save className="w-3.5 h-3.5" />
              <span>Simpan Lokasi</span>
            </button>
          </div>
        </div>
      )}

      {message && (
        <p className={`text-[11px] font-semibold mt-2 ${message.type === 'error' ? 'text-rose-700' : 'text-emerald-700'}`}>{message.text}</p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Event Asrama (Admin)
// ---------------------------------------------------------------------------

function AdminEvent({
  eventList,
  gedungList,
  onTambahEvent,
  onEditEvent,
  onHapusEvent,
  onLihatRekap,
}: {
  eventList: EventAsrama[]
  gedungList: Gedung[]
  onTambahEvent: () => void
  onEditEvent: (ev: EventAsrama) => void
  onHapusEvent: (ev: EventAsrama) => void
  onLihatRekap: (ev: EventAsrama) => void
}) {
  const [filterTipe, setFilterTipe] = useState<'semua' | 'seluruh' | 'gedung'>('semua')
  const [filterStatus, setFilterStatus] = useState<string>('semua')
  const [cari, setCari] = useState('')

  const today = todayLocal()
  const now = new Date()
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  const getStatusEvent = (ev: EventAsrama): 'Akan Datang' | 'Sedang Berlangsung' | 'Selesai' => {
    if (ev.tanggal > today) return 'Akan Datang'
    if (ev.tanggal < today) return 'Selesai'
    if (currentTime < ev.jamMulai) return 'Akan Datang'
    if (currentTime > ev.jamSelesai) return 'Selesai'
    return 'Sedang Berlangsung'
  }

  const filtered = eventList.filter(ev => {
    if (filterTipe !== 'semua' && ev.tipe !== filterTipe) return false
    const st = getStatusEvent(ev)
    if (filterStatus !== 'semua' && st !== filterStatus) return false
    if (cari.trim()) {
      const q = cari.toLowerCase()
      return (
        ev.judul.toLowerCase().includes(q) ||
        (ev.deskripsi || '').toLowerCase().includes(q) ||
        ev.lokasi.toLowerCase().includes(q) ||
        (ev.namaGedung || '').toLowerCase().includes(q)
      )
    }
    return true
  })

  const totalEvent = eventList.length
  const akanDatang = eventList.filter(e => getStatusEvent(e) === 'Akan Datang').length
  const berlangsung = eventList.filter(e => getStatusEvent(e) === 'Sedang Berlangsung').length
  const selesai = eventList.filter(e => getStatusEvent(e) === 'Selesai').length

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={<CalendarDays className="w-5 h-5 text-emerald-700" />}
          label="Total Event"
          value={totalEvent}
          sub="Seluruh asrama & gedung"
          color="#164f25"
        />
        <StatCard
          icon={<Clock className="w-5 h-5 text-slate-700" />}
          label="Akan Datang"
          value={akanDatang}
          sub="Jadwal mendatang"
          color="#1e40af"
        />
        <StatCard
          icon={<Sparkles className="w-5 h-5 text-amber-700" />}
          label="Sedang Berlangsung"
          value={berlangsung}
          sub="Presensi dibuka saat ini"
          color="#b45309"
        />
        <StatCard
          icon={<CheckCircle2 className="w-5 h-5 text-slate-700" />}
          label="Event Selesai"
          value={selesai}
          sub="Alpa dicatat otomatis"
          color="#475569"
        />
      </div>

      {/* Action & Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4.5 rounded-2xl border border-emerald-100/90 shadow-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari judul, lokasi, agenda..."
              value={cari}
              onChange={e => setCari(e.target.value)}
              className="pl-8 pr-3 py-2 rounded-xl border border-gray-200 text-xs outline-none focus:border-emerald-600 w-48 sm:w-64 bg-gray-50/50"
            />
          </div>
          <select
            value={filterTipe}
            onChange={e => setFilterTipe(e.target.value as any)}
            className="px-3 py-2 rounded-xl border border-gray-200 text-xs bg-white outline-none focus:border-emerald-600 font-medium"
          >
            <option value="semua">Semua Cakupan</option>
            <option value="seluruh">Seluruh Asrama</option>
            <option value="gedung">Per Gedung</option>
          </select>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 text-xs bg-white outline-none focus:border-emerald-600 font-medium"
          >
            <option value="semua">Semua Status</option>
            <option value="Akan Datang">Akan Datang</option>
            <option value="Sedang Berlangsung">Sedang Berlangsung</option>
            <option value="Selesai">Selesai</option>
          </select>
        </div>

        <button
          type="button"
          onClick={onTambahEvent}
          className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-emerald-700/20 cursor-pointer transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Buat Event Baru</span>
        </button>
      </div>

      {/* Event Cards Grid */}
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map(ev => {
            const st = getStatusEvent(ev)
            return (
              <KartuEvent
                key={ev.id}
                ev={ev}
                status={st}
                onEdit={() => onEditEvent(ev)}
                onHapus={() => onHapusEvent(ev)}
                penyelenggara={`Oleh: ${ev.namaPembuat || ev.createdBy || 'Admin'}`}
              >
                <div className="pt-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => onLihatRekap(ev)}
                    className="w-full py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Rekap Kehadiran</span>
                  </button>
                </div>
              </KartuEvent>
            )
          })}
          <UbinBuatEvent
            onClick={onTambahEvent}
            label="Buat event baru"
            keterangan={filtered.length === 0 ? (eventList.length === 0 ? 'Belum ada event. Buat event untuk seluruh asrama atau satu gedung.' : 'Tidak ada event yang cocok dengan filter.') : 'Untuk seluruh asrama atau satu gedung'}
          />
        </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Presensi & Izin (rekap lintas gedung, hanya baca)
// ---------------------------------------------------------------------------

// Jumlah baris izin yang ditampilkan per "halaman" (ditambah dengan tombol "Tampilkan lebih banyak")
const PER_HALAMAN_IZIN = 25

function AdminPresensiIzin({ penghuni, gedungList, sesiList, data, now }: {
  penghuni: Penghuni[]
  gedungList: Gedung[]
  sesiList: Sesi[]
  data: DataPresensi
  now: Date
}) {
  const today = todayLocal()
  // Nama sesi unik lintas gedung (absen Malam punya jam berbeda tiap gedung)
  const aktif = namaSesiAktif(sesiList)
  const [tanggal, setTanggal] = useState(today)
  const [sesi, setSesi] = useState(aktif[0]?.nama || '')
  const [gedung, setGedung] = useState('')
  const [cariRekap, setCariRekap] = useState('')
  const [statusRekap, setStatusRekap] = useState<FilterStatusRekap>('')
  // Data perizinan punya filter sendiri (termasuk gedung), terpisah dari filter rekap presensi di atas
  const saring = useSaringIzin(data.izin)
  const [batasTampil, setBatasTampil] = useState(PER_HALAMAN_IZIN)

  // Tiap penghuni dinilai dengan jadwal sesi gedungnya; gedung yang belum mengatur absen malam tidak ikut
  const rows: RekapRow[] = penghuniWajibAbsen(penghuni, gedung || undefined).flatMap(p => {
    const s = sesiUntuk(sesiList, sesi, p.namaGedung, tanggal)
    return s ? [{ penghuni: p, detail: statusSesi(p.nim, tanggal, s, data, now) }] : []
  })
  const kataRekap = cariRekap.trim().toLowerCase()
  const rowsDicari = kataRekap ? rows.filter(r => `${r.penghuni.nama} ${r.penghuni.nim} ${r.penghuni.nomorKamar ?? ''} ${r.penghuni.namaGedung ?? ''}`.toLowerCase().includes(kataRekap)) : rows
  const rowsTampil = statusRekap ? rowsDicari.filter(r => r.detail.status === statusRekap) : rowsDicari
  const izinRows = [...saring.hasil].sort((a, b) => b.tanggal.localeCompare(a.tanggal) || b.id - a.id)
  const izinTampil = izinRows.slice(0, batasTampil)

  return (
    <div className="space-y-6">
      {/* Filter rekap dalam satu kartu */}
      <div className="bg-white rounded-2xl border border-gray-200/90 shadow-2xs px-5 py-4 flex flex-col xl:flex-row xl:items-center gap-3">
        <div className="xl:mr-auto">
          <h3 className="text-base font-extrabold text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>Rekap Presensi</h3>
          <p className="text-xs text-gray-500">{formatTanggal(tanggal)} · Sesi {sesi || '–'}{gedung ? ` · ${gedung}` : ' · seluruh gedung'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DateInput max={today} className="px-3.5 py-2.5 rounded-xl border border-gray-200 bg-[#fff] text-sm font-medium text-gray-700" value={tanggal} onChange={e => setTanggal(e.target.value)} />
          <SesiToggle sesiList={aktif} value={sesi} onChange={setSesi} />
          <select className="px-3.5 py-2.5 rounded-xl border border-gray-200 bg-[#fff] text-sm font-medium text-gray-700" value={gedung} onChange={e => setGedung(e.target.value)} aria-label="Gedung">
            <option value="">Seluruh gedung</option>
            {gedungList.map(g => <option key={g.id} value={g.nama}>{g.nama}</option>)}
          </select>
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input type="search" value={cariRekap} onChange={e => setCariRekap(e.target.value)} placeholder="Cari nama, NIM, kamar, gedung..." aria-label="Cari penghuni"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 bg-[#fff] text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 transition-all placeholder:text-gray-400" />
          </div>
        </div>
      </div>

      <UbinStatusRekap rows={rowsDicari} value={statusRekap} onChange={setStatusRekap} />

      <div className="bg-white rounded-2xl overflow-hidden border border-gray-200/90 shadow-2xs">
        <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h3 className="text-base font-extrabold text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>Daftar Penghuni</h3>
          <p className="text-xs text-gray-500">{rowsTampil.length} dari {rows.length} penghuni wajib absen · koreksi dilakukan fasil gedung masing-masing</p>
        </div>
        <RekapTableBerhalaman rows={rowsTampil} showGedung kunciReset={`${tanggal}|${sesi}|${gedung}|${statusRekap}|${kataRekap}`}
          emptyText={kataRekap ? 'Tidak ada penghuni yang cocok dengan pencarian' : 'Tidak ada penghuni untuk filter yang dipilih'} />
      </div>

      <div className="bg-white rounded-2xl overflow-hidden border border-gray-200/90 shadow-2xs">
        <div className="px-5 py-4 border-b border-gray-100 space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h3 className="text-base font-extrabold text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>Data Perizinan</h3>
            <p className="text-xs text-gray-500">Seluruh gedung · keputusan izin dilakukan fasil gedung masing-masing</p>
          </div>
          <BarisSaringIzin saring={saring} gedungList={gedungList} />
        </div>
        {/* HP: kartu per izin */}
        <ul className="md:hidden divide-y divide-gray-100">
          {izinRows.length === 0 && <li><KosongSaringIzin saring={saring} teksKosong="Belum ada data izin" /></li>}
          {izinTampil.map(i => (
            <li key={i.id} className="px-4 py-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">{i.namaPenghuni}</p>
                  <p className="text-[11px] text-gray-500 truncate"><span className="mono">{i.nim}</span>{i.nomorKamar ? ` · Kamar ${i.nomorKamar}` : ''}{i.namaGedung ? ` · ${i.namaGedung}` : ''}</p>
                </div>
                <Badge status={i.statusPersetujuan} />
              </div>
              <p className="mt-1.5 text-xs font-semibold text-gray-800">{formatRentangIzin(i.tanggal, i.tanggalSelesai, i.sesi, i.hariBerulang)}</p>
              <p className="text-xs text-gray-600 mt-0.5 leading-snug">{i.alasan}</p>
              {i.fileBukti && <BuktiIzin fileBukti={i.fileBukti} className="mt-1.5 inline-flex items-center gap-1 py-1 text-[11px] font-semibold text-slate-700" />}
              {(i.namaApprover || i.catatanApprover || i.idIzinSebelumnya != null) && (
                <div className="mt-2 pt-2 border-t border-gray-100 text-[11px] text-gray-500 space-y-0.5">
                  {i.idIzinSebelumnya != null && <p className="font-semibold text-amber-700">Pengajuan ulang</p>}
                  {i.namaApprover && <p>Diputuskan {i.namaApprover} · {formatTanggal(i.tanggalApproval || '', 'tanpaHari')}</p>}
                  {i.catatanApprover && <p>Catatan: {i.catatanApprover}</p>}
                </div>
              )}
            </li>
          ))}
        </ul>
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50/70 border-b border-gray-100">
                {['Penghuni', 'Gedung', 'Berlaku', 'Alasan', 'Status', 'Diputuskan Oleh', 'Catatan'].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {izinRows.length === 0 && (
                <tr><td colSpan={7}><KosongSaringIzin saring={saring} teksKosong="Belum ada data izin" /></td></tr>
              )}
              {izinTampil.map(i => (
                <tr key={i.id} className="hover:bg-emerald-50/30">
                  <td className="px-5 py-3.5">
                    <p className="font-bold text-gray-900">{i.namaPenghuni}</p>
                    <p className="mono text-[11px] text-gray-500">{i.nim}{i.nomorKamar ? ` · Kamar ${i.nomorKamar}` : ''}</p>
                  </td>
                  <td className="px-5 py-3.5 text-xs text-gray-600">{i.namaGedung}</td>
                  <td className="px-5 py-3.5 text-xs text-gray-700 whitespace-nowrap">{formatRentangIzin(i.tanggal, i.tanggalSelesai, i.sesi, i.hariBerulang)}</td>
                  <td className="px-5 py-3.5 text-xs text-gray-700 max-w-[240px]">
                    {i.alasan}
                    {i.fileBukti && <BuktiIzin fileBukti={i.fileBukti} className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700" />}
                  </td>
                  <td className="px-5 py-3.5">
                    <Badge status={i.statusPersetujuan} />
                    {i.idIzinSebelumnya != null && <p className="text-[10px] font-semibold text-amber-700 mt-1 whitespace-nowrap">Pengajuan ulang</p>}
                  </td>
                  <td className="px-5 py-3.5 text-xs text-gray-600">{i.namaApprover ? `${i.namaApprover} · ${formatTanggal(i.tanggalApproval || '', 'tanpaHari')}` : '–'}</td>
                  <td className="px-5 py-3.5 text-xs text-gray-500 max-w-[200px]">{i.catatanApprover || '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {izinRows.length > PER_HALAMAN_IZIN && (
          <div className="px-6 py-3 border-t border-emerald-100 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
            <span>Menampilkan {izinTampil.length} dari {izinRows.length} izin</span>
            <div className="flex gap-2">
              {izinTampil.length < izinRows.length && (
                <button type="button" onClick={() => setBatasTampil(b => b + PER_HALAMAN_IZIN)} className="px-3 py-1.5 rounded-lg font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 cursor-pointer">
                  Tampilkan lebih banyak
                </button>
              )}
              {batasTampil > PER_HALAMAN_IZIN && (
                <button type="button" onClick={() => setBatasTampil(PER_HALAMAN_IZIN)} className="px-3 py-1.5 rounded-lg font-semibold text-gray-600 hover:bg-gray-100 cursor-pointer">
                  Ringkas
                </button>
              )}
            </div>
          </div>
        )}
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

  const opsi: { key: keyof ModeUji; judul: string; ket: string }[] = [
    { key: 'abaikanJam', judul: 'Abaikan jam sesi', ket: 'Penghuni bisa absen kapan saja hari ini' },
    { key: 'abaikanRadius', judul: 'Abaikan radius GPS', ket: 'Penghuni bisa absen di luar radius gedung' },
  ]

  return (
    <KartuProfil
      ikon={<ShieldAlert />}
      judul="Mode Uji"
      sub="Melonggarkan aturan untuk mencoba fitur absensi"
      className={aktif ? 'border-amber-300! ring-2 ring-amber-300/30' : ''}
      kanan={
        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${aktif ? 'bg-amber-100 text-amber-900' : 'bg-gray-100 text-gray-500'}`}>
          {aktif ? 'Aktif' : 'Nonaktif'}
        </span>
      }
    >
      <div className="p-5 flex-1 flex flex-col gap-3">
        <div className="grid md:grid-cols-2 gap-3">
        {opsi.map(o => {
          const nyala = modeUji[o.key]
          return (
            <label
              key={o.key}
              className={`flex items-center justify-between gap-4 p-3.5 rounded-xl border cursor-pointer transition-colors ${nyala ? 'border-amber-300 bg-amber-50/60' : 'border-gray-200 hover:bg-gray-50'}`}
            >
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-gray-900">{o.judul}</span>
                <span className="block text-xs text-gray-500">{o.ket}</span>
              </span>
              {/* Sakelar on/off (checkbox asli tetap ada untuk aksesibilitas) */}
              <input type="checkbox" className="peer sr-only" checked={nyala} disabled={saving} onChange={e => ubah({ [o.key]: e.target.checked })} />
              <span className="relative w-11 h-6 shrink-0 rounded-full bg-gray-200 transition-colors peer-checked:bg-amber-500 peer-focus-visible:ring-2 peer-focus-visible:ring-amber-400/50 after:absolute after:top-0.5 after:left-0.5 after:w-5 after:h-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5" />
            </label>
          )
        })}
        </div>
        <div className="mt-auto pt-4 border-t border-gray-100 flex items-center justify-between gap-3 text-xs">
          <p className="text-gray-400">Presensi uji ditandai label <span className="font-semibold text-gray-600">[Mode Uji]</span></p>
          {msg && <span className={`font-semibold ${msg.type === 'error' ? 'text-rose-700' : 'text-emerald-700'}`}>{msg.text}</span>}
        </div>
      </div>
    </KartuProfil>
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
    <KartuProfil ikon={<Settings />} judul="Parameter Presensi" sub="Toleransi GPS, ambang peringatan, dan pengingat">
      <div className="p-5 flex-1 flex flex-col gap-4">
        <div className="grid sm:grid-cols-3 gap-3">
          {fields.map(f => (
            <div key={f.key} className="p-3.5 rounded-xl border border-gray-200 bg-gray-50/60">
              <span className="block text-xs font-semibold text-gray-700 truncate">{f.label}</span>
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="number"
                  min={f.min}
                  max={f.max}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-[#fff] text-sm font-bold text-gray-900 tabular-nums outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/15"
                  value={form[f.key]}
                  disabled={saving}
                  onChange={e => { setForm(prev => ({ ...prev, [f.key]: Number(e.target.value) })); setMsg(null) }}
                />
                <span className="text-xs font-semibold text-gray-500 shrink-0">{f.satuan}</span>
              </div>
              <span className="block text-[11px] text-gray-400 mt-1.5">{f.hint}</span>
            </div>
          ))}
        </div>

        <div className="mt-auto pt-4 border-t border-gray-100 flex items-center justify-between gap-3">
          {msg ? (
            <p className={`text-xs font-semibold ${msg.type === 'error' ? 'text-rose-700' : 'text-emerald-700'}`}>{msg.text}</p>
          ) : (
            <span className="text-xs text-gray-400">Berlaku untuk seluruh gedung</span>
          )}
          <button
            onClick={simpan}
            disabled={saving}
            className="px-4 py-2 rounded-xl font-bold text-xs text-white bg-[#141a17] hover:bg-[#2a332e] transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
            style={{ fontFamily: 'Plus Jakarta Sans' }}
          >
            {saving ? 'Menyimpan...' : 'Simpan Aturan'}
          </button>
        </div>
      </div>
    </KartuProfil>
  )
}

function AdminPengaturan({ sesiList, gedungList, libur, onSaveSesi, onAddLibur, onUpdateLibur, onDeleteLibur }: {
  sesiList: Sesi[]
  gedungList: Gedung[]
  libur: HariLibur[]
  onSaveSesi: (list: Sesi[]) => Promise<ApiResult>
  onAddLibur: (l: Omit<HariLibur, 'id'>) => Promise<ApiResult>
  onUpdateLibur: (l: HariLibur) => Promise<ApiResult>
  onDeleteLibur: (id: number) => Promise<ApiResult>
}) {
  // Hari libur yang sedang diedit (form kiri berubah jadi mode edit)
  const [editLibur, setEditLibur] = useState<number | null>(null)
  // Admin hanya mengatur sesi global (mis. Subuh); absen malam diatur fasil per gedung
  const sesiGlobal = useMemo(() => sesiList.filter(s => s.idGedung == null), [sesiList])
  const [draft, setDraft] = useState<Sesi[]>(sesiGlobal)
  const [sesiMsg, setSesiMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [liburForm, setLiburForm] = useState({ tanggalMulai: '', tanggalSelesai: '', keterangan: '' })
  const [liburMsg, setLiburMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => setDraft(sesiGlobal), [sesiGlobal])

  const updateDraft = (id: number, changes: Partial<Sesi>) => setDraft(prev => prev.map(s => s.id === id ? { ...s, ...changes } : s))

  const simpanSesi = async () => {
    const nama = draft.map(s => s.nama.trim().toLowerCase())
    if (draft.some(s => !s.nama.trim() || !s.jamMulai || !s.jamSelesai)) {
      setSesiMsg({ type: 'error', text: 'Nama dan jam setiap sesi wajib diisi.' })
      return
    }
    if (nama.includes('malam')) {
      setSesiMsg({ type: 'error', text: 'Absen malam diatur oleh fasil masing-masing gedung, bukan oleh admin.' })
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

  const mulaiEditLibur = (l: HariLibur) => {
    setEditLibur(l.id)
    setLiburForm({ tanggalMulai: l.tanggalMulai, tanggalSelesai: l.tanggalSelesai === l.tanggalMulai ? '' : l.tanggalSelesai, keterangan: l.keterangan })
    setLiburMsg(null)
  }
  const batalEditLibur = () => {
    setEditLibur(null)
    setLiburForm({ tanggalMulai: '', tanggalSelesai: '', keterangan: '' })
    setLiburMsg(null)
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
    const isi = { tanggalMulai: liburForm.tanggalMulai, tanggalSelesai: selesai, keterangan: liburForm.keterangan.trim() }
    const result = editLibur !== null ? await onUpdateLibur({ id: editLibur, ...isi }) : await onAddLibur(isi)
    const berhasil = result.ok || result.offline
    setLiburMsg(berhasil ? { type: 'success', text: editLibur !== null ? 'Hari libur diperbarui.' : 'Hari libur ditambahkan.' } : { type: 'error', text: result.message })
    // Form hanya dikosongkan bila tersimpan, agar isian tidak hilang saat gagal
    if (berhasil) {
      setLiburForm({ tanggalMulai: '', tanggalSelesai: '', keterangan: '' })
      setEditLibur(null)
    }
  }

  const fieldCls = 'px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/15 bg-[#fff]'
  const labelCls = 'block text-xs font-semibold text-gray-600 mb-1'

  return (
    <div className="space-y-5">
      <div className="grid lg:grid-cols-2 gap-5 items-stretch">
        {/* Jadwal sesi global */}
        <KartuProfil
          ikon={<Clock />}
          judul="Jadwal Sesi Presensi"
          sub="Berlaku untuk semua gedung (mis. absen subuh)"
          kanan={<span className="px-2.5 py-1 rounded-full text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200">{draft.filter(x => x.aktif).length} sesi aktif</span>}
        >
          <div className="p-5 flex-1 flex flex-col gap-3">
            {draft.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-6 rounded-xl border border-dashed border-gray-200">Belum ada sesi global. Klik "Tambah Sesi" untuk membuat.</p>
            )}
            {draft.map(x => (
              <div key={x.id} className={`p-3.5 rounded-xl border transition-colors ${x.aktif ? 'border-emerald-200 bg-emerald-50/30' : 'border-gray-200 bg-gray-50/60'}`}>
                <div className="grid grid-cols-2 sm:grid-cols-[1fr_auto_auto] gap-3 items-end">
                  <div className="col-span-2 sm:col-span-1">
                    <label className={labelCls}>Nama sesi</label>
                    <input className={`${fieldCls} w-full font-semibold text-gray-800`} value={x.nama} onChange={e => updateDraft(x.id, { nama: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelCls}>Mulai</label>
                    <TimeInput className={fieldCls} value={x.jamMulai} onChange={e => updateDraft(x.id, { jamMulai: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelCls}>Selesai</label>
                    <TimeInput className={fieldCls} value={x.jamSelesai} onChange={e => updateDraft(x.id, { jamSelesai: e.target.value })} />
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setDraft(prev => prev.filter(y => y.id !== x.id))}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2 py-1 -ml-2 rounded-lg cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />Hapus sesi
                </button>
                <label className="flex items-center gap-3 cursor-pointer">
                  <span className="text-xs font-semibold text-gray-700">Wajib presensi</span>
                  <input type="checkbox" className="peer sr-only" checked={x.aktif} onChange={e => updateDraft(x.id, { aktif: e.target.checked })} />
                  <span className="relative w-10 h-[22px] shrink-0 rounded-full bg-gray-200 transition-colors peer-checked:bg-emerald-600 peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-400/50 after:absolute after:top-0.5 after:left-0.5 after:w-[18px] after:h-[18px] after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-[18px]" />
                </label>
                </div>
              </div>
            ))}

            <div className="mt-auto pt-4 border-t border-gray-100 space-y-2">
              <div className="flex gap-2">
                <button
                  onClick={() => setDraft(prev => [...prev, { id: Date.now(), nama: '', jamMulai: '', jamSelesai: '', aktif: true }])}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-emerald-800 bg-[#fff] border border-emerald-200 hover:bg-emerald-50 flex items-center justify-center gap-1.5 cursor-pointer"
                  style={{ fontFamily: 'Plus Jakarta Sans' }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Sesi</span>
                </button>
                <button
                  onClick={simpanSesi}
                  className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-[#141a17] hover:bg-[#2a332e] flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                  style={{ fontFamily: 'Plus Jakarta Sans' }}
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Simpan Jadwal</span>
                </button>
              </div>
              {draft.length !== sesiGlobal.length && <p className="text-[11px] text-amber-700 font-semibold">Ada perubahan daftar sesi, klik "Simpan Jadwal" untuk menerapkan.</p>}
              {sesiMsg && <p className={`text-xs font-semibold ${sesiMsg.type === 'error' ? 'text-rose-700' : 'text-emerald-700'}`}>{sesiMsg.text}</p>}
            </div>
          </div>
        </KartuProfil>

        <JadwalMalamAdmin sesiList={sesiList} gedungList={gedungList} />
      </div>

      {/* Hari libur: form di kiri, daftar di kanan */}
      <KartuProfil
        ikon={<Palmtree />}
        judul="Hari Libur & Cuti"
        sub="Periode bebas presensi, tidak dihitung alpa"
        kanan={<span className="px-2.5 py-1 rounded-full text-[11px] font-bold text-gray-600 bg-gray-100">{libur.length} periode</span>}
      >
        <div className="p-5 grid lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] gap-5">
          <div className="p-4 rounded-xl bg-gray-50/70 border border-gray-200 space-y-3 self-start">
            <p className="text-sm font-bold text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>{editLibur !== null ? 'Ubah periode libur' : 'Tambah periode libur'}</p>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className={labelCls}>Mulai</label>
                <DateInput className={`${fieldCls} w-full`} value={liburForm.tanggalMulai} onChange={e => setLiburForm(v => ({ ...v, tanggalMulai: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Selesai</label>
                <DateInput clearable min={liburForm.tanggalMulai} className={`${fieldCls} w-full`} value={liburForm.tanggalSelesai} onChange={e => setLiburForm(v => ({ ...v, tanggalSelesai: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Keterangan</label>
              <input className={`${fieldCls} w-full`} placeholder="cth: Libur Semester Ganjil" value={liburForm.keterangan} onChange={e => setLiburForm(v => ({ ...v, keterangan: e.target.value }))} />
            </div>
            <p className="text-[11px] text-gray-400">Kosongkan tanggal selesai untuk libur satu hari. Selama libur, semua absen (harian & event) dinonaktifkan.</p>
            <div className="flex gap-2">
              {editLibur !== null && (
                <button onClick={batalEditLibur} className="px-4 py-2.5 rounded-xl text-xs font-bold text-gray-700 bg-[#fff] border border-gray-200 hover:bg-gray-50 cursor-pointer">Batal</button>
              )}
              <button
                onClick={tambahLibur}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white bg-[#141a17] hover:bg-[#2a332e] flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                style={{ fontFamily: 'Plus Jakarta Sans' }}
              >
                {editLibur !== null ? <Save className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                <span>{editLibur !== null ? 'Simpan Perubahan' : 'Tambah Hari Libur'}</span>
              </button>
            </div>
            {liburMsg && <p className={`text-xs font-semibold ${liburMsg.type === 'error' ? 'text-rose-700' : 'text-emerald-700'}`}>{liburMsg.text}</p>}
          </div>

          <div className="min-w-0">
            {libur.length === 0 ? (
              <div className="h-full min-h-40 flex flex-col items-center justify-center text-center rounded-xl border border-dashed border-gray-200 px-6 py-10">
                <Palmtree className="w-7 h-7 text-gray-300" />
                <p className="mt-2 text-sm font-semibold text-gray-600">Belum ada hari libur</p>
                <p className="text-xs text-gray-400">Periode yang ditambahkan akan tampil di sini.</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-2.5 max-h-[320px] overflow-y-auto pr-1">
                {[...libur].sort((a, b) => b.tanggalMulai.localeCompare(a.tanggalMulai)).map(l => {
                  const hari = Math.round((new Date(l.tanggalSelesai).getTime() - new Date(l.tanggalMulai).getTime()) / 86400000) + 1
                  return (
                    <div key={l.id} className={`group flex items-center gap-3 p-3 rounded-xl border bg-[#fff] transition-colors ${editLibur === l.id ? 'border-emerald-400 ring-2 ring-emerald-400/20' : 'border-gray-200 hover:border-gray-300'}`}>
                      <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                        <Palmtree className="w-[18px] h-[18px]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-gray-900 truncate" style={{ fontFamily: 'Plus Jakarta Sans' }}>{l.keterangan}</p>
                        <p className="text-xs text-gray-500">{formatRentangTanggal(l.tanggalMulai, l.tanggalSelesai)} · {hari} hari</p>
                      </div>
                      <button
                        onClick={() => mulaiEditLibur(l)}
                        className="p-2 rounded-lg text-gray-400 hover:text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer shrink-0"
                        title="Ubah"
                        aria-label={`Ubah ${l.keterangan}`}
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={async () => { const r = await onDeleteLibur(l.id); if (!r.ok && !r.offline) setLiburMsg({ type: 'error', text: r.message }); else if (editLibur === l.id) batalEditLibur() }}
                        className="p-2 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer shrink-0"
                        title="Hapus"
                        aria-label={`Hapus ${l.keterangan}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </KartuProfil>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Laporan
// ---------------------------------------------------------------------------


// Laporan rekap admin: semua statistik & ekspor mengikuti filter periode, gedung, dan sesi di atasnya
function AdminLaporan({ admin, penghuni, gedungList, sesiList, data, now }: {
  // Admin yang mencetak; dicantumkan sebagai penanda tangan laporan
  admin: CurrentUser
  penghuni: Penghuni[]
  gedungList: Gedung[]
  sesiList: Sesi[]
  data: DataPresensi
  now: Date
}) {
  const today = todayLocal()
  const [saringPeriode, setSaringPeriode] = useState<SaringPeriode>({ periode: 'bulan-ini', dari: '', sampai: '' })
  const [gedungPilih, setGedungPilih] = useState('')
  const [sesiPilih, setSesiPilih] = useState('')
  // Ekspor yang sedang disiapkan ('judul|format'); Excel butuh waktu memuat pustakanya
  const [memproses, setMemproses] = useState<string | null>(null)

  const rentang = rentangLaporan(saringPeriode, today)
  const [mulai, akhir] = rentang ?? [today, today]
  const namaSesi = namaSesiAktif(sesiList).map(s => s.nama)
  const keteranganSaring = rentang
    ? [labelPeriodeLaporan(saringPeriode, rentang), gedungPilih || 'Seluruh gedung', sesiPilih ? `Sesi ${sesiPilih}` : 'Semua sesi'].join(' · ')
    : ''

  // Riwayat sesi wajib tiap penghuni pada periode (sejak tanggal masuknya), dihitung sekali untuk semua laporan.
  // Penghuni yang tidak presensi tetap tercatat (Tidak Hadir), bukan hanya baris yang ada di tabel presensi.
  const penghuniDipilih = penghuniWajibAbsen(penghuni, gedungPilih || undefined)
  const rekap = !rentang ? [] : penghuniDipilih.map(p => {
    const dari = p.tanggalMasuk ? maxDate(mulai, p.tanggalMasuk) : mulai
    const riwayat = dari <= akhir
      ? riwayatPenghuni(p.nim, dari, akhir, sesiList, data, now, p.namaGedung).filter(r => !sesiPilih || r.sesi.nama === sesiPilih)
      : []
    return { p, riwayat, c: hitungStatus(riwayat.map(r => r.detail.status)) }
  })
  const gedungDipilih = gedungPilih ? gedungList.filter(g => g.nama === gedungPilih) : gedungList
  const perGedung = gedungDipilih.map(g => ({
    gedung: g,
    c: hitungStatus(rekap.filter(x => x.p.namaGedung === g.nama).flatMap(x => x.riwayat.map(r => r.detail.status))),
  }))
  const total = hitungStatus(rekap.flatMap(x => x.riwayat.map(r => r.detail.status)))
  const pctTidakHadir = total.wajib > 0 ? Math.round((total['Tidak Hadir'] / total.wajib) * 100) : 0
  // Izin yang rentangnya bersinggungan dengan periode; izin "seharian" ikut di setiap sesi
  const izinPeriode = !rentang ? [] : data.izin.filter(i =>
    i.tanggal <= akhir && (i.tanggalSelesai || i.tanggal) >= mulai &&
    (!gedungPilih || i.namaGedung === gedungPilih) &&
    (!sesiPilih || !i.sesi || i.sesi === sesiPilih))
  // "Terbaik" hanya bermakna bila ada kehadiran; semua 0% -> tidak ada gedung terbaik
  const terbaik = perGedung.filter(x => x.c.wajib > 0 && x.c.Hadir > 0).sort((a, b) => b.c.persen - a.c.persen)[0]

  const ekspor = async (title: string, format: ExportFormat) => {
    if (memproses || (!rentang && title !== 'Daftar Penghuni')) return
    // Daftar penghuni tidak terikat periode/sesi; laporan lain mencantumkan seluruh filter
    const tanpaPeriode = title === 'Daftar Penghuni'
    const keterangan: [string, string][] = tanpaPeriode
      ? [['Gedung', gedungPilih || 'Seluruh gedung']]
      : [['Periode', labelPeriodeLaporan(saringPeriode, rentang!)], ['Gedung', gedungPilih || 'Seluruh gedung'], ['Sesi', sesiPilih || 'Semua sesi']]
    const persenTotal = `${total.persen}%`
    let laporan: LaporanFormal

    if (title === 'Presensi Detail') {
      const baris = rekap
        .flatMap(({ p, riwayat }) => riwayat.map(r => ({ p, r })))
        .sort((a, b) => a.r.tanggal.localeCompare(b.r.tanggal) || a.r.sesi.jamMulai.localeCompare(b.r.sesi.jamMulai) || a.p.nama.localeCompare(b.p.nama))
      laporan = {
        judul: 'Laporan Presensi Penghuni Asrama',
        headers: ['Tanggal', 'Sesi', 'NIM', 'Nama', 'Gedung', 'Kamar', 'Status', 'Waktu', 'Keterangan'],
        rows: baris.map(({ p, r }) => [formatTanggal(r.tanggal, 'tanpaHari'), r.sesi.nama, p.nim, p.nama, p.namaGedung, p.nomorKamar, r.detail.status, jamPresensi(r.detail.presensi) || '–', keteranganStatus(r.detail)]),
        kolomAngka: [1, 5, 7],
        kolomStatus: 6,
        ringkasan: [['Penghuni', penghuniDipilih.length], ['Hadir', total.Hadir], ['Izin', total.Izin], ['Tidak Hadir', total['Tidak Hadir']], ['Tingkat kehadiran', persenTotal]],
        catatan: 'Tingkat kehadiran dihitung dari sesi wajib (hadir, izin, tidak hadir); hari libur dan sesi yang belum berakhir tidak dihitung.',
      }
    } else if (title === 'Rekap Perizinan') {
      const jumlah = (s: string) => izinPeriode.filter(i => i.statusPersetujuan === s).length
      laporan = {
        judul: 'Laporan Rekapitulasi Perizinan Penghuni',
        headers: ['NIM', 'Nama', 'Gedung', 'Kamar', 'Tanggal Izin', 'Sesi', 'Alasan', 'Status', 'Catatan Fasilitator'],
        rows: izinPeriode.map(i => [i.nim, i.namaPenghuni, i.namaGedung, i.nomorKamar, formatRentangTanggal(i.tanggal, i.tanggalSelesai), i.sesi || 'Seharian', i.alasan, i.statusPersetujuan === 'Pending' ? 'Menunggu' : i.statusPersetujuan, i.catatanApprover || '–']),
        kolomAngka: [3, 5],
        kolomStatus: 7,
        ringkasan: [['Total pengajuan', izinPeriode.length], ['Disetujui', jumlah('Disetujui')], ['Ditolak', jumlah('Ditolak')], ['Menunggu', jumlah('Pending')]],
      }
    } else if (title === 'Daftar Penghuni') {
      const daftar = penghuni.filter(p => !gedungPilih || p.namaGedung === gedungPilih)
      laporan = {
        judul: 'Daftar Penghuni Asrama',
        headers: ['NIM', 'Nama', 'Email', 'No. HP', 'Asal', 'Peran', 'Status', 'Gedung', 'Kamar', 'Tanggal Masuk'],
        rows: daftar.map(p => [p.nim, p.nama, p.email, p.noHp, p.asal, p.role === 'fasil' ? 'Fasilitator' : 'Penghuni', p.statusAktif ? 'Aktif' : 'Nonaktif', p.namaGedung || '–', p.nomorKamar || '–', p.tanggalMasuk ? formatTanggal(p.tanggalMasuk, 'tanpaHari') : '–']),
        kolomAngka: [8],
        kolomStatus: 6,
        ringkasan: [['Total', daftar.length], ['Aktif', daftar.filter(p => p.statusAktif).length], ['Nonaktif', daftar.filter(p => !p.statusAktif).length]],
      }
    } else if (title === 'Statistik Gedung') {
      laporan = {
        judul: 'Laporan Statistik Kehadiran per Gedung',
        headers: ['Gedung', 'Hadir', 'Izin', 'Tidak Hadir', 'Sesi Wajib', 'Tingkat Kehadiran'],
        rows: perGedung.map(x => [x.gedung.nama, x.c.Hadir, x.c.Izin, x.c['Tidak Hadir'], x.c.wajib, x.c.wajib > 0 ? `${x.c.persen}%` : '–']),
        kolomAngka: [1, 2, 3, 4, 5],
        ringkasan: [['Gedung', perGedung.length], ['Sesi wajib', total.wajib], ['Tingkat kehadiran', persenTotal], ['Gedung terbaik', terbaik ? terbaik.gedung.nama : '–']],
      }
    } else {
      laporan = {
        judul: 'Laporan Rekapitulasi Kehadiran per Penghuni',
        headers: ['NIM', 'Nama', 'Gedung', 'Kamar', 'Hadir', 'Izin', 'Tidak Hadir', 'Sesi Wajib', 'Kehadiran'],
        rows: [...rekap].sort((a, b) => a.p.namaGedung.localeCompare(b.p.namaGedung) || a.p.nama.localeCompare(b.p.nama))
          .map(({ p, c }) => [p.nim, p.nama, p.namaGedung, p.nomorKamar, c.Hadir, c.Izin, c['Tidak Hadir'], c.wajib, c.wajib > 0 ? `${c.persen}%` : '–']),
        kolomAngka: [3, 4, 5, 6, 7, 8],
        ringkasan: [['Penghuni', rekap.length], ['Sesi wajib', total.wajib], ['Tidak hadir', total['Tidak Hadir']], ['Tingkat kehadiran', persenTotal]],
      }
    }

    laporan.keterangan = keterangan
    laporan.penandatangan = {
      jabatan: 'Pengelola Asrama',
      nama: admin.nama,
      identitas: /^\d+$/.test(admin.nim) ? `NIP/NIM. ${admin.nim}` : undefined,
    }
    const slug = [title, gedungPilih, tanpaPeriode ? '' : sesiPilih, tanpaPeriode ? today : `${mulai}_${akhir}`]
      .filter(Boolean).join('-').toLowerCase().replace(/[^a-z0-9_]+/g, '-').replace(/^-|-$/g, '')
    setMemproses(`${title}|${format}`)
    try {
      await unduhLaporan(`${slug}.${format}`, laporan, format)
    } finally {
      setMemproses(null)
    }
  }

  const saringCls = 'px-3 py-2 rounded-lg border border-gray-300 hover:border-gray-400 text-sm text-gray-800 bg-white outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15 transition-colors'

  // Tren harian pada periode: status seluruh sesi wajib dikelompokkan per tanggal dalam satu putaran
  const statusPerTanggal = new Map<string, PresensiStatus[]>()
  for (const { riwayat } of rekap) {
    for (const r of riwayat) {
      const daftar = statusPerTanggal.get(r.tanggal)
      if (daftar) daftar.push(r.detail.status)
      else statusPerTanggal.set(r.tanggal, [r.detail.status])
    }
  }
  const tren = rentang ? dateRangeDesc(mulai, akhir).reverse().map(tanggal => ({ tanggal, c: hitungStatus(statusPerTanggal.get(tanggal) ?? []) })) : []
  const perbandingan = perGedung.map(x => ({ label: x.gedung.nama, sub: `${penghuniDipilih.filter(p => p.namaGedung === x.gedung.nama).length} penghuni`, c: x.c })).sort((a, b) => b.c.persen - a.c.persen)
  const jumlahPenghuniTerdaftar = penghuni.filter(p => !gedungPilih || p.namaGedung === gedungPilih).length

  const FORMAT: { format: ExportFormat; label: string; warna: string }[] = [
    { format: 'pdf', label: 'PDF', warna: 'text-rose-700 border-rose-200 hover:bg-rose-600' },
    { format: 'xlsx', label: 'Excel', warna: 'text-emerald-800 border-emerald-200 hover:bg-emerald-700' },
    { format: 'doc', label: 'Word', warna: 'text-slate-800 border-slate-200 hover:bg-slate-700' },
    { format: 'csv', label: 'CSV', warna: 'text-gray-700 border-gray-200 hover:bg-gray-700' },
  ]
  const jenisLaporan = [
    { title: 'Presensi Detail', desc: 'Status setiap penghuni per tanggal & sesi, termasuk yang tidak hadir', icon: <FileSpreadsheet className="w-5 h-5 text-emerald-700" />, warna: 'bg-emerald-50', baris: rekap.reduce((n, x) => n + x.riwayat.length, 0) },
    { title: 'Rekap per Penghuni', desc: 'Jumlah hadir, izin, dan tidak hadir tiap penghuni', icon: <TrendingUp className="w-5 h-5 text-rose-700" />, warna: 'bg-rose-50', baris: rekap.length },
    { title: 'Statistik Gedung', desc: 'Tingkat kehadiran per gedung', icon: <Building className="w-5 h-5 text-slate-700" />, warna: 'bg-slate-50', baris: perGedung.length },
    { title: 'Rekap Perizinan', desc: 'Pengajuan izin & status persetujuan pada periode', icon: <FileBarChart className="w-5 h-5 text-amber-700" />, warna: 'bg-amber-50', baris: izinPeriode.length },
    { title: 'Daftar Penghuni', desc: 'Data penghuni terdaftar (mengikuti filter gedung saja)', icon: <Users className="w-5 h-5 text-slate-700" />, warna: 'bg-slate-50', baris: jumlahPenghuniTerdaftar },
  ]

  return (
    <div className="space-y-6">
      {/* Kepala halaman + filter */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xs overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#fff] border border-gray-200 p-1 shrink-0 flex items-center justify-center">
            <img src={logoUnand} alt="Logo Universitas Andalas" className="h-full w-auto object-contain" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-extrabold tracking-tight text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>Laporan & Rekapitulasi Kehadiran</h2>
            <p className="text-xs text-gray-500">Atur filter, tinjau ringkasannya, lalu unduh laporan resmi berkop Universitas Andalas.</p>
          </div>
        </div>
        <div className="px-6 py-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <PilihPeriodeLaporan nilai={saringPeriode} onChange={setSaringPeriode} today={today} className={saringCls} />
            <select value={gedungPilih} onChange={e => setGedungPilih(e.target.value)} aria-label="Gedung" className={saringCls}>
              <option value="">Seluruh gedung</option>
              {gedungList.map(g => <option key={g.id} value={g.nama}>{g.nama}</option>)}
            </select>
            <select value={sesiPilih} onChange={e => setSesiPilih(e.target.value)} aria-label="Sesi" className={saringCls}>
              <option value="">Semua sesi</option>
              {namaSesi.map(n => <option key={n} value={n}>Sesi {n}</option>)}
            </select>
          </div>
          {rentang && (
            <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold">
              <span className="px-2 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800">{labelPeriodeLaporan(saringPeriode, rentang)}</span>
              <span className="px-2 py-1 rounded-md bg-gray-50 border border-gray-200 text-gray-700">{gedungPilih || 'Seluruh gedung'}</span>
              <span className="px-2 py-1 rounded-md bg-gray-50 border border-gray-200 text-gray-700">{sesiPilih ? `Sesi ${sesiPilih}` : 'Semua sesi'}</span>
              <span className="px-2 py-1 rounded-md bg-gray-50 border border-gray-200 text-gray-700">{penghuniDipilih.length} penghuni wajib absen</span>
            </div>
          )}
        </div>
      </div>

      {!rentang ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center text-sm text-gray-500">Pilih rentang tanggal yang valid untuk menampilkan ringkasan laporan.</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={<CheckCircle2 className="w-6 h-6 text-emerald-700" />} label="Tingkat Kehadiran" value={`${total.persen}%`} sub={`${total.Hadir} dari ${total.wajib} sesi`} color="#1c7b31" />
            <StatCard icon={<XCircle className="w-6 h-6 text-rose-700" />} label="Tidak Hadir" value={`${pctTidakHadir}%`} sub={`${total['Tidak Hadir']} sesi tanpa keterangan`} color="#be123c" />
            <StatCard icon={<AlertCircle className="w-6 h-6 text-amber-700" />} label="Pengajuan Izin" value={izinPeriode.length} sub="pada periode ini" color="#b45309" />
            <StatCard icon={<Building className="w-6 h-6 text-slate-700" />} label={gedungPilih ? 'Gedung' : 'Gedung Terbaik'} value={terbaik ? terbaik.gedung.nama.replace('Asrama ', '') : '-'} sub={terbaik ? `Tingkat ${terbaik.c.persen}%` : 'Belum ada data'} color="#475569" />
          </div>

          <div className="grid lg:grid-cols-5 gap-5">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-2xs p-5 lg:col-span-3">
              <p className="font-bold text-sm text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>Tren Kehadiran Harian</p>
              <p className="text-xs text-gray-500 mt-0.5 mb-3">Jumlah sesi wajib per hari pada periode terpilih. Arahkan kursor ke batang untuk detail.</p>
              <GrafikTrenKehadiran tren={tren} today={today} tinggi={150} />
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-2xs p-5 lg:col-span-2">
              <p className="font-bold text-sm text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>Perbandingan Gedung</p>
              <p className="text-xs text-gray-500 mt-0.5 mb-4">Tingkat kehadiran terhadap target {TARGET_KEHADIRAN}%, diurutkan dari tertinggi</p>
              <DaftarMeter data={perbandingan} kosong="Tidak ada gedung pada filter ini" />
            </div>
          </div>

          <div className="grid lg:grid-cols-5 gap-5">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-2xs p-5 lg:col-span-3">
              <p className="font-bold text-sm text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>Pola Kehadiran Mingguan</p>
              <p className="text-xs text-gray-500 mt-0.5 mb-4">Tingkat kehadiran per hari dan sesi pada periode ini. Makin gelap makin tinggi; kotak bergaris merah = paling rendah.</p>
              <PetaPanasPola pola={hitungPolaMingguan(rekap.flatMap(x => x.riwayat))} />
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 shadow-2xs p-5 lg:col-span-2">
              <p className="font-bold text-sm text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>Sebaran Tingkat Kehadiran Penghuni</p>
              <p className="text-xs text-gray-500 mt-0.5 mb-3">Jumlah penghuni pada tiap rentang tingkat kehadiran</p>
              <HistogramSebaran persen={rekap.filter(x => x.c.wajib > 0).map(x => x.c.persen)} />
            </div>
          </div>
        </>
      )}

      <RekapSemester
        penghuni={penghuni}
        sesiList={sesiList}
        data={data}
        now={now}
        gedungList={gedungList}
        penandatangan={{ jabatan: 'Pengelola Asrama', nama: admin.nama, identitas: /^\d+$/.test(admin.nim) ? `NIP/NIM. ${admin.nim}` : undefined }}
      />

      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xs p-6">
        <SectionTitle subtitle="Setiap berkas memuat kop Universitas Andalas, keterangan filter, ringkasan, tabel bernomor, dan blok tanda tangan">Unduh Laporan Resmi</SectionTitle>
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {jenisLaporan.map(item => {
            const mati = !rentang && item.title !== 'Daftar Penghuni'
            return (
              <div key={item.title} className="p-4 rounded-xl border border-gray-200 bg-white hover:border-emerald-300 hover:shadow-sm transition-all flex flex-col">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl ${item.warna} flex items-center justify-center shrink-0`}>{item.icon}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h5 className="font-bold text-sm text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>{item.title}</h5>
                      <span className="shrink-0 px-1.5 py-0.5 rounded-md bg-gray-100 text-[10px] font-bold text-gray-600 tabular-nums">{mati ? '–' : `${item.baris} baris`}</span>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed mt-0.5">{item.desc}</p>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-gray-100 grid grid-cols-4 gap-1.5">
                  {FORMAT.map(f => {
                    const sedang = memproses === `${item.title}|${f.format}`
                    return (
                      <button
                        key={f.format}
                        onClick={() => ekspor(item.title, f.format)}
                        disabled={mati || memproses !== null}
                        className={`py-1.5 rounded-lg text-[11px] font-bold bg-white border hover:text-white transition-colors flex items-center justify-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white ${f.warna} ${sedang ? 'disabled:opacity-100' : ''}`}
                        style={{ fontFamily: 'Plus Jakarta Sans' }}
                        title={`Unduh ${item.title} sebagai ${f.label}`}
                      >
                        {sedang ? 'Menyiapkan…' : (<><Download className="w-3 h-3" />{f.label}</>)}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
