import { Fragment, useState, useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { AturanPresensi, CurrentUser, Gedung, HariLibur, IzinRecord, Penghuni, PresensiRecord, PresensiStatus, Sesi, StatusFoto, EventAsrama, RekapEventResult, FotoEvent, EventInput, Pengumuman, TemplateAlasan } from '../types'
import AppLayout, { Badge, ConfirmDialog } from '../components/AppLayout'
import { JadwalMalamFasil } from '../components/JadwalMalam'
import { useRealtime, bilaBerubah } from '../realtime'
import KartuEvent, { UbinBuatEvent } from '../components/KartuEvent'
import { unduhLaporan, type ExportFormat } from '../ekspor'
import { BuktiIzin, FotoBadge, KotakTanggalIzin, RekapTableBerhalaman, SesiToggle, UbinStatusRekap, TAMPILAN_STATUS_IZIN, formatRentangIzin, type RekapRow } from '../components/PresensiWidgets'
import { BarisSaringIzin, KosongSaringIzin, useSaringIzin, type StatusSaring } from '../components/SaringIzin'
import { BilahKomposisi, HistogramSebaran, PetaPanasPola, WARNA_STATUS_GRAFIK, hitungPolaMingguan } from '../components/GrafikKehadiran'
import { PanelTrenKehadiran } from '../components/TrenKehadiran'
import { PilihPeriodeLaporan, labelPeriodeLaporan, rentangLaporan, type SaringPeriode } from '../components/SaringLaporan'
import DateInput from '../components/DateInput'
import { notifikasiFasil } from '../notifikasiPeran'
import { KartuGantiPassword, KartuProfil, ProfilHeader } from '../components/ProfilAkun'
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
  awalDemo, fetchFotoValidasiEvent, validasiFotoEventApi, fetchFotoEvent, fetchFotoWajah, fetchPresensi, fetchIzin, fetchPenghuni, fetchGedung, fetchSesi, fetchLibur,
  fetchEvent, addEventApi, updateEventApi, deleteEventApi, fetchRekapEvent, type ApiResult,
  updateIzinStatusApi, koreksiPresensiApi, validasiFotoApi, validasiFotoMassalApi, fetchAturanPresensi, ATURAN_PRESENSI_DEFAULT, fetchPengumuman, addPengumumanApi, updatePengumumanApi, deletePengumumanApi, fetchTemplateAlasan, sudahDimuat } from '../api'
import {
  cariLibur, formatTanggal, hitungStatus, penghuniWajibAbsen, periodeRekap, riwayatPenghuni, sesiAktif, sesiUntuk, statusSesi, toHM, todayLocal, type DataPresensi,
  addDays, formatRentangTanggal, teksHariBerulang, hariIso, maxDate, dateRangeDesc, NAMA_HARI, kehadiranHariIni, kehadiranGabungan, HARI_RINGKASAN, type RiwayatRow } from '../logic'
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
  IdCard,
  Phone,
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
  MoonStar,
  ImageOff,
  Megaphone,
} from 'lucide-react'
import { KelolaPengumuman } from '../components/Pengumuman'
import RekapSemester from '../components/RekapSemester'
import { EventFormModal, EventRekapModal } from '../components/EventModals'

