import { useState, useEffect } from 'react'
import type { CurrentUser, Gedung, HariLibur, IzinRecord, Penghuni, PresensiRecord, PresensiStatus, Sesi } from '../types'
import AppLayout, { SectionTitle, Badge } from '../components/AppLayout'
import { RekapStats, RekapTable, SesiToggle, formatRentangIzin, type RekapRow } from '../components/PresensiWidgets'
import {
  presensiList as initialPresensi,
  izinList as initialIzin,
  penghuniList as initialPenghuni,
  gedungList as initialGedung,
  sesiList as initialSesi,
  liburList as initialLibur,
} from '../data/mockData'
import { fetchPresensi, fetchIzin, fetchPenghuni, fetchGedung, fetchSesi, fetchLibur, updateIzinStatusApi, koreksiPresensiApi } from '../api'
import {
  cariLibur, hitungStatus, penghuniWajibAbsen, periodeRekap, riwayatPenghuni, sesiAktif, statusSesi, toHM, todayLocal, type DataPresensi,
} from '../logic'
import {
  LayoutDashboard,
  ClipboardCheck,
  FileCheck,
  BarChart3,
  AlertCircle,
  Calendar,
  Paperclip,
  User,
  Check,
  X,
  Pencil,
  Building2,
  Palmtree,
} from 'lucide-react'

const navItems = [
  { id: 'dashboard', label: 'Dashboard Fasil', icon: <LayoutDashboard className="w-[18px] h-[18px]" /> },
  { id: 'monitor', label: 'Monitor Presensi', icon: <ClipboardCheck className="w-[18px] h-[18px]" /> },
  { id: 'izin', label: 'Manajemen Izin', icon: <FileCheck className="w-[18px] h-[18px]" /> },
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
  const [presensi, setPresensi] = useState<PresensiRecord[]>(initialPresensi)
  const [izinData, setIzinData] = useState<IzinRecord[]>(initialIzin)
  const [sesiList, setSesiList] = useState<Sesi[]>(initialSesi)
  const [libur, setLibur] = useState<HariLibur[]>(initialLibur)
  const [selectedIzin, setSelectedIzin] = useState<IzinRecord | null>(null)
  const [koreksi, setKoreksi] = useState<KoreksiTarget | null>(null)
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    fetchPenghuni().then(setPenghuni)
    fetchGedung().then(setGedungList)
    fetchPresensi().then(setPresensi)
    fetchIzin().then(setIzinData)
    fetchSesi().then(setSesiList)
    fetchLibur().then(setLibur)
  }, [])

  // Lingkup data fasil: hanya gedung tempat ia ditetapkan sebagai penanggung jawab (gedung.NIM_Pj)
  const gedungSaya = gedungList.find(g => g.nimPj === user.nim) || null
  const today = todayLocal()
  const sesiAktifList = sesiAktif(sesiList)
  const anggota = gedungSaya ? penghuniWajibAbsen(penghuni, gedungSaya.nama) : []
  const nimGedung = new Set(penghuni.filter(p => gedungSaya && p.namaGedung === gedungSaya.nama).map(p => p.nim))
  const izinGedung = izinData.filter(i => nimGedung.has(i.nim) || (gedungSaya && i.namaGedung === gedungSaya.nama))
  const data: DataPresensi = { presensi, izin: izinData, libur }

  const rekapRows = (tanggal: string, sesiNama: string): RekapRow[] => {
    const sesi = sesiList.find(s => s.nama === sesiNama)
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

  const handleKoreksi = async (status: PresensiStatus, keterangan: string) => {
    if (!koreksi) return
    const { row, tanggal, sesi } = koreksi
    const p = row.penghuni
    const record: PresensiRecord = {
      id: row.detail.presensi?.id ?? Date.now(),
      nim: p.nim, namaPenghuni: p.nama, nomorKamar: p.nomorKamar, namaGedung: p.namaGedung,
      tanggal, sesi, waktu: row.detail.presensi?.waktu || toHM(new Date()),
      latitude: row.detail.presensi?.latitude ?? null, longitude: row.detail.presensi?.longitude ?? null,
      status, fotoWajah: '', keterangan, dikoreksiOleh: user.nim,
    }
    setPresensi(prev => [record, ...prev.filter(r => !(r.nim === p.nim && r.tanggal === tanggal && r.sesi === sesi))])
    setKoreksi(null)
    await koreksiPresensiApi({ nim: p.nim, tanggal, sesi, status, keterangan, korektorNim: user.nim })
  }

  if (!gedungSaya) {
    return (
      <AppLayout user={user} onLogout={onLogout} navItems={navItems} activeTab={activeTab} onTabChange={setActiveTab}>
        <div className="bg-white rounded-2xl p-10 text-center border border-amber-200 max-w-xl mx-auto">
          <Building2 className="w-10 h-10 text-amber-600 mx-auto mb-3" />
          <h3 className="font-bold text-base text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>Anda belum ditetapkan sebagai PJ gedung</h3>
          <p className="text-sm text-gray-500 mt-1">Hubungi admin agar akun Anda ditetapkan sebagai penanggung jawab salah satu gedung asrama.</p>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout user={user} onLogout={onLogout} navItems={navItems} activeTab={activeTab} onTabChange={setActiveTab}>
      <div className="mb-5 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-emerald-100 text-xs font-semibold text-emerald-900">
        <Building2 className="w-4 h-4 text-emerald-700" />
        <span>Penanggung jawab {gedungSaya.nama} · {anggota.length} penghuni wajib absen</span>
      </div>

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
        />
      )}
      {activeTab === 'monitor' && (
        <FasilMonitor
          sesiList={sesiAktifList}
          rekapRows={rekapRows}
          today={today}
          onKoreksi={(row, tanggal, sesi) => setKoreksi({ row, tanggal, sesi })}
        />
      )}
      {activeTab === 'izin' && <FasilIzin izinData={izinGedung} onSelect={setSelectedIzin} />}
      {activeTab === 'rekap' && <FasilRekap anggota={anggota} sesiList={sesiList} data={data} today={today} now={now} />}

      {selectedIzin && (
        <IzinModal izin={selectedIzin} onClose={() => setSelectedIzin(null)} onDecide={handleKeputusanIzin} />
      )}
      {koreksi && (
        <KoreksiModal target={koreksi} onClose={() => setKoreksi(null)} onSave={handleKoreksi} />
      )}
    </AppLayout>
  )
}

