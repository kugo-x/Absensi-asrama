import { useState, useEffect } from 'react'
import type { CurrentUser, Penghuni, Gedung } from '../types'
import AppLayout, { StatCard, SectionTitle, Badge } from '../components/AppLayout'
import { penghuniList as initialPenghuni, gedungList, kamarList } from '../data/mockData'
import { fetchPenghuni, addPenghuniApi, togglePenghuniStatusApi } from '../api'
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
  Award, 
  TrendingUp, 
  Calendar,
  FileSpreadsheet,
  X,
  MapPin,
  ShieldAlert
} from 'lucide-react'

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-[18px] h-[18px]" /> },
  { id: 'penghuni', label: 'Data Penghuni', icon: <Users className="w-[18px] h-[18px]" /> },
  { id: 'gedung', label: 'Gedung & Kamar', icon: <Building2 className="w-[18px] h-[18px]" /> },
  { id: 'laporan', label: 'Laporan Rekap', icon: <FileBarChart className="w-[18px] h-[18px]" /> },
]

export default function AdminPage({ user, onLogout }: { user: CurrentUser; onLogout: () => void }) {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [penghuni, setPenghuni] = useState<Penghuni[]>(initialPenghuni)
  const [search, setSearch] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [newPenghuni, setNewPenghuni] = useState({ 
    nim: '', 
    nama: '', 
    nomorKamar: '', 
    namaGedung: '', 
    asal: '', 
    email: '', 
    noHp: '', 
    angkatan: '2026' 
  })

  useEffect(() => {
    fetchPenghuni().then(data => {
      if (data && data.length > 0) setPenghuni(data)
    })
  }, [])

  const filtered = penghuni.filter(p =>
    p.nama.toLowerCase().includes(search.toLowerCase()) ||
    p.nim.includes(search) ||
    p.nomorKamar.includes(search) ||
    p.namaGedung.toLowerCase().includes(search.toLowerCase())
  )

  const handleAddPenghuni = async () => {
    if (!newPenghuni.nim || !newPenghuni.nama) return
    const toAdd: Penghuni = { ...newPenghuni, statusAktif: true, role: 'penghuni' }
    setPenghuni(prev => [...prev, toAdd])
    await addPenghuniApi(toAdd)
    setNewPenghuni({ nim: '', nama: '', nomorKamar: '', namaGedung: '', asal: '', email: '', noHp: '', angkatan: '2026' })
    setShowAddModal(false)
  }

  const toggleStatus = async (nim: string) => {
    setPenghuni(prev => prev.map(p => p.nim === nim ? { ...p, statusAktif: !p.statusAktif } : p))
    await togglePenghuniStatusApi(nim)
  }

  return (
    <AppLayout user={user} onLogout={onLogout} navItems={navItems} activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'dashboard' && <AdminDashboard penghuni={penghuni} />}
      {activeTab === 'penghuni' && (
        <AdminPenghuni
          penghuni={filtered}
          search={search}
          setSearch={setSearch}
          onAddClick={() => setShowAddModal(true)}
          onToggleStatus={toggleStatus}
        />
      )}
      {activeTab === 'gedung' && <AdminGedung />}
      {activeTab === 'laporan' && <AdminLaporan penghuni={penghuni} />}

      {/* Modal Tambah Penghuni */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl border border-emerald-100 animate-scale-up">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-emerald-950" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                    Tambah Penghuni Baru
                  </h3>
                  <p className="text-xs text-gray-400">Daftarkan mahasiswa ke sistem asrama</p>
                </div>
              </div>
              <button 
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 max-h-[70vh] overflow-y-auto pr-1">
              {[
                { key: 'nim', label: 'NIM Mahasiswa', placeholder: 'Contoh: 2310933011' },
                { key: 'nama', label: 'Nama Lengkap', placeholder: 'Masukkan nama lengkap' },
                { key: 'email', label: 'Alamat Email', placeholder: 'mhs@student.unand.ac.id' },
                { key: 'noHp', label: 'Nomor WhatsApp / HP', placeholder: '081234567890' },
                { key: 'asal', label: 'Asal Daerah / Kota', placeholder: 'Contoh: Bukittinggi' },
                { key: 'angkatan', label: 'Tahun Angkatan', placeholder: '2026' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-bold uppercase tracking-wider text-emerald-900 mb-1.5" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                    {f.label}
                  </label>
                  <input
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 transition-all"
                    placeholder={f.placeholder}
                    value={(newPenghuni as any)[f.key]}
                    onChange={e => setNewPenghuni(prev => ({ ...prev, [f.key]: e.target.value }))}
                  />
                </div>
              ))}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-emerald-900 mb-1.5" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                    Gedung Asrama
                  </label>
                  <select
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 transition-all bg-white"
                    value={newPenghuni.namaGedung}
                    onChange={e => setNewPenghuni(prev => ({ ...prev, namaGedung: e.target.value }))}
                  >
                    <option value="">Pilih Gedung</option>
                    {gedungList.map(g => <option key={g.id} value={g.nama}>{g.nama}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-emerald-900 mb-1.5" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                    Nomor Kamar
                  </label>
                  <select
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 transition-all bg-white"
                    value={newPenghuni.nomorKamar}
                    onChange={e => setNewPenghuni(prev => ({ ...prev, nomorKamar: e.target.value }))}
                  >
                    <option value="">Pilih Kamar</option>
                    {kamarList.filter(k => k.namaGedung === newPenghuni.namaGedung).map(k => (
                      <option key={k.nomorKamar} value={k.nomorKamar}>{k.nomorKamar} (Lt. {k.lantai})</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100">
              <button 
                className="flex-1 py-2.5 rounded-xl font-bold text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors" 
                onClick={() => setShowAddModal(false)}
              >
                Batal
              </button>
              <button 
                className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white bg-emerald-700 hover:bg-emerald-800 transition-colors shadow-sm" 
                onClick={handleAddPenghuni}
              >
                Simpan Penghuni
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  )
}

function AdminDashboard({ penghuni }: { penghuni: Penghuni[] }) {
  const aktif = penghuni.filter(p => p.statusAktif).length
  const fasil = penghuni.filter(p => p.role === 'fasil').length
  const putra = penghuni.filter(p => p.namaGedung.includes('Putra')).length
  const putri = penghuni.filter(p => p.namaGedung.includes('Putri')).length

  return (
    <div className="space-y-6">
      {/* 4 Stats Cards with Lucide Icons */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Users className="w-6 h-6 text-emerald-700" />}
          label="Penghuni Aktif"
          value={aktif}
          sub={`${penghuni.length} total terdaftar`}
          color="#064e3b"
        />
        <StatCard
          icon={<Building className="w-6 h-6 text-blue-700" />}
          label="Gedung Asrama"
          value={gedungList.length}
          sub="4 gedung beroperasi"
          color="#1e40af"
        />
        <StatCard
          icon={<UserCheck className="w-6 h-6 text-amber-700" />}
          label="Fasilitator"
          value={fasil}
          sub="Pengurus pembina"
          color="#b45309"
        />
        <StatCard
          icon={<DoorClosed className="w-6 h-6 text-purple-700" />}
          label="Total Kamar"
          value={kamarList.length}
          sub="Tersebar 2 lantai"
          color="#6b21a8"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Distribution by gedung */}
        <div className="bg-white rounded-2xl p-6 border border-emerald-100/80 shadow-xs">
          <SectionTitle subtitle="Jumlah mahasiswa yang menetap per gedung saat ini">
            Distribusi Penghuni per Gedung
          </SectionTitle>
          <div className="space-y-4">
            {gedungList.map(g => {
              const count = penghuni.filter(p => p.namaGedung === g.nama && p.statusAktif).length
              const max = Math.max(...gedungList.map(gd => penghuni.filter(p => p.namaGedung === gd.nama).length), 1)
              const pct = Math.round((count / max) * 100)
              return (
                <div key={g.id}>
                  <div className="flex justify-between items-center text-sm mb-1.5">
                    <span className="font-bold text-gray-800" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                      {g.nama}
                    </span>
                    <span className="font-bold text-emerald-800 mono bg-emerald-50 px-2 py-0.5 rounded-md text-xs">
                      {count} Penghuni
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-500" 
                      style={{ 
                        width: `${pct}%`, 
                        background: g.jenis === 'Putra' ? 'linear-gradient(90deg, #059669, #10b981)' : 'linear-gradient(90deg, #7c3aed, #a855f7)' 
                      }} 
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* System Summary */}
        <div className="bg-white rounded-2xl p-6 border border-emerald-100/80 shadow-xs">
          <SectionTitle subtitle="Status operasional dan ketentuan jadwal asrama">
            Informasi Operasional & Sesi
          </SectionTitle>
          <div className="space-y-2.5">
            {[
              { label: 'Penghuni Asrama Putra', value: `${putra} Orang`, color: '#047857' },
              { label: 'Penghuni Asrama Putri', value: `${putri} Orang`, color: '#7c3aed' },
              { label: 'Penghuni Status Aktif', value: `${aktif} Orang`, color: '#047857' },
              { label: 'Penghuni Nonaktif', value: `${penghuni.length - aktif} Orang`, color: '#dc2626' },
              { label: 'Jadwal Sesi Subuh', value: '04:00 – 06:00 WIB', color: '#1e40af' },
              { label: 'Jadwal Sesi Malam', value: '18:00 – 20:30 WIB', color: '#1e40af' },
              { label: 'Batas Toleransi Radius', value: '50 Meter (Geofence)', color: '#b45309' },
            ].map(item => (
              <div key={item.label} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0 text-sm">
                <span className="text-gray-500 font-medium">{item.label}</span>
                <span className="font-bold mono px-2 py-0.5 rounded-md bg-gray-50" style={{ color: item.color }}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function AdminPenghuni({ penghuni, search, setSearch, onAddClick, onToggleStatus }: {
  penghuni: Penghuni[]
  search: string
  setSearch: (v: string) => void
  onAddClick: () => void
  onToggleStatus: (nim: string) => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 transition-all font-medium placeholder:text-gray-400"
            placeholder="Cari berdasarkan nama, NIM, atau kamar..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button 
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm text-white bg-emerald-700 hover:bg-emerald-800 transition-colors shadow-sm cursor-pointer" 
          onClick={onAddClick}
          style={{ fontFamily: 'Plus Jakarta Sans' }}
        >
          <UserPlus className="w-4 h-4" />
          <span>Tambah Penghuni</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl overflow-hidden border border-emerald-100/80 shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-emerald-50/60 border-b border-emerald-100">
                {['NIM', 'Nama Lengkap', 'Gedung', 'Kamar', 'Asal Daerah', 'Peran', 'Status', 'Aksi'].map(h => (
                  <th key={h} className="text-left px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-emerald-950" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {penghuni.map(p => (
                <tr key={p.nim} className="hover:bg-emerald-50/30 transition-colors">
                  <td className="px-5 py-3.5 mono text-xs font-semibold text-gray-600">{p.nim}</td>
                  <td className="px-5 py-3.5 font-bold text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>{p.nama}</td>
                  <td className="px-5 py-3.5 text-xs text-gray-600">{p.namaGedung || '-'}</td>
                  <td className="px-5 py-3.5 mono text-xs font-bold text-emerald-800">{p.nomorKamar || '-'}</td>
                  <td className="px-5 py-3.5 text-xs text-gray-600">{p.asal || '-'}</td>
                  <td className="px-5 py-3.5">
                    <Badge status={p.role === 'fasil' ? 'Disetujui' : 'Hadir'} />
                  </td>
                  <td className="px-5 py-3.5">
                    <Badge status={p.statusAktif ? 'Aktif' : 'Non-aktif'} />
                  </td>
                  <td className="px-5 py-3.5">
                    <button
                      onClick={() => onToggleStatus(p.nim)}
                      className={`text-xs font-bold px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                        p.statusAktif 
                          ? 'text-red-700 bg-red-50 hover:bg-red-100' 
                          : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                      }`}
                      style={{ fontFamily: 'Plus Jakarta Sans' }}
                    >
                      {p.statusAktif ? 'Nonaktifkan' : 'Aktifkan'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 text-xs text-gray-500 border-t border-gray-100 font-medium bg-gray-50/50">
          Menampilkan {penghuni.length} data mahasiswa
        </div>
      </div>
    </div>
  )
}

function AdminGedung() {
  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-2 gap-6">
        {gedungList.map(g => (
          <div key={g.id} className="bg-white rounded-2xl p-6 border border-emerald-100/80 shadow-xs hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-extrabold text-base text-emerald-950" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                    {g.nama}
                  </h4>
                  <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                    g.jenis === 'Putra' ? 'bg-emerald-50 text-emerald-800' : 'bg-purple-50 text-purple-800'
                  }`}>
                    Asrama {g.jenis}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2.5 border-t border-b border-gray-100 py-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-gray-500 font-medium">Pembina / Fasil PJ</span>
                <span className="font-bold text-gray-800">{g.namaPj}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 font-medium">NIM Fasilitator</span>
                <span className="font-semibold mono text-xs text-gray-600">{g.nimPj}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 font-medium">Kapasitas Gedung</span>
                <span className="font-bold text-emerald-800">{g.totalKamar} Kamar</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500 font-medium">Radius Geofencing</span>
                <span className="font-bold text-blue-800">{g.radiusMeter} Meter</span>
              </div>
            </div>

            <div className="mt-4">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-900 mb-2.5" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                Daftar Kamar
              </p>
              <div className="flex flex-wrap gap-2">
                {kamarList.filter(k => k.idGedung === g.id).map(k => (
                  <span 
                    key={k.nomorKamar} 
                    className="mono text-xs font-semibold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-100"
                  >
                    {k.nomorKamar}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function AdminLaporan({ penghuni }: { penghuni: Penghuni[] }) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 border border-emerald-100/80 shadow-xs">
        <SectionTitle subtitle="Unduh rekapitulasi data kehadiran dalam format spreadsheet">
          Ekspor Dokumen & Laporan
        </SectionTitle>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { title: 'Presensi Harian', desc: 'Rekap kehadiran mahasiswa hari ini', icon: <FileSpreadsheet className="w-5 h-5 text-emerald-700" /> },
            { title: 'Presensi Mingguan', desc: 'Ringkasan kehadiran 7 hari terakhir', icon: <Calendar className="w-5 h-5 text-blue-700" /> },
            { title: 'Rekap Perizinan', desc: 'Data pengajuan izin & status persetujuan', icon: <FileBarChart className="w-5 h-5 text-amber-700" /> },
            { title: 'Daftar Penghuni', desc: 'Data lengkap penghuni seluruh gedung', icon: <Users className="w-5 h-5 text-purple-700" /> },
            { title: 'Statistik Gedung', desc: 'Analisis persentase per gedung', icon: <Building className="w-5 h-5 text-emerald-700" /> },
            { title: 'Laporan Bulanan', desc: 'Laporan komprehensif bulan berjalan', icon: <TrendingUp className="w-5 h-5 text-rose-700" /> },
          ].map(item => (
            <div 
              key={item.title} 
              className="p-4 rounded-xl border border-emerald-100 bg-emerald-50/30 hover:bg-emerald-50/70 transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center border border-emerald-100 mb-3 group-hover:scale-105 transition-transform shadow-2xs">
                  {item.icon}
                </div>
                <h5 className="font-bold text-sm text-emerald-950 mb-1" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                  {item.title}
                </h5>
                <p className="text-xs text-gray-500 leading-relaxed font-medium">
                  {item.desc}
                </p>
              </div>
              <button 
                onClick={() => alert(`Mengunduh berkas ${item.title}...`)}
                className="mt-4 w-full py-2 px-3 rounded-lg text-xs font-bold text-emerald-800 bg-white border border-emerald-200 hover:bg-emerald-700 hover:text-white transition-all flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                style={{ fontFamily: 'Plus Jakarta Sans' }}
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh CSV</span>
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 border border-emerald-100/80 shadow-xs">
        <SectionTitle subtitle="Ringkasan performa tingkat kehadiran bulan berjalan">
          Statistik Kehadiran September 2026
        </SectionTitle>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard 
            icon={<CheckCircle2 className="w-6 h-6 text-emerald-700" />} 
            label="Rata-rata Hadir" 
            value="87%" 
            sub="Subuh + Malam" 
            color="#047857"
          />
          <StatCard 
            icon={<XCircle className="w-6 h-6 text-rose-700" />} 
            label="Ketidakhadiran" 
            value="11%" 
            sub="Tanpa keterangan" 
            color="#dc2626" 
          />
          <StatCard 
            icon={<AlertCircle className="w-6 h-6 text-amber-700" />} 
            label="Pengajuan Izin" 
            value="24" 
            sub="September 2026" 
            color="#b45309" 
          />
          <StatCard 
            icon={<Award className="w-6 h-6 text-purple-700" />} 
            label="Gedung Terbaik" 
            value="Putra B" 
            sub="Tingkat 94%" 
            color="#6b21a8" 
          />
        </div>
      </div>
    </div>
  )
}