const navItems = [
  { id: 'dashboard', label: 'Dashboard Fasil', icon: <LayoutDashboard className="w-[18px] h-[18px]" /> },
  { id: 'event', label: 'Event Gedung', icon: <CalendarDays className="w-[18px] h-[18px]" /> },
  { id: 'pengumuman', label: 'Pengumuman', icon: <Megaphone className="w-[18px] h-[18px]" /> },
  { id: 'monitor', label: 'Monitor Presensi', icon: <ClipboardCheck className="w-[18px] h-[18px]" /> },
  { id: 'malam', label: 'Absen Malam', icon: <MoonStar className="w-[18px] h-[18px]" /> },
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
  // Foto absen event penghuni gedung (validasi terpisah dari presensi harian)
  const [fotoEvent, setFotoEvent] = useState<FotoEvent[]>([])
  const [aturan, setAturan] = useState<AturanPresensi>(ATURAN_PRESENSI_DEFAULT)

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(timer)
  }, [])

  // Realtime: data diperbarui berkala (tiap beberapa detik) tanpa perlu refresh halaman
  useRealtime(() => {
    setNow(new Date())
    fetchPresensi().then(bilaBerubah(setPresensi))
    fetchIzin().then(bilaBerubah(setIzinData))
    fetchEvent().then(bilaBerubah(setEventList))
    fetchSesi().then(bilaBerubah(setSesiList))
    fetchLibur().then(bilaBerubah(setLibur))
    fetchPenghuni().then(bilaBerubah(setPenghuni))
    fetchGedung().then(bilaBerubah(setGedungList))
    fetchFotoValidasiEvent().then(bilaBerubah(setFotoEvent))
    fetchPengumuman().then(bilaBerubah(setPengumuman))
  })
  const [pengumuman, setPengumuman] = useState<Pengumuman[]>([])
  useEffect(() => { fetchPengumuman().then(setPengumuman) }, [])
  const muatPengumuman = () => fetchPengumuman().then(setPengumuman)

  useEffect(() => {
    fetchPenghuni().then(setPenghuni)
    fetchFotoValidasiEvent().then(setFotoEvent)
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
    const riwayat = riwayatPenghuni(p.nim, periodeRekap(today, p.tanggalMasuk, HARI_RINGKASAN), today, sesiList, data, now, p.namaGedung)
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
  const fotoMenunggu = presensiBerfoto.filter(r => r.statusFoto === 'Menunggu').length + fotoEvent.filter(f => f.statusFoto === 'Menunggu').length
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

  const handleValidasiFotoEvent = async (id: number, status: Exclude<StatusFoto, 'Menunggu'>, catatan: string) => {
    const result = await validasiFotoEventApi(id, status, catatan)
    if (!result.ok && !result.offline) return result.message
    setFotoEvent(prev => prev.map(f => f.id !== id ? f : { ...f, statusFoto: status, catatanValidasi: catatan, namaValidator: user.nama, ...(status === 'Ditolak' ? { status: 'Tidak Hadir' as const } : {}) }))
    if (result.ok) fetchFotoValidasiEvent().then(setFotoEvent)
    return null
  }

  const handleSaveEvent = async (data: EventInput): Promise<ApiResult> => {
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
      notifikasi={notifikasiFasil({ nim: user.nim, izinGedung, presensiBerfoto, sering, batasTidakHadir: aturan.batasTidakHadir, eventList, today, jamSekarang, pengumuman, fotoEvent })}>
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
      {/* Halaman khusus jadwal absen malam gedung */}
      {activeTab === 'malam' && (
        <JadwalMalamFasil
          gedung={gedungSaya}
          sesiList={sesiList}
          onTersimpan={() => fetchSesi().then(setSesiList)}
          ringkas={(() => {
            const rows = rekapRows(today, 'Malam')
            const n = (st: PresensiStatus) => rows.filter(r => r.detail.status === st).length
            return rows.length ? { hadir: n('Hadir'), belum: n('Belum'), tidakHadir: n('Tidak Hadir'), izin: n('Izin'), total: rows.length } : null
          })()}
          onLihatMonitor={() => bukaMonitor('Malam', '')}
        />
      )}
      {activeTab === 'pengumuman' && (
        <KelolaPengumuman
          daftar={pengumuman}
          peran="fasil"
          nimSaya={user.nim}
          gedungList={gedungList}
          namaGedungSaya={gedungSaya.nama}
          onTambah={async d => { const r = await addPengumumanApi(d); if (r.ok) muatPengumuman(); return r }}
          onUbah={async (id, d) => { const r = await updatePengumumanApi(id, d); if (r.ok) muatPengumuman(); return r }}
          onHapus={p => setConfirmDialog({
            open: true,
            title: 'Hapus Pengumuman',
            message: `Hapus pengumuman "${p.judul}"? Penghuni tidak akan melihatnya lagi.`,
            onConfirm: async () => {
              const res = await deletePengumumanApi(p.id)
              if (res.ok || res.offline) muatPengumuman()
              else alert(res.message || 'Gagal menghapus pengumuman.')
              setConfirmDialog(c => ({ ...c, open: false }))
            },
          })}
        />
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
      {activeTab === 'foto' && <FasilValidasiFoto records={presensiBerfoto} fotoEvent={fotoEvent} onValidasi={handleValidasiFoto} onValidasiEvent={handleValidasiFotoEvent} onTerimaMassal={handleTerimaMassal} />}
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
  // Rumus sama dengan dashboard admin: hadir / sesi wajib (libur tidak dihitung)
  const c = kehadiranHariIni(rows.map(r => r.detail.status))
  const mulaiSesi = s ? new Date(`${today}T${s.jamMulai}`) : null
  const selesaiSesi = s ? new Date(`${today}T${s.jamSelesai}`) : null
  const fase = mulaiSesi && selesaiSesi ? (now < mulaiSesi ? 'belum' : now > selesaiSesi ? 'tutup' : 'buka') : null
  const keteranganSesi = !s || !mulaiSesi || !selesaiSesi ? ''
    : fase === 'buka' ? `Ditutup ${s.jamSelesai} · sisa ${formatDurasi(Math.max(1, Math.round((selesaiSesi.getTime() - now.getTime()) / 60000)))}`
      : fase === 'belum' ? `Dibuka ${s.jamMulai} · ${formatDurasi(Math.round((mulaiSesi.getTime() - now.getTime()) / 60000))} lagi`
        : `Sudah ditutup pukul ${s.jamSelesai}`

  // Ringkasan gedung 30 hari: dari total sesi wajib, bukan rata-rata persentase per orang
  const persenGedung = kehadiranGabungan(rekapPenghuni.map(r => r.c)).persen

  // Penghuni yang perlu diperhatikan pada sesi terpilih: belum presensi selama sesi buka, tidak hadir setelah tutup
  const perhatian = fase === 'belum' ? [] : rows.filter(r => r.detail.status === (fase === 'tutup' ? 'Tidak Hadir' : 'Belum'))
    .sort((a, b) => a.penghuni.nama.localeCompare(b.penghuni.nama))
  const persenSesi = c.persen

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
              {namaFasil}
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
              { label: 'Kehadiran', nilai: `${persenGedung}%`, ket: `${HARI_RINGKASAN} hari terakhir` },
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
                <p className="text-xs text-gray-500 mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
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
                <span className="text-5xl font-extrabold text-gray-900 leading-none" style={{ fontFamily: 'Plus Jakarta Sans' }}>{c.total > 0 ? `${persenSesi}%` : '–'}</span>
                <span className="text-sm text-gray-500 pb-1">
                  {c.total > 0
                    ? <>hadir · <strong className="text-gray-800">{c.Hadir}</strong> dari {c.total} penghuni wajib absen pada sesi {sesi}</>
                    : <>tidak ada kewajiban presensi pada sesi {sesi}{c.Libur > 0 ? ' (hari libur)' : ''}</>}
                </span>
              </div>

              <BilahKomposisi
                bagian={[
                  { label: 'Hadir', nilai: c.Hadir, warna: WARNA_STATUS_GRAFIK.Hadir },
                  { label: 'Izin & libur', nilai: c.Izin + c.Libur, warna: WARNA_STATUS_GRAFIK.Izin },
                  { label: 'Tidak hadir', nilai: c['Tidak Hadir'], warna: WARNA_STATUS_GRAFIK['Tidak Hadir'] },
                  { label: 'Belum presensi', nilai: c.Belum, warna: 'var(--color-gray-300)', teksGelap: true },
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
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-gray-900 truncate">{eventBerikutnya.judul}</p>
                  {eventBerikutnya.tanggal === today && toHM(now) >= eventBerikutnya.jamMulai
                    ? <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">Berlangsung</span>
                    : <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600">Akan datang</span>}
                </div>
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

  const LABEL_STATUS: Record<string, string> = { Hadir: 'Hadir', Belum: 'Belum absen', 'Tidak Hadir': 'Tidak hadir', Izin: 'Izin', Libur: 'Libur' }

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

      <UbinStatusRekap rows={dicari} value={filterStatus} onChange={setFilterStatus} />

      <div className="bg-white rounded-2xl overflow-hidden border border-gray-200/90 shadow-2xs">
        <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h3 className="text-base font-extrabold text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>
            {filterStatus ? LABEL_STATUS[filterStatus] : 'Semua Penghuni'} <span className="text-gray-400 font-semibold">· {filtered.length} penghuni</span>
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

// Antrean validasi foto: presensi harian & absen event dipisah lewat tab, ditampilkan sebagai daftar + detail pop-up
type JenisFoto = 'harian' | 'event'
interface ItemFoto {
  kunci: string
  jenis: JenisFoto
  id: number
  nama: string
  nim: string
  kamar: string
  tanggal: string
  waktu: string
  konteks: string
  // Kunci saringan: nama sesi (harian) atau judul event (event)
  sesi: string
  lat: number | null
  lng: number | null
  info: string
  foto: string
  statusFoto: StatusFoto
  catatan: string
  validator: string | null
}

const keItemHarian = (r: PresensiRecord): ItemFoto => ({
  kunci: `h${r.id}`, jenis: 'harian', id: r.id, nama: r.namaPenghuni, nim: r.nim, kamar: r.nomorKamar,
  tanggal: r.tanggal, waktu: r.waktu, konteks: `Sesi ${r.sesi}`, sesi: r.sesi, lat: r.latitude, lng: r.longitude,
  info: r.akurasiMeter != null ? `±${Math.round(r.akurasiMeter)} m` : '',
  foto: r.fotoWajah ?? '', statusFoto: r.statusFoto ?? 'Menunggu', catatan: r.catatanValidasi ?? '', validator: r.namaValidator ?? null,
})
const keItemEvent = (f: FotoEvent): ItemFoto => ({
  kunci: `e${f.id}`, jenis: 'event', id: f.id, nama: f.namaPenghuni, nim: f.nim, kamar: f.nomorKamar,
  tanggal: f.tanggal, waktu: f.waktu, konteks: `Event ${f.judulEvent}`, sesi: f.judulEvent, lat: f.latitude, lng: f.longitude,
  info: f.jarakMeter != null ? `${Math.round(f.jarakMeter)} m dari titik event` : '',
  foto: f.foto, statusFoto: f.statusFoto, catatan: f.catatanValidasi ?? '', validator: f.namaValidator,
})

// Gambar foto (harian lewat fetchFotoWajah, event lewat fetchFotoEvent) dengan token, tanpa membuka tab baru
function GambarFoto({ item, className }: { item: ItemFoto; className: string }) {
  const [src, setSrc] = useState<string | null>(null)
  const [gagal, setGagal] = useState(false)
  useEffect(() => {
    let aktif = true
    let dibuat: string | null = null
    setSrc(null)
    setGagal(false)
    const muat = item.jenis === 'event' ? fetchFotoEvent(item.foto) : fetchFotoWajah(item.foto)
    muat.then(url => {
      if (!aktif) {
        if (url?.startsWith('blob:')) URL.revokeObjectURL(url)
        return
      }
      if (url?.startsWith('blob:')) dibuat = url
      if (url) setSrc(url)
      else setGagal(true)
    })
    return () => {
      aktif = false
      if (dibuat) URL.revokeObjectURL(dibuat)
    }
  }, [item.jenis, item.foto])
  return (
    <div className={`bg-gray-100 overflow-hidden flex items-center justify-center ${className}`}>
      {src ? <img src={src} alt={`Foto ${item.nama}`} className="w-full h-full object-cover" />
        : gagal ? <ImageOff className="w-5 h-5 text-gray-400" />
        : <span className="w-4 h-4 rounded-full border-2 border-gray-300 border-t-transparent animate-spin" />}
    </div>
  )
}

function FasilValidasiFoto({ records, fotoEvent, onValidasi, onValidasiEvent, onTerimaMassal }: {
  records: PresensiRecord[]
  fotoEvent: FotoEvent[]
  onValidasi: (rec: PresensiRecord, status: Exclude<StatusFoto, 'Menunggu'>, catatan: string) => Promise<string | null>
  onValidasiEvent: (id: number, status: Exclude<StatusFoto, 'Menunggu'>, catatan: string) => Promise<string | null>
  onTerimaMassal: (ids: number[]) => Promise<{ ok: boolean; pesan: string }>
}) {
  const [jenis, setJenis] = useState<JenisFoto>('harian')
  const [filter, setFilter] = useState<StatusFoto>('Menunggu')
  const [cari, setCari] = useState('')
  const [tglSaring, setTglSaring] = useState('')
  const [sesiSaring, setSesiSaring] = useState('')
  const [batas, setBatas] = useState(25)
  const [detail, setDetail] = useState<string | null>(null)
  const [pilih, setPilih] = useState<Set<number>>(new Set())
  const [prosesMassal, setProsesMassal] = useState(false)
  const [pesanMassal, setPesanMassal] = useState<{ ok: boolean; teks: string } | null>(null)

  const harian = records.map(keItemHarian)
  const event = fotoEvent.map(keItemEvent)
  const semua = jenis === 'harian' ? harian : event
  const kata = cari.trim().toLowerCase()
  // Pilihan sesi/event diambil dari data yang ada (urut abjad), disaring tanggal bila dipilih
  const opsiSesi = [...new Set(semua.filter(i => !tglSaring || i.tanggal === tglSaring).map(i => i.sesi).filter(Boolean))].sort((a, b) => a.localeCompare(b))
  const adaSaring = !!(tglSaring || sesiSaring)
  const dicari = semua.filter(i =>
    (!kata || `${i.nama} ${i.nim} ${i.kamar} ${i.konteks}`.toLowerCase().includes(kata)) &&
    (!tglSaring || i.tanggal === tglSaring) &&
    (!sesiSaring || i.sesi === sesiSaring))
  // Menunggu: yang paling lama di depan; arsip: yang terbaru di depan
  const filtered = dicari.filter(i => i.statusFoto === filter).sort((a, b) => filter === 'Menunggu'
    ? `${a.tanggal}${a.waktu}`.localeCompare(`${b.tanggal}${b.waktu}`)
    : `${b.tanggal}${b.waktu}`.localeCompare(`${a.tanggal}${a.waktu}`))
  const tampil = filtered.slice(0, batas)
  const itemDetail = [...harian, ...event].find(i => i.kunci === detail) ?? null

  useEffect(() => {
    setBatas(25)
    setPilih(new Set())
    setPesanMassal(null)
  }, [jenis, filter, kata, tglSaring, sesiSaring])

  // Ganti jenis: pilihan sesi/event berbeda, jadi saringan sesi dikosongkan
  useEffect(() => { setSesiSaring('') }, [jenis])

  // Terima sekaligus hanya untuk presensi harian (endpoint massal khusus harian)
  const menungguHarian = filtered.filter(i => i.jenis === 'harian' && i.statusFoto === 'Menunggu')
  const bisaMassal = jenis === 'harian' && filter === 'Menunggu' && menungguHarian.length > 0
  const terpilih = menungguHarian.filter(i => pilih.has(i.id)).map(i => i.id)
  const semuaTerpilih = menungguHarian.length > 0 && terpilih.length === menungguHarian.length
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

  const putuskan = (item: ItemFoto, status: Exclude<StatusFoto, 'Menunggu'>, catatan: string) => {
    if (item.jenis === 'event') return onValidasiEvent(item.id, status, catatan)
    const rec = records.find(r => r.id === item.id)
    return rec ? onValidasi(rec, status, catatan) : Promise.resolve('Data presensi tidak ditemukan.')
  }

  const jumlahMenunggu = (l: ItemFoto[]) => l.filter(i => i.statusFoto === 'Menunggu').length
  const ubin: { status: StatusFoto; ket: string; ikon: ReactNode; warna: string; aktifCls: string }[] = [
    { status: 'Menunggu', ket: 'Perlu diperiksa', ikon: <Clock className="w-4 h-4" />, warna: 'bg-amber-50 text-amber-700', aktifCls: 'border-amber-400 ring-2 ring-amber-400/20' },
    { status: 'Diterima', ket: 'Wajah sesuai', ikon: <CheckCircle2 className="w-4 h-4" />, warna: 'bg-emerald-50 text-emerald-700', aktifCls: 'border-emerald-500 ring-2 ring-emerald-500/20' },
    { status: 'Ditolak', ket: 'Tercatat Tidak Hadir', ikon: <XCircle className="w-4 h-4" />, warna: 'bg-rose-50 text-rose-600', aktifCls: 'border-rose-400 ring-2 ring-rose-400/20' },
  ]
  const tabJenis: [JenisFoto, string, ItemFoto[]][] = [['harian', 'Presensi Harian', harian], ['event', 'Absen Event', event]]

  return (
    <div className="space-y-5">
      {/* Jenis foto: presensi harian / absen event */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex p-1 rounded-xl bg-gray-100 border border-gray-200" role="tablist" aria-label="Jenis foto">
          {tabJenis.map(([v, label, l]) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={jenis === v}
              onClick={() => setJenis(v)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer inline-flex items-center gap-2 ${jenis === v ? 'bg-[#fff] text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-800'}`}
            >
              {v === 'harian' ? <Camera className="w-4 h-4" /> : <CalendarDays className="w-4 h-4" />}
              {label}
              {jumlahMenunggu(l) > 0 && <span className="min-w-5 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold tabular-nums">{jumlahMenunggu(l)}</span>}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-72 sm:ml-auto">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={cari}
            onChange={e => setCari(e.target.value)}
            placeholder={jenis === 'event' ? 'Cari nama, NIM, kamar, event...' : 'Cari nama, NIM, kamar, sesi...'}
            aria-label="Cari foto"
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 bg-[#fff] text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 transition-all placeholder:text-gray-400"
          />
        </div>
      </div>

      {/* Saring tanggal & sesi / event */}
      <div className="flex flex-wrap items-center gap-2">
        <DateInput
          clearable
          placeholder="Semua tanggal"
          className="w-full sm:w-48 px-3.5 py-2.5 rounded-xl border border-gray-200 hover:border-gray-300 bg-[#fff] text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 transition-all font-medium text-gray-700"
          value={tglSaring}
          onChange={e => setTglSaring(e.target.value)}
        />
        <select
          value={sesiSaring}
          onChange={e => setSesiSaring(e.target.value)}
          aria-label={jenis === 'event' ? 'Saring event' : 'Saring sesi'}
          className="w-full sm:w-56 px-3.5 py-2.5 rounded-xl border border-gray-200 hover:border-gray-300 bg-[#fff] text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 transition-all font-medium text-gray-700 cursor-pointer"
        >
          <option value="">{jenis === 'event' ? 'Semua event' : 'Semua sesi'}</option>
          {[...new Set([...opsiSesi, ...(sesiSaring ? [sesiSaring] : [])])].map(o => <option key={o} value={o}>{jenis === 'event' ? o : `Sesi ${o}`}</option>)}
        </select>
        {adaSaring && (
          <button type="button" onClick={() => { setTglSaring(''); setSesiSaring('') }}
            className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold text-gray-600 hover:text-gray-900 hover:bg-gray-100 cursor-pointer">
            <X className="w-3.5 h-3.5" /> Hapus saringan
          </button>
        )}
      </div>

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
              className={`text-left bg-[#fff] rounded-2xl border p-3 sm:p-4 shadow-2xs transition-all cursor-pointer hover:-translate-y-0.5 hover:shadow-md ${aktif ? u.aktifCls : 'border-gray-200/90'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-gray-600">{u.status}</span>
                <span className={`hidden sm:flex w-8 h-8 rounded-lg items-center justify-center ${u.warna}`}>{u.ikon}</span>
              </div>
              <p className="mt-1 text-2xl font-extrabold text-gray-900 tabular-nums" style={{ fontFamily: 'Plus Jakarta Sans' }}>{dicari.filter(i => i.statusFoto === u.status).length}</p>
              <p className="hidden sm:block text-[11px] text-gray-400 truncate">{u.ket}</p>
            </button>
          )
        })}
      </div>

      <div className="bg-white rounded-2xl border border-gray-200/90 shadow-2xs overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-base font-extrabold text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>
            Foto {jenis === 'event' ? 'absen event' : 'presensi harian'} · {filter} <span className="text-gray-400 font-semibold">· {filtered.length}</span>
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">Klik baris untuk melihat foto & memutuskan. Foto yang ditolak membuat {jenis === 'event' ? 'absen event' : 'presensi'} tercatat Tidak Hadir; penghuni bisa absen ulang selama waktunya masih berjalan.</p>
        </div>

        {bisaMassal && (
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/60 flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer select-none">
              <input
                type="checkbox"
                className="w-4 h-4 accent-emerald-700 cursor-pointer"
                checked={semuaTerpilih}
                onChange={() => setPilih(semuaTerpilih ? new Set() : new Set(menungguHarian.map(i => i.id)))}
              />
              Pilih semua ({menungguHarian.length})
            </label>
            <span className="text-xs text-gray-500">{terpilih.length} dipilih</span>
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

        {filtered.length === 0 ? (
          <div className="py-14 flex flex-col items-center text-center px-5">
            <span className={`w-14 h-14 rounded-2xl flex items-center justify-center ${filter === 'Menunggu' ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
              {filter === 'Menunggu' ? <CheckCircle2 className="w-7 h-7" /> : <Camera className="w-7 h-7" />}
            </span>
            <p className="mt-3 text-sm font-bold text-gray-800" style={{ fontFamily: 'Plus Jakarta Sans' }}>
              {kata || adaSaring ? 'Tidak ada foto yang cocok' : filter === 'Menunggu' ? 'Semua foto sudah divalidasi' : `Belum ada foto yang ${filter.toLowerCase()}`}
            </p>
            <p className="mt-1 text-xs text-gray-500 max-w-sm">Foto {jenis === 'event' ? 'absen event' : 'presensi mandiri'} penghuni gedung Anda tampil di sini.</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {tampil.map(i => (
              <li key={i.kunci} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/80 transition-colors">
                {bisaMassal && (
                  <input type="checkbox" className="w-4 h-4 accent-emerald-700 cursor-pointer shrink-0" checked={pilih.has(i.id)} onChange={() => togglePilih(i.id)} aria-label={`Pilih foto ${i.nama}`} />
                )}
                <button type="button" onClick={() => setDetail(i.kunci)} className="flex-1 min-w-0 flex items-center gap-3 text-left cursor-pointer">
                  <GambarFoto item={i} className="w-11 h-11 rounded-xl shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-gray-900 truncate">{i.nama}</p>
                    <p className="text-xs text-gray-500 truncate"><span className="mono">{i.nim}</span> · Kamar {i.kamar || '–'}</p>
                  </div>
                  <div className="hidden sm:block min-w-0 w-56 text-xs">
                    <p className="font-semibold text-gray-700 truncate">{i.konteks}</p>
                    <p className="text-gray-500">{formatTanggal(i.tanggal)} · {i.waktu.slice(0, 5)} WIB</p>
                  </div>
                  <FotoBadge status={i.statusFoto} />
                  <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {filtered.length > tampil.length && (
          <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <span>Menampilkan {tampil.length} dari {filtered.length}</span>
            <button type="button" onClick={() => setBatas(b => b + 25)} className="font-bold text-emerald-700 hover:underline cursor-pointer">Tampilkan lebih banyak</button>
          </div>
        )}
      </div>

      {itemDetail && <DetailValidasiFoto key={itemDetail.kunci} item={itemDetail} onClose={() => setDetail(null)} onPutuskan={putuskan} />}
    </div>
  )
}

// Template alasan validasi foto (dikelola admin di menu Sesi & Hari Libur). Klik untuk mengisi catatan,
// lalu bisa disunting sebelum dikirim. Bawaan dipakai hanya bila daftar dari server belum dapat dimuat.
type GrupAlasan = { status: Exclude<StatusFoto, 'Menunggu'>; judul: string; daftar: string[] }
const TEMPLATE_BAWAAN: TemplateAlasan[] = [
  { status: 'Diterima', teks: 'Wajah terlihat jelas dan sesuai data penghuni.' },
  { status: 'Diterima', teks: 'Foto sesuai, lokasi dalam radius.' },
  { status: 'Ditolak', teks: 'Wajah tidak terlihat jelas / buram.' },
  { status: 'Ditolak', teks: 'Wajah tertutup (masker, helm, atau tangan).' },
  { status: 'Ditolak', teks: 'Foto terlalu gelap.' },
]
const kelompokkanAlasan = (l: TemplateAlasan[]): GrupAlasan[] => [
  { status: 'Diterima', judul: 'Alasan diterima', daftar: l.filter(t => t.status === 'Diterima').map(t => t.teks) },
  { status: 'Ditolak', judul: 'Alasan ditolak', daftar: l.filter(t => t.status === 'Ditolak').map(t => t.teks) },
]

function DetailValidasiFoto({ item, onClose, onPutuskan }: {
  item: ItemFoto
  onClose: () => void
  onPutuskan: (item: ItemFoto, status: Exclude<StatusFoto, 'Menunggu'>, catatan: string) => Promise<string | null>
}) {
  const [catatan, setCatatan] = useState('')
  const [error, setError] = useState('')
  const [proses, setProses] = useState(false)
  const menunggu = item.statusFoto === 'Menunggu'
  // Template terbaru diambil setiap popup dibuka, jadi perubahan admin langsung berlaku
  // null = sedang dimuat; bawaan hanya bila server gagal & belum pernah termuat
  const [alasanMuat, setAlasanMuat] = useState<GrupAlasan[] | null>(null)
  useEffect(() => {
    let aktif = true
    fetchTemplateAlasan().then(l => {
      if (aktif) setAlasanMuat(kelompokkanAlasan(l.length > 0 || sudahDimuat('template-alasan') ? l : TEMPLATE_BAWAAN))
    })
    return () => { aktif = false }
  }, [])
  const alasan = alasanMuat ?? []

  useEffect(() => {
    const tutup = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', tutup)
    return () => window.removeEventListener('keydown', tutup)
  }, [onClose])

  const putuskan = async (status: Exclude<StatusFoto, 'Menunggu'>) => {
    if (status === 'Ditolak' && !catatan.trim()) {
      setError('Catatan wajib diisi saat menolak foto agar penghuni mengetahui alasannya.')
      return
    }
    // Cegah salah klik: template alasan ditolak dikirim dengan tombol Terima (atau sebaliknya)
    const lawan = alasan.find(g => g.status !== status)
    if (lawan?.daftar.includes(catatan.trim())) {
      setError(`Catatan yang dipilih adalah ${lawan.judul.toLowerCase()}. Ganti catatannya atau tekan tombol ${lawan.status === 'Diterima' ? 'Terima' : 'Tolak'}.`)
      return
    }
    setProses(true)
    const gagal = await onPutuskan(item, status, catatan.trim())
    setProses(false)
    if (gagal) setError(gagal)
    else onClose()
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm motion-safe:[animation:lg-pudar_0.2s_ease-out]"
      role="dialog"
      aria-modal="true"
      aria-label={`Detail foto ${item.nama}`}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-5xl max-h-[94vh] overflow-y-auto rounded-2xl bg-[#fff] shadow-2xl grid md:grid-cols-[1.5fr_1fr] motion-safe:[animation:lg-muncul_0.3s_cubic-bezier(0.22,1,0.36,1)]">
        <GambarFoto item={item} className="w-full aspect-[4/3] md:aspect-auto md:min-h-[560px] md:h-full" />
        <div className="p-6 flex flex-col gap-5">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">{item.jenis === 'event' ? 'Absen event' : 'Presensi harian'}</p>
              <h3 className="text-xl font-extrabold text-gray-900 leading-tight" style={{ fontFamily: 'Plus Jakarta Sans' }}>{item.nama}</h3>
              <p className="text-xs text-gray-500"><span className="mono">{item.nim}</span> · Kamar {item.kamar || '–'}</p>
            </div>
            <button type="button" onClick={onClose} className="p-2 -mr-2 -mt-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 cursor-pointer" aria-label="Tutup"><X className="w-4 h-4" /></button>
          </div>

          <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-3 text-sm">
            <dt className="text-gray-400 font-semibold">{item.jenis === 'event' ? 'Event' : 'Sesi'}</dt>
            <dd className="text-gray-800 font-semibold">{item.konteks.replace(/^(Sesi|Event) /, '')}</dd>
            <dt className="text-gray-400 font-semibold">Waktu</dt>
            <dd className="text-gray-800">{formatTanggal(item.tanggal)} · {item.waktu.slice(0, 5)} WIB</dd>
            {item.lat !== null && item.lng !== null && (
              <>
                <dt className="text-gray-400 font-semibold">Lokasi</dt>
                <dd>
                  <a href={`https://www.google.com/maps?q=${item.lat},${item.lng}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-slate-700 hover:underline">
                    <MapPin className="w-3 h-3" /><span className="mono">{Number(item.lat).toFixed(5)}, {Number(item.lng).toFixed(5)}</span>
                  </a>
                  {item.info && <span className="block text-gray-500">{item.info}</span>}
                </dd>
              </>
            )}
            <dt className="text-gray-400 font-semibold">Status</dt>
            <dd><FotoBadge status={item.statusFoto} /></dd>
            {!menunggu && item.validator && (
              <>
                <dt className="text-gray-400 font-semibold">Divalidasi</dt>
                <dd className="text-gray-800">{item.validator}</dd>
              </>
            )}
            {!menunggu && item.catatan && (
              <>
                <dt className="text-gray-400 font-semibold">Catatan</dt>
                <dd className="text-gray-800">{item.catatan}</dd>
              </>
            )}
          </dl>

          {menunggu ? (
            <div className="mt-auto space-y-2">
              {/* Template alasan: diterima / ditolak */}
              <div className="space-y-2">
                {!alasanMuat && <p className="text-[11px] text-gray-500">Memuat template alasan…</p>}
                {alasan.filter(g => g.daftar.length > 0).map(g => (
                  <div key={g.status}>
                    <p className={`text-[11px] font-bold mb-1 ${g.status === 'Diterima' ? 'text-emerald-700' : 'text-rose-700'}`}>{g.judul}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {g.daftar.map(t => {
                        const dipilih = catatan === t
                        return (
                          <button
                            key={t}
                            type="button"
                            aria-pressed={dipilih}
                            onClick={() => { setCatatan(dipilih ? '' : t); setError('') }}
                            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors cursor-pointer text-left ${dipilih
                              ? (g.status === 'Diterima' ? 'bg-emerald-50 border-emerald-400 text-emerald-800' : 'bg-rose-50 border-rose-400 text-rose-800')
                              : 'bg-[#fff] border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-900'}`}
                          >
                            {t}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <textarea
                rows={3}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 transition-all placeholder:text-gray-400"
                placeholder="Pilih template di atas atau tulis catatan sendiri (wajib jika menolak)"
                value={catatan}
                onChange={e => { setCatatan(e.target.value); setError('') }}
              />
              {error && <p className="text-xs text-rose-700 font-semibold">{error}</p>}
              <div className="flex gap-2">
                <button
                  disabled={proses}
                  onClick={() => putuskan('Ditolak')}
                  className="flex-1 py-2.5 rounded-xl font-bold text-xs text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <X className="w-3.5 h-3.5" /><span>Tolak</span>
                </button>
                <button
                  disabled={proses}
                  onClick={() => putuskan('Diterima')}
                  className="flex-1 py-2.5 rounded-xl font-bold text-xs text-white bg-[#141a17] hover:bg-[#2a332e] flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" /><span>{proses ? 'Menyimpan…' : 'Terima'}</span>
                </button>
              </div>
            </div>
          ) : (
            <p className="mt-auto text-[11px] text-gray-400">Keputusan sudah tersimpan.</p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}

// Rekap kehadiran per penghuni untuk tindak lanjut pelanggaran.
// Ambang "perlu ditegur" diatur admin (pengaturan batas_tidak_hadir) dan dihitung dalam periode yang dipilih.
type UrutanRekap = 'alpa' | 'kehadiran' | 'nama' | 'kamar'

// Rincian tidak hadir & izin, dikelompokkan per tanggal (terbaru dulu)
function RincianRekap({ riwayat }: { riwayat: RiwayatRow[] }) {
  const per = new Map<string, { sesi: string; status: PresensiStatus }[]>()
  for (const r of riwayat) {
    if (r.detail.status !== 'Tidak Hadir' && r.detail.status !== 'Izin') continue
    per.set(r.tanggal, [...(per.get(r.tanggal) ?? []), { sesi: r.sesi.nama, status: r.detail.status }])
  }
  const tanggal = [...per.keys()].sort().reverse()
  const [semuaTgl, setSemuaTgl] = useState(false)
  const terlihat = semuaTgl ? tanggal : tanggal.slice(0, 8)
  if (tanggal.length === 0) return <p className="text-xs text-gray-400">Tidak ada catatan tidak hadir atau izin pada periode ini.</p>
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-2 text-[11px] text-gray-500">
        <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500" />Tidak hadir</span>
        <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" />Izin</span>
      </div>
      {/* Sengaja tidak memakai .grid: anak .grid di main mendapat animasi masuk bertahap */}
      <ul className="sm:columns-2 gap-x-6 space-y-1.5">
        {terlihat.map(t => (
          <li key={t} className="flex items-center gap-3 text-xs break-inside-avoid">
            <span className="w-32 shrink-0 font-semibold text-gray-700">{formatTanggal(t)}</span>
            <span className="flex flex-wrap gap-1">
              {per.get(t)!.map(x => (
                <span key={x.sesi} className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${x.status === 'Izin' ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
                  {x.sesi}
                </span>
              ))}
            </span>
          </li>
        ))}
      </ul>
      {tanggal.length > 8 && (
        <button type="button" onClick={() => setSemuaTgl(v => !v)} className="mt-2 text-xs font-bold text-gray-600 hover:text-gray-900 cursor-pointer">
          {semuaTgl ? 'Tampilkan lebih sedikit' : `Tampilkan semua (${tanggal.length} tanggal)`}
        </button>
      )}
    </div>
  )
}

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

  const saringCls = 'px-3 py-2.5 rounded-xl border border-gray-200 hover:border-gray-300 text-sm font-medium text-gray-800 bg-[#fff] outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 transition-colors placeholder:text-gray-400'
  const tombolUnduh = 'inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold text-gray-700 bg-[#fff] border border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'

  // Pembagian halaman tabel
  const [perHalaman, setPerHalaman] = useState(10)
  const [halaman, setHalaman] = useState(1)
  useEffect(() => setHalaman(1), [kata, hanyaDitegur, urutan, perHalaman, dari, sampai, sesiPilih])
  const jumlahHalaman = Math.max(1, Math.ceil(rows.length / perHalaman))
  const aktifHal = Math.min(halaman, jumlahHalaman)
  const awalHal = (aktifHal - 1) * perHalaman
  const tampil = rows.slice(awalHal, awalHal + perHalaman)
  const tombolHal = 'px-3 py-1.5 rounded-lg border border-gray-200 bg-[#fff] font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'

  const warnaPersen = (p: number) => p >= 80 ? 'bg-emerald-600' : p >= 60 ? 'bg-amber-500' : 'bg-rose-500'
  const inisial = (nama: string) => nama.split(/\s+/).filter(Boolean).slice(0, 2).map(k => k[0]?.toUpperCase()).join('')

  const ubin = [
    { kunci: 'hadir', label: 'Kehadiran', nilai: `${persenGedung}%`, ket: `${total.hadir} dari ${total.wajib} sesi wajib`, ikon: <BarChart3 className="w-4 h-4" />, warna: 'bg-gray-100 text-gray-700', bar: persenGedung },
    { kunci: 'alpa', label: 'Tidak hadir', nilai: total.alpa, ket: 'sesi pada periode ini', ikon: <XCircle className="w-4 h-4" />, warna: 'bg-rose-50 text-rose-600' },
    { kunci: 'izin', label: 'Izin', nilai: total.izin, ket: 'sesi pada periode ini', ikon: <FileCheck className="w-4 h-4" />, warna: 'bg-amber-50 text-amber-700' },
  ]

  return (
    <div className="space-y-5">
      {/* 1. Saring periode & sesi (berlaku untuk seluruh halaman) + unduh */}
      <div className="bg-[#fff] rounded-2xl border border-gray-200/90 shadow-2xs px-5 py-4 flex flex-col xl:flex-row xl:items-center gap-3">
        <div className="xl:mr-auto min-w-0">
          <h3 className="text-base font-extrabold text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>Rekap Kehadiran {namaGedung}</h3>
          <p className="text-xs text-gray-500">{keteranganSaring} · {semua.length} penghuni wajib absen</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PilihPeriodeLaporan nilai={saringPeriode} onChange={setSaringPeriode} today={today} className={saringCls} />
          <select value={sesiPilih} onChange={e => setSesiPilih(e.target.value)} aria-label="Sesi" className={saringCls}>
            <option value="">Semua sesi</option>
            {namaSesi.map(n => <option key={n} value={n}>Sesi {n}</option>)}
          </select>
          <span className="hidden sm:block w-px h-7 bg-gray-200 mx-1" aria-hidden />
          {([['xlsx', 'Excel'], ['pdf', 'PDF']] as const).map(([format, label]) => (
            <button key={format} onClick={() => unduh(format)} disabled={rows.length === 0} className={tombolUnduh} title={`Unduh rekap yang ditampilkan sebagai ${label}`}>
              <Download className="w-3.5 h-3.5" />{label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Ringkasan; "Perlu ditegur" sekaligus penyaring tabel */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {ubin.map(u => (
          <div key={u.kunci} className="bg-[#fff] rounded-2xl border border-gray-200/90 p-4 shadow-2xs min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-gray-600 truncate">{u.label}</span>
              <span className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center ${u.warna}`}>{u.ikon}</span>
            </div>
            <p className="mt-1 text-2xl font-extrabold text-gray-900 tabular-nums" style={{ fontFamily: 'Plus Jakarta Sans' }}>{u.nilai}</p>
            {'bar' in u && u.bar !== undefined ? (
              <div className="mt-1.5 h-1.5 rounded-full bg-gray-100 overflow-hidden"><div className={`h-full rounded-full ${warnaPersen(u.bar)}`} style={{ width: `${u.bar}%` }} /></div>
            ) : null}
            <p className="text-[11px] text-gray-400 truncate mt-1">{u.ket}</p>
          </div>
        ))}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setHanyaDitegur(v => !v)}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setHanyaDitegur(v => !v) } }}
          aria-pressed={hanyaDitegur}
          title="Klik untuk menyaring tabel"
          className={`bg-[#fff] rounded-2xl border p-4 shadow-2xs min-w-0 transition-all cursor-pointer hover:-translate-y-0.5 hover:shadow-md ${hanyaDitegur ? 'border-rose-400 ring-2 ring-rose-400/20' : 'border-gray-200/90'}`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-gray-600 truncate">Perlu ditegur</span>
            <span className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center bg-rose-50 text-rose-600"><AlertCircle className="w-4 h-4" /></span>
          </div>
          <p className="mt-1 text-2xl font-extrabold text-gray-900 tabular-nums" style={{ fontFamily: 'Plus Jakarta Sans' }}>{jumlahDitegur}</p>
          <p className="text-[11px] text-gray-400 truncate mt-1">{hanyaDitegur ? 'Klik untuk tampilkan semua' : `≥ ${BATAS_ALPA} sesi tidak hadir`}</p>
        </div>
      </div>

      {/* 3. Grafik */}
      <div className="grid lg:grid-cols-5 gap-5">
        <div className="bg-[#fff] rounded-2xl border border-gray-200/90 shadow-2xs p-5 lg:col-span-3">
          <p className="font-bold text-sm text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>Pola Kehadiran Mingguan</p>
          <p className="text-xs text-gray-500 mt-0.5 mb-4">Tingkat kehadiran per hari dan sesi. Makin gelap makin tinggi; kotak bergaris merah = paling rendah.</p>
          <PetaPanasPola pola={hitungPolaMingguan(semua.flatMap(r => r.riwayat))} />
        </div>
        <div className="bg-[#fff] rounded-2xl border border-gray-200/90 shadow-2xs p-5 lg:col-span-2">
          <p className="font-bold text-sm text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>Sebaran Tingkat Kehadiran</p>
          <p className="text-xs text-gray-500 mt-0.5 mb-3">Jumlah penghuni pada tiap rentang tingkat kehadiran</p>
          <HistogramSebaran persen={semua.filter(r => r.c.wajib > 0).map(r => r.c.persen)} />
        </div>
      </div>

      {/* 4. Daftar penghuni */}
      <div className="bg-[#fff] rounded-2xl border border-gray-200/90 shadow-2xs overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="lg:mr-auto">
            <h3 className="text-base font-extrabold text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>
              {hanyaDitegur ? 'Penghuni yang perlu ditegur' : 'Rekap per penghuni'} <span className="text-gray-400 font-semibold">· {rows.length}</span>
            </h3>
            <p className="text-xs text-gray-500">Klik baris untuk melihat tanggal tidak hadir & izin</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-60">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input type="search" value={cari} onChange={e => setCari(e.target.value)} placeholder="Cari nama, NIM, kamar..." aria-label="Cari penghuni" className={`${saringCls} w-full pl-9`} />
            </div>
            <select value={urutan} onChange={e => setUrutan(e.target.value as UrutanRekap)} aria-label="Urutkan" className={saringCls}>
              <option value="alpa">Tidak hadir terbanyak</option>
              <option value="kehadiran">Kehadiran terendah</option>
              <option value="nama">Nama (A–Z)</option>
              <option value="kamar">Nomor kamar</option>
            </select>
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-gray-400">
            {!rentang ? 'Pilih rentang tanggal yang valid.' : anggota.length === 0 ? 'Belum ada penghuni wajib absen di gedung ini.' : 'Tidak ada penghuni yang cocok dengan filter.'}
          </p>
        ) : (
          <>
            {/* Tabel (layar lebar) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50/70 border-b border-gray-100">
                    {[['Penghuni', 'text-left'], ['Kamar', 'text-left'], ['Hadir', 'text-center'], ['Izin', 'text-center'], ['Tidak hadir', 'text-center'], ['Kehadiran', 'text-left'], ['Status', 'text-left']].map(([h, al]) => (
                      <th key={h} className={`${al} px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {tampil.map(({ penghuni: p, c, riwayat }) => {
                    const ditegur = perluDitegur(c)
                    const terbuka = dibuka === p.nim
                    return (
                      <Fragment key={p.nim}>
                        <tr className={`cursor-pointer transition-colors ${terbuka ? 'bg-gray-50' : 'hover:bg-gray-50/70'}`} onClick={() => setDibuka(terbuka ? null : p.nim)}>
                          <td className="px-5 py-3">
                            <button type="button" aria-expanded={terbuka} className="flex items-center gap-3 text-left cursor-pointer">
                              <ChevronRight className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${terbuka ? 'rotate-90' : ''}`} />
                              <span className="w-8 h-8 shrink-0 rounded-full bg-gray-100 text-gray-700 text-[11px] font-bold flex items-center justify-center">{inisial(p.nama)}</span>
                              <span className="min-w-0">
                                <span className="block font-semibold text-gray-900 truncate">{p.nama}</span>
                                <span className="block mono text-[11px] text-gray-500">{p.nim}</span>
                              </span>
                            </button>
                          </td>
                          <td className="px-5 py-3"><span className="px-2 py-0.5 rounded-md bg-gray-100 text-xs font-semibold text-gray-700 mono">{p.nomorKamar}</span></td>
                          <td className="px-5 py-3 text-center font-bold tabular-nums text-emerald-700">{c.Hadir}</td>
                          <td className="px-5 py-3 text-center font-bold tabular-nums text-amber-700">{c.Izin}</td>
                          <td className="px-5 py-3 text-center font-bold tabular-nums text-rose-600">{c['Tidak Hadir']}</td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-24 h-1.5 rounded-full bg-gray-100 overflow-hidden"><div className={`h-full rounded-full ${warnaPersen(c.persen)}`} style={{ width: `${c.persen}%` }} /></div>
                              <span className="text-xs font-bold text-gray-800 tabular-nums w-9">{c.wajib > 0 ? `${c.persen}%` : '–'}</span>
                              <span className="text-[11px] text-gray-400 tabular-nums whitespace-nowrap">{c.Hadir}/{c.wajib}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3">
                            {ditegur
                              ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-rose-200 bg-rose-50 text-[11px] font-bold text-rose-700"><AlertCircle className="w-3 h-3" />Perlu ditegur</span>
                              : <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-gray-200 bg-gray-50 text-[11px] font-semibold text-gray-500">Aman</span>}
                          </td>
                        </tr>
                        {terbuka && (
                          <tr className="bg-gray-50/60">
                            <td colSpan={7} className="px-5 pt-1 pb-4 pl-[4.25rem]"><RincianRekap riwayat={riwayat} /></td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Kartu (HP) */}
            <ul className="md:hidden divide-y divide-gray-100">
              {tampil.map(({ penghuni: p, c, riwayat }) => {
                const ditegur = perluDitegur(c)
                const terbuka = dibuka === p.nim
                return (
                  <li key={p.nim} className="px-4 py-3.5">
                    <button type="button" aria-expanded={terbuka} onClick={() => setDibuka(terbuka ? null : p.nim)} className="w-full text-left cursor-pointer">
                      <div className="flex items-center gap-3">
                        <span className="w-9 h-9 shrink-0 rounded-full bg-gray-100 text-gray-700 text-xs font-bold flex items-center justify-center">{inisial(p.nama)}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-gray-900 truncate">{p.nama}</p>
                          <p className="text-[11px] text-gray-500"><span className="mono">{p.nim}</span> · Kamar {p.nomorKamar}</p>
                        </div>
                        {ditegur && <span className="shrink-0 px-2 py-0.5 rounded-full border border-rose-200 bg-rose-50 text-[10px] font-bold text-rose-700">Ditegur</span>}
                        <ChevronRight className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${terbuka ? 'rotate-90' : ''}`} />
                      </div>
                      <div className="mt-2.5 flex items-center gap-2.5">
                        <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden"><div className={`h-full rounded-full ${warnaPersen(c.persen)}`} style={{ width: `${c.persen}%` }} /></div>
                        <span className="text-xs font-bold text-gray-800 tabular-nums">{c.wajib > 0 ? `${c.persen}%` : '–'}</span>
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                        {[['Hadir', c.Hadir, 'text-emerald-700'], ['Izin', c.Izin, 'text-amber-700'], ['Tidak hadir', c['Tidak Hadir'], 'text-rose-600']].map(([l, n, w]) => (
                          <span key={l as string} className="rounded-lg bg-gray-50 border border-gray-100 py-1.5">
                            <span className={`block text-sm font-extrabold tabular-nums ${w}`}>{n}</span>
                            <span className="block text-[10px] text-gray-500">{l}</span>
                          </span>
                        ))}
                      </div>
                    </button>
                    {terbuka && <div className="mt-3 pt-3 border-t border-gray-100"><RincianRekap riwayat={riwayat} /></div>}
                  </li>
                )
              })}
            </ul>

            {/* Halaman */}
            <div className="px-5 py-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <label className="inline-flex items-center gap-2">
                  <span>Tampilkan</span>
                  <select value={perHalaman} onChange={e => setPerHalaman(Number(e.target.value))} aria-label="Jumlah baris per halaman"
                    className="px-2 py-1.5 rounded-lg border border-gray-200 bg-[#fff] text-xs font-semibold text-gray-800 outline-none focus:border-emerald-600 cursor-pointer">
                    {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <span>baris</span>
                </label>
                <span>Menampilkan {awalHal + 1}–{awalHal + tampil.length} dari {rows.length} penghuni</span>
              </div>
              {jumlahHalaman > 1 && (
                <div className="flex items-center gap-1.5">
                  <button type="button" className={tombolHal} disabled={aktifHal === 1} onClick={() => setHalaman(aktifHal - 1)}>‹ Sebelumnya</button>
                  <span className="px-2 font-semibold text-gray-700 tabular-nums">{aktifHal} / {jumlahHalaman}</span>
                  <button type="button" className={tombolHal} disabled={aktifHal === jumlahHalaman} onClick={() => setHalaman(aktifHal + 1)}>Berikutnya ›</button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* 5. Rekap semester untuk pihak kampus */}
      <RekapSemester
        penghuni={anggota}
        sesiList={sesiList}
        data={data}
        now={now}
        gedungTetap={namaGedung}
        penandatangan={{ jabatan: `Fasilitator ${namaGedung}`, nama: fasil.nama, identitas: `NIM. ${fasil.nim}` }}
      />
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
  // Rekam kerja: tindakan yang tercatat atas nama fasil ini
  const izinDiputuskan = izinGedung.filter(i => i.nimApprover === user.nim && i.statusPersetujuan !== 'Pending')
  const disetujui = izinDiputuskan.filter(i => i.statusPersetujuan === 'Disetujui').length
  const fotoDivalidasi = presensi.filter(r => r.divalidasiOleh === user.nim && r.statusFoto && r.statusFoto !== 'Menunggu').length
  const koreksi = presensi.filter(r => r.dikoreksiOleh === user.nim).length
  const izinMenunggu = izinGedung.filter(i => i.statusPersetujuan === 'Pending').length

  const aktif = penghuniGedung.filter(p => p.statusAktif)
  const kamarTerisi = new Set(aktif.map(p => p.nomorKamar).filter(Boolean)).size
  const adaLokasi = gedung?.latitude != null && gedung?.longitude != null


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
        {/* Kontak: hanya tampil (diubah oleh admin), gaya sama dengan "Informasi Data Pribadi" penghuni */}
        <KartuProfil ikon={<Mail />} judul="Kontak" sub="Dipakai penghuni dan admin untuk menghubungi Anda" kanan={<Badge status="Aktif" />}>
          <div className="flex-1 flex flex-col divide-y divide-gray-100">
            {[
              { label: 'Nama Lengkap', value: user.nama, icon: <User className="w-4 h-4" /> },
              { label: 'NIM / NIP', value: user.nim, icon: <IdCard className="w-4 h-4" /> },
              { label: 'Alamat Email', value: user.email || '-', icon: <Mail className="w-4 h-4" /> },
              { label: 'Nomor WhatsApp / HP', value: user.noHp || '-', icon: <Phone className="w-4 h-4" /> },
              { label: 'Gedung Binaan', value: gedung?.nama || '-', icon: <Building2 className="w-4 h-4" /> },
            ].map(row => (
              <div key={row.label} className="flex-1 flex items-center gap-3 px-5 py-3 text-xs">
                <span className="w-8 h-8 shrink-0 rounded-lg bg-gray-50 border border-gray-100 text-emerald-700 flex items-center justify-center">{row.icon}</span>
                <span className="w-40 shrink-0 text-gray-500 font-medium">{row.label}</span>
                <span className="flex-1 min-w-0 text-right font-semibold text-gray-900 truncate" style={{ fontFamily: 'Plus Jakarta Sans' }} title={row.value}>{row.value}</span>
              </div>
            ))}
            <p className="px-5 py-3 text-[11px] text-gray-400">Data kontak hanya dapat diubah oleh admin.</p>
          </div>
        </KartuProfil>

        <KartuGantiPassword user={user} onLogout={onLogout} susun />
      </div>
    </div>
  )
}
