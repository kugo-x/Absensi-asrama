import { Fragment, useState, useEffect, type ReactNode } from 'react'
import type { AturanPresensi, CurrentUser, Gedung, HariLibur, IzinRecord, Penghuni, PresensiRecord, PresensiStatus, Sesi, StatusFoto, EventAsrama, RekapEventResult } from '../types'
import AppLayout, { SectionTitle, Badge, ConfirmDialog, StatCard } from '../components/AppLayout'
import { JadwalMalamFasil } from '../components/JadwalMalam'
import KartuEvent, { UbinBuatEvent } from '../components/KartuEvent'
import { unduhLaporan, type ExportFormat } from '../ekspor'
import { BuktiIzin, FotoBadge, FotoWajah, KotakTanggalIzin, RekapTableBerhalaman, SesiToggle, TAMPILAN_STATUS_IZIN, formatRentangIzin, type RekapRow } from '../components/PresensiWidgets'
import { BarisSaringIzin, KosongSaringIzin, useSaringIzin, type StatusSaring } from '../components/SaringIzin'
import { BilahKomposisi, HistogramSebaran, PetaPanasPola, WARNA_STATUS_GRAFIK, hitungPolaMingguan } from '../components/GrafikKehadiran'
import { PanelTrenKehadiran } from '../components/TrenKehadiran'
import { PilihPeriodeLaporan, labelPeriodeLaporan, rentangLaporan, type SaringPeriode } from '../components/SaringLaporan'
import DateInput from '../components/DateInput'
import { notifikasiFasil } from '../notifikasiPeran'
import { KartuGantiPassword, KartuProfil, ProfilHeader, simpanUserLokal } from '../components/ProfilAkun'
import {
  presensiList as initialPresensi,
  izinList as initialIzin,
  penghuniList as initialPenghuni,
  gedungList as initialGedung,
  sesiList as initialSesi,
  liburList as initialLibur,
  eventList as initialEvent,
} from '../data/mockData'
import {
  awalDemo, fetchPresensi, fetchIzin, fetchPenghuni, fetchGedung, fetchSesi, fetchLibur,
  fetchEvent, addEventApi, updateEventApi, deleteEventApi, fetchRekapEvent, type ApiResult,
  updateIzinStatusApi, koreksiPresensiApi, updateProfileApi, validasiFotoApi, validasiFotoMassalApi, fetchAturanPresensi, ATURAN_PRESENSI_DEFAULT
} from '../api'
import {
  cariLibur, formatTanggal, hitungStatus, penghuniWajibAbsen, periodeRekap, riwayatPenghuni, sesiAktif, sesiUntuk, statusSesi, toHM, todayLocal, type DataPresensi,
  addDays, formatRentangTanggal, teksHariBerulang, hariIso, maxDate, dateRangeDesc, NAMA_HARI,
} from '../logic'
import {
  LayoutDashboard,
  ClipboardCheck,
  FileCheck,
  BarChart3,
  AlertCircle,
  Calendar,
  CalendarDays,
  Paperclip,
  User,
  Users,
  Check,
  Download,
  X,
  Pencil,
  Building2,
  Palmtree,
  Camera,
  MapPin,
  Plus,
  Trash2,
  Edit,
  Sparkles,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Search,
  Eye,
  ShieldCheck,
  Mail,
} from 'lucide-react'
import { EventFormModal, EventRekapModal } from '../components/EventModals'

const navItems = [
  { id: 'dashboard', label: 'Dashboard Fasil', icon: <LayoutDashboard className="w-[18px] h-[18px]" /> },
  { id: 'event', label: 'Event Gedung', icon: <CalendarDays className="w-[18px] h-[18px]" /> },
  { id: 'monitor', label: 'Monitor Presensi', icon: <ClipboardCheck className="w-[18px] h-[18px]" /> },
  { id: 'izin', label: 'Manajemen Izin', icon: <FileCheck className="w-[18px] h-[18px]" /> },
  { id: 'foto', label: 'Validasi Foto', icon: <Camera className="w-[18px] h-[18px]" /> },
  { id: 'rekap', label: 'Rekap Kehadiran', icon: <BarChart3 className="w-[18px] h-[18px]" /> },
  { id: 'profil', label: 'Profil Saya', icon: <User className="w-[18px] h-[18px]" /> },
]

interface KoreksiTarget {
  row: RekapRow
  tanggal: string
  sesi: string
}