function FasilDashboard({ sesiList, rekapRows, today, now, liburHariIni, pendingIzin, onKoreksi, onOpenIzin }: {
  sesiList: Sesi[]
  rekapRows: (tanggal: string, sesi: string) => RekapRow[]
  today: string
  now: Date
  liburHariIni?: HariLibur
  pendingIzin: IzinRecord[]
  onKoreksi: (row: RekapRow, sesi: string) => void
  onOpenIzin: (i: IzinRecord) => void
}) {
  // Default ke sesi yang sedang dibuka, atau sesi terakhir yang sudah dimulai
  const hm = toHM(now)
  const defaultSesi = [...sesiList].reverse().find(s => s.jamMulai <= hm)?.nama || sesiList[0]?.nama || ''
  const [sesi, setSesi] = useState(defaultSesi)
  const rows = rekapRows(today, sesi)
  const s = sesiList.find(x => x.nama === sesi)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-emerald-100/80 shadow-xs">
        <div>
          <h4 className="font-extrabold text-base text-emerald-950" style={{ fontFamily: 'Plus Jakarta Sans' }}>Pantauan Sesi Hari Ini</h4>
          <p className="text-xs text-gray-500 font-medium">Siapa saja yang sudah dan belum absen di gedung Anda</p>
        </div>
        <SesiToggle sesiList={sesiList} value={sesi} onChange={setSesi} />
      </div>

      {liburHariIni && (
        <div className="p-3 rounded-xl bg-sky-50 border border-sky-200 text-sky-900 text-xs font-semibold flex items-center gap-2">
          <Palmtree className="w-4 h-4 text-sky-600" />
          <span>Hari ini libur ({liburHariIni.keterangan}). Tidak ada kewajiban presensi.</span>
        </div>
      )}

      <RekapStats rows={rows} />

      <div className="bg-white rounded-2xl overflow-hidden border border-emerald-100/80 shadow-xs">
        <div className="px-6 py-4 border-b border-emerald-100">
          <SectionTitle subtitle={s ? `Sesi ${s.nama} ${s.jamMulai}–${s.jamSelesai} WIB · penghuni yang belum absen saat sesi ditutup otomatis Tidak Hadir` : ''}>
            Daftar Penghuni — Sesi {sesi}
          </SectionTitle>
        </div>
        <RekapTable rows={rows} onKoreksi={row => onKoreksi(row, sesi)} />
      </div>

      {pendingIzin.length > 0 && (
        <div className="bg-amber-50/80 rounded-2xl p-6 border border-amber-200/80 shadow-xs">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="w-5 h-5 text-amber-700" />
            <h4 className="font-extrabold text-base text-amber-950" style={{ fontFamily: 'Plus Jakarta Sans' }}>
              Pengajuan Izin Menunggu Persetujuan ({pendingIzin.length})
            </h4>
          </div>
          <div className="grid gap-3">
            {pendingIzin.map(i => (
              <div key={i.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-white border border-amber-200 shadow-2xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>{i.namaPenghuni}</span>
                    <span className="mono text-xs text-gray-500">({i.nim} · {i.nomorKamar})</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{formatRentangIzin(i.tanggal, i.tanggalSelesai, i.sesi)}</p>
                  <p className="text-xs text-amber-900 mt-1 font-medium leading-relaxed">{i.alasan}</p>
                </div>
                <button
                  onClick={() => onOpenIzin(i)}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 cursor-pointer shrink-0"
                >
                  Tinjau
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
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
  const [sesi, setSesi] = useState(sesiList[0]?.nama || '')
  const [filterStatus, setFilterStatus] = useState('')
  const rows = rekapRows(tanggal, sesi)
  const filtered = filterStatus ? rows.filter(r => r.detail.status === filterStatus) : rows

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="date"
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
                    <span>{formatRentangIzin(i.tanggal, i.tanggalSelesai, i.sesi)}</span>
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

// Rekap per penghuni 30 hari terakhir untuk tindak lanjut pelanggaran
function FasilRekap({ anggota, sesiList, data, today, now }: {
  anggota: Penghuni[]
  sesiList: Sesi[]
  data: DataPresensi
  today: string
  now: Date
}) {
  const BATAS_ALPA = 3
  const rows = anggota.map(p => {
    const riwayat = riwayatPenghuni(p.nim, periodeRekap(today, p.tanggalMasuk), today, sesiList, data, now)
    return { penghuni: p, c: hitungStatus(riwayat.map(r => r.detail.status)) }
  }).sort((a, b) => b.c['Tidak Hadir'] - a.c['Tidak Hadir'] || a.c.persen - b.c.persen)

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-2xl bg-white border border-emerald-100/80 shadow-xs">
        <SectionTitle subtitle={`Rekap 30 hari terakhir. Penghuni dengan Tidak Hadir ≥ ${BATAS_ALPA} sesi ditandai untuk ditindaklanjuti.`}>
          Rekap Kehadiran Penghuni
        </SectionTitle>
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
              ['Berlaku', formatRentangIzin(izin.tanggal, izin.tanggalSelesai, izin.sesi)],
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
  onSave: (status: PresensiStatus, keterangan: string) => void
}) {
  const current = target.row.detail.status
  const [status, setStatus] = useState<PresensiStatus>(current === 'Hadir' ? 'Hadir' : current === 'Izin' ? 'Izin' : 'Hadir')
  const [keterangan, setKeterangan] = useState('')
  const [error, setError] = useState('')

  const simpan = () => {
    if (!keterangan.trim()) {
      setError('Keterangan koreksi wajib diisi sebagai catatan audit.')
      return
    }
    onSave(status, keterangan.trim())
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
              <p className="text-xs text-gray-400">{target.row.penghuni.nama} · {target.tanggal} · Sesi {target.sesi}</p>
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
            <button className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white bg-emerald-700 hover:bg-emerald-800 transition-colors cursor-pointer" onClick={simpan}>Simpan Koreksi</button>
          </div>
        </div>
      </div>
    </div>
  )
}
