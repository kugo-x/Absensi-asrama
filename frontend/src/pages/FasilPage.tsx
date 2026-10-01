import { useState, useEffect } from 'react'
import type { CurrentUser, IzinRecord, PresensiRecord } from '../types'
import AppLayout, { StatCard, SectionTitle, Badge } from '../components/AppLayout'
import { presensiList as initialPresensi, izinList as initialIzin, penghuniList, TODAY } from '../data/mockData'
import { fetchPresensi, fetchIzin, updateIzinStatusApi } from '../api'
import { 
  LayoutDashboard, 
  ClipboardCheck, 
  FileCheck, 
  History, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Clock, 
  Sun, 
  Moon, 
  Calendar, 
  Paperclip, 
  User, 
  Check, 
  X, 
  ChevronRight,
  Filter,
  Building
} from 'lucide-react'

const navItems = [
  { id: 'dashboard', label: 'Dashboard Fasil', icon: <LayoutDashboard className="w-[18px] h-[18px]" /> },
  { id: 'monitor', label: 'Monitor Presensi', icon: <ClipboardCheck className="w-[18px] h-[18px]" /> },
  { id: 'izin', label: 'Manajemen Izin', icon: <FileCheck className="w-[18px] h-[18px]" /> },
  { id: 'riwayat', label: 'Riwayat Log', icon: <History className="w-[18px] h-[18px]" /> },
]

