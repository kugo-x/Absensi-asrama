import { useEffect, useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, CheckCircle2, Cog, RefreshCw, Search, ShieldCheck, XCircle } from 'lucide-react'
import type { LogAktivitas } from '../types'
import { fetchLogAktivitas, type HasilLogAktivitas } from '../api'
import { formatTanggal } from '../logic'
import DateInput from './DateInput'

/**
 * Log aktivitas sistem (admin, hanya baca): siapa melakukan apa dan kapan.
 * Filter & pembagian halaman diproses server karena log terus bertambah.
 */

const JENIS: { nilai: string; label: string; warna: string }[] = [
  { nilai: 'akun', label: 'Akun', warna: 'bg-purple-50 border-purple-200 text-purple-800' },
  { nilai: 'penghuni', label: 'Penghuni', warna: 'bg-teal-50 border-teal-200 text-teal-800' },
  { nilai: 'gedung', label: 'Gedung', warna: 'bg-blue-50 border-blue-200 text-blue-800' },
  { nilai: 'kamar', label: 'Kamar', warna: 'bg-sky-50 border-sky-200 text-sky-800' },
  { nilai: 'presensi', label: 'Presensi', warna: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
  { nilai: 'izin', label: 'Izin', warna: 'bg-amber-50 border-amber-200 text-amber-800' },
  { nilai: 'event', label: 'Event', warna: 'bg-pink-50 border-pink-200 text-pink-800' },
  { nilai: 'pengaturan', label: 'Pengaturan', warna: 'bg-gray-50 border-gray-200 text-gray-700' },
  { nilai: 'sistem', label: 'Sistem', warna: 'bg-slate-100 border-slate-300 text-slate-800' },
]
const PERAN: Record<string, string> = { admin: 'Admin', fasil: 'Fasilitator', penghuni: 'Penghuni', sistem: 'Sistem' }
const PER_HALAMAN = 25

const jenisDari = (e: string) => JENIS.find(j => j.nilai === e) ?? { nilai: e, label: e, warna: 'bg-gray-50 border-gray-200 text-gray-600' }
const inisial = (nama: string) => nama.split(' ').filter(Boolean).slice(0, 2).map(k => k[0]).join('').toUpperCase()

function RincianData({ data }: { data: LogAktivitas['data'] }) {
  if (data === null || data === undefined) return <p className="text-gray-400">Tidak ada data yang dikirim.</p>
  if (typeof data === 'string') return <p className="break-all">{data}</p>
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
      {Object.entries(data).map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-gray-500 font-medium">{k}</dt>
          <dd className="text-gray-800 break-all mono">
            {v === null || v === '' ? <span className="text-gray-300">–</span> : typeof v === 'object' ? JSON.stringify(v) : String(v)}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export default function HalamanLogAktivitas() {
  const [cari, setCari] = useState('')
  const [cariAktif, setCariAktif] = useState('')
  const [entitas, setEntitas] = useState('')
  const [status, setStatus] = useState('')
  const [dari, setDari] = useState('')
  const [sampai, setSampai] = useState('')
  const [halaman, setHalaman] = useState(1)
  const [hasil, setHasil] = useState<HasilLogAktivitas | null>(null)
  const [memuat, setMemuat] = useState(true)
  const [gagal, setGagal] = useState(false)
  const [dibuka, setDibuka] = useState<number | null>(null)
  const [muatUlang, setMuatUlang] = useState(0)

  // Pencarian dikirim setelah berhenti mengetik sebentar, agar tidak memanggil server tiap huruf
  useEffect(() => {
    const t = setTimeout(() => setCariAktif(cari.trim()), 400)
    return () => clearTimeout(t)
  }, [cari])

  // Filter berubah -> kembali ke halaman 1
  useEffect(() => setHalaman(1), [cariAktif, entitas, status, dari, sampai])

  useEffect(() => {
    let aktif = true
    setMemuat(true)
    fetchLogAktivitas({ q: cariAktif, entitas, status, dari, sampai, halaman, per: PER_HALAMAN }).then(h => {
      if (!aktif) return
      setHasil(h)
      setGagal(h === null)
      setMemuat(false)
    })
    return () => { aktif = false }
  }, [cariAktif, entitas, status, dari, sampai, halaman, muatUlang])

  const total = hasil?.total ?? 0
  const jumlahHalaman = Math.max(1, Math.ceil(total / PER_HALAMAN))
  const mulai = (halaman - 1) * PER_HALAMAN
  const adaSaringan = !!(cariAktif || entitas || status || dari || sampai)
  const reset = () => { setCari(''); setEntitas(''); setStatus(''); setDari(''); setSampai('') }
  const saringCls = 'px-3 py-2 rounded-lg border border-gray-300 hover:border-gray-400 text-sm text-gray-800 bg-white outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15 transition-colors placeholder:text-gray-400'

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-2xs overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5 text-slate-700" />
            </div>
            <div>
              <h2 className="font-bold text-base text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>Log Aktivitas Sistem</h2>
              <p className="text-xs text-gray-500 mt-0.5">Jejak setiap perubahan data: siapa, melakukan apa, dan kapan. Termasuk percobaan yang ditolak. Log hanya dapat dibaca.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMuatUlang(n => n + 1)}
            disabled={memuat}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 cursor-pointer disabled:opacity-50 shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${memuat ? 'animate-spin' : ''}`} />
            Muat ulang
          </button>
        </div>

        <div className="px-6 py-4 space-y-3 border-b border-gray-100">
          <div className="flex flex-col lg:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input type="search" value={cari} onChange={e => setCari(e.target.value)} placeholder="Cari nama, NIM, aktivitas, sasaran, isi data, atau alamat IP..." aria-label="Cari log" className={`${saringCls} w-full pl-9`} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:flex gap-2">
              <select value={entitas} onChange={e => setEntitas(e.target.value)} aria-label="Jenis data" className={saringCls}>
                <option value="">Semua jenis</option>
                {JENIS.map(j => <option key={j.nilai} value={j.nilai}>{j.label}</option>)}
              </select>
              <select value={status} onChange={e => setStatus(e.target.value)} aria-label="Status" className={saringCls}>
                <option value="">Semua status</option>
                <option value="berhasil">Berhasil</option>
                <option value="gagal">Gagal / ditolak</option>
              </select>
              <div className="lg:w-40"><DateInput clearable placeholder="Dari tanggal" className={`${saringCls} w-full`} value={dari} max={sampai || undefined} onChange={e => setDari(e.target.value)} /></div>
              <div className="lg:w-40"><DateInput clearable placeholder="Sampai tanggal" className={`${saringCls} w-full`} value={sampai} min={dari || undefined} onChange={e => setSampai(e.target.value)} /></div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <span>{memuat ? 'Memuat…' : `${total.toLocaleString('id-ID')} catatan`}{adaSaringan ? ' sesuai filter' : ''}</span>
            {adaSaringan && <button type="button" onClick={reset} className="font-semibold text-emerald-700 hover:underline cursor-pointer">Reset filter</button>}
          </div>
        </div>

        {gagal ? (
          <p className="px-6 py-12 text-center text-sm text-red-700">Log aktivitas gagal dimuat. Periksa koneksi ke server lalu coba muat ulang.</p>
        ) : hasil?.pesan ? (
          <p className="px-6 py-12 text-center text-sm text-amber-700">{hasil.pesan}</p>
        ) : (
          <div className={`divide-y divide-gray-100 transition-opacity ${memuat ? 'opacity-50' : ''}`}>
            {hasil && hasil.data.length === 0 && (
              <p className="px-6 py-12 text-center text-sm text-gray-400">{adaSaringan ? 'Tidak ada catatan yang cocok dengan filter.' : 'Belum ada aktivitas tercatat.'}</p>
            )}
            {hasil?.data.map(l => {
              const jenis = jenisDari(l.entitas)
              const terbuka = dibuka === l.id
              const sistem = !l.nim
              return (
                <div key={l.id} className={terbuka ? 'bg-gray-50/70' : ''}>
                  <button
                    type="button"
                    onClick={() => setDibuka(terbuka ? null : l.id)}
                    aria-expanded={terbuka}
                    // display:grid lewat style, bukan kelas `grid`: animasi tema (index.css `.grid > *`)
                    // akan memudarkan setiap kolom di setiap baris tiap kali daftar dimuat ulang
                    style={{ display: 'grid' }}
                    className="w-full text-left px-6 py-3 grid-cols-[auto_1fr_auto] sm:grid-cols-[96px_200px_1fr_auto] gap-x-4 gap-y-1 items-center hover:bg-gray-50 cursor-pointer"
                  >
                    {/* Kapan */}
                    <span className="hidden sm:block text-xs text-gray-500 tabular-nums leading-tight">
                      <span className="block font-semibold text-gray-800">{l.waktu.slice(11, 16)}</span>
                      {formatTanggal(l.waktu.slice(0, 10), 'tanpaHari')}
                    </span>
                    {/* Siapa */}
                    <span className="flex items-center gap-2.5 min-w-0">
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ${sistem ? 'bg-slate-200 text-slate-700' : 'bg-emerald-100 text-emerald-800'}`}>
                        {sistem ? <Cog className="w-4 h-4" /> : inisial(l.nama || l.nim || '?')}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-gray-900 truncate">{sistem ? 'Sistem' : l.nama || l.nim}</span>
                        <span className="block text-[11px] text-gray-500 truncate">
                          {sistem ? 'Perintah terjadwal' : `${l.nim}${l.peran ? ` · ${PERAN[l.peran] ?? l.peran}` : ''}`}
                        </span>
                      </span>
                    </span>
                    {/* Apa */}
                    <span className="col-span-3 sm:col-span-1 row-start-2 sm:row-start-auto min-w-0">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className={`px-1.5 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wide ${jenis.warna}`}>{jenis.label}</span>
                        <span className="text-sm font-semibold text-gray-800">{l.aksi}</span>
                        {l.target && <span className="text-xs text-gray-500 mono">{l.target}</span>}
                      </span>
                      {l.keterangan && <span className="block text-xs text-gray-500 truncate mt-0.5">{l.keterangan}</span>}
                      <span className="sm:hidden block text-[11px] text-gray-400 mt-0.5">{formatTanggal(l.waktu.slice(0, 10), 'tanpaHari')} · {l.waktu.slice(11, 16)}</span>
                    </span>
                    {/* Hasil */}
                    <span className="flex items-center gap-2 justify-self-end">
                      {l.status === 'berhasil'
                        ? <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700"><CheckCircle2 className="w-3.5 h-3.5" />Berhasil</span>
                        : <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700"><XCircle className="w-3.5 h-3.5" />Gagal{l.kodeHttp ? ` (${l.kodeHttp})` : ''}</span>}
                      <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${terbuka ? 'rotate-180' : ''}`} />
                    </span>
                  </button>
                  {terbuka && (
                    <div className="px-6 pb-4 grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-4 text-xs">
                      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 content-start">
                        <dt className="text-gray-500">Waktu</dt><dd className="text-gray-800 tabular-nums">{formatTanggal(l.waktu.slice(0, 10))}, {l.waktu.slice(11)}</dd>
                        <dt className="text-gray-500">Permintaan</dt><dd className="text-gray-800 mono break-all">{l.rute ?? '–'}</dd>
                        <dt className="text-gray-500">Alamat IP</dt><dd className="text-gray-800 mono">{l.ip ?? '–'}</dd>
                        <dt className="text-gray-500">Perangkat</dt><dd className="text-gray-600 break-all">{l.agen || '–'}</dd>
                        {l.keterangan && <><dt className="text-gray-500">Pesan</dt><dd className="text-gray-800">{l.keterangan}</dd></>}
                      </dl>
                      <div className="rounded-lg border border-gray-200 bg-white p-3">
                        <p className="font-semibold text-gray-700 mb-2">Data yang dikirim</p>
                        <RincianData data={l.data} />
                        <p className="mt-2 text-[11px] text-gray-400">Password, foto, dan berkas tidak pernah disimpan di log.</p>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {total > PER_HALAMAN && (
          <div className="px-6 py-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
            <span>Menampilkan {mulai + 1}–{Math.min(mulai + PER_HALAMAN, total)} dari {total.toLocaleString('id-ID')}</span>
            <div className="flex items-center gap-1.5">
              <button type="button" disabled={halaman === 1 || memuat} onClick={() => setHalaman(h => h - 1)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-semibold border border-gray-200 bg-white hover:bg-gray-50 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"><ChevronLeft className="w-3.5 h-3.5" />Sebelumnya</button>
              <span className="px-2 font-semibold text-gray-700">{halaman} / {jumlahHalaman}</span>
              <button type="button" disabled={halaman >= jumlahHalaman || memuat} onClick={() => setHalaman(h => h + 1)} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-semibold border border-gray-200 bg-white hover:bg-gray-50 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">Berikutnya<ChevronRight className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
