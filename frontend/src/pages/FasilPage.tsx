import { useState, useEffect } from 'react'
import type { AturanPresensi, CurrentUser, Gedung, HariLibur, IzinRecord, Penghuni, PresensiRecord, PresensiStatus, Sesi, StatusFoto, EventAsrama, RekapEventResult } from '../types'
import AppLayout, { SectionTitle, Badge, ConfirmDialog } from '../components/AppLayout'
import { JadwalMalamFasil } from '../components/JadwalMalam'
import { downloadReport, type ExportFormat } from '../ekspor'
import { FotoBadge, FotoWajah, RekapStats, RekapTable, SesiToggle, formatRentangIzin, type RekapRow } from '../components/PresensiWidgets'
import DateInput from '../components/DateInput'
import { notifikasiFasil } from '../notifikasiPeran'
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
  updateIzinStatusApi, koreksiPresensiApi, validasiFotoApi, validasiFotoMassalApi, fetchAturanPresensi, ATURAN_PRESENSI_DEFAULT
} from '../api'
import {
  cariLibur, formatTanggal, hitungStatus, penghuniWajibAbsen, periodeRekap, riwayatPenghuni, sesiAktif, sesiUntuk, statusSesi, toHM, todayLocal, type DataPresensi,
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
  Search,
  Eye,
} from 'lucide-react'
import { EventFormModal, EventRekapModal } from '../components/EventModals'