export default function FasilPage({ user, onLogout }: { user: CurrentUser; onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [presensi, setPresensi] = useState<PresensiRecord[]>(initialPresensi)
  const [izinData, setIzinData] = useState<IzinRecord[]>(initialIzin)
  const [selectedIzin, setSelectedIzin] = useState<IzinRecord | null>(null)
  const [keteranganPenolakan, setKeteranganPenolakan] = useState('')
  const [sesi, setSesi] = useState<'Subuh' | 'Malam'>('Subuh')

  useEffect(() => {
    fetchPresensi().then(data => {
      if (data && data.length > 0) setPresensi(data)
    })
    fetchIzin().then(data => {
      if (data && data.length > 0) setIzinData(data)
    })
  }, [])

  const todayStr = new Date().toISOString().slice(0, 10)
  const todayPresensi = presensi.filter(p => (p.tanggal === todayStr || p.tanggal === TODAY) && p.sesi === sesi)
  const hadir = todayPresensi.filter(p => p.status === 'Hadir').length
  const tidakHadir = todayPresensi.filter(p => p.status === 'Tidak Hadir').length
  const izinCount = todayPresensi.filter(p => p.status === 'Izin').length
  const pendingIzin = izinData.filter(i => i.statusPersetujuan === 'Pending')

  const handleApprove = async (id: number) => {
    setIzinData(prev => prev.map(i => i.id === id
      ? { ...i, statusPersetujuan: 'Disetujui', nimApprover: user.nim, namaApprover: user.nama, tanggalApproval: TODAY }
      : i
    ))
    setSelectedIzin(null)
    await updateIzinStatusApi(id, 'Disetujui', user.nim)
  }

  const handleReject = async (id: number) => {
    setIzinData(prev => prev.map(i => i.id === id
      ? { ...i, statusPersetujuan: 'Ditolak', nimApprover: user.nim, namaApprover: user.nama, tanggalApproval: TODAY, keteranganPenolakan }
      : i
    ))
    setSelectedIzin(null)
    setKeteranganPenolakan('')
    await updateIzinStatusApi(id, 'Ditolak', user.nim)
  }

  return (
    <AppLayout user={user} onLogout={onLogout} navItems={navItems} activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'dashboard' && (
        <FasilDashboard todayPresensi={todayPresensi} hadir={hadir} tidakHadir={tidakHadir} izinCount={izinCount} pendingIzin={pendingIzin} sesi={sesi} setSesi={setSesi} />
      )}
      {activeTab === 'monitor' && <FasilMonitor presensi={presensi} />}
      {activeTab === 'izin' && (
        <FasilIzin
          izinData={izinData}
          onSelect={setSelectedIzin}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )}
      {activeTab === 'riwayat' && <FasilRiwayat presensi={presensi} />}

      {/* Modal Detail & Approval Izin */}
      {selectedIzin && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl border border-emerald-100 animate-scale-up">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <FileCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-emerald-950" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                    Detail Pengajuan Izin
                  </h3>
                  <p className="text-xs text-gray-400">Verifikasi berkas dan alasan ketidakhadiran</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedIzin(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 mb-5">
              <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-100 space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 font-medium">Mahasiswa</span>
                  <span className="font-bold text-gray-900">{selectedIzin.namaPenghuni}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 font-medium">NIM</span>
                  <span className="font-semibold mono text-xs text-gray-700">{selectedIzin.nim}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 font-medium">Kamar & Gedung</span>
                  <span className="font-semibold text-emerald-800">{selectedIzin.nomorKamar} — {selectedIzin.namaGedung}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 font-medium">Rentang Tanggal</span>
                  <span className="font-bold text-gray-800">{selectedIzin.tanggal} s/d {selectedIzin.tanggalAkhir}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500 font-medium">Status Saat Ini</span>
                  <Badge status={selectedIzin.statusPersetujuan} />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-emerald-900 mb-1" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                  Alasan Permohonan Izin:
                </label>
                <div className="p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-100 text-sm text-gray-800 leading-relaxed font-medium">
                  {selectedIzin.alasan}
                </div>
              </div>

              {selectedIzin.fileBukti && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-emerald-900 mb-1" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                    Lampiran Berkas:
                  </label>
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-blue-50 border border-blue-100 text-blue-700 text-xs font-semibold">
                    <Paperclip className="w-4 h-4 shrink-0 text-blue-500" />
                    <span>{selectedIzin.fileBukti}</span>
                  </div>
                </div>
              )}
            </div>

            {selectedIzin.statusPersetujuan === 'Pending' ? (
              <div className="space-y-3 pt-3 border-t border-gray-100">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                    Catatan Penolakan (Wajib jika menolak)
                  </label>
                  <input 
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 transition-all font-medium placeholder:text-gray-400" 
                    placeholder="Contoh: Lampiran surat dokter belum dilampirkan..." 
                    value={keteranganPenolakan} 
                    onChange={e => setKeteranganPenolakan(e.target.value)} 
                  />
                </div>
                <div className="flex gap-3">
                  <button 
                    className="flex-1 py-2.5 px-4 rounded-xl font-bold text-sm text-rose-700 bg-rose-50 hover:bg-rose-100 transition-colors border border-rose-200 flex items-center justify-center gap-1.5 cursor-pointer" 
                    onClick={() => handleReject(selectedIzin.id)}
                  >
                    <X className="w-4 h-4" />
                    <span>Tolak Izin</span>
                  </button>
                  <button 
                    className="flex-1 py-2.5 px-4 rounded-xl font-bold text-sm text-white bg-emerald-700 hover:bg-emerald-800 transition-colors shadow-sm flex items-center justify-center gap-1.5 cursor-pointer" 
                    onClick={() => handleApprove(selectedIzin.id)}
                  >
                    <Check className="w-4 h-4" />
                    <span>Setujui Izin</span>
                  </button>
                </div>
              </div>
            ) : (
              <button 
                className="w-full py-2.5 rounded-xl font-bold text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer" 
                onClick={() => setSelectedIzin(null)}
              >
                Tutup Jendela
              </button>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  )
}

function FasilDashboard({ todayPresensi, hadir, tidakHadir, izinCount, pendingIzin, sesi, setSesi }: {
  todayPresensi: PresensiRecord[]
  hadir: number; tidakHadir: number; izinCount: number
  pendingIzin: IzinRecord[]
  sesi: 'Subuh' | 'Malam'
  setSesi: (s: 'Subuh' | 'Malam') => void
}) {
  const total = todayPresensi.length
  const pctHadir = total > 0 ? Math.round((hadir / total) * 100) : 0

  return (
    <div className="space-y-6">
      {/* Sesi Toggle with Sun and Moon Icons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-emerald-100/80 shadow-xs">
        <div>
          <h4 className="font-extrabold text-base text-emerald-950" style={{ fontFamily: 'Plus Jakarta Sans' }}>
            Pantauan Sesi Absensi
          </h4>
          <p className="text-xs text-gray-500 font-medium">Pilih sesi untuk melihat rekapitulasi kehadiran penghuni</p>
        </div>
        <div className="inline-flex p-1.5 rounded-xl bg-emerald-50/70 border border-emerald-100">
          <button
            onClick={() => setSesi('Subuh')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              sesi === 'Subuh'
                ? 'bg-white text-emerald-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-900'
            }`}
            style={{ fontFamily: 'Plus Jakarta Sans' }}
          >
            <Sun className={`w-4 h-4 ${sesi === 'Subuh' ? 'text-amber-500' : 'text-gray-400'}`} />
            <span>Sesi Subuh (04:00–06:00)</span>
          </button>
          <button
            onClick={() => setSesi('Malam')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              sesi === 'Malam'
                ? 'bg-white text-emerald-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-900'
            }`}
            style={{ fontFamily: 'Plus Jakarta Sans' }}
          >
            <Moon className={`w-4 h-4 ${sesi === 'Malam' ? 'text-blue-500' : 'text-gray-400'}`} />
            <span>Sesi Malam (18:00–20:30)</span>
          </button>
        </div>
      </div>

      {/* 4 Stats Cards with Lucide Icons */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          icon={<CheckCircle2 className="w-6 h-6 text-emerald-700" />} 
          label="Hadir Tepat Waktu" 
          value={hadir} 
          sub={`${pctHadir}% dari total`} 
          color="#047857"
        />
        <StatCard 
          icon={<XCircle className="w-6 h-6 text-rose-700" />} 
          label="Tidak Hadir" 
          value={tidakHadir} 
          sub="Belum absen / absen kosong" 
          color="#dc2626" 
        />
        <StatCard 
          icon={<FileCheck className="w-6 h-6 text-amber-700" />} 
          label="Berstatus Izin" 
          value={izinCount} 
          sub="Disetujui pembina" 
          color="#b45309" 
        />
        <StatCard 
          icon={<Clock className="w-6 h-6 text-purple-700" />} 
          label="Izin Menunggu" 
          value={pendingIzin.length} 
          sub="Perlu konfirmasi segera" 
          color="#6b21a8" 
        />
      </div>

      {/* Presensi Table */}
      <div className="bg-white rounded-2xl overflow-hidden border border-emerald-100/80 shadow-xs">
        <div className="px-6 py-4 border-b border-emerald-100 flex items-center justify-between">
          <SectionTitle subtitle={`Daftar catatan kehadiran penghuni pada sesi ${sesi} hari ini`}>
            Status Presensi Hari Ini — Sesi {sesi}
          </SectionTitle>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-emerald-50/60 border-b border-emerald-100">
                {['Nama Lengkap', 'NIM', 'Gedung', 'Kamar', 'Waktu Masuk', 'Status Kehadiran'].map(h => (
                  <th key={h} className="text-left px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-emerald-950" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {todayPresensi.map(p => (
                <tr key={p.id} className="hover:bg-emerald-50/30 transition-colors">
                  <td className="px-5 py-3.5 font-bold text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                    {p.namaPenghuni}
                  </td>
                  <td className="px-5 py-3.5 mono text-xs font-semibold text-gray-600">{p.nim}</td>
                  <td className="px-5 py-3.5 text-xs text-gray-600">{p.namaGedung}</td>
                  <td className="px-5 py-3.5 mono text-xs font-bold text-emerald-800">{p.nomorKamar}</td>
                  <td className="px-5 py-3.5 mono text-xs font-medium text-gray-700">{p.waktu || '–'}</td>
                  <td className="px-5 py-3.5">
                    <Badge status={p.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pending Izin Notification Banner */}
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
                    <span className="font-bold text-sm text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                      {i.namaPenghuni}
                    </span>
                    <span className="mono text-xs text-gray-500">({i.nim} · {i.nomorKamar})</span>
                  </div>
                  <p className="text-xs text-amber-900 mt-1 font-medium leading-relaxed">
                    {i.alasan}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge status="Pending" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function FasilMonitor({ presensi }: { presensi: PresensiRecord[] }) {
  const [filterDate, setFilterDate] = useState(TODAY)
  const [filterGedung, setFilterGedung] = useState('')
  const filtered = presensi.filter(p =>
    p.tanggal === filterDate &&
    (filterGedung === '' || p.namaGedung === filterGedung)
  )
  const gedungNames = [...new Set(presensi.map(p => p.namaGedung))]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <input 
          type="date" 
          className="px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 transition-all font-medium text-gray-700" 
          value={filterDate} 
          onChange={e => setFilterDate(e.target.value)} 
        />
        <select 
          className="px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 transition-all font-medium text-gray-700" 
          value={filterGedung} 
          onChange={e => setFilterGedung(e.target.value)}
        >
          <option value="">Seluruh Gedung Asrama</option>
          {gedungNames.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-2xl overflow-hidden border border-emerald-100/80 shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-emerald-50/60 border-b border-emerald-100">
                {['Nama Lengkap', 'Gedung', 'Kamar', 'Sesi', 'Waktu Presensi', 'Status', 'Keterangan'].map(h => (
                  <th key={h} className="text-left px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-emerald-950" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-sm text-gray-400 font-medium">
                    Tidak ada catatan presensi untuk filter yang dipilih
                  </td>
                </tr>
              )}
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-emerald-50/30 transition-colors">
                  <td className="px-5 py-3.5 font-bold text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                    {p.namaPenghuni}
                  </td>
                  <td className="px-5 py-3.5 text-xs text-gray-600">{p.namaGedung}</td>
                  <td className="px-5 py-3.5 mono text-xs font-bold text-emerald-800">{p.nomorKamar}</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      p.sesi === 'Subuh' ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-blue-50 text-blue-800 border border-blue-200'
                    }`}>
                      {p.sesi === 'Subuh' ? <Sun className="w-3 h-3" /> : <Moon className="w-3 h-3" />}
                      <span>{p.sesi}</span>
                    </span>
                  </td>
                  <td className="px-5 py-3.5 mono text-xs font-medium text-gray-700">{p.waktu || '–'}</td>
                  <td className="px-5 py-3.5"><Badge status={p.status} /></td>
                  <td className="px-5 py-3.5 text-xs text-gray-500 font-medium">{p.keterangan || '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function FasilIzin({ izinData, onSelect, onApprove, onReject }: {
  izinData: IzinRecord[]
  onSelect: (i: IzinRecord) => void
  onApprove: (id: number) => void
  onReject: (id: number) => void
}) {
  const [filter, setFilter] = useState<string>('Semua')
  const filtered = filter === 'Semua' ? izinData : izinData.filter(i => i.statusPersetujuan === filter)

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {['Semua', 'Pending', 'Disetujui', 'Ditolak'].map(f => (
          <button 
            key={f} 
            onClick={() => setFilter(f)} 
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
              filter === f 
                ? 'bg-emerald-800 text-white shadow-xs' 
                : 'bg-white text-gray-600 border border-gray-200 hover:border-emerald-500'
            }`}
            style={{ fontFamily: 'Plus Jakarta Sans' }}
          >
            {f}
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
                  <span className="font-extrabold text-base text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                    {i.namaPenghuni}
                  </span>
                  <Badge status={i.statusPersetujuan} />
                </div>
                <p className="mono text-xs text-gray-500 mb-2">
                  {i.nim} · Kamar {i.nomorKamar} · {i.namaGedung}
                </p>
                <p className="text-sm text-gray-800 mb-3 font-medium leading-relaxed">
                  {i.alasan}
                </p>
                <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 font-medium">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-gray-400" />
                    <span>{i.tanggal} s/d {i.tanggalAkhir}</span>
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
                      <span>Disetujui: {i.namaApprover}</span>
                    </span>
                  )}
                </div>
                {i.keteranganPenolakan && (
                  <p className="text-xs mt-3 p-2.5 rounded-xl bg-red-50 text-red-700 font-medium border border-red-100">
                    Alasan penolakan: {i.keteranganPenolakan}
                  </p>
                )}
              </div>
              {i.statusPersetujuan === 'Pending' ? (
                <div className="flex sm:flex-col gap-2 shrink-0 w-full sm:w-auto">
                  <button 
                    className="flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 transition-colors shadow-2xs flex items-center justify-center gap-1 cursor-pointer" 
                    onClick={() => onApprove(i.id)}
                    style={{ fontFamily: 'Plus Jakarta Sans' }}
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Setujui</span>
                  </button>
                  <button 
                    className="flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 transition-colors border border-rose-200 flex items-center justify-center gap-1 cursor-pointer" 
                    onClick={() => onSelect(i)}
                    style={{ fontFamily: 'Plus Jakarta Sans' }}
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Tolak</span>
                  </button>
                </div>
              ) : (
                <button 
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 transition-colors border border-emerald-200 cursor-pointer shrink-0" 
                  onClick={() => onSelect(i)}
                  style={{ fontFamily: 'Plus Jakarta Sans' }}
                >
                  Detail Izin
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function FasilRiwayat({ presensi }: { presensi: PresensiRecord[] }) {
  const grouped = presensi.reduce<Record<string, PresensiRecord[]>>((acc, p) => {
    if (!acc[p.tanggal]) acc[p.tanggal] = []
    acc[p.tanggal].push(p)
    return acc
  }, {})

  return (
    <div className="space-y-5">
      {Object.entries(grouped).sort((a, b) => b[0].localeCompare(a[0])).map(([tanggal, records]) => {
        const hadir = records.filter(r => r.status === 'Hadir').length
        const total = records.length
        return (
          <div key={tanggal} className="bg-white rounded-2xl overflow-hidden border border-emerald-100/80 shadow-xs">
            <div className="flex items-center justify-between px-6 py-3.5 bg-emerald-50/60 border-b border-emerald-100">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-700" />
                <span className="font-extrabold text-sm text-emerald-950" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                  {tanggal}
                </span>
              </div>
              <span className="mono text-xs font-bold px-2.5 py-1 rounded-md bg-white border border-emerald-200 text-emerald-800">
                {hadir}/{total} Hadir
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-100">
                  {records.map(r => (
                    <tr key={r.id} className="hover:bg-emerald-50/20 transition-colors">
                      <td className="px-6 py-3 font-semibold text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                        {r.namaPenghuni}
                      </td>
                      <td className="px-6 py-3">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          r.sesi === 'Subuh' ? 'bg-amber-50 text-amber-800' : 'bg-blue-50 text-blue-800'
                        }`}>
                          {r.sesi === 'Subuh' ? <Sun className="w-3 h-3" /> : <Moon className="w-3 h-3" />}
                          <span>{r.sesi}</span>
                        </span>
                      </td>
                      <td className="px-6 py-3 mono text-xs text-gray-600">{r.waktu || '–'}</td>
                      <td className="px-6 py-3"><Badge status={r.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}
    </div>
  )
}
