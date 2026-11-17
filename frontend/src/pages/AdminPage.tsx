import { useState, useEffect, useMemo } from 'react'
import type { CurrentUser, Penghuni, Gedung, Kamar, PresensiRecord, PresensiStatus, IzinRecord, Sesi, HariLibur, ModeUji, AturanPresensi, EventAsrama, RekapEventResult, GedungInput, KamarInput } from '../types'
import AppLayout, { StatCard, SectionTitle, Badge, ConfirmDialog } from '../components/AppLayout'
import { BuktiIzin, KotakTanggalIzin, RekapStats, RekapTableBerhalaman, SesiToggle, formatRentangIzin, type RekapRow } from '../components/PresensiWidgets'
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
  fetchPresensi, fetchIzin, fetchSesi, saveSesiApi, fetchLibur, addLiburApi, deleteLiburApi, type ApiResult, type UbahPenghuni,
  fetchModeUji, saveModeUjiApi, MODE_UJI_MATI, resetPasswordApi,
  fetchAturanPresensi, saveAturanPresensiApi, ATURAN_PRESENSI_DEFAULT, awalDemo, seedDatabaseApi,
} from '../api'
import MapPicker from '../components/MapPicker'
import { EventFormModal, EventRekapModal } from '../components/EventModals'
import { GedungFormModal, KamarFormModal } from '../components/GedungKamarModals'
import { getCurrentPosition } from '../geo'
import DateInput from '../components/DateInput'
import TimeInput from '../components/TimeInput'
import { notifikasiAdmin } from '../notifikasiPeran'
import { JadwalMalamAdmin } from '../components/JadwalMalam'
import { unduhLaporan, type ExportFormat, type LaporanFormal } from '../ekspor'
import * as XLSX from 'xlsx'
import {
  addDays, cariLibur, faseSesi, formatTanggal, hitungStatus, hunianKamar, penghuniWajibAbsen, namaSesiAktif, riwayatPenghuni, sesiAktif, sesiPadaTanggal, sesiUntuk, statusSesi, todayLocal, type DataPresensi,
  jamPresensi, keteranganStatus, maxDate, formatRentangTanggal, dateRangeDesc,
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
  CalendarDays,
  Sparkles,
  Edit,
  ChevronRight,
} from 'lucide-react'

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-[18px] h-[18px]" /> },
  { id: 'penghuni', label: 'Data Penghuni', icon: <Users className="w-[18px] h-[18px]" /> },
  { id: 'gedung', label: 'Gedung & Kamar', icon: <Building2 className="w-[18px] h-[18px]" /> },
  { id: 'event', label: 'Event Asrama', icon: <CalendarDays className="w-[18px] h-[18px]" /> },
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

  const handleSaveEvent = async (data: Partial<EventAsrama>): Promise<ApiResult> => {
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
          onNavigateTab={setActiveTab}
          onSeed={handleSeed}
          loadingSeed={loadingSeed}
        />
      )}
      {activeTab === 'penghuni' && (
        <AdminPenghuni penghuni={penghuni} onAddClick={() => setShowAddModal(true)} onKelola={setKelola} onResetPassword={nim => setResetTarget(penghuni.find(p => p.nim === nim) || null)} />
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
          <div className="grid lg:grid-cols-12 gap-5 items-stretch">
            <div className="lg:col-span-7">
              <AturanPresensiCard aturan={aturan} onSave={handleSaveAturan} />
            </div>
            <div className="lg:col-span-5">
              <ModeUjiCard modeUji={modeUji} onSave={handleSaveModeUji} />
            </div>
          </div>
          <AdminPengaturan sesiList={sesiList} gedungList={gedungList} libur={libur} onSaveSesi={handleSaveSesi} onAddLibur={handleAddLibur} onDeleteLibur={handleDeleteLibur} />
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

function salamAdmin(now: Date): string {
  const jam = now.getHours()
  return jam < 11 ? 'Selamat pagi' : jam < 15 ? 'Selamat siang' : jam < 18 ? 'Selamat sore' : 'Selamat malam'
}

function AdminDashboard({
  admin,
  penghuni,
  gedungList,
  kamarList,
  sesiList,
  data,
  now,
  modeUji,
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
  onNavigateTab?: (tab: string) => void
  onSeed?: () => void
  loadingSeed?: boolean
}) {
  const today = todayLocal()
  const [rentangGedung, setRentangGedung] = useState<'hari-ini' | '7-hari'>('hari-ini')
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
  const rekapHariIni = hitungStatus(statusHariIni.map(x => x.status))
  const persenHariIni = statusHariIni.length > 0 ? Math.round((rekapHariIni.Hadir / statusHariIni.length) * 100) : 0
  const sesiBerjalan = sesiHariIni.filter(s => faseSesi(s, today, now) === 'dibuka')

  // Riwayat 7 hari tiap penghuni (sejak tanggal masuknya) untuk perbandingan gedung
  const awalTren = addDays(today, -6)
  const riwayat7 = wajib.map(p => ({
    p,
    riwayat: riwayatPenghuni(p.nim, p.tanggalMasuk ? maxDate(awalTren, p.tanggalMasuk) : awalTren, today, sesiList, data, now, p.namaGedung),
  }))
  const perbandinganGedung = gedungList.map(g => {
    const anggota = new Set(wajib.filter(p => p.namaGedung === g.nama).map(p => p.nim))
    const statuses = rentangGedung === 'hari-ini'
      ? statusHariIni.filter(x => anggota.has(x.p.nim)).map(x => x.status)
      : riwayat7.filter(x => anggota.has(x.p.nim)).flatMap(x => x.riwayat.map(r => r.detail.status))
    return { label: g.nama, sub: `${anggota.size} penghuni`, c: hitungStatus(statuses) }
  }).sort((a, b) => b.c.persen - a.c.persen)

  const izinMenunggu = data.izin.filter(i => i.statusPersetujuan === 'Pending')
  const fotoMenunggu = data.presensi.filter(r => r.statusFoto === 'Menunggu').length
  const modeUjiAktif = !!(modeUji?.abaikanJam || modeUji?.abaikanRadius)
  const izinTerbaru = [...data.izin].sort((a, b) => b.id - a.id).slice(0, 5)

  const perhatian = [
    modeUjiAktif && { kunci: 'uji', ikon: <AlertCircle className="w-4 h-4 text-amber-700" />, judul: 'Mode uji presensi masih aktif', ket: [modeUji?.abaikanJam && 'jam sesi diabaikan', modeUji?.abaikanRadius && 'radius GPS diabaikan'].filter(Boolean).join(', '), tab: 'pengaturan' },
    sesiHariIni.length === 0 && !liburHariIni && { kunci: 'sesi', ikon: <Clock className="w-4 h-4 text-amber-700" />, judul: 'Tidak ada sesi presensi hari ini', ket: 'Periksa jadwal sesi aktif', tab: 'pengaturan' },
    tanpaPj.length > 0 && { kunci: 'pj', ikon: <UserCheck className="w-4 h-4 text-rose-600" />, judul: `${tanpaPj.length} gedung belum punya fasilitator`, ket: 'Izin & foto penghuninya tidak dapat diproses', tab: 'gedung' },
    tanpaKoordinat.length > 0 && { kunci: 'gps', ikon: <Building className="w-4 h-4 text-rose-600" />, judul: `${tanpaKoordinat.length} gedung belum diatur koordinatnya`, ket: 'Penghuninya belum dapat presensi mandiri', tab: 'gedung' },
    izinMenunggu.length > 0 && { kunci: 'izin', ikon: <FileBarChart className="w-4 h-4 text-orange-600" />, judul: `${izinMenunggu.length} izin menunggu fasilitator`, ket: 'Diputuskan oleh fasil gedung masing-masing', tab: 'presensi' },
    fotoMenunggu > 0 && { kunci: 'foto', ikon: <UserCheck className="w-4 h-4 text-orange-600" />, judul: `${fotoMenunggu} foto presensi belum divalidasi`, ket: 'Divalidasi oleh fasil gedung masing-masing', tab: 'presensi' },
  ].filter(Boolean) as { kunci: string; ikon: React.ReactNode; judul: string; ket: string; tab: string }[]


  const kartuCls = 'bg-white rounded-2xl border border-gray-200 shadow-2xs'
  const judulKartu = 'font-bold text-sm text-gray-900'
  const tautan = 'text-xs font-bold text-emerald-700 hover:underline cursor-pointer flex items-center gap-0.5 shrink-0'

  return (
    <div className="space-y-5">
      {/* Banner Seeder bila database kosong */}
      {gedungList.length === 0 && penghuni.length === 0 && onSeed && (
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
      <div className="rounded-2xl bg-gradient-to-br from-emerald-800 to-emerald-950 text-white p-5 sm:p-6 shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-2xl bg-white/95 p-1.5 shrink-0 shadow-sm flex items-center justify-center">
              <img src={logoUnand} alt="Logo Universitas Andalas" className="h-full w-auto object-contain" />
            </div>
            <div>
              <p className="text-xs font-semibold text-emerald-200">{formatTanggal(today)}</p>
              <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight mt-0.5" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                {salamAdmin(now)}, {admin.nama.split(' ')[0]}
              </h2>
              <p className="text-sm text-emerald-100/90 mt-0.5">Pengelola Asrama Mahasiswa · Universitas Andalas</p>
              {liburHariIni && (
                <span className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full text-[11px] font-bold bg-sky-100 text-sky-900">
                  Hari ini libur: {liburHariIni.keterangan}
                </span>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 lg:w-[520px]">
            {[
              { label: 'Penghuni', nilai: wajib.length, ket: `${penghuni.filter(p => !p.statusAktif).length} nonaktif`, tab: 'penghuni' },
              { label: 'Gedung', nilai: gedungList.length, ket: `${gedungList.length - tanpaPj.length} ber-PJ`, tab: 'gedung' },
              { label: 'Fasilitator', nilai: fasil, ket: 'aktif', tab: 'penghuni' },
              { label: 'Hunian', nilai: `${persenHunian}%`, ket: `${terisi}/${kapasitas} tempat`, tab: 'gedung' },
            ].map(x => (
              <button key={x.label} type="button" onClick={() => buka(x.tab)} className="text-left rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 px-3 py-2.5 cursor-pointer transition-colors">
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
              <span className="text-5xl font-extrabold text-gray-900 leading-none" style={{ fontFamily: 'Plus Jakarta Sans' }}>{persenHariIni}%</span>
              <span className="text-sm text-gray-500 pb-1">hadir · <strong className="text-gray-800">{rekapHariIni.Hadir}</strong> dari {statusHariIni.length} sesi wajib hari ini</span>
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
                  <button type="button" onClick={() => buka('pengaturan')} className="text-[11px] font-bold text-emerald-700 hover:underline cursor-pointer">Atur</button>
                </div>
                {sesiHariIni.length === 0 ? (
                  <p className="text-xs text-gray-400">{liburHariIni ? 'Libur, tidak ada sesi wajib.' : 'Belum ada sesi aktif.'}</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {sesiHariIni.map(s => {
                      const fase = faseSesi(s, today, now)
                      return (
                        <span key={`${s.id}-${s.namaGedung ?? ''}`} className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-semibold border ${fase === 'dibuka' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : fase === 'ditutup' ? 'bg-gray-50 border-gray-200 text-gray-500' : 'bg-blue-50 border-blue-100 text-blue-800'}`}>
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
              {([['hari-ini', 'Hari ini'], ['7-hari', '7 hari']] as const).map(([k, label]) => (
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
}) {
  const fasilList = penghuni.filter(p => p.role === 'fasil' && p.statusAktif)

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4.5 rounded-2xl border border-emerald-100/90 shadow-xs">
        <div>
          <h3 className="text-base font-extrabold text-emerald-950" style={{ fontFamily: 'Plus Jakarta Sans' }}>
            Manajemen Gedung & Kamar
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Tambah, edit, dan hapus gedung/kamar asrama serta atur radius geofencing presensi
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onTambahGedung}
            className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-emerald-700/20 cursor-pointer transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Gedung</span>
          </button>
          <button
            type="button"
            onClick={() => onTambahKamar()}
            className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
          >
            <Plus className="w-3.5 h-3.5 text-emerald-700" />
            <span>Tambah Kamar</span>
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {gedungList.map(g => {
          const kamarGedung = kamarList.filter(k => k.idGedung === g.id)
          const kapasitas = kamarGedung.reduce((s, k) => s + k.kapasitas, 0)
          const terisi = kamarGedung.reduce((s, k) => s + hunianKamar(k, penghuni), 0)
          return (
            <div key={g.id} className="bg-white rounded-2xl p-6 border border-emerald-100/80 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100 shrink-0">
                      <Building2 className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-base text-emerald-950" style={{ fontFamily: 'Plus Jakarta Sans' }}>{g.nama}</h4>
                      <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[11px] font-bold ${g.jenis === 'Putra' ? 'bg-emerald-50 text-emerald-800' : 'bg-purple-50 text-purple-800'}`}>
                        Asrama {g.jenis}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-gray-600 mr-1">Terisi {terisi}/{kapasitas}</span>
                    <button
                      type="button"
                      onClick={() => onEditGedung(g)}
                      title="Edit Nama & Data Gedung"
                      className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:text-emerald-700 hover:bg-emerald-50 cursor-pointer transition-colors"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onHapusGedung(g)}
                      title="Hapus Gedung"
                      className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:text-rose-700 hover:bg-rose-50 cursor-pointer transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
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
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-bold uppercase tracking-wider text-emerald-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                      Daftar Kamar ({kamarGedung.length})
                    </p>
                    <button
                      type="button"
                      onClick={() => onTambahKamar(g.id)}
                      className="text-[11px] font-bold text-emerald-700 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Tambah Kamar</span>
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {kamarGedung.map(k => {
                      const isi = hunianKamar(k, penghuni)
                      const warna = isi >= k.kapasitas ? 'bg-rose-50 text-rose-800 border-rose-200' : isi === 0 ? 'bg-gray-50 text-gray-600 border-gray-200' : 'bg-emerald-50 text-emerald-800 border-emerald-100'
                      return (
                        <div
                          key={k.nomorKamar}
                          className={`group relative mono text-xs font-semibold pl-2.5 pr-1.5 py-1 rounded-lg border flex items-center gap-1.5 ${warna}`}
                          title={`Lantai ${k.lantai} · Kapasitas: ${k.kapasitas} orang (terisi ${isi})`}
                        >
                          <span>{k.nomorKamar} · {isi}/{k.kapasitas}</span>
                          <div className="flex items-center gap-0.5 opacity-80 group-hover:opacity-100">
                            <button
                              type="button"
                              onClick={() => onEditKamar(k)}
                              title="Edit Kamar"
                              className="p-0.5 hover:bg-black/10 rounded cursor-pointer"
                            >
                              <Edit className="w-2.5 h-2.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onHapusKamar(k.nomorKamar)}
                              title="Hapus Kamar"
                              className="p-0.5 hover:bg-black/10 rounded cursor-pointer"
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <p className="text-[11px] text-gray-400 mt-2">Merah = penuh, abu-abu = kosong. Klik ikon pensil untuk ubah kapasitas/lantai.</p>
                </div>
              </div>
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
    <div className="mt-4 p-3.5 rounded-xl bg-blue-50/40 border border-blue-100">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-bold uppercase tracking-wider text-blue-900 flex items-center gap-1.5" style={{ fontFamily: 'Plus Jakarta Sans' }}>
          <MapPin className="w-3.5 h-3.5 text-blue-700" />
          Lokasi Geofence Presensi
        </p>
        {!editing && (
          <button onClick={() => { setEditing(true); setMessage(null); setLat(gedung.latitude); setLng(gedung.longitude); setRadiusMeter(gedung.radiusMeter) }} className="text-xs font-bold text-blue-800 hover:underline cursor-pointer">
            Atur Lokasi di Peta
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
        <p className={`text-[11px] font-semibold mt-2 ${message.type === 'error' ? 'text-red-700' : 'text-emerald-700'}`}>{message.text}</p>
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
          color="#064e3b"
        />
        <StatCard
          icon={<Clock className="w-5 h-5 text-blue-700" />}
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
          icon={<CheckCircle2 className="w-5 h-5 text-purple-700" />}
          label="Event Selesai"
          value={selesai}
          sub="Alpa dicatat otomatis"
          color="#6b21a8"
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
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100 shadow-xs">
          <CalendarDays className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h4 className="font-extrabold text-base text-gray-800 mb-1" style={{ fontFamily: 'Plus Jakarta Sans' }}>
            Belum Ada Event
          </h4>
          <p className="text-xs text-gray-500 max-w-sm mx-auto mb-4">
            Tidak ada event yang sesuai dengan filter. Klik tombol di bawah untuk membuat event baru.
          </p>
          <button
            type="button"
            onClick={onTambahEvent}
            className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Buat Event Baru</span>
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-5">
          {filtered.map(ev => {
            const st = getStatusEvent(ev)
            return (
              <div
                key={ev.id}
                className="bg-white rounded-2xl p-5 border border-emerald-100/80 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2.5">
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

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => onEditEvent(ev)}
                        title="Edit Event"
                        className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:text-emerald-700 hover:bg-emerald-50 cursor-pointer transition-colors"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onHapusEvent(ev)}
                        title="Hapus Event"
                        className="p-1.5 rounded-lg border border-gray-200 text-gray-600 hover:text-rose-700 hover:bg-rose-50 cursor-pointer transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <h4 className="font-extrabold text-base text-gray-900 leading-snug" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                    {ev.judul}
                  </h4>
                  {ev.deskripsi && (
                    <p className="text-xs text-gray-600 mt-1 line-clamp-2 leading-relaxed">
                      {ev.deskripsi}
                    </p>
                  )}

                  <div className="mt-4 pt-3 border-t border-gray-100 space-y-1.5 text-xs">
                    <div className="flex items-center gap-2 text-gray-700">
                      <Calendar className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      <span className="font-semibold">{ev.tanggal}</span>
                      <span className="text-gray-400">·</span>
                      <Clock className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      <span className="font-semibold">{ev.jamMulai}–{ev.jamSelesai} WIB</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <MapPin className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                      <span className="truncate">{ev.lokasi} (Radius: {ev.radiusMeter} m)</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-[11px] text-gray-400">
                    Oleh: {ev.namaPembuat || ev.createdBy || 'Admin'}
                  </span>
                  <button
                    type="button"
                    onClick={() => onLihatRekap(ev)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Rekap Kehadiran</span>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
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
  // Data perizinan punya filter sendiri (termasuk gedung), terpisah dari filter rekap presensi di atas
  const saring = useSaringIzin(data.izin)
  const [batasTampil, setBatasTampil] = useState(PER_HALAMAN_IZIN)

  // Tiap penghuni dinilai dengan jadwal sesi gedungnya; gedung yang belum mengatur absen malam tidak ikut
  const rows: RekapRow[] = penghuniWajibAbsen(penghuni, gedung || undefined).flatMap(p => {
    const s = sesiUntuk(sesiList, sesi, p.namaGedung, tanggal)
    return s ? [{ penghuni: p, detail: statusSesi(p.nim, tanggal, s, data, now) }] : []
  })
  const izinRows = [...saring.hasil].sort((a, b) => b.tanggal.localeCompare(a.tanggal) || b.id - a.id)
  const izinTampil = izinRows.slice(0, batasTampil)

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
          <SectionTitle subtitle="Koreksi presensi dilakukan oleh fasil gedung masing-masing">Rekap Presensi — {formatTanggal(tanggal)} · Sesi {sesi}</SectionTitle>
        </div>
        <RekapTableBerhalaman rows={rows} showGedung kunciReset={`${tanggal}|${sesi}|${gedung}`} />
      </div>

      <div className="bg-white rounded-2xl overflow-hidden border border-emerald-100/80 shadow-xs">
        <div className="px-6 py-4 border-b border-emerald-100">
          <SectionTitle subtitle="Seluruh pengajuan izin lintas gedung. Keputusan izin dilakukan oleh fasil gedung masing-masing.">Data Perizinan</SectionTitle>
          <BarisSaringIzin saring={saring} gedungList={gedungList} />
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
                    {i.fileBukti && <BuktiIzin fileBukti={i.fileBukti} className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700" />}
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

function AdminPengaturan({ sesiList, gedungList, libur, onSaveSesi, onAddLibur, onDeleteLibur }: {
  sesiList: Sesi[]
  gedungList: Gedung[]
  libur: HariLibur[]
  onSaveSesi: (list: Sesi[]) => Promise<ApiResult>
  onAddLibur: (l: Omit<HariLibur, 'id'>) => Promise<ApiResult>
  onDeleteLibur: (id: number) => Promise<ApiResult>
}) {
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
    const berhasil = result.ok || result.offline
    setLiburMsg(berhasil ? { type: 'success', text: 'Hari libur ditambahkan.' } : { type: 'error', text: result.message })
    // Form hanya dikosongkan bila tersimpan, agar isian tidak hilang saat gagal
    if (berhasil) setLiburForm({ tanggalMulai: '', tanggalSelesai: '', keterangan: '' })
  }

  const fieldCls = 'px-3 py-1.5 rounded-lg border border-gray-300 text-xs outline-none focus:border-emerald-700 bg-white'

  return (
    <div className="grid lg:grid-cols-2 gap-5 items-start">
      <div className="space-y-5">
      {/* Jadwal Sesi */}
      <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div>
            <h4 className="text-sm font-bold text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>Jadwal Sesi Presensi</h4>
            <p className="text-[11px] text-gray-400">Berlaku untuk semua gedung (mis. absen subuh)</p>
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
      <JadwalMalamAdmin sesiList={sesiList} gedungList={gedungList} />
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
              <button onClick={async () => { const r = await onDeleteLibur(l.id); if (!r.ok && !r.offline) setLiburMsg({ type: 'error', text: r.message }) }} className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer shrink-0" title="Hapus">
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
    { format: 'doc', label: 'Word', warna: 'text-blue-800 border-blue-200 hover:bg-blue-700' },
    { format: 'csv', label: 'CSV', warna: 'text-gray-700 border-gray-200 hover:bg-gray-700' },
  ]
  const jenisLaporan = [
    { title: 'Presensi Detail', desc: 'Status setiap penghuni per tanggal & sesi, termasuk yang tidak hadir', icon: <FileSpreadsheet className="w-5 h-5 text-emerald-700" />, warna: 'bg-emerald-50', baris: rekap.reduce((n, x) => n + x.riwayat.length, 0) },
    { title: 'Rekap per Penghuni', desc: 'Jumlah hadir, izin, dan tidak hadir tiap penghuni', icon: <TrendingUp className="w-5 h-5 text-rose-700" />, warna: 'bg-rose-50', baris: rekap.length },
    { title: 'Statistik Gedung', desc: 'Tingkat kehadiran per gedung', icon: <Building className="w-5 h-5 text-blue-700" />, warna: 'bg-blue-50', baris: perGedung.length },
    { title: 'Rekap Perizinan', desc: 'Pengajuan izin & status persetujuan pada periode', icon: <FileBarChart className="w-5 h-5 text-amber-700" />, warna: 'bg-amber-50', baris: izinPeriode.length },
    { title: 'Daftar Penghuni', desc: 'Data penghuni terdaftar (mengikuti filter gedung saja)', icon: <Users className="w-5 h-5 text-purple-700" />, warna: 'bg-purple-50', baris: jumlahPenghuniTerdaftar },
  ]

  return (
    <div className="space-y-6">
      {/* Kepala halaman + filter */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xs overflow-hidden">
        <div className="px-6 py-5 bg-gradient-to-r from-emerald-800 to-emerald-950 text-white flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-white/95 p-1 shrink-0 flex items-center justify-center">
            <img src={logoUnand} alt="Logo Universitas Andalas" className="h-full w-auto object-contain" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-extrabold tracking-tight" style={{ fontFamily: 'Plus Jakarta Sans' }}>Laporan & Rekapitulasi Kehadiran</h2>
            <p className="text-xs text-emerald-100/90">Atur filter, tinjau ringkasannya, lalu unduh laporan resmi berkop Universitas Andalas.</p>
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
            <StatCard icon={<CheckCircle2 className="w-6 h-6 text-emerald-700" />} label="Tingkat Kehadiran" value={`${total.persen}%`} sub={`${total.Hadir} dari ${total.wajib} sesi`} color="#047857" />
            <StatCard icon={<XCircle className="w-6 h-6 text-rose-700" />} label="Tidak Hadir" value={`${pctTidakHadir}%`} sub={`${total['Tidak Hadir']} sesi tanpa keterangan`} color="#be123c" />
            <StatCard icon={<AlertCircle className="w-6 h-6 text-amber-700" />} label="Pengajuan Izin" value={izinPeriode.length} sub="pada periode ini" color="#b45309" />
            <StatCard icon={<Building className="w-6 h-6 text-purple-700" />} label={gedungPilih ? 'Gedung' : 'Gedung Terbaik'} value={terbaik ? terbaik.gedung.nama.replace('Asrama ', '') : '-'} sub={terbaik ? `Tingkat ${terbaik.c.persen}%` : 'Belum ada data'} color="#6b21a8" />
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