export default function FasilPage({ user, onLogout }: { user: CurrentUser; onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [penghuni, setPenghuni] = useState<Penghuni[]>(initialPenghuni)
  const [gedungList, setGedungList] = useState<Gedung[]>(initialGedung)
  const [presensi, setPresensi] = useState<PresensiRecord[]>(awalDemo(initialPresensi))
  const [izinData, setIzinData] = useState<IzinRecord[]>(initialIzin)
  const [sesiList, setSesiList] = useState<Sesi[]>(awalDemo(initialSesi))
  const [libur, setLibur] = useState<HariLibur[]>(awalDemo(initialLibur))
  const [eventList, setEventList] = useState<EventAsrama[]>(awalDemo(initialEvent))
  const [eventModal, setEventModal] = useState<{ open: boolean; event: EventAsrama | null }>({ open: false, event: null })
  const [rekapModal, setRekapModal] = useState<{ open: boolean; rekap: RekapEventResult | null }>({ open: false, rekap: null })
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; title: string; message: string; onConfirm: () => void }>({ open: false, title: '', message: '', onConfirm: () => {} })
  const [selectedIzin, setSelectedIzin] = useState<IzinRecord | null>(null)
  const [koreksi, setKoreksi] = useState<KoreksiTarget | null>(null)
  // Monitor dibuka dari dashboard dengan sesi & status terpilih; `n` memaksa Monitor dimuat ulang
  const [monitorAwal, setMonitorAwal] = useState<{ sesi: string; status: PresensiStatus | ''; n: number } | null>(null)
  const gantiTab = (tab: string) => {
    setMonitorAwal(null)
    setActiveTab(tab)
  }
  const bukaMonitor = (sesi: string, status: PresensiStatus | '') => {
    setMonitorAwal({ sesi, status, n: Date.now() })
    setActiveTab('monitor')
  }
  const [now, setNow] = useState(new Date())
  const [aturan, setAturan] = useState<AturanPresensi>(ATURAN_PRESENSI_DEFAULT)

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(timer)
  }, [])

  // Presensi & izin diperbarui berkala agar pantauan sesi dan antrean validasi foto tetap terkini
  useEffect(() => {
    const timer = setInterval(() => {
      fetchPresensi().then(setPresensi)
      fetchIzin().then(setIzinData)
      fetchEvent().then(setEventList)
    }, 60000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    fetchPenghuni().then(setPenghuni)
    fetchGedung().then(setGedungList)
    fetchPresensi().then(setPresensi)
    fetchIzin().then(setIzinData)
    fetchSesi().then(setSesiList)
    fetchLibur().then(setLibur)
    fetchEvent().then(setEventList)
    fetchAturanPresensi().then(setAturan)
  }, [])

  // Lingkup data fasil: hanya gedung tempat ia ditetapkan sebagai penanggung jawab (gedung.NIM_Pj)
  const gedungSaya = gedungList.find(g => g.nimPj === user.nim) || null
  const today = todayLocal()
  const sesiAktifList = sesiAktif(sesiList, gedungSaya?.nama, today)
  const anggota = gedungSaya ? penghuniWajibAbsen(penghuni, gedungSaya.nama) : []
  const penghuniGedungSaya = gedungSaya ? penghuni.filter(p => p.role !== 'fasil' && p.namaGedung === gedungSaya.nama) : []
  const nimGedung = new Set(penghuni.filter(p => gedungSaya && p.namaGedung === gedungSaya.nama).map(p => p.nim))
  const izinGedung = izinData.filter(i => nimGedung.has(i.nim) || (gedungSaya && i.namaGedung === gedungSaya.nama))
  const data: DataPresensi = { presensi, izin: izinData, libur }
  // Foto presensi mandiri penghuni gedung ini (penghuni yang pindah gedung divalidasi PJ gedung barunya)
  const nimAnggota = new Set(anggota.map(p => p.nim))
  const presensiBerfoto = presensi.filter(r => r.statusFoto && r.fotoWajah && nimAnggota.has(r.nim))
  // Rekap 30 hari per penghuni; dipakai peringatan & ringkasan di dashboard
  const rekapPenghuni = anggota.map(p => {
    const riwayat = riwayatPenghuni(p.nim, periodeRekap(today, p.tanggalMasuk), today, sesiList, data, now, p.namaGedung)
    return { penghuni: p, c: hitungStatus(riwayat.map(r => r.detail.status)), riwayat }
  }).sort((a, b) => b.c['Tidak Hadir'] - a.c['Tidak Hadir'] || a.c.persen - b.c.persen)
  const sering = rekapPenghuni.filter(r => r.c['Tidak Hadir'] >= aturan.batasTidakHadir)
  // Penghuni yang sedang berizin (disetujui) hari ini, satu baris per penghuni
  const izinHariIni = izinGedung
    .filter(i => i.statusPersetujuan === 'Disetujui' && i.tanggal <= today && today <= (i.tanggalSelesai || i.tanggal) &&
      (!i.hariBerulang?.length || i.hariBerulang.includes(hariIso(today))))
    .filter((i, n, semua) => semua.findIndex(x => x.nim === i.nim) === n)
  // Event berikutnya yang relevan untuk gedung ini (event gedung sendiri atau event seluruh asrama)
  const jamSekarang = toHM(now)
  const eventBerikutnya = eventList
    .filter(ev => (ev.idGedung == null || ev.idGedung === gedungSaya?.id) && (ev.tanggal > today || (ev.tanggal === today && ev.jamSelesai >= jamSekarang)))
    .sort((a, b) => `${a.tanggal} ${a.jamMulai}`.localeCompare(`${b.tanggal} ${b.jamMulai}`))[0] ?? null
  const fotoMenunggu = presensiBerfoto.filter(r => r.statusFoto === 'Menunggu').length
  const menu = navItems.map(n => n.id === 'foto' && fotoMenunggu > 0 ? { ...n, label: `${n.label} (${fotoMenunggu})` } : n)

  const rekapRows = (tanggal: string, sesiNama: string): RekapRow[] => {
    const sesi = sesiUntuk(sesiList, sesiNama, gedungSaya?.nama, tanggal)
    if (!sesi) return []
    return anggota.map(p => ({ penghuni: p, detail: statusSesi(p.nim, tanggal, sesi, data, now) }))
  }

  // Keputusan izin: tunggu server, tampilkan galat di modal bila gagal; berhasil -> ambil ulang dari DB.
  // Mengembalikan pesan galat, atau null jika berhasil.
  const handleKeputusanIzin = async (id: number, status: 'Disetujui' | 'Ditolak', catatan: string): Promise<string | null> => {
    const result = await updateIzinStatusApi(id, status, user.nim, catatan)
    if (!result.ok && !result.offline) {
      // Mis. izin sudah diputuskan lebih dulu: segarkan daftar agar statusnya sesuai server
      fetchIzin().then(setIzinData)
      return result.message
    }
    setSelectedIzin(null)
    if (result.ok) {
      fetchIzin().then(setIzinData)
      return null
    }
    // Mode demo: simpan lokal
    setIzinData(prev => prev.map(i => i.id === id
      ? { ...i, statusPersetujuan: status, nimApprover: user.nim, namaApprover: user.nama, tanggalApproval: today, catatanApprover: catatan }
      : i
    ))
    return null
  }

  // Koreksi: tunggu server, tampilkan galat di modal bila gagal; berhasil -> ambil ulang dari DB.
  // Mengembalikan pesan galat, atau null jika berhasil.
  const handleKoreksi = async (status: PresensiStatus, keterangan: string): Promise<string | null> => {
    if (!koreksi) return null
    const { row, tanggal, sesi } = koreksi
    const p = row.penghuni
    const result = await koreksiPresensiApi({ nim: p.nim, tanggal, sesi, status, keterangan, korektorNim: user.nim })
    if (!result.ok && !result.offline) return result.message
    setKoreksi(null)
    if (result.ok) {
      fetchPresensi().then(setPresensi)
      return null
    }
    // Mode demo: simpan lokal
    const record: PresensiRecord = {
      id: row.detail.presensi?.id ?? Date.now(),
      nim: p.nim, namaPenghuni: p.nama, nomorKamar: p.nomorKamar, namaGedung: p.namaGedung,
      tanggal, sesi, waktu: row.detail.presensi?.waktu || toHM(new Date()),
      latitude: row.detail.presensi?.latitude ?? null, longitude: row.detail.presensi?.longitude ?? null,
      status, fotoWajah: '', keterangan, dikoreksiOleh: user.nim,
    }
    setPresensi(prev => [record, ...prev.filter(r => !(r.nim === p.nim && r.tanggal === tanggal && r.sesi === sesi))])
    return null
  }

  // Terima banyak foto sekaligus; mengembalikan { ok, pesan }
  const handleTerimaMassal = async (ids: number[]) => {
    const result = await validasiFotoMassalApi(ids)
    if (!result.ok && !result.offline) return { ok: false, pesan: result.message }
    const terpilih = new Set(ids)
    setPresensi(prev => prev.map(r => terpilih.has(r.id) && r.statusFoto === 'Menunggu'
      ? { ...r, statusFoto: 'Diterima' as StatusFoto, catatanValidasi: '', divalidasiOleh: user.nim, namaValidator: user.nama }
      : r))
    if (result.ok) fetchPresensi().then(setPresensi)
    return { ok: true, pesan: result.offline ? `${ids.length} foto diterima (mode demo).` : result.message }
  }

  // Mengembalikan pesan galat, atau null jika berhasil
  const handleValidasiFoto = async (rec: PresensiRecord, status: Exclude<StatusFoto, 'Menunggu'>, catatan: string) => {
    const result = await validasiFotoApi(rec.id, status, catatan)
    if (!result.ok && !result.offline) return result.message
    setPresensi(prev => prev.map(r => r.id !== rec.id ? r : {
      ...r,
      statusFoto: status,
      catatanValidasi: catatan,
      divalidasiOleh: user.nim,
      namaValidator: user.nama,
      ...(status === 'Ditolak' ? { status: 'Tidak Hadir' as PresensiStatus, keterangan: `Foto ditolak: ${catatan}`, dikoreksiOleh: user.nim } : {}),
    }))
    if (result.ok) fetchPresensi().then(setPresensi)
    return null
  }

  const handleSaveEvent = async (data: Partial<EventAsrama>): Promise<ApiResult> => {
    const payload = {
      ...data,
      tipe: 'gedung' as const,
      idGedung: gedungSaya?.id ?? null,
    }
    const res = eventModal.event ? await updateEventApi(eventModal.event.id, payload) : await addEventApi(payload)
    if (res.ok || res.offline) {
      fetchEvent().then(setEventList)
    }
    return res
  }

  const handleDeleteEvent = (ev: EventAsrama) => {
    setConfirmDialog({
      open: true,
      title: 'Hapus Event Gedung',
      message: `Apakah Anda yakin ingin menghapus event "${ev.judul}"? Data presensi peserta untuk event ini akan ikut terhapus.`,
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

  if (!gedungSaya) {
    return (
      <AppLayout user={user} onLogout={onLogout} navItems={menu} activeTab={activeTab} onTabChange={setActiveTab}>
        {activeTab === 'profil' ? (
        <FasilProfil
          user={user}
          onLogout={onLogout}
          gedung={gedungSaya}
          penghuniGedung={penghuniGedungSaya}
          jumlahWajibAbsen={anggota.length}
          izinGedung={izinGedung}
          presensi={presensi}
          fotoMenunggu={fotoMenunggu}
          onBuka={gantiTab}
        />
        ) : (
        <div className="bg-white rounded-2xl p-10 text-center border border-amber-200 max-w-xl mx-auto">
          <Building2 className="w-10 h-10 text-amber-600 mx-auto mb-3" />
          <h3 className="font-bold text-base text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>Anda belum ditetapkan sebagai PJ gedung</h3>
          <p className="text-sm text-gray-500 mt-1">Hubungi admin agar akun Anda ditetapkan sebagai penanggung jawab salah satu gedung asrama.</p>
        </div>
        )}
      </AppLayout>
    )
  }

  return (
    <AppLayout user={user} onLogout={onLogout} navItems={menu} activeTab={activeTab} onTabChange={gantiTab}
      notifikasi={notifikasiFasil({ nim: user.nim, izinGedung, presensiBerfoto, sering, batasTidakHadir: aturan.batasTidakHadir, eventList, today, jamSekarang })}>
      {/* Dashboard sudah menampilkan gedung & jumlah penghuni di header-nya */}
      {activeTab !== 'dashboard' && activeTab !== 'profil' && (
        <div className="mb-5 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-emerald-100 text-xs font-semibold text-emerald-900">
          <Building2 className="w-4 h-4 text-emerald-700" />
          <span>Penanggung jawab {gedungSaya.nama} · {anggota.length} penghuni wajib absen</span>
        </div>
      )}

      {activeTab === 'dashboard' && (
        <FasilDashboard
          namaFasil={user.nama}
          gedung={gedungSaya}
          jumlahPenghuni={anggota.length}
          sesiList={sesiAktifList}
          rekapRows={rekapRows}
          today={today}
          now={now}
          liburHariIni={cariLibur(today, libur)}
          pendingIzin={izinGedung.filter(i => i.statusPersetujuan === 'Pending')}
          izinHariIni={izinHariIni}
          rekapPenghuni={rekapPenghuni}
          panelTren={
            <PanelTrenKehadiran
              penghuni={anggota}
              sesiList={sesiList}
              data={data}
              now={now}
              judul="Tren Kehadiran Gedung"
              aksi={<button type="button" onClick={() => setActiveTab('rekap')} className="text-xs font-bold text-emerald-700 hover:underline cursor-pointer shrink-0">Rekap lengkap</button>}
            />
          }
          eventBerikutnya={eventBerikutnya}
          onKoreksi={(row, sesi) => setKoreksi({ row, tanggal: today, sesi })}
          onLihatMonitor={bukaMonitor}
          onLihatIzin={() => setActiveTab('izin')}
          onLihatEvent={() => setActiveTab('event')}
          sering={sering}
          batasTidakHadir={aturan.batasTidakHadir}
          onLihatRekap={() => setActiveTab('rekap')}
          fotoMenunggu={fotoMenunggu}
          onLihatFoto={() => setActiveTab('foto')}
        />
      )}
      {/* Pengaturan jadwal absen malam gedung: diletakkan di bawah karena jarang diubah */}
      {activeTab === 'dashboard' && (
        <div className="mt-6">
          <JadwalMalamFasil gedung={gedungSaya} sesiList={sesiList} onTersimpan={() => fetchSesi().then(setSesiList)} />
        </div>
      )}
      {activeTab === 'event' && (
        <FasilEvent
          eventList={eventList}
          gedungSaya={gedungSaya}
          onTambahEvent={() => setEventModal({ open: true, event: null })}
          onEditEvent={ev => setEventModal({ open: true, event: ev })}
          onHapusEvent={handleDeleteEvent}
          onLihatRekap={handleViewRekap}
        />
      )}
      {activeTab === 'monitor' && (
        <FasilMonitor
          key={monitorAwal?.n ?? 0}
          awal={monitorAwal}
          sesiList={sesiAktif(sesiList, gedungSaya.nama)}
          rekapRows={rekapRows}
          today={today}
          onKoreksi={(row, tanggal, sesi) => setKoreksi({ row, tanggal, sesi })}
        />
      )}
      {activeTab === 'izin' && <FasilIzin izinData={izinGedung} onSelect={setSelectedIzin} />}
      {activeTab === 'foto' && <FasilValidasiFoto records={presensiBerfoto} onValidasi={handleValidasiFoto} onTerimaMassal={handleTerimaMassal} />}
      {activeTab === 'rekap' && <FasilRekap fasil={user} anggota={anggota} sesiList={sesiList} data={data} now={now} batas={aturan.batasTidakHadir} namaGedung={gedungSaya.nama} />}
      {activeTab === 'profil' && (
        <FasilProfil
          user={user}
          onLogout={onLogout}
          gedung={gedungSaya}
          penghuniGedung={penghuniGedungSaya}
          jumlahWajibAbsen={anggota.length}
          izinGedung={izinGedung}
          presensi={presensi}
          fotoMenunggu={fotoMenunggu}
          onBuka={gantiTab}
        />
      )}

      {selectedIzin && (
        <IzinModal
          izin={selectedIzin}
          izinLain={izinGedung.filter(i => i.nim === selectedIzin.nim && i.id !== selectedIzin.id)}
          onClose={() => setSelectedIzin(null)}
          onDecide={handleKeputusanIzin}
        />
      )}
      {koreksi && (
        <KoreksiModal target={koreksi} onClose={() => setKoreksi(null)} onSave={handleKoreksi} />
      )}

      {/* Modals Event */}
      {eventModal.open && (
        <EventFormModal
          event={eventModal.event}
          gedungList={gedungList}
          role="fasil"
          fasilIdGedung={gedungSaya.id}
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

// ---------------------------------------------------------------------------
// Event Gedung (Fasil)
// ---------------------------------------------------------------------------

function FasilEvent({
  eventList,
  gedungSaya,
  onTambahEvent,
  onEditEvent,
  onHapusEvent,
  onLihatRekap,
}: {
  eventList: EventAsrama[]
  gedungSaya: Gedung
  onTambahEvent: () => void
  onEditEvent: (ev: EventAsrama) => void
  onHapusEvent: (ev: EventAsrama) => void
  onLihatRekap: (ev: EventAsrama) => void
}) {
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

  // Event yang relevan untuk fasil: event gedung binaannya ATAU event seluruh asrama
  const eventFasil = eventList.filter(ev => ev.tipe === 'seluruh' || ev.idGedung === gedungSaya.id)

  const filtered = eventFasil.filter(ev => {
    const st = getStatusEvent(ev)
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

  return (
    <div className="space-y-6">
      {/* Header + pencarian dalam satu kartu */}
      <div className="bg-white rounded-2xl border border-emerald-100/90 shadow-xs p-4.5 flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-extrabold text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>Event & Kegiatan {gedungSaya.nama}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{eventFasil.length} event · gedung Anda & seluruh asrama</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari event, agenda, lokasi..."
              value={cari}
              onChange={e => setCari(e.target.value)}
              className="pl-8 pr-3 py-2 rounded-xl border border-gray-200 text-xs outline-none focus:border-emerald-600 w-52 sm:w-64 bg-white"
            />
          </div>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-2 rounded-xl border border-gray-200 text-xs bg-white outline-none focus:border-emerald-600 font-medium"
          >
            <option value="semua">Semua status</option>
            <option value="Akan Datang">Akan Datang</option>
            <option value="Sedang Berlangsung">Sedang Berlangsung</option>
            <option value="Selesai">Selesai</option>
          </select>
          <button
            type="button"
            onClick={onTambahEvent}
            className="px-4 py-2 rounded-xl bg-[#141a17] hover:bg-[#2a332e] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm cursor-pointer transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Buat Event</span>
          </button>
        </div>
      </div>

      {/* Grid Cards */}
      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map(ev => {
            const st = getStatusEvent(ev)
            const adalahGedungSaya = ev.tipe === 'gedung' && ev.idGedung === gedungSaya.id
            return (
              <KartuEvent
                key={ev.id}
                ev={ev}
                status={st}
                onEdit={adalahGedungSaya ? () => onEditEvent(ev) : undefined}
                onHapus={adalahGedungSaya ? () => onHapusEvent(ev) : undefined}
                penyelenggara={adalahGedungSaya ? 'Dikelola oleh Anda' : `Penyelenggara: ${ev.namaPembuat || 'Admin'}`}
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
            label="Buat event gedung"
            keterangan={filtered.length === 0 ? (eventFasil.length === 0 ? 'Belum ada event terjadwal untuk gedung Anda.' : 'Tidak ada event yang cocok dengan pencarian.') : 'Atur jadwal, lokasi & radius presensi'}
          />
        </div>
    </div>
  )
}

type RekapPenghuni = { penghuni: Penghuni; c: ReturnType<typeof hitungStatus> }

function salam(now: Date): string {
  const jam = now.getHours()
  return jam < 11 ? 'Selamat pagi' : jam < 15 ? 'Selamat siang' : jam < 18 ? 'Selamat sore' : 'Selamat malam'
}

// 75 menit → "1 jam 15 menit"
function formatDurasi(menit: number): string {
  const j = Math.floor(menit / 60)
  const m = menit % 60
  return j > 0 ? `${j} jam${m ? ` ${m} menit` : ''}` : `${m} menit`
}

function FasilDashboard({
  namaFasil, gedung, jumlahPenghuni, sesiList, rekapRows, today, now, liburHariIni, pendingIzin, izinHariIni, rekapPenghuni, panelTren,
  eventBerikutnya, onKoreksi, onLihatMonitor, onLihatIzin, onLihatEvent, sering, batasTidakHadir, onLihatRekap, fotoMenunggu, onLihatFoto,
}: {
  namaFasil: string
  gedung: Gedung
  jumlahPenghuni: number
  sesiList: Sesi[]
  rekapRows: (tanggal: string, sesi: string) => RekapRow[]
  today: string
  now: Date
  liburHariIni?: HariLibur
  pendingIzin: IzinRecord[]
  // Izin disetujui yang berlaku hari ini (satu per penghuni)
  izinHariIni: IzinRecord[]
  // Rekap 30 hari tiap penghuni, untuk ringkasan kehadiran gedung
  rekapPenghuni: RekapPenghuni[]
  // Panel tren (7 hari / 12 minggu / 6 bulan) disiapkan induk karena butuh seluruh jadwal sesi
  panelTren: React.ReactNode
  eventBerikutnya: EventAsrama | null
  onKoreksi: (row: RekapRow, sesi: string) => void
  // Buka tab Monitor dengan sesi & status terpilih (daftar lengkap penghuni ada di sana)
  onLihatMonitor: (sesi: string, status: PresensiStatus | '') => void
  onLihatIzin: () => void
  onLihatEvent: () => void
  sering: RekapPenghuni[]
  batasTidakHadir: number
  onLihatRekap: () => void
  fotoMenunggu: number
  onLihatFoto: () => void
}) {
  // Default ke sesi yang sedang dibuka, atau sesi terakhir yang sudah dimulai
  const hm = toHM(now)
  const defaultSesi = [...sesiList].reverse().find(s => s.jamMulai <= hm)?.nama || sesiList[0]?.nama || ''
  const [pilihan, setSesi] = useState('')
  const sesi = sesiList.some(x => x.nama === pilihan) ? pilihan : defaultSesi
  const rows = rekapRows(today, sesi)
  const s = sesiList.find(x => x.nama === sesi)
  const c = hitungStatus(rows.map(r => r.detail.status))
  const mulaiSesi = s ? new Date(`${today}T${s.jamMulai}`) : null
  const selesaiSesi = s ? new Date(`${today}T${s.jamSelesai}`) : null
  const fase = mulaiSesi && selesaiSesi ? (now < mulaiSesi ? 'belum' : now > selesaiSesi ? 'tutup' : 'buka') : null
  const keteranganSesi = !s || !mulaiSesi || !selesaiSesi ? ''
    : fase === 'buka' ? `Ditutup ${s.jamSelesai} · sisa ${formatDurasi(Math.max(1, Math.round((selesaiSesi.getTime() - now.getTime()) / 60000)))}`
      : fase === 'belum' ? `Dibuka ${s.jamMulai} · ${formatDurasi(Math.round((mulaiSesi.getTime() - now.getTime()) / 60000))} lagi`
        : `Sudah ditutup pukul ${s.jamSelesai}`

  // Ringkasan gedung 30 hari: dari total sesi wajib, bukan rata-rata persentase per orang
  const total = rekapPenghuni.reduce((t, r) => ({ hadir: t.hadir + r.c.Hadir, wajib: t.wajib + r.c.wajib }), { hadir: 0, wajib: 0 })
  const persenGedung = total.wajib > 0 ? Math.round((total.hadir / total.wajib) * 100) : 0

  // Penghuni yang perlu diperhatikan pada sesi terpilih: belum presensi selama sesi buka, tidak hadir setelah tutup
  const perhatian = fase === 'belum' ? [] : rows.filter(r => r.detail.status === (fase === 'tutup' ? 'Tidak Hadir' : 'Belum'))
    .sort((a, b) => a.penghuni.nama.localeCompare(b.penghuni.nama))
  const persenSesi = rows.length > 0 ? Math.round((c.Hadir / rows.length) * 100) : 0

  const izinTerdekat = [...pendingIzin].sort((a, b) => a.tanggal.localeCompare(b.tanggal))[0]
  const tindakan = [
    fotoMenunggu > 0 && { kunci: 'foto', ikon: <Camera className="w-4 h-4 text-amber-600" />, jumlah: fotoMenunggu, judul: 'Foto presensi menunggu validasi', ket: 'Periksa kecocokan wajah penghuni', aksi: 'Validasi', onClick: onLihatFoto },
    pendingIzin.length > 0 && { kunci: 'izin', ikon: <FileCheck className="w-4 h-4 text-amber-700" />, jumlah: pendingIzin.length, judul: 'Izin menunggu keputusan', ket: `Terdekat: ${izinTerdekat.namaPenghuni}, ${formatRentangTanggal(izinTerdekat.tanggal, izinTerdekat.tanggalSelesai)}`, aksi: 'Tinjau', onClick: onLihatIzin },
    sering.length > 0 && { kunci: 'alpa', ikon: <AlertCircle className="w-4 h-4 text-rose-600" />, jumlah: sering.length, judul: 'Penghuni sering tidak hadir', ket: `≥ ${batasTidakHadir} sesi dalam 30 hari terakhir`, aksi: 'Lihat', onClick: onLihatRekap },
  ].filter(Boolean) as { kunci: string; ikon: React.ReactNode; jumlah: number; judul: string; ket: string; aksi: string; onClick: () => void }[]

  const kartuCls = 'bg-white rounded-2xl border border-gray-200 shadow-2xs'
  const judulKartu = 'font-bold text-sm text-gray-900'

  return (
    <div className="space-y-5">
      {/* Header: sapaan, gedung, dan ringkasan singkat */}
      <div className="rounded-2xl bg-gradient-to-br from-[#0f3e2d] via-[#17603d] to-[#27a150] text-white p-5 sm:p-6 shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div>
            <p className="text-xs font-semibold text-emerald-200">{formatTanggal(today)}</p>
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight mt-0.5" style={{ fontFamily: 'Plus Jakarta Sans' }}>
              {salam(now)}, {namaFasil.split(' ')[0]}
            </h2>
            <p className="text-sm text-emerald-100/90 mt-1 flex items-center gap-1.5">
              <Building2 className="w-4 h-4" />
              Penanggung jawab {gedung.nama}
            </p>
            {liburHariIni && (
              <span className="inline-flex items-center gap-1.5 mt-3 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-900">
                <Palmtree className="w-3.5 h-3.5" /> Hari ini libur: {liburHariIni.keterangan}
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:w-[420px]">
            {[
              { label: 'Penghuni', nilai: jumlahPenghuni, ket: 'wajib absen' },
              { label: 'Kehadiran', nilai: `${persenGedung}%`, ket: '30 hari terakhir' },
              { label: 'Sedang izin', nilai: izinHariIni.length, ket: 'hari ini' },
            ].map(x => (
              <div key={x.label} className="rounded-xl bg-white/10 border border-white/15 px-3 py-2.5">
                <p className="text-[11px] font-semibold text-emerald-200">{x.label}</p>
                <p className="text-xl font-extrabold leading-tight" style={{ fontFamily: 'Plus Jakarta Sans' }}>{x.nilai}</p>
                <p className="text-[10px] text-emerald-100/70">{x.ket}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Sesi hari ini */}
        <div className={`${kartuCls} p-5 lg:col-span-2`}>
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
            <div>
              <p className={judulKartu} style={{ fontFamily: 'Plus Jakarta Sans' }}>Pantauan Sesi Hari Ini</p>
              {s && (
                <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5">
                  {fase === 'buka' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
                  <span className={fase === 'buka' ? 'font-semibold text-emerald-700' : ''}>
                    Sesi {sesi} {fase === 'buka' ? 'sedang dibuka' : fase === 'belum' ? 'belum dibuka' : 'ditutup'}
                  </span>
                  <span>· {keteranganSesi}</span>
                </p>
              )}
            </div>
            <SesiToggle sesiList={sesiList} value={sesi} onChange={setSesi} />
          </div>

          {rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">{liburHariIni ? 'Hari ini libur, tidak ada sesi wajib.' : 'Tidak ada sesi wajib untuk ditampilkan.'}</p>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
                <span className="text-5xl font-extrabold text-gray-900 leading-none" style={{ fontFamily: 'Plus Jakarta Sans' }}>{persenSesi}%</span>
                <span className="text-sm text-gray-500 pb-1">hadir · <strong className="text-gray-800">{c.Hadir}</strong> dari {rows.length} penghuni pada sesi {sesi}</span>
              </div>

              <BilahKomposisi
                bagian={[
                  { label: 'Hadir', nilai: c.Hadir, warna: WARNA_STATUS_GRAFIK.Hadir },
                  { label: 'Izin & libur', nilai: c.Izin + c.Libur, warna: WARNA_STATUS_GRAFIK.Izin },
                  { label: 'Tidak hadir', nilai: c['Tidak Hadir'], warna: WARNA_STATUS_GRAFIK['Tidak Hadir'] },
                  { label: 'Belum presensi', nilai: c.Belum, warna: '#d1d5db', teksGelap: true },
                ]}
              />

                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <p className="text-xs font-semibold text-gray-700">
                      {fase === 'tutup' ? 'Tidak hadir' : 'Belum presensi'} ({perhatian.length})
                    </p>
                    <button
                      type="button"
                      onClick={() => onLihatMonitor(sesi, perhatian.length > 0 ? (fase === 'tutup' ? 'Tidak Hadir' : 'Belum') : '')}
                      className="text-[11px] font-bold text-emerald-700 hover:underline cursor-pointer flex items-center gap-0.5 shrink-0"
                    >
                      {perhatian.length > 0 ? 'Lihat semua di Monitor' : 'Buka Monitor Presensi'}
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {perhatian.length === 0 ? (
                    <p className="text-xs text-emerald-700 font-medium flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" />
                      {fase === 'belum' ? 'Sesi belum dibuka.' : 'Semua penghuni sudah tercatat.'}
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {perhatian.slice(0, 12).map(r => (
                        <button
                          key={r.penghuni.nim}
                          type="button"
                          onClick={() => onKoreksi(r, sesi)}
                          title={`Koreksi presensi ${r.penghuni.nama}`}
                          className={`px-2 py-1 rounded-md text-[11px] font-semibold border cursor-pointer transition-colors ${fase === 'tutup' ? 'bg-rose-50 border-rose-200 text-rose-800 hover:bg-rose-100' : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'}`}
                        >
                          {r.penghuni.nama} <span className="mono text-gray-400 font-normal">· {r.penghuni.nomorKamar}</span>
                        </button>
                      ))}
                      {perhatian.length > 12 && (
                        <button
                          type="button"
                          onClick={() => onLihatMonitor(sesi, fase === 'tutup' ? 'Tidak Hadir' : 'Belum')}
                          className="px-2 py-1 rounded-md text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                        >
                          +{perhatian.length - 12} lainnya
                        </button>
                      )}
                    </div>
                  )}
                </div>
            </div>
          )}
        </div>

        {/* Perlu tindakan */}
        <div className={`${kartuCls} p-5`}>
          <p className={`${judulKartu} mb-3`} style={{ fontFamily: 'Plus Jakarta Sans' }}>Perlu Tindakan</p>
          {tindakan.length === 0 ? (
            <div className="py-6 text-center">
              <CheckCircle2 className="w-9 h-9 text-emerald-500 mx-auto mb-2" />
              <p className="text-sm font-semibold text-gray-800">Semua beres</p>
              <p className="text-xs text-gray-500 mt-0.5">Tidak ada yang perlu ditindaklanjuti.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {tindakan.map(t => (
                <button
                  key={t.kunci}
                  type="button"
                  onClick={t.onClick}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-left cursor-pointer transition-colors"
                >
                  <div className="w-9 h-9 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center shrink-0">{t.ikon}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-gray-900"><span className="text-base mr-1">{t.jumlah}</span>{t.judul}</p>
                    <p className="text-[11px] text-gray-500 truncate">{t.ket}</p>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-700 shrink-0 flex items-center gap-0.5">{t.aksi}<ChevronRight className="w-3.5 h-3.5" /></span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Tren kehadiran gedung: 7 hari / 12 minggu / 6 bulan */}
        <div className={`${kartuCls} p-5 lg:col-span-2`}>{panelTren}</div>

        {/* Hari ini: izin & event */}
        <div className={`${kartuCls} p-5 space-y-5`}>
          <div>
            <p className={`${judulKartu} mb-2`} style={{ fontFamily: 'Plus Jakarta Sans' }}>Sedang Izin Hari Ini</p>
            {izinHariIni.length === 0 ? (
              <p className="text-xs text-gray-400">Tidak ada penghuni yang sedang izin.</p>
            ) : (
              <ul className="space-y-1.5">
                {izinHariIni.slice(0, 5).map(i => (
                  <li key={i.id} className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-gray-800 truncate">{i.namaPenghuni}</span>
                    <span className="text-gray-500 shrink-0">s/d {formatTanggal(i.tanggalSelesai || i.tanggal, 'tanpaHari')}</span>
                  </li>
                ))}
                {izinHariIni.length > 5 && (
                  <li><button type="button" onClick={onLihatIzin} className="text-[11px] font-semibold text-emerald-700 hover:underline cursor-pointer">+{izinHariIni.length - 5} lainnya</button></li>
                )}
              </ul>
            )}
          </div>

          <div className="pt-4 border-t border-gray-100">
            <p className={`${judulKartu} mb-2`} style={{ fontFamily: 'Plus Jakarta Sans' }}>Event Berikutnya</p>
            {eventBerikutnya ? (
              <button type="button" onClick={onLihatEvent} className="w-full text-left rounded-xl border border-emerald-100 bg-emerald-50/50 hover:bg-emerald-50 p-3 cursor-pointer transition-colors">
                <p className="text-sm font-bold text-gray-900 truncate">{eventBerikutnya.judul}</p>
                <p className="text-[11px] text-gray-600 mt-1 flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5 text-emerald-700" />
                  {eventBerikutnya.tanggal === today ? 'Hari ini' : formatTanggal(eventBerikutnya.tanggal, 'tanpaHari')} · {eventBerikutnya.jamMulai}–{eventBerikutnya.jamSelesai}
                </p>
                <p className="text-[11px] text-gray-600 mt-0.5 flex items-center gap-1.5 truncate">
                  <MapPin className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                  {eventBerikutnya.lokasi}
                </p>
              </button>
            ) : (
              <p className="text-xs text-gray-400">Belum ada event terjadwal.</p>
            )}
          </div>
        </div>
      </div>

      {/* Daftar lengkap penghuni sengaja tidak ditampilkan di dashboard (bisa ratusan baris + foto);
          tempatnya di tab Monitor Presensi yang punya pencarian, filter, dan pembagian halaman */}
    </div>
  )
}

// Filter status di Monitor; urutannya mendahulukan yang perlu tindakan
const STATUS_MONITOR: PresensiStatus[] = ['Belum', 'Tidak Hadir', 'Hadir', 'Izin', 'Libur']

// Tempat data presensi lengkap per tanggal & sesi; dirancang untuk gedung berpenghuni ratusan
// (pencarian, filter status, dan pembagian halaman)
function FasilMonitor({ sesiList, rekapRows, today, onKoreksi, awal }: {
  sesiList: Sesi[]
  rekapRows: (tanggal: string, sesi: string) => RekapRow[]
  today: string
  onKoreksi: (row: RekapRow, tanggal: string, sesi: string) => void
  // Dibuka dari dashboard: sesi & status yang langsung dipilih
  awal?: { sesi: string; status: PresensiStatus | '' } | null
}) {
  const [tanggal, setTanggal] = useState(today)
  const [pilihan, setSesi] = useState(awal?.sesi ?? '')
  const sesi = sesiList.some(x => x.nama === pilihan) ? pilihan : sesiList[0]?.nama || ''
  const [filterStatus, setFilterStatus] = useState<PresensiStatus | ''>(awal?.status ?? '')
  const [cari, setCari] = useState('')

  const rows = rekapRows(tanggal, sesi)
  const kata = cari.trim().toLowerCase()
  const dicari = kata ? rows.filter(r => `${r.penghuni.nama} ${r.penghuni.nim} ${r.penghuni.nomorKamar}`.toLowerCase().includes(kata)) : rows
  const filtered = filterStatus ? dicari.filter(r => r.detail.status === filterStatus) : dicari
  const jumlah = (s: PresensiStatus) => dicari.filter(r => r.detail.status === s).length

  // Ubin status = ringkasan angka sekaligus penyaring (menggantikan kartu angka + chip filter)
  const ubin: { status: PresensiStatus | ''; label: string; ikon: ReactNode; warna: string; aktifCls: string }[] = [
    { status: '', label: 'Semua', ikon: <Users className="w-4 h-4" />, warna: 'bg-gray-100 text-gray-600', aktifCls: 'border-gray-800 ring-2 ring-gray-800/10' },
    { status: 'Hadir', label: 'Hadir', ikon: <CheckCircle2 className="w-4 h-4" />, warna: 'bg-emerald-50 text-emerald-700', aktifCls: 'border-emerald-500 ring-2 ring-emerald-500/20' },
    { status: 'Belum', label: 'Belum absen', ikon: <Clock className="w-4 h-4" />, warna: 'bg-gray-100 text-gray-600', aktifCls: 'border-gray-500 ring-2 ring-gray-500/15' },
    { status: 'Tidak Hadir', label: 'Tidak hadir', ikon: <XCircle className="w-4 h-4" />, warna: 'bg-rose-50 text-rose-600', aktifCls: 'border-rose-400 ring-2 ring-rose-400/20' },
    { status: 'Izin', label: 'Izin', ikon: <FileCheck className="w-4 h-4" />, warna: 'bg-amber-50 text-amber-700', aktifCls: 'border-amber-400 ring-2 ring-amber-400/20' },
    { status: 'Libur', label: 'Libur', ikon: <Palmtree className="w-4 h-4" />, warna: 'bg-slate-100 text-slate-600', aktifCls: 'border-slate-400 ring-2 ring-slate-400/20' },
  ]
  const ubinAktif = ubin.find(u => u.status === filterStatus)

  return (
    <div className="space-y-5">
      {/* Filter dalam satu kartu */}
      <div className="bg-white rounded-2xl border border-gray-200/90 shadow-2xs px-5 py-4 flex flex-col xl:flex-row xl:items-center gap-3">
        <div className="xl:mr-auto">
          <h3 className="text-base font-extrabold text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>Pantauan Presensi</h3>
          <p className="text-xs text-gray-500">{formatTanggal(tanggal)} · Sesi {sesi || '–'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DateInput
            max={today}
            className="px-3.5 py-2.5 rounded-xl border border-gray-200 hover:border-gray-300 bg-[#fff] text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 transition-all font-medium text-gray-700"
            value={tanggal}
            onChange={e => setTanggal(e.target.value)}
          />
          <SesiToggle sesiList={sesiList} value={sesi} onChange={setSesi} />
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={cari}
              onChange={e => setCari(e.target.value)}
              placeholder="Cari nama, NIM, atau kamar..."
              aria-label="Cari penghuni"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 bg-[#fff] text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 transition-all placeholder:text-gray-400"
            />
          </div>
        </div>
      </div>

      {/* Ubin status */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3" role="tablist" aria-label="Saring status presensi">
        {ubin.map(u => {
          const aktif = filterStatus === u.status
          return (
            <button
              key={u.status || 'semua'}
              type="button"
              role="tab"
              aria-selected={aktif}
              onClick={() => setFilterStatus(u.status)}
              className={`text-left bg-[#fff] rounded-2xl border p-3.5 shadow-2xs transition-all cursor-pointer hover:-translate-y-0.5 hover:shadow-md ${aktif ? u.aktifCls : 'border-gray-200/90'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-gray-600 truncate">{u.label}</span>
                <span className={`w-7 h-7 shrink-0 rounded-lg flex items-center justify-center ${u.warna}`}>{u.ikon}</span>
              </div>
              <p className="mt-1 text-2xl font-extrabold text-gray-900 tabular-nums" style={{ fontFamily: 'Plus Jakarta Sans' }}>{u.status ? jumlah(u.status) : dicari.length}</p>
            </button>
          )
        })}
      </div>

      <div className="bg-white rounded-2xl overflow-hidden border border-gray-200/90 shadow-2xs">
        <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h3 className="text-base font-extrabold text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>
            {filterStatus ? ubinAktif?.label : 'Semua Penghuni'} <span className="text-gray-400 font-semibold">· {filtered.length} penghuni</span>
          </h3>
          <p className="text-xs text-gray-500">Yang perlu perhatian (tidak hadir, belum absen) tampil lebih dulu</p>
        </div>
        <RekapTableBerhalaman
          rows={filtered}
          kunciReset={`${tanggal}|${sesi}|${filterStatus}|${kata}`}
          onKoreksi={row => onKoreksi(row, tanggal, sesi)}
          emptyText={kata ? 'Tidak ada penghuni yang cocok dengan pencarian' : 'Tidak ada penghuni untuk filter yang dipilih'}
        />
      </div>
    </div>
  )
}

function FasilIzin({ izinData, onSelect }: { izinData: IzinRecord[]; onSelect: (i: IzinRecord) => void }) {
  const today = todayLocal()
  const saring = useSaringIzin(izinData, 'Pending')
  // Menunggu: tanggal izin terdekat dulu (paling mendesak); status lain: terbaru dulu
  const daftar = [...saring.hasil].sort((a, b) => saring.status === 'Pending'
    ? a.tanggal.localeCompare(b.tanggal) || a.id - b.id
    : b.tanggal.localeCompare(a.tanggal) || b.id - a.id)
  const chipCls = 'inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold border'

  // Ubin status = ringkasan angka sekaligus tab penyaring
  const ubin: { status: StatusSaring; label: string; ket: string; ikon: ReactNode; warna: string; aktifCls: string }[] = [
    { status: 'Pending', label: 'Menunggu', ket: 'Perlu keputusan', ikon: <Clock className="w-4 h-4" />, warna: 'bg-amber-50 text-amber-700', aktifCls: 'border-amber-400 ring-2 ring-amber-400/20' },
    { status: 'Disetujui', label: 'Disetujui', ket: 'Izin diterima', ikon: <CheckCircle2 className="w-4 h-4" />, warna: 'bg-emerald-50 text-emerald-700', aktifCls: 'border-emerald-500 ring-2 ring-emerald-500/20' },
    { status: 'Ditolak', label: 'Ditolak', ket: 'Izin tidak diterima', ikon: <XCircle className="w-4 h-4" />, warna: 'bg-rose-50 text-rose-600', aktifCls: 'border-rose-400 ring-2 ring-rose-400/20' },
    { status: 'Semua', label: 'Semua', ket: 'Seluruh pengajuan', ikon: <FileCheck className="w-4 h-4" />, warna: 'bg-gray-100 text-gray-600', aktifCls: 'border-gray-800 ring-2 ring-gray-800/10' },
  ]

  return (
    <div className="space-y-5">
      {/* Ubin status */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" role="tablist" aria-label="Saring status izin">
        {ubin.map(u => {
          const aktif = saring.status === u.status
          return (
            <button
              key={u.status}
              type="button"
              role="tab"
              aria-selected={aktif}
              onClick={() => saring.setStatus(u.status)}
              className={`text-left bg-[#fff] rounded-2xl border p-4 shadow-2xs transition-all cursor-pointer hover:-translate-y-0.5 hover:shadow-md ${aktif ? u.aktifCls : 'border-gray-200/90'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-gray-600">{u.label}</span>
                <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${u.warna}`}>{u.ikon}</span>
              </div>
              <p className="mt-1 text-2xl font-extrabold text-gray-900 tabular-nums" style={{ fontFamily: 'Plus Jakarta Sans' }}>{saring.jumlah[u.status]}</p>
              <p className="text-[11px] text-gray-400">{u.ket}</p>
            </button>
          )
        })}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200/90 shadow-2xs overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h3 className="text-base font-extrabold text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>
              {saring.status === 'Semua' ? 'Semua Pengajuan' : `Izin ${ubin.find(u => u.status === saring.status)?.label}`}
            </h3>
            <p className="text-xs text-gray-500">{saring.status === 'Pending' ? 'Diurutkan dari tanggal izin terdekat' : 'Diurutkan dari yang terbaru'}</p>
          </div>
          <BarisSaringIzin saring={saring} tanpaStatus />
        </div>

        <div className="p-4 space-y-3">
          {daftar.length === 0 && <KosongSaringIzin saring={saring} teksKosong="Belum ada pengajuan izin dari penghuni gedung ini" />}

          {daftar.map(i => {
            const tampil = TAMPILAN_STATUS_IZIN[i.statusPersetujuan]
            const pending = i.statusPersetujuan === 'Pending'
            // Izin menunggu yang mulai hari ini/besok (atau sudah berjalan) perlu segera diputuskan
            const segera = pending && i.tanggal <= addDays(today, 1)
            const rutin = teksHariBerulang(i.hariBerulang)
            return (
              <div
                key={i.id}
                className={`flex gap-4 p-4 rounded-xl border bg-[#fff] hover:shadow-sm transition-shadow ${pending ? 'border-gray-200 border-l-4 border-l-amber-400' : 'border-gray-200'}`}
              >
                <KotakTanggalIzin izin={i} />

                <div className="min-w-0 flex-1 flex flex-col">
                  {/* Nama + badge (badge turun ke baris berikutnya bila sempit, nama tidak terpotong) */}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="text-sm font-bold text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>{i.namaPenghuni}</p>
                    <span className={`${chipCls} ${tampil.pill}`} style={{ fontFamily: 'Plus Jakarta Sans' }}>{tampil.label}</span>
                    {segera && <span className={`${chipCls} bg-rose-50 border-rose-200 text-rose-700`}>Segera</span>}
                    {i.idIzinSebelumnya != null && <span className={`${chipCls} bg-amber-50 border-amber-300 text-amber-800`}>Pengajuan ulang</span>}
                  </div>
                  <p className="text-[11px] text-gray-500 mt-0.5"><span className="mono">{i.nim}</span> · Kamar {i.nomorKamar || '–'}</p>

                  <p className="text-xs text-gray-500 mt-2">
                    <span className="font-semibold text-gray-800">{formatRentangTanggal(i.tanggal, i.tanggalSelesai)}</span>
                    {' · '}{i.sesi ? `Sesi ${i.sesi}` : 'Seharian'}
                    {rutin && <> · {rutin}</>}
                  </p>
                  <p className="text-sm text-gray-800 leading-snug mt-1 break-words">{i.alasan}</p>
                  {i.catatanSebelumnya && (
                    <p className="text-xs mt-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 text-amber-900 break-words"><span className="font-semibold">Ditolak sebelumnya:</span> {i.catatanSebelumnya}</p>
                  )}
                  {i.catatanApprover && (
                    <p className={`text-xs mt-1.5 px-2.5 py-1.5 rounded-lg break-words ${i.statusPersetujuan === 'Ditolak' ? 'bg-rose-50 text-rose-800' : 'bg-gray-50 text-gray-700'}`}>
                      <span className="font-semibold">Catatan keputusan:</span> {i.catatanApprover}
                    </p>
                  )}

                  <div className="mt-3 pt-3 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 text-[11px] text-gray-500">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
                      {i.fileBukti
                        ? <BuktiIzin fileBukti={i.fileBukti} className="inline-flex items-center gap-1 font-semibold text-slate-700" />
                        : <span className="text-gray-400">Tanpa berkas bukti</span>}
                      {!pending && (
                        <span className="inline-flex items-center gap-1">
                          <User className="w-3 h-3 shrink-0" />
                          {tampil.label} oleh {i.namaApprover || 'fasilitator'}{i.tanggalApproval ? ` · ${formatTanggal(i.tanggalApproval, 'tanpaHari')}` : ''}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => onSelect(i)}
                      className={`sm:ml-auto w-full sm:w-auto px-4 py-2 rounded-lg text-xs font-bold cursor-pointer transition-colors ${pending ? 'text-white bg-[#141a17] hover:bg-[#2a332e]' : 'text-emerald-800 bg-white border border-emerald-200 hover:bg-emerald-50'}`}
                      style={{ fontFamily: 'Plus Jakarta Sans' }}
                    >
                      {pending ? 'Tinjau & Putuskan' : 'Lihat Detail'}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// Antrean validasi foto wajah presensi mandiri penghuni gedung
function FasilValidasiFoto({ records, onValidasi, onTerimaMassal }: {
  records: PresensiRecord[]
  onValidasi: (rec: PresensiRecord, status: Exclude<StatusFoto, 'Menunggu'>, catatan: string) => Promise<string | null>
  onTerimaMassal: (ids: number[]) => Promise<{ ok: boolean; pesan: string }>
}) {
  const [filter, setFilter] = useState<StatusFoto>('Menunggu')
  const filtered = records.filter(r => r.statusFoto === filter)
  const daftarFilter: StatusFoto[] = ['Menunggu', 'Diterima', 'Ditolak']
  // Pilihan untuk terima sekaligus (hanya foto yang masih Menunggu)
  const [pilih, setPilih] = useState<Set<number>>(new Set())
  const [prosesMassal, setProsesMassal] = useState(false)
  const [pesanMassal, setPesanMassal] = useState<{ ok: boolean; teks: string } | null>(null)
  const menunggu = records.filter(r => r.statusFoto === 'Menunggu')
  const terpilih = menunggu.filter(r => pilih.has(r.id)).map(r => r.id)
  const semuaTerpilih = menunggu.length > 0 && terpilih.length === menunggu.length
  const togglePilih = (id: number) => setPilih(prev => {
    const baru = new Set(prev)
    if (baru.has(id)) baru.delete(id)
    else baru.add(id)
    return baru
  })
  const terimaTerpilih = async () => {
    if (terpilih.length === 0) return
    setProsesMassal(true)
    const hasil = await onTerimaMassal(terpilih)
    setProsesMassal(false)
    setPesanMassal({ ok: hasil.ok, teks: hasil.pesan })
    if (hasil.ok) setPilih(new Set())
  }

  // Ubin status = ringkasan angka sekaligus tab penyaring
  const ubin: { status: StatusFoto; ket: string; ikon: ReactNode; warna: string; aktifCls: string }[] = [
    { status: 'Menunggu', ket: 'Perlu diperiksa', ikon: <Clock className="w-4 h-4" />, warna: 'bg-amber-50 text-amber-700', aktifCls: 'border-amber-400 ring-2 ring-amber-400/20' },
    { status: 'Diterima', ket: 'Wajah sesuai', ikon: <CheckCircle2 className="w-4 h-4" />, warna: 'bg-emerald-50 text-emerald-700', aktifCls: 'border-emerald-500 ring-2 ring-emerald-500/20' },
    { status: 'Ditolak', ket: 'Tercatat Tidak Hadir', ikon: <XCircle className="w-4 h-4" />, warna: 'bg-rose-50 text-rose-600', aktifCls: 'border-rose-400 ring-2 ring-rose-400/20' },
  ]
  const kosong = filter === 'Menunggu'
    ? { judul: 'Semua foto sudah divalidasi', ket: 'Foto presensi mandiri penghuni yang baru masuk akan muncul di sini.' }
    : filter === 'Diterima'
      ? { judul: 'Belum ada foto yang diterima', ket: 'Foto yang Anda terima tampil di sini sebagai arsip.' }
      : { judul: 'Belum ada foto yang ditolak', ket: 'Foto yang ditolak membuat presensi tercatat Tidak Hadir.' }

  return (
    <div className="space-y-5">
      {/* Ubin status */}
      <div className="grid grid-cols-3 gap-3" role="tablist" aria-label="Saring status foto">
        {ubin.map(u => {
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
                <span className="text-xs font-semibold text-gray-600">{u.status}</span>
                <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${u.warna}`}>{u.ikon}</span>
              </div>
              <p className="mt-1 text-2xl font-extrabold text-gray-900 tabular-nums" style={{ fontFamily: 'Plus Jakarta Sans' }}>{records.filter(r => r.statusFoto === u.status).length}</p>
              <p className="text-[11px] text-gray-400 truncate">{u.ket}</p>
            </button>
          )
        })}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200/90 shadow-2xs overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base font-extrabold text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>Foto {filter}</h3>
            <p className="text-xs text-gray-500 mt-0.5">Pastikan wajah di foto benar penghuni yang bersangkutan. Foto yang ditolak membuat presensi tercatat Tidak Hadir.</p>
          </div>
        </div>

        {/* Terima sekaligus */}
        {filter === 'Menunggu' && menunggu.length > 0 && (
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/60 flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer select-none">
              <input
                type="checkbox"
                className="w-4 h-4 accent-emerald-700 cursor-pointer"
                checked={semuaTerpilih}
                onChange={() => setPilih(semuaTerpilih ? new Set() : new Set(menunggu.map(r => r.id)))}
              />
              Pilih semua ({menunggu.length})
            </label>
            <span className="text-xs text-gray-500">{terpilih.length} dipilih</span>
            <span className="hidden md:inline text-[11px] text-gray-400">· Foto bermasalah ditolak satu per satu karena wajib disertai catatan</span>
            <button
              onClick={terimaTerpilih}
              disabled={terpilih.length === 0 || prosesMassal}
              className="ml-auto inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#141a17] hover:bg-[#2a332e] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Check className="w-3.5 h-3.5" />
              {prosesMassal ? 'Menyimpan…' : `Terima ${terpilih.length || ''} foto terpilih`}
            </button>
          </div>
        )}
        {pesanMassal && <p className={`px-5 pt-3 text-xs font-semibold ${pesanMassal.ok ? 'text-emerald-700' : 'text-rose-700'}`}>{pesanMassal.teks}</p>}

        <div className="p-5">
          {filtered.length === 0 ? (
            <div className="py-12 flex flex-col items-center text-center">
              <span className={`w-14 h-14 rounded-2xl flex items-center justify-center ${filter === 'Menunggu' ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                {filter === 'Menunggu' ? <CheckCircle2 className="w-7 h-7" /> : <Camera className="w-7 h-7" />}
              </span>
              <p className="mt-3 text-sm font-bold text-gray-800" style={{ fontFamily: 'Plus Jakarta Sans' }}>{kosong.judul}</p>
              <p className="mt-1 text-xs text-gray-500 max-w-sm">{kosong.ket}</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map(r => <KartuValidasiFoto key={r.id} rec={r} onValidasi={onValidasi} dipilih={pilih.has(r.id)} onPilih={() => togglePilih(r.id)} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function KartuValidasiFoto({ rec, onValidasi, dipilih, onPilih }: {
  rec: PresensiRecord
  onValidasi: (rec: PresensiRecord, status: Exclude<StatusFoto, 'Menunggu'>, catatan: string) => Promise<string | null>
  dipilih: boolean
  onPilih: () => void
}) {
  const [catatan, setCatatan] = useState('')
  const [error, setError] = useState('')
  const [proses, setProses] = useState(false)
  const menunggu = rec.statusFoto === 'Menunggu'

  const putuskan = async (status: Exclude<StatusFoto, 'Menunggu'>) => {
    if (status === 'Ditolak' && !catatan.trim()) {
      setError('Catatan wajib diisi saat menolak foto agar penghuni mengetahui alasannya.')
      return
    }
    setProses(true)
    const gagal = await onValidasi(rec, status, catatan.trim())
    setProses(false)
    if (gagal) setError(gagal)
  }

  return (
    <div className={`bg-[#fff] rounded-2xl overflow-hidden border shadow-xs hover:shadow-md transition-shadow flex flex-col ${dipilih ? 'border-emerald-500 ring-2 ring-emerald-500/30' : 'border-gray-200'}`}>
      <div className="relative">
        <FotoWajah foto={rec.fotoWajah} alt={`Foto ${rec.namaPenghuni}`} className="w-full aspect-[4/3]" />
        {menunggu && (
          <label className="absolute top-2 left-2 inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/90 backdrop-blur text-[11px] font-bold text-gray-700 shadow-xs cursor-pointer select-none">
            <input type="checkbox" className="w-3.5 h-3.5 accent-emerald-700 cursor-pointer" checked={dipilih} onChange={onPilih} aria-label={`Pilih foto ${rec.namaPenghuni}`} />
            Pilih
          </label>
        )}
      </div>
      <div className="p-4 space-y-3 flex-1 flex flex-col">
        <div>
          <div className="flex items-center justify-between gap-2">
            <span className="font-extrabold text-sm text-gray-900 truncate" style={{ fontFamily: 'Plus Jakarta Sans' }}>{rec.namaPenghuni}</span>
            {rec.statusFoto && <FotoBadge status={rec.statusFoto} />}
          </div>
          <p className="mono text-xs text-gray-500">{rec.nim} · Kamar {rec.nomorKamar}</p>
          <p className="text-xs text-gray-600 mt-1 font-medium">{formatTanggal(rec.tanggal)} · Sesi {rec.sesi} · {rec.waktu} WIB</p>
          {rec.latitude !== null && rec.longitude !== null && (
            <a href={`https://www.google.com/maps?q=${rec.latitude},${rec.longitude}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-1 text-xs text-slate-700 hover:underline">
              <MapPin className="w-3 h-3" />
              <span className="mono">{Number(rec.latitude).toFixed(5)}, {Number(rec.longitude).toFixed(5)}</span>
              {rec.akurasiMeter != null && <span className="text-gray-500">· ±{Math.round(rec.akurasiMeter)} m</span>}
            </a>
          )}
        </div>

        {menunggu ? (
          <div className="space-y-2 mt-auto">
            <textarea
              rows={2}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 transition-all placeholder:text-gray-400"
              placeholder="Catatan (wajib jika menolak), mis. wajah tidak terlihat"
              value={catatan}
              onChange={e => { setCatatan(e.target.value); setError('') }}
            />
            {error && <p className="text-xs text-rose-700 font-semibold">{error}</p>}
            <div className="flex gap-2">
              <button
                disabled={proses}
                onClick={() => putuskan('Ditolak')}
                className="flex-1 py-2 rounded-xl font-bold text-xs text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <X className="w-3.5 h-3.5" />
                <span>Tolak</span>
              </button>
              <button
                disabled={proses}
                onClick={() => putuskan('Diterima')}
                className="flex-1 py-2 rounded-xl font-bold text-xs text-white bg-[#141a17] hover:bg-[#2a332e] flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Terima</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="text-xs text-gray-600 p-2.5 rounded-xl bg-gray-50 border border-gray-100 mt-auto">
            {rec.namaValidator ? `Divalidasi ${rec.namaValidator}` : 'Divalidasi'}{rec.divalidasiPada ? ` · ${rec.divalidasiPada}` : ''}
            {rec.catatanValidasi && <p className="mt-1 font-medium text-gray-800">Catatan: {rec.catatanValidasi}</p>}
          </div>
        )}
      </div>
    </div>
  )
}

// Rekap kehadiran per penghuni untuk tindak lanjut pelanggaran.
// Ambang "perlu ditegur" diatur admin (pengaturan batas_tidak_hadir) dan dihitung dalam periode yang dipilih.
type UrutanRekap = 'alpa' | 'kehadiran' | 'nama' | 'kamar'

function FasilRekap({ fasil, anggota, sesiList, data, now, batas: BATAS_ALPA, namaGedung }: {
  // Fasil yang mencetak; dicantumkan sebagai penanda tangan laporan
  fasil: CurrentUser
  anggota: Penghuni[]
  sesiList: Sesi[]
  data: DataPresensi
  now: Date
  batas: number
  namaGedung: string
}) {
  const today = todayLocal()
  const [saringPeriode, setSaringPeriode] = useState<SaringPeriode>({ periode: '30', dari: '', sampai: '' })
  const [sesiPilih, setSesiPilih] = useState('')
  const [cari, setCari] = useState('')
  const [urutan, setUrutan] = useState<UrutanRekap>('alpa')
  const [hanyaDitegur, setHanyaDitegur] = useState(false)
  const [dibuka, setDibuka] = useState<string | null>(null)

  // Rentang bebas yang belum valid -> tabel kosong sampai tanggalnya diperbaiki
  const rentang = rentangLaporan(saringPeriode, today)
  const [dari, sampai] = rentang ?? [today, today]
  const namaSesi = [...new Set(sesiAktif(sesiList, namaGedung).map(s => s.nama))]
  const keteranganSaring = rentang
    ? `${labelPeriodeLaporan(saringPeriode, rentang)}${sesiPilih ? ` · Sesi ${sesiPilih}` : ' · Semua sesi'}`
    : 'Pilih rentang tanggal yang valid'

  // Rekap tiap penghuni sejak tanggal masuknya (penghuni baru tidak dihitung alpa sebelum masuk)
  const semua = !rentang ? [] : anggota.map(p => {
    const mulai = p.tanggalMasuk ? maxDate(dari, p.tanggalMasuk) : dari
    const riwayat = mulai <= sampai
      ? riwayatPenghuni(p.nim, mulai, sampai, sesiList, data, now, p.namaGedung).filter(r => !sesiPilih || r.sesi.nama === sesiPilih)
      : []
    return { penghuni: p, c: hitungStatus(riwayat.map(r => r.detail.status)), riwayat }
  })
  const perluDitegur = (c: ReturnType<typeof hitungStatus>) => c['Tidak Hadir'] >= BATAS_ALPA

  const kata = cari.trim().toLowerCase()
  const rows = semua
    .filter(r => !kata || `${r.penghuni.nama} ${r.penghuni.nim} ${r.penghuni.nomorKamar}`.toLowerCase().includes(kata))
    .filter(r => !hanyaDitegur || perluDitegur(r.c))
    .sort((a, b) => {
      switch (urutan) {
        case 'kehadiran': return a.c.persen - b.c.persen || b.c['Tidak Hadir'] - a.c['Tidak Hadir']
        case 'nama': return a.penghuni.nama.localeCompare(b.penghuni.nama)
        case 'kamar': return a.penghuni.nomorKamar.localeCompare(b.penghuni.nomorKamar, 'id', { numeric: true })
        default: return b.c['Tidak Hadir'] - a.c['Tidak Hadir'] || a.c.persen - b.c.persen
      }
    })

  // Ringkasan gedung: persentase dihitung dari total sesi wajib, bukan rata-rata persentase per orang
  const total = semua.reduce((t, r) => ({ hadir: t.hadir + r.c.Hadir, wajib: t.wajib + r.c.wajib, alpa: t.alpa + r.c['Tidak Hadir'], izin: t.izin + r.c.Izin }), { hadir: 0, wajib: 0, alpa: 0, izin: 0 })
  const persenGedung = total.wajib > 0 ? Math.round((total.hadir / total.wajib) * 100) : 0
  const jumlahDitegur = semua.filter(r => perluDitegur(r.c)).length

  // Ekspor mengikuti yang sedang ditampilkan (periode, sesi, pencarian, urutan, filter "perlu ditegur")
  const unduh = (format: ExportFormat) => {
    if (!rentang) return
    const keterangan: [string, string][] = [['Gedung', namaGedung], ['Periode', labelPeriodeLaporan(saringPeriode, rentang)], ['Sesi', sesiPilih || 'Semua sesi']]
    if (kata) keterangan.push(['Pencarian', cari.trim()])
    if (hanyaDitegur) keterangan.push(['Filter', 'Hanya penghuni yang perlu ditegur'])
    const slug = namaGedung.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    void unduhLaporan(`rekap-kehadiran-${slug}${sesiPilih ? `-${sesiPilih.toLowerCase()}` : ''}-${dari}_${sampai}.${format}`, {
      judul: 'Laporan Rekapitulasi Kehadiran Penghuni',
      keterangan,
      headers: ['NIM', 'Nama', 'Kamar', 'Hadir', 'Izin', 'Tidak Hadir', 'Sesi Wajib', 'Kehadiran', 'Catatan'],
      rows: rows.map(({ penghuni: p, c }) => [
        p.nim, p.nama, p.nomorKamar, c.Hadir, c.Izin, c['Tidak Hadir'], c.wajib, c.wajib > 0 ? `${c.persen}%` : '–',
        perluDitegur(c) ? 'Perlu ditegur' : '–',
      ]),
      kolomAngka: [2, 3, 4, 5, 6, 7],
      kolomStatus: 8,
      ringkasan: [['Penghuni', semua.length], ['Tingkat kehadiran', `${persenGedung}%`], ['Tidak hadir', `${total.alpa} sesi`], ['Perlu ditegur', jumlahDitegur]],
      catatan: `Penghuni ditandai "Perlu ditegur" bila tidak hadir sedikitnya ${BATAS_ALPA} sesi pada periode ini. Tingkat kehadiran dihitung dari sesi wajib; hari libur tidak dihitung.`,
      penandatangan: { jabatan: `Fasilitator ${namaGedung}`, nama: fasil.nama, identitas: `NIM. ${fasil.nim}` },
    }, format)
  }

  const saringCls = 'px-3 py-2 rounded-lg border border-gray-300 hover:border-gray-400 text-sm text-gray-800 bg-white outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15 transition-colors placeholder:text-gray-400'

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<BarChart3 className="w-5 h-5 text-emerald-700" />} label="Kehadiran Gedung" value={`${persenGedung}%`} sub={`${total.hadir} dari ${total.wajib} sesi wajib`} color="#141a17" />
        <StatCard icon={<XCircle className="w-5 h-5 text-rose-600" />} label="Total Tidak Hadir" value={total.alpa} sub="sesi" color="#be123c" />
        <StatCard icon={<FileCheck className="w-5 h-5 text-amber-700" />} label="Total Izin" value={total.izin} sub="sesi" color="#b45309" />
        <StatCard icon={<AlertCircle className="w-5 h-5 text-rose-600" />} label="Perlu Ditegur" value={jumlahDitegur} sub={`≥ ${BATAS_ALPA} sesi tidak hadir`} color="#e11d48" />
      </div>

      <div className="grid lg:grid-cols-5 gap-5">
        <div className="bg-white rounded-xl border border-gray-200 shadow-2xs p-5 lg:col-span-3">
          <p className="font-bold text-sm text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>Pola Kehadiran Mingguan</p>
          <p className="text-xs text-gray-500 mt-0.5 mb-4">Tingkat kehadiran per hari dan sesi pada periode ini. Makin gelap makin tinggi; kotak bergaris merah = paling rendah.</p>
          <PetaPanasPola pola={hitungPolaMingguan(semua.flatMap(r => r.riwayat))} />
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-2xs p-5 lg:col-span-2">
          <p className="font-bold text-sm text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>Sebaran Tingkat Kehadiran</p>
          <p className="text-xs text-gray-500 mt-0.5 mb-3">Jumlah penghuni pada tiap rentang tingkat kehadiran</p>
          <HistogramSebaran persen={semua.filter(r => r.c.wajib > 0).map(r => r.c.persen)} />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden">
        <div className="px-5 pt-4 pb-4 border-b border-gray-100 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <SectionTitle subtitle={`${keteranganSaring}. Klik nama penghuni untuk melihat tanggal tidak hadir & izinnya.`}>
              Rekap Kehadiran Penghuni
            </SectionTitle>
            <div className="flex gap-2 shrink-0">
              {([['xlsx', 'Excel'], ['pdf', 'PDF']] as const).map(([format, label]) => (
                <button
                  key={format}
                  onClick={() => unduh(format)}
                  disabled={rows.length === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-emerald-800 bg-white border border-emerald-200 hover:bg-emerald-700 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                  title={`Unduh rekap yang ditampilkan sebagai ${label}`}
                >
                  <Download className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input type="search" value={cari} onChange={e => setCari(e.target.value)} placeholder="Cari nama, NIM, atau kamar..." aria-label="Cari penghuni" className={`${saringCls} w-full pl-9`} />
            </div>
            <div className="flex flex-wrap gap-2">
              <PilihPeriodeLaporan nilai={saringPeriode} onChange={setSaringPeriode} today={today} className={saringCls} />
              <select value={sesiPilih} onChange={e => setSesiPilih(e.target.value)} aria-label="Sesi" className={saringCls}>
                <option value="">Semua sesi</option>
                {namaSesi.map(n => <option key={n} value={n}>Sesi {n}</option>)}
              </select>
              <select value={urutan} onChange={e => setUrutan(e.target.value as UrutanRekap)} aria-label="Urutkan" className={saringCls}>
                <option value="alpa">Tidak hadir terbanyak</option>
                <option value="kehadiran">Kehadiran terendah</option>
                <option value="nama">Nama (A–Z)</option>
                <option value="kamar">Nomor kamar</option>
              </select>
            </div>
          </div>

          <label className="inline-flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer select-none">
            <input type="checkbox" className="accent-rose-600 w-4 h-4" checked={hanyaDitegur} onChange={e => setHanyaDitegur(e.target.checked)} />
            Hanya yang perlu ditegur ({jumlahDitegur})
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {['Penghuni', 'Kamar', 'Hadir', 'Izin', 'Tidak Hadir', 'Kehadiran', 'Catatan'].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-600" style={{ fontFamily: 'Plus Jakarta Sans' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-sm text-gray-400">
                  {anggota.length === 0 ? 'Belum ada penghuni wajib absen di gedung ini' : 'Tidak ada penghuni yang cocok dengan filter'}
                </td></tr>
              )}
              {rows.map(({ penghuni: p, c, riwayat }) => {
                const ditegur = perluDitegur(c)
                const terbuka = dibuka === p.nim
                const alpa = riwayat.filter(r => r.detail.status === 'Tidak Hadir')
                const izin = riwayat.filter(r => r.detail.status === 'Izin')
                return (
                  <Fragment key={p.nim}>
                    <tr className={`${ditegur ? 'bg-rose-50/50' : ''} hover:bg-gray-50 cursor-pointer`} onClick={() => setDibuka(terbuka ? null : p.nim)}>
                      <td className="px-5 py-3">
                        <button type="button" aria-expanded={terbuka} className="text-left cursor-pointer">
                          <p className="font-bold text-gray-900 flex items-center gap-1" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                            <ChevronRight className={`w-3.5 h-3.5 text-gray-400 transition-transform ${terbuka ? 'rotate-90' : ''}`} />
                            {p.nama}
                          </p>
                          <p className="mono text-[11px] text-gray-500 pl-[18px]">{p.nim}</p>
                        </button>
                      </td>
                      <td className="px-5 py-3 mono text-xs font-bold text-emerald-800">{p.nomorKamar}</td>
                      <td className="px-5 py-3 font-semibold text-emerald-700">{c.Hadir}</td>
                      <td className="px-5 py-3 font-semibold text-amber-700">{c.Izin}</td>
                      <td className="px-5 py-3 font-semibold text-rose-700">{c['Tidak Hadir']}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                            <div className={`h-full ${c.persen >= 80 ? 'bg-emerald-600' : c.persen >= 60 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${c.persen}%` }} />
                          </div>
                          <span className="text-xs font-bold text-gray-700">{c.wajib > 0 ? `${c.persen}%` : '–'}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-xs">
                        {ditegur ? <span className="font-bold text-rose-700">Perlu ditegur</span> : <span className="text-gray-400">–</span>}
                      </td>
                    </tr>
                    {terbuka && (
                      <tr className="bg-gray-50/70">
                        <td colSpan={7} className="px-5 py-3">
                          <div className="grid sm:grid-cols-2 gap-4 text-xs">
                            {([['Tidak hadir', alpa, 'bg-rose-50 border-rose-200 text-rose-800'], ['Izin', izin, 'bg-amber-50 border-amber-200 text-amber-800']] as const).map(([judul, daftar, warna]) => (
                              <div key={judul}>
                                <p className="font-bold text-gray-700 mb-1.5">{judul} ({daftar.length} sesi)</p>
                                {daftar.length === 0 ? <p className="text-gray-400">Tidak ada</p> : (
                                  <div className="flex flex-wrap gap-1.5">
                                    {daftar.map(r => (
                                      <span key={`${r.tanggal}-${r.sesi.nama}`} className={`px-2 py-0.5 rounded-md border font-semibold ${warna}`}>
                                        {formatTanggal(r.tanggal, 'tanpaHari')} · {r.sesi.nama}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// Catatan yang sering dipakai fasil; diklik untuk mengisi kolom catatan
const CATATAN_CEPAT = [
  'Lampirkan surat keterangan dokter.',
  'Alasan kurang jelas, mohon dilengkapi.',
  'Diajukan terlalu mendadak.',
  'Hati-hati di jalan.',
]

function IzinModal({ izin, izinLain, onClose, onDecide }: {
  izin: IzinRecord
  // Izin lain milik penghuni yang sama, sebagai bahan pertimbangan
  izinLain: IzinRecord[]
  onClose: () => void
  onDecide: (id: number, status: 'Disetujui' | 'Ditolak', catatan: string) => Promise<string | null>
}) {
  const [catatan, setCatatan] = useState('')
  const [error, setError] = useState('')
  const [proses, setProses] = useState<'Disetujui' | 'Ditolak' | null>(null)
  const pending = izin.statusPersetujuan === 'Pending'
  const riwayat = {
    Disetujui: izinLain.filter(i => i.statusPersetujuan === 'Disetujui').length,
    Ditolak: izinLain.filter(i => i.statusPersetujuan === 'Ditolak').length,
    Pending: izinLain.filter(i => i.statusPersetujuan === 'Pending').length,
  }

  const putuskan = async (status: 'Disetujui' | 'Ditolak') => {
    if (status === 'Ditolak' && !catatan.trim()) {
      setError('Alasan penolakan wajib diisi agar penghuni mengetahui alasannya.')
      return
    }
    setError('')
    setProses(status)
    const pesan = await onDecide(izin.id, status, catatan.trim())
    // Berhasil: modal ditutup oleh induk. Gagal: tampilkan pesan server dan biarkan fasil mencoba lagi
    if (pesan) {
      setError(pesan)
      setProses(null)
    }
  }

  const isiCatatan = (teks: string) => {
    setCatatan(prev => (prev.trim() ? `${prev.trim()} ${teks}` : teks))
    setError('')
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
      {/* bg-[#fff], bukan bg-white: tema kaca (index.css) membuat .bg-white di modal tembus pandang dan tampak kusam */}
      <div className="bg-[#fff] rounded-2xl w-full max-w-lg p-6 shadow-2xl border border-emerald-100 max-h-[92vh] overflow-y-auto">
        <div className="modal-header flex items-center justify-between gap-3 -mx-6 -mt-6 px-6 py-4 border-b border-gray-100 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 shrink-0 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>Detail Pengajuan Izin</h3>
              <p className="text-xs text-gray-400">Verifikasi berkas dan alasan ketidakhadiran</p>
            </div>
          </div>
          <button onClick={onClose} disabled={proses !== null} aria-label="Tutup" className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer disabled:opacity-40">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3.5 mb-5">
          <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100 space-y-2 text-sm">
            {[
              ['Mahasiswa', izin.namaPenghuni],
              ['NIM', izin.nim],
              ['Kamar', izin.nomorKamar],
              ['Berlaku', formatRentangIzin(izin.tanggal, izin.tanggalSelesai, izin.sesi, izin.hariBerulang)],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between items-center gap-3">
                <span className="text-gray-500 font-medium">{k}</span>
                <span className="font-bold text-gray-900 text-right">{v}</span>
              </div>
            ))}
            <div className="flex justify-between items-center">
              <span className="text-gray-500 font-medium">Status Saat Ini</span>
              <Badge status={izin.statusPersetujuan} />
            </div>
            <div className="flex justify-between items-start gap-3 pt-2 border-t border-gray-200/70">
              <span className="text-gray-500 font-medium">Izin lain penghuni ini</span>
              <span className="text-xs text-right text-gray-700">
                {izinLain.length === 0
                  ? 'Belum pernah mengajukan'
                  : <><strong className="text-emerald-700">{riwayat.Disetujui}</strong> disetujui · <strong className="text-rose-700">{riwayat.Ditolak}</strong> ditolak · <strong className="text-amber-700">{riwayat.Pending}</strong> menunggu</>}
              </span>
            </div>
          </div>

          {izin.idIzinSebelumnya != null && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
              <p className="font-bold mb-0.5">Pengajuan ulang dari izin yang ditolak</p>
              {izin.catatanSebelumnya
                ? <p><span className="font-semibold">Catatan penolakan sebelumnya:</span> {izin.catatanSebelumnya}</p>
                : <p>Periksa apakah kekurangan pada pengajuan sebelumnya sudah dilengkapi.</p>}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-emerald-900 mb-1" style={{ fontFamily: 'Plus Jakarta Sans' }}>Alasan Permohonan Izin:</label>
            <div className="p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-100 text-sm text-gray-800 leading-relaxed font-medium">{izin.alasan}</div>
          </div>

          {izin.fileBukti && (
            <BuktiIzin fileBukti={izin.fileBukti} className="w-full flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-slate-700 text-xs font-semibold text-left" />
          )}

          {!pending && izin.catatanApprover && (
            <div className="p-3 rounded-xl bg-gray-50 border border-gray-100 text-xs text-gray-700">
              Catatan {izin.namaApprover}: {izin.catatanApprover}
            </div>
          )}
        </div>

        {pending ? (
          <div className="space-y-3 pt-3 border-t border-gray-100">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                Catatan untuk Penghuni (wajib jika menolak)
              </label>
              <textarea
                rows={2}
                disabled={proses !== null}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 transition-all font-medium placeholder:text-gray-400 disabled:opacity-60"
                placeholder="Contoh: Lampirkan surat keterangan dokter..."
                value={catatan}
                onChange={e => { setCatatan(e.target.value); setError('') }}
              />
              <div className="flex flex-wrap gap-1.5 mt-2">
                {CATATAN_CEPAT.map(teks => (
                  <button
                    key={teks}
                    type="button"
                    disabled={proses !== null}
                    onClick={() => isiCatatan(teks)}
                    className="px-2 py-1 rounded-md text-[11px] font-semibold text-gray-600 bg-gray-50 border border-gray-200 hover:border-emerald-300 hover:text-emerald-800 cursor-pointer transition-colors disabled:opacity-50"
                  >
                    + {teks}
                  </button>
                ))}
              </div>
              {error && (
                <p role="alert" className="text-xs text-rose-700 font-semibold mt-2 p-2.5 rounded-lg bg-rose-50 border border-rose-100">{error}</p>
              )}
            </div>
            <div className="flex gap-3">
              <button
                disabled={proses !== null}
                className="flex-1 py-2.5 px-4 rounded-xl font-bold text-sm text-rose-700 bg-rose-50 hover:bg-rose-100 transition-colors border border-rose-200 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                onClick={() => putuskan('Ditolak')}
              >
                <X className="w-4 h-4" />
                <span>{proses === 'Ditolak' ? 'Menyimpan...' : 'Tolak Izin'}</span>
              </button>
              <button
                disabled={proses !== null}
                className="flex-1 py-2.5 px-4 rounded-xl font-bold text-sm text-white bg-emerald-700 hover:bg-emerald-800 transition-colors shadow-sm flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                onClick={() => putuskan('Disetujui')}
              >
                <Check className="w-4 h-4" />
                <span>{proses === 'Disetujui' ? 'Menyimpan...' : 'Setujui Izin'}</span>
              </button>
            </div>
          </div>
        ) : (
          <button className="w-full py-2.5 rounded-xl font-bold text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer" onClick={onClose}>
            Tutup Jendela
          </button>
        )}
      </div>
    </div>
  )
}

function KoreksiModal({ target, onClose, onSave }: {
  target: KoreksiTarget
  onClose: () => void
  onSave: (status: PresensiStatus, keterangan: string) => Promise<string | null>
}) {
  const current = target.row.detail.status
  const [status, setStatus] = useState<PresensiStatus>(current === 'Hadir' ? 'Hadir' : current === 'Izin' ? 'Izin' : 'Hadir')
  const [keterangan, setKeterangan] = useState('')
  const [error, setError] = useState('')

  const [menyimpan, setMenyimpan] = useState(false)
  const simpan = async () => {
    if (!keterangan.trim()) {
      setError('Keterangan koreksi wajib diisi sebagai catatan audit.')
      return
    }
    setMenyimpan(true)
    const galat = await onSave(status, keterangan.trim())
    setMenyimpan(false)
    if (galat) setError(galat)
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl border border-emerald-100">
        <div className="modal-header flex items-center justify-between gap-3 -mx-6 -mt-6 px-6 py-4 border-b border-gray-100 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 shrink-0 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center">
              <Pencil className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>Koreksi Presensi</h3>
              <p className="text-xs text-gray-400">{target.row.penghuni.nama} · {formatTanggal(target.tanggal)} · Sesi {target.sesi}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500 font-medium">Status saat ini</span>
            <Badge status={current} />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5" style={{ fontFamily: 'Plus Jakarta Sans' }}>Ubah Menjadi</label>
            <div className="grid grid-cols-3 gap-2">
              {(['Hadir', 'Izin', 'Tidak Hadir'] as PresensiStatus[]).map(s => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={`py-2 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                    status === s ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-white text-gray-700 border-gray-200 hover:border-emerald-400'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5" style={{ fontFamily: 'Plus Jakarta Sans' }}>Keterangan</label>
            <textarea
              rows={2}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 transition-all placeholder:text-gray-400"
              placeholder="Contoh: GPS perangkat bermasalah, kehadiran dicek langsung oleh fasil"
              value={keterangan}
              onChange={e => { setKeterangan(e.target.value); setError('') }}
            />
            {error && <p className="text-xs text-rose-700 font-semibold mt-1">{error}</p>}
          </div>
          <div className="flex gap-3">
            <button className="flex-1 py-2.5 rounded-xl font-bold text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer" onClick={onClose}>Batal</button>
            <button className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white bg-emerald-700 hover:bg-emerald-800 transition-colors cursor-pointer" onClick={simpan} disabled={menyimpan}>{menyimpan ? 'Menyimpan…' : 'Simpan Koreksi'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ==================== PROFIL FASIL ====================

function FasilProfil({
  user, onLogout, gedung, penghuniGedung, jumlahWajibAbsen, izinGedung, presensi, fotoMenunggu, onBuka,
}: {
  user: CurrentUser
  onLogout: () => void
  gedung: Gedung | null
  penghuniGedung: Penghuni[]
  jumlahWajibAbsen: number
  izinGedung: IzinRecord[]
  presensi: PresensiRecord[]
  fotoMenunggu: number
  onBuka: (tab: string) => void
}) {
  const [pesanFoto, setPesanFoto] = useState('')
  const [email, setEmail] = useState(user.email || '')
  const [noHp, setNoHp] = useState(user.noHp || '')
  const [simpan, setSimpan] = useState(false)
  const [pesanKontak, setPesanKontak] = useState<{ ok: boolean; teks: string } | null>(null)
  const kontakBerubah = email.trim() !== (user.email || '') || noHp.trim() !== (user.noHp || '')

  const simpanKontak = async () => {
    setPesanKontak(null)
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setPesanKontak({ ok: false, teks: 'Format email tidak valid.' })
    setSimpan(true)
    const hasil = await updateProfileApi(user.nim, { nama: user.nama, email: email.trim(), noHp: noHp.trim(), asal: user.asal || '' })
    setSimpan(false)
    if (hasil.ok || hasil.offline) simpanUserLokal({ email: email.trim(), noHp: noHp.trim() })
    setPesanKontak({ ok: hasil.ok || !!hasil.offline, teks: hasil.ok ? 'Kontak berhasil diperbarui.' : hasil.message })
  }

  // Rekam kerja: tindakan yang tercatat atas nama fasil ini
  const izinDiputuskan = izinGedung.filter(i => i.nimApprover === user.nim && i.statusPersetujuan !== 'Pending')
  const disetujui = izinDiputuskan.filter(i => i.statusPersetujuan === 'Disetujui').length
  const fotoDivalidasi = presensi.filter(r => r.divalidasiOleh === user.nim && r.statusFoto && r.statusFoto !== 'Menunggu').length
  const koreksi = presensi.filter(r => r.dikoreksiOleh === user.nim).length
  const izinMenunggu = izinGedung.filter(i => i.statusPersetujuan === 'Pending').length

  const aktif = penghuniGedung.filter(p => p.statusAktif)
  const kamarTerisi = new Set(aktif.map(p => p.nomorKamar).filter(Boolean)).size
  const adaLokasi = gedung?.latitude != null && gedung?.longitude != null

  const kolom = 'w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/15 transition-colors placeholder:text-gray-400'
  const label = 'block text-xs font-semibold text-gray-700 mb-1.5'

  return (
    <div className="space-y-5 w-full">
      {/* Baris 1: identitas selebar halaman, angka yang perlu ditindak bisa diklik */}
      <ProfilHeader
        user={user}
        peran="Fasilitator Asrama"
        keterangan={gedung ? `PJ ${gedung.nama}` : 'Belum ditetapkan sebagai PJ gedung'}
        onPesan={setPesanFoto}
        stats={[
          { label: 'Penghuni dibina', nilai: `${aktif.length} orang` },
          { label: 'Izin menunggu', nilai: izinMenunggu, sorot: izinMenunggu > 0, onClick: gedung ? () => onBuka('izin') : undefined },
          { label: 'Foto menunggu', nilai: fotoMenunggu, sorot: fotoMenunggu > 0, onClick: gedung ? () => onBuka('foto') : undefined },
        ]}
      />
      {pesanFoto && <p className="-mt-2 text-xs font-semibold text-emerald-700">{pesanFoto}</p>}

      {/* Baris 2: gedung | rekam kerja (tinggi sama) */}
      <div className="grid lg:grid-cols-2 gap-5 items-stretch">
        <KartuProfil
          ikon={<Building2 />}
          judul="Gedung Tanggung Jawab"
          sub={gedung ? gedung.nama : 'Belum ada gedung'}
          kanan={gedung && (
            <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${gedung.jenis === 'Putri' ? 'bg-slate-50 text-slate-800' : 'bg-emerald-50 text-emerald-800'}`}>
              Asrama {gedung.jenis}
            </span>
          )}
        >
          {gedung ? (
            <div className="p-5 flex-1 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Penghuni aktif', nilai: aktif.length },
                  { label: 'Wajib absen', nilai: jumlahWajibAbsen },
                  { label: 'Kamar terisi', nilai: `${kamarTerisi}${gedung.totalKamar ? ` / ${gedung.totalKamar}` : ''}` },
                  { label: 'Radius presensi', nilai: `${gedung.radiusMeter} m` },
                ].map(st => (
                  <div key={st.label} className="p-3.5 rounded-xl bg-gray-50 border border-gray-100">
                    <p className="text-[11px] text-gray-500">{st.label}</p>
                    <p className="mt-0.5 text-xl font-extrabold text-gray-900 tabular-nums" style={{ fontFamily: 'Plus Jakarta Sans' }}>{st.nilai}</p>
                  </div>
                ))}
              </div>
              <div className="mt-auto pt-4 border-t border-gray-100 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                <MapPin className="w-3.5 h-3.5 text-emerald-700" />
                {adaLokasi ? (
                  <>
                    <span className="mono">{gedung.latitude!.toFixed(5)}, {gedung.longitude!.toFixed(5)}</span>
                    <a
                      href={`https://www.google.com/maps?q=${gedung.latitude},${gedung.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      className="ml-auto font-semibold text-emerald-700 hover:text-emerald-900"
                    >
                      Lihat di peta
                    </a>
                  </>
                ) : (
                  <span>Titik lokasi presensi belum diatur admin</span>
                )}
              </div>
            </div>
          ) : (
            <p className="p-5 text-xs text-gray-500">Anda belum ditetapkan sebagai penanggung jawab gedung. Hubungi admin.</p>
          )}
        </KartuProfil>

        <KartuProfil ikon={<ClipboardCheck />} judul="Rekam Kerja" sub="Tindakan yang tercatat atas nama Anda">
          <div className="p-5 flex-1 flex flex-col gap-3">
            {[
              { ikon: <FileCheck className="w-4 h-4" />, label: 'Izin diputuskan', nilai: izinDiputuskan.length, ket: `${disetujui} disetujui · ${izinDiputuskan.length - disetujui} ditolak` },
              { ikon: <Camera className="w-4 h-4" />, label: 'Foto divalidasi', nilai: fotoDivalidasi, ket: 'Foto wajah presensi penghuni' },
              { ikon: <Pencil className="w-4 h-4" />, label: 'Koreksi presensi', nilai: koreksi, ket: 'Status presensi yang Anda ubah' },
            ].map(st => (
              <div key={st.label} className="flex-1 flex items-center gap-3.5 p-3.5 rounded-xl bg-gray-50 border border-gray-100">
                <div className="w-9 h-9 shrink-0 rounded-lg bg-white border border-gray-100 text-emerald-700 flex items-center justify-center">{st.ikon}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-700">{st.label}</p>
                  <p className="text-[11px] text-gray-400 truncate">{st.ket}</p>
                </div>
                <p className="text-2xl font-extrabold text-gray-900 tabular-nums" style={{ fontFamily: 'Plus Jakarta Sans' }}>{st.nilai}</p>
              </div>
            ))}
          </div>
        </KartuProfil>
      </div>

      {/* Baris 3: kontak | keamanan (tinggi sama) */}
      <div className="grid lg:grid-cols-2 gap-5 items-stretch">
        <KartuProfil ikon={<Mail />} judul="Kontak" sub="Dipakai penghuni dan admin untuk menghubungi Anda">
          <div className="p-5 flex-1 flex flex-col gap-4">
            <div className="grid gap-3">
              <div>
                <label className={label}>Nama Lengkap</label>
                <input value={user.nama} disabled className={`${kolom} bg-gray-50 text-gray-500 cursor-not-allowed`} title="Nama hanya dapat diubah oleh admin" />
              </div>
              <div>
                <label htmlFor="fasil-email" className={label}>Email</label>
                <input id="fasil-email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="nama@email.com" className={kolom} />
              </div>
              <div>
                <label htmlFor="fasil-hp" className={label}>Nomor WhatsApp</label>
                <input id="fasil-hp" type="tel" inputMode="tel" value={noHp} onChange={e => setNoHp(e.target.value)} placeholder="08xxxxxxxxxx" className={kolom} />
              </div>
            </div>
            <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-gray-100">
              {pesanKontak
                ? <p className={`text-xs font-semibold ${pesanKontak.ok ? 'text-emerald-700' : 'text-rose-600'}`}>{pesanKontak.teks}</p>
                : <p className="text-[11px] text-gray-400">Nama hanya dapat diubah oleh admin.</p>}
              <button
                type="button"
                onClick={simpanKontak}
                disabled={!kontakBerubah || simpan}
                className="py-2.5 px-5 rounded-xl font-bold text-xs text-white bg-[#141a17] hover:bg-[#2a332e] transition-colors shadow-2xs cursor-pointer disabled:opacity-40 disabled:cursor-default"
                style={{ fontFamily: 'Plus Jakarta Sans' }}
              >
                {simpan ? 'Menyimpan…' : 'Simpan Kontak'}
              </button>
            </div>
          </div>
        </KartuProfil>

        <KartuGantiPassword user={user} onLogout={onLogout} susun />
      </div>
    </div>
  )
}