const navItems = [
  { id: 'dashboard', label: 'Dashboard Fasil', icon: <LayoutDashboard className="w-[18px] h-[18px]" /> },
  { id: 'event', label: 'Event Gedung', icon: <CalendarDays className="w-[18px] h-[18px]" /> },
  { id: 'monitor', label: 'Monitor Presensi', icon: <ClipboardCheck className="w-[18px] h-[18px]" /> },
  { id: 'izin', label: 'Manajemen Izin', icon: <FileCheck className="w-[18px] h-[18px]" /> },
  { id: 'foto', label: 'Validasi Foto', icon: <Camera className="w-[18px] h-[18px]" /> },
  { id: 'rekap', label: 'Rekap Kehadiran', icon: <BarChart3 className="w-[18px] h-[18px]" /> },
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
  const nimGedung = new Set(penghuni.filter(p => gedungSaya && p.namaGedung === gedungSaya.nama).map(p => p.nim))
  const izinGedung = izinData.filter(i => nimGedung.has(i.nim) || (gedungSaya && i.namaGedung === gedungSaya.nama))
  const data: DataPresensi = { presensi, izin: izinData, libur }
  // Foto presensi mandiri penghuni gedung ini (penghuni yang pindah gedung divalidasi PJ gedung barunya)
  const nimAnggota = new Set(anggota.map(p => p.nim))
  const presensiBerfoto = presensi.filter(r => r.statusFoto && r.fotoWajah && nimAnggota.has(r.nim))
  // Rekap 30 hari per penghuni; dipakai tab Rekap dan peringatan di dashboard
  const rekapPenghuni = anggota.map(p => {
    const riwayat = riwayatPenghuni(p.nim, periodeRekap(today, p.tanggalMasuk), today, sesiList, data, now, p.namaGedung)
    return { penghuni: p, c: hitungStatus(riwayat.map(r => r.detail.status)) }
  }).sort((a, b) => b.c['Tidak Hadir'] - a.c['Tidak Hadir'] || a.c.persen - b.c.persen)
  const sering = rekapPenghuni.filter(r => r.c['Tidak Hadir'] >= aturan.batasTidakHadir)
  const fotoMenunggu = presensiBerfoto.filter(r => r.statusFoto === 'Menunggu').length
  const menu = navItems.map(n => n.id === 'foto' && fotoMenunggu > 0 ? { ...n, label: `${n.label} (${fotoMenunggu})` } : n)

  const rekapRows = (tanggal: string, sesiNama: string): RekapRow[] => {
    const sesi = sesiUntuk(sesiList, sesiNama, gedungSaya?.nama, tanggal)
    if (!sesi) return []
    return anggota.map(p => ({ penghuni: p, detail: statusSesi(p.nim, tanggal, sesi, data, now) }))
  }

  const handleKeputusanIzin = async (id: number, status: 'Disetujui' | 'Ditolak', catatan: string) => {
    setIzinData(prev => prev.map(i => i.id === id
      ? { ...i, statusPersetujuan: status, nimApprover: user.nim, namaApprover: user.nama, tanggalApproval: today, catatanApprover: catatan }
      : i
    ))
    setSelectedIzin(null)
    await updateIzinStatusApi(id, status, user.nim, catatan)
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
        <div className="bg-white rounded-2xl p-10 text-center border border-amber-200 max-w-xl mx-auto">
          <Building2 className="w-10 h-10 text-amber-600 mx-auto mb-3" />
          <h3 className="font-bold text-base text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>Anda belum ditetapkan sebagai PJ gedung</h3>
          <p className="text-sm text-gray-500 mt-1">Hubungi admin agar akun Anda ditetapkan sebagai penanggung jawab salah satu gedung asrama.</p>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout user={user} onLogout={onLogout} navItems={menu} activeTab={activeTab} onTabChange={setActiveTab}
      notifikasi={notifikasiFasil({ izinGedung, presensiBerfoto, sering, batasTidakHadir: aturan.batasTidakHadir })}>
      <div className="mb-5 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-emerald-100 text-xs font-semibold text-emerald-900">
        <Building2 className="w-4 h-4 text-emerald-700" />
        <span>Penanggung jawab {gedungSaya.nama} · {anggota.length} penghuni wajib absen</span>
      </div>

      {activeTab === 'dashboard' && (
        <JadwalMalamFasil gedung={gedungSaya} sesiList={sesiList} onTersimpan={() => fetchSesi().then(setSesiList)} />
      )}
      {activeTab === 'dashboard' && (
        <FasilDashboard
          sesiList={sesiAktifList}
          rekapRows={rekapRows}
          today={today}
          now={now}
          liburHariIni={cariLibur(today, libur)}
          pendingIzin={izinGedung.filter(i => i.statusPersetujuan === 'Pending')}
          onKoreksi={(row, sesi) => setKoreksi({ row, tanggal: today, sesi })}
          onOpenIzin={setSelectedIzin}
          sering={sering}
          batasTidakHadir={aturan.batasTidakHadir}
          onLihatRekap={() => setActiveTab('rekap')}
          fotoMenunggu={fotoMenunggu}
          onLihatFoto={() => setActiveTab('foto')}
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
          sesiList={sesiAktif(sesiList, gedungSaya.nama)}
          rekapRows={rekapRows}
          today={today}
          onKoreksi={(row, tanggal, sesi) => setKoreksi({ row, tanggal, sesi })}
        />
      )}
      {activeTab === 'izin' && <FasilIzin izinData={izinGedung} onSelect={setSelectedIzin} />}
      {activeTab === 'foto' && <FasilValidasiFoto records={presensiBerfoto} onValidasi={handleValidasiFoto} onTerimaMassal={handleTerimaMassal} />}
      {activeTab === 'rekap' && <FasilRekap rows={rekapPenghuni} batas={aturan.batasTidakHadir} namaGedung={gedungSaya.nama} />}

      {selectedIzin && (
        <IzinModal izin={selectedIzin} onClose={() => setSelectedIzin(null)} onDecide={handleKeputusanIzin} />
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
      {/* Action Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4.5 rounded-2xl border border-emerald-100/90 shadow-xs">
        <div>
          <h3 className="text-base font-extrabold text-emerald-950" style={{ fontFamily: 'Plus Jakarta Sans' }}>
            Event & Kegiatan {gedungSaya.nama}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Buat kegiatan gedung, atur radius presensi di peta, dan pantau rekap kehadiran peserta
          </p>
        </div>
        <button
          type="button"
          onClick={onTambahEvent}
          className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-emerald-700/20 cursor-pointer transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Buat Event Gedung</span>
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-gray-100 shadow-xs">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari event, agenda, lokasi..."
            value={cari}
            onChange={e => setCari(e.target.value)}
            className="pl-8 pr-3 py-1.5 rounded-xl border border-gray-200 text-xs outline-none focus:border-emerald-600 w-52 sm:w-72 bg-gray-50/50"
          />
        </div>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs bg-white outline-none focus:border-emerald-600 font-medium"
        >
          <option value="semua">Semua Status ({eventFasil.length})</option>
          <option value="Akan Datang">Akan Datang</option>
          <option value="Sedang Berlangsung">Sedang Berlangsung</option>
          <option value="Selesai">Selesai</option>
        </select>
      </div>

      {/* Grid Cards */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100 shadow-xs">
          <CalendarDays className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h4 className="font-extrabold text-base text-gray-800 mb-1" style={{ fontFamily: 'Plus Jakarta Sans' }}>
            Belum Ada Event Terjadwal
          </h4>
          <p className="text-xs text-gray-500 max-w-sm mx-auto mb-4">
            Belum ada agenda atau kegiatan gedung yang terdaftar saat ini.
          </p>
          <button
            type="button"
            onClick={onTambahEvent}
            className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Buat Event Gedung Baru</span>
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-5">
          {filtered.map(ev => {
            const st = getStatusEvent(ev)
            const adalahGedungSaya = ev.tipe === 'gedung' && ev.idGedung === gedungSaya.id
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

                    {adalahGedungSaya && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onEditEvent(ev)}
                          title="Edit Event Gedung"
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
                    )}
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
                    {adalahGedungSaya ? 'Dikelola oleh Anda' : `Penyelenggara: ${ev.namaPembuat || 'Admin'}`}
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

type RekapPenghuni = { penghuni: Penghuni; c: ReturnType<typeof hitungStatus> }

function FasilDashboard({ sesiList, rekapRows, today, now, liburHariIni, pendingIzin, onKoreksi, onOpenIzin, sering, batasTidakHadir, onLihatRekap, fotoMenunggu, onLihatFoto }: {
  sesiList: Sesi[]
  rekapRows: (tanggal: string, sesi: string) => RekapRow[]
  today: string
  now: Date
  liburHariIni?: HariLibur
  pendingIzin: IzinRecord[]
  onKoreksi: (row: RekapRow, sesi: string) => void
  onOpenIzin: (i: IzinRecord) => void
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
  const fase = s ? (now < new Date(`${today}T${s.jamMulai}`) ? 'belum' : now > new Date(`${today}T${s.jamSelesai}`) ? 'tutup' : 'buka') : null

  return (
    <div className="space-y-4">
      {/* Header Ringkasan & Filter Sesi */}
      <div className="bg-white rounded-2xl p-4 border border-gray-200/90 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>
              Pantauan Sesi
            </span>
            {liburHariIni ? (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-sky-100 text-sky-800">
                🌴 Libur: {liburHariIni.keterangan}
              </span>
            ) : fase === 'buka' ? (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Sesi {sesi} Sedang Dibuka
              </span>
            ) : s ? (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-500">
                Sesi {sesi} ({s.jamMulai}–{s.jamSelesai}) · {fase === 'tutup' ? 'Ditutup' : 'Akan Datang'}
              </span>
            ) : null}
          </div>

          <SesiToggle sesiList={sesiList} value={sesi} onChange={setSesi} />
        </div>

        {/* Metrik Pills & Progress Bar */}
        <div className="pt-2 border-t border-gray-100">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold">
                {c.Hadir} Hadir
              </span>
              <span className="px-2 py-0.5 rounded-md bg-gray-50 border border-gray-200 text-gray-600 text-xs font-medium">
                {c.Belum} Belum
              </span>
              <span className="px-2 py-0.5 rounded-md bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
                {c['Tidak Hadir']} Alpa
              </span>
              <span className="px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium">
                {c.Izin + c.Libur} Izin
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 font-medium">{c.Hadir}/{rows.length} penghuni</span>
              <span className="px-2.5 py-0.5 rounded-md bg-[#0e4b29] text-white text-xs font-bold shadow-2xs">
                {c.persen}%
              </span>
            </div>
          </div>

          <div className="h-2 rounded-full bg-gray-100 overflow-hidden flex">
            <div
              className="h-full bg-emerald-600 transition-all duration-300"
              style={{ width: `${rows.length > 0 ? (c.Hadir / rows.length) * 100 : 0}%` }}
            />
            <div
              className="h-full bg-amber-400 transition-all duration-300"
              style={{ width: `${rows.length > 0 ? ((c.Izin + c.Libur) / rows.length) * 100 : 0}%` }}
            />
            <div
              className="h-full bg-rose-500 transition-all duration-300"
              style={{ width: `${rows.length > 0 ? (c['Tidak Hadir'] / rows.length) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* Tindak Lanjut Mendesak (Jika ada) */}
      {(fotoMenunggu > 0 || pendingIzin.length > 0 || sering.length > 0) && (
        <div className="space-y-2">
          {fotoMenunggu > 0 && (
            <div className="p-3 rounded-xl bg-orange-50 border border-orange-200/90 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <Camera className="w-4 h-4 text-orange-600 shrink-0" />
                <span className="font-bold text-orange-950 truncate">
                  {fotoMenunggu} foto presensi menunggu validasi
                </span>
              </div>
              <button
                onClick={onLihatFoto}
                className="px-3 py-1 rounded-lg text-xs font-bold text-orange-900 bg-white hover:bg-orange-100 border border-orange-300 cursor-pointer shadow-2xs shrink-0"
              >
                Validasi
              </button>
            </div>
          )}

          {pendingIzin.length > 0 && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200/90 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <FileCheck className="w-4 h-4 text-amber-700 shrink-0" />
                <span className="font-bold text-amber-950 truncate">
                  {pendingIzin.length} permohonan izin perlu persetujuan
                </span>
                <span className="text-amber-800 hidden sm:inline truncate">
                  ({pendingIzin[0].namaPenghuni} - {pendingIzin[0].alasan})
                </span>
              </div>
              <button
                onClick={() => onOpenIzin(pendingIzin[0])}
                className="px-3 py-1 rounded-lg text-xs font-bold text-amber-950 bg-white hover:bg-amber-100 border border-amber-300 cursor-pointer shadow-2xs shrink-0"
              >
                Tinjau ({pendingIzin.length})
              </button>
            </div>
          )}

          {sering.length > 0 && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200/90 flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span className="font-bold text-red-950 truncate">
                  {sering.length} penghuni sering alpa (≥{batasTidakHadir} sesi)
                </span>
              </div>
              <button
                onClick={onLihatRekap}
                className="px-3 py-1 rounded-lg text-xs font-bold text-red-900 bg-white hover:bg-red-100 border border-red-300 cursor-pointer shadow-2xs shrink-0"
              >
                Rekap
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tabel Penghuni */}
      <div className="bg-white rounded-2xl overflow-hidden border border-gray-200 shadow-2xs">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <span className="font-bold text-sm text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>
            Daftar Penghuni — Sesi {sesi || 'Aktif'}
          </span>
          <span className="text-xs text-gray-400 font-medium">{rows.length} penghuni terdaftar</span>
        </div>
        <RekapTable rows={rows} onKoreksi={row => onKoreksi(row, sesi)} />
      </div>
    </div>
  )
}

function FasilMonitor({ sesiList, rekapRows, today, onKoreksi }: {
  sesiList: Sesi[]
  rekapRows: (tanggal: string, sesi: string) => RekapRow[]
  today: string
  onKoreksi: (row: RekapRow, tanggal: string, sesi: string) => void
}) {
  const [tanggal, setTanggal] = useState(today)
  const [pilihan, setSesi] = useState('')
  const sesi = sesiList.some(x => x.nama === pilihan) ? pilihan : sesiList[0]?.nama || ''
  const [filterStatus, setFilterStatus] = useState('')
  const rows = rekapRows(tanggal, sesi)
  const filtered = filterStatus ? rows.filter(r => r.detail.status === filterStatus) : rows

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <DateInput
          max={today}
          className="px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 transition-all font-medium text-gray-700"
          value={tanggal}
          onChange={e => setTanggal(e.target.value)}
        />
        <SesiToggle sesiList={sesiList} value={sesi} onChange={setSesi} />
        <select
          className="px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm outline-none focus:border-emerald-600 font-medium text-gray-700"
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
        >
          <option value="">Semua Status</option>
          {['Hadir', 'Belum', 'Tidak Hadir', 'Izin', 'Libur'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <RekapStats rows={rows} />

      <div className="bg-white rounded-2xl overflow-hidden border border-emerald-100/80 shadow-xs">
        <RekapTable rows={filtered} onKoreksi={row => onKoreksi(row, tanggal, sesi)} emptyText="Tidak ada penghuni untuk filter yang dipilih" />
      </div>
    </div>
  )
}

function FasilIzin({ izinData, onSelect }: { izinData: IzinRecord[]; onSelect: (i: IzinRecord) => void }) {
  const [filter, setFilter] = useState<string>('Pending')
  const filtered = filter === 'Semua' ? izinData : izinData.filter(i => i.statusPersetujuan === filter)

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {['Pending', 'Disetujui', 'Ditolak', 'Semua'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              filter === f ? 'bg-emerald-800 text-white shadow-xs' : 'bg-white text-gray-600 border border-gray-200 hover:border-emerald-500'
            }`}
            style={{ fontFamily: 'Plus Jakarta Sans' }}
          >
            {f} ({f === 'Semua' ? izinData.length : izinData.filter(i => i.statusPersetujuan === f).length})
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="bg-white rounded-2xl p-10 text-center border border-emerald-100/80">
            <p className="text-sm text-gray-400 font-medium">Tidak ada permohonan izin dalam kategori ini</p>
          </div>
        )}
        {filtered.map(i => (
          <div key={i.id} className="bg-white rounded-2xl p-5 border border-emerald-100/80 shadow-xs hover:shadow-md transition-shadow">
            <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2.5 mb-1.5">
                  <span className="font-extrabold text-base text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>{i.namaPenghuni}</span>
                  <Badge status={i.statusPersetujuan} />
                </div>
                <p className="mono text-xs text-gray-500 mb-2">{i.nim} · Kamar {i.nomorKamar}</p>
                <p className="text-sm text-gray-800 mb-3 font-medium leading-relaxed">{i.alasan}</p>
                <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 font-medium">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-gray-400" />
                    <span>{formatRentangIzin(i.tanggal, i.tanggalSelesai, i.sesi, i.hariBerulang)}</span>
                  </span>
                  {i.fileBukti && (
                    <span className="flex items-center gap-1.5 text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                      <Paperclip className="w-3 h-3" />
                      <span>{i.fileBukti}</span>
                    </span>
                  )}
                  {i.namaApprover && (
                    <span className="flex items-center gap-1.5 text-emerald-800">
                      <User className="w-3.5 h-3.5" />
                      <span>{i.statusPersetujuan === 'Ditolak' ? 'Ditolak' : 'Disetujui'}: {i.namaApprover}</span>
                    </span>
                  )}
                </div>
                {i.catatanApprover && (
                  <p className="text-xs mt-3 p-2.5 rounded-xl bg-gray-50 text-gray-700 font-medium border border-gray-100">Catatan: {i.catatanApprover}</p>
                )}
              </div>
              <button
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 transition-colors border border-emerald-200 cursor-pointer shrink-0"
                onClick={() => onSelect(i)}
                style={{ fontFamily: 'Plus Jakarta Sans' }}
              >
                {i.statusPersetujuan === 'Pending' ? 'Tinjau & Putuskan' : 'Detail Izin'}
              </button>
            </div>
          </div>
        ))}
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

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-2xl bg-white border border-emerald-100/80 shadow-xs">
        <SectionTitle subtitle="Periksa apakah foto wajah benar penghuni yang bersangkutan. Foto yang ditolak membuat presensi tercatat Tidak Hadir.">
          Validasi Foto Presensi
        </SectionTitle>
      </div>
      <div className="flex gap-2 flex-wrap">
        {daftarFilter.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              filter === f ? 'bg-emerald-800 text-white shadow-xs' : 'bg-white text-gray-600 border border-gray-200 hover:border-emerald-500'
            }`}
            style={{ fontFamily: 'Plus Jakarta Sans' }}
          >
            {f} ({records.filter(r => r.statusFoto === f).length})
          </button>
        ))}
      </div>

      {filter === 'Menunggu' && menunggu.length > 0 && (
        <div className="sticky top-2 z-10 flex flex-wrap items-center gap-3 px-4 py-3 rounded-2xl bg-white/95 backdrop-blur border border-emerald-100 shadow-xs">
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
          <button
            onClick={terimaTerpilih}
            disabled={terpilih.length === 0 || prosesMassal}
            className="ml-auto inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Check className="w-3.5 h-3.5" />
            {prosesMassal ? 'Menyimpan…' : `Terima ${terpilih.length || ''} foto terpilih`}
          </button>
          <p className="basis-full text-[11px] text-gray-400">Foto yang bermasalah tolak satu per satu karena wajib disertai catatan.</p>
        </div>
      )}
      {pesanMassal && <p className={`text-xs font-semibold ${pesanMassal.ok ? 'text-emerald-700' : 'text-red-700'}`}>{pesanMassal.teks}</p>}

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center border border-emerald-100/80">
          <p className="text-sm text-gray-400 font-medium">
            {filter === 'Menunggu' ? 'Semua foto presensi sudah divalidasi' : 'Tidak ada foto dalam kategori ini'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map(r => <KartuValidasiFoto key={r.id} rec={r} onValidasi={onValidasi} dipilih={pilih.has(r.id)} onPilih={() => togglePilih(r.id)} />)}
        </div>
      )}
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
    <div className={`bg-white rounded-2xl overflow-hidden border shadow-xs flex flex-col ${dipilih ? 'border-emerald-500 ring-2 ring-emerald-500/30' : 'border-emerald-100/80'}`}>
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
            <a href={`https://www.google.com/maps?q=${rec.latitude},${rec.longitude}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-1 text-xs text-blue-700 hover:underline">
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
            {error && <p className="text-xs text-red-700 font-semibold">{error}</p>}
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
                className="flex-1 py-2 rounded-xl font-bold text-xs text-white bg-emerald-700 hover:bg-emerald-800 flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
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

// Rekap per penghuni 30 hari terakhir untuk tindak lanjut pelanggaran
// Ambang "perlu ditegur" diatur admin (pengaturan batas_tidak_hadir)
function FasilRekap({ rows, batas: BATAS_ALPA, namaGedung }: { rows: RekapPenghuni[]; batas: number; namaGedung: string }) {
  const unduh = (format: ExportFormat) => {
    const today = todayLocal()
    const judul = `Rekap Kehadiran ${namaGedung} (30 hari s/d ${formatTanggal(today, 'tanpaHari')})`
    const headers = ['NIM', 'Nama', 'Kamar', 'Hadir', 'Izin', 'Tidak Hadir', 'Sesi Wajib', 'Kehadiran', 'Catatan']
    const data = rows.map(({ penghuni: p, c }) => [
      p.nim, p.nama, p.nomorKamar, c.Hadir, c.Izin, c['Tidak Hadir'], c.wajib, `${c.persen}%`,
      c['Tidak Hadir'] >= BATAS_ALPA ? 'Perlu ditegur' : '',
    ])
    const slug = namaGedung.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    downloadReport(`rekap-kehadiran-${slug}-${today}.${format}`, headers, data, format, judul)
  }

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-2xl bg-white border border-emerald-100/80 shadow-xs flex flex-col sm:flex-row sm:items-start gap-3">
        <div className="flex-1">
          <SectionTitle subtitle={`Rekap 30 hari terakhir. Penghuni dengan Tidak Hadir ≥ ${BATAS_ALPA} sesi ditandai untuk ditindaklanjuti.`}>
            Rekap Kehadiran Penghuni
          </SectionTitle>
        </div>
        <div className="flex gap-2 shrink-0">
          {([['xlsx', 'Excel'], ['pdf', 'PDF']] as const).map(([format, label]) => (
            <button
              key={format}
              onClick={() => unduh(format)}
              disabled={rows.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-emerald-800 bg-white border border-emerald-200 hover:bg-emerald-700 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
              title={`Unduh rekap sebagai ${label}`}
            >
              <Download className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="bg-white rounded-2xl overflow-hidden border border-emerald-100/80 shadow-xs overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-emerald-50/60 border-b border-emerald-100">
              {['Nama Lengkap', 'Kamar', 'Hadir', 'Izin', 'Tidak Hadir', 'Kehadiran', 'Catatan'].map(h => (
                <th key={h} className="text-left px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-emerald-950" style={{ fontFamily: 'Plus Jakarta Sans' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map(({ penghuni: p, c }) => (
              <tr key={p.nim} className={c['Tidak Hadir'] >= BATAS_ALPA ? 'bg-red-50/40' : 'hover:bg-emerald-50/30'}>
                <td className="px-5 py-3.5">
                  <p className="font-bold text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>{p.nama}</p>
                  <p className="mono text-[11px] text-gray-500">{p.nim}</p>
                </td>
                <td className="px-5 py-3.5 mono text-xs font-bold text-emerald-800">{p.nomorKamar}</td>
                <td className="px-5 py-3.5 font-semibold text-emerald-700">{c.Hadir}</td>
                <td className="px-5 py-3.5 font-semibold text-amber-700">{c.Izin}</td>
                <td className="px-5 py-3.5 font-semibold text-rose-700">{c['Tidak Hadir']}</td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full bg-emerald-600" style={{ width: `${c.persen}%` }} />
                    </div>
                    <span className="text-xs font-bold text-gray-700">{c.persen}%</span>
                  </div>
                </td>
                <td className="px-5 py-3.5 text-xs">
                  {c['Tidak Hadir'] >= BATAS_ALPA
                    ? <span className="font-bold text-red-700">Perlu ditegur</span>
                    : <span className="text-gray-400">–</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function IzinModal({ izin, onClose, onDecide }: {
  izin: IzinRecord
  onClose: () => void
  onDecide: (id: number, status: 'Disetujui' | 'Ditolak', catatan: string) => void
}) {
  const [catatan, setCatatan] = useState('')
  const [error, setError] = useState('')
  const pending = izin.statusPersetujuan === 'Pending'

  const tolak = () => {
    if (!catatan.trim()) {
      setError('Alasan penolakan wajib diisi agar penghuni mengetahui alasannya.')
      return
    }
    onDecide(izin.id, 'Ditolak', catatan.trim())
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl border border-emerald-100">
        <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <FileCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-emerald-950" style={{ fontFamily: 'Plus Jakarta Sans' }}>Detail Pengajuan Izin</h3>
              <p className="text-xs text-gray-400">Verifikasi berkas dan alasan ketidakhadiran</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer">
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
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-emerald-900 mb-1" style={{ fontFamily: 'Plus Jakarta Sans' }}>Alasan Permohonan Izin:</label>
            <div className="p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-100 text-sm text-gray-800 leading-relaxed font-medium">{izin.alasan}</div>
          </div>

          {izin.fileBukti && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-blue-50 border border-blue-100 text-blue-700 text-xs font-semibold">
              <Paperclip className="w-4 h-4 shrink-0 text-blue-500" />
              <span>{izin.fileBukti}</span>
            </div>
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
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 transition-all font-medium placeholder:text-gray-400"
                placeholder="Contoh: Lampirkan surat keterangan dokter..."
                value={catatan}
                onChange={e => { setCatatan(e.target.value); setError('') }}
              />
              {error && <p className="text-xs text-red-700 font-semibold mt-1">{error}</p>}
            </div>
            <div className="flex gap-3">
              <button
                className="flex-1 py-2.5 px-4 rounded-xl font-bold text-sm text-rose-700 bg-rose-50 hover:bg-rose-100 transition-colors border border-rose-200 flex items-center justify-center gap-1.5 cursor-pointer"
                onClick={tolak}
              >
                <X className="w-4 h-4" />
                <span>Tolak Izin</span>
              </button>
              <button
                className="flex-1 py-2.5 px-4 rounded-xl font-bold text-sm text-white bg-emerald-700 hover:bg-emerald-800 transition-colors shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                onClick={() => onDecide(izin.id, 'Disetujui', catatan.trim())}
              >
                <Check className="w-4 h-4" />
                <span>Setujui Izin</span>
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
        <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Pencil className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-emerald-950" style={{ fontFamily: 'Plus Jakarta Sans' }}>Koreksi Presensi</h3>
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
            {error && <p className="text-xs text-red-700 font-semibold mt-1">{error}</p>}
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
