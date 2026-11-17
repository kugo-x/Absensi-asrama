import { useEffect, useRef, useState } from 'react'
import { Sun, Moon, CheckCircle2, XCircle, FileCheck, Clock, Pencil, Paperclip } from 'lucide-react'
import type { HariIso, IzinRecord, IzinStatus, Penghuni, Sesi, StatusFoto } from '../types'
import type { StatusDetail } from '../logic'
import { formatRentangTanggal, teksHariBerulang, hitungStatus, jamPresensi, keteranganStatus, dateRangeDesc, hariIso, NAMA_HARI } from '../logic'
import { StatCard, Badge } from './AppLayout'
import { adalahBuktiTersimpan, fetchBuktiIzin, fetchFotoWajah } from '../api'

export function SesiIcon({ nama, className = 'w-4 h-4' }: { nama: string; className?: string }) {
  return /subuh|pagi/i.test(nama) ? <Sun className={`${className} text-amber-500`} /> : <Moon className={`${className} text-blue-500`} />
}

export function SesiToggle({ sesiList, value, onChange }: { sesiList: Sesi[]; value: string; onChange: (nama: string) => void }) {
  return (
    <div className="inline-flex flex-wrap p-1.5 rounded-xl bg-emerald-50/70 border border-emerald-100">
      {sesiList.map(s => (
        <button
          key={s.id}
          onClick={() => onChange(s.nama)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            value === s.nama ? 'bg-white text-emerald-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'
          }`}
          style={{ fontFamily: 'Plus Jakarta Sans' }}
        >
          <SesiIcon nama={s.nama} />
          <span>Sesi {s.nama} ({s.jamMulai}–{s.jamSelesai})</span>
        </button>
      ))}
    </div>
  )
}

export interface RekapRow {
  penghuni: Penghuni
  detail: StatusDetail
}

export function RekapStats({ rows }: { rows: RekapRow[] }) {
  const c = hitungStatus(rows.map(r => r.detail.status))
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard icon={<CheckCircle2 className="w-6 h-6 text-emerald-700" />} label="Hadir" value={c.Hadir} sub={`dari ${rows.length} penghuni`} color="#047857" />
      <StatCard icon={<Clock className="w-6 h-6 text-gray-600" />} label="Belum Absen" value={c.Belum} sub="Sesi belum ditutup" color="#4b5563" />
      <StatCard icon={<XCircle className="w-6 h-6 text-rose-700" />} label="Tidak Hadir" value={c['Tidak Hadir']} sub="Tanpa keterangan" color="#dc2626" />
      <StatCard icon={<FileCheck className="w-6 h-6 text-amber-700" />} label="Izin / Libur" value={c.Izin + c.Libur} sub="Izin disetujui atau hari libur" color="#b45309" />
    </div>
  )
}

// Urutkan agar yang perlu perhatian (Tidak Hadir, Belum) tampil lebih dulu
const URUTAN_STATUS_REKAP: Record<string, number> = { 'Tidak Hadir': 0, Belum: 1, Izin: 2, Libur: 3, Hadir: 4 }
export function urutkanRekap(rows: RekapRow[]): RekapRow[] {
  return [...rows].sort((a, b) => URUTAN_STATUS_REKAP[a.detail.status] - URUTAN_STATUS_REKAP[b.detail.status] || a.penghuni.nama.localeCompare(b.penghuni.nama))
}

/**
 * RekapTable dengan pembagian halaman, untuk gedung berpenghuni ratusan.
 * Hanya baris di halaman aktif yang dirender, sehingga foto wajah yang dimuat juga hanya untuk baris itu.
 * Halaman kembali ke 1 setiap kali `kunciReset` berubah (mis. tanggal/sesi/filter berganti).
 */
export function RekapTableBerhalaman({ rows, perHalaman = 25, kunciReset = '', ...props }: {
  rows: RekapRow[]
  perHalaman?: number
  kunciReset?: string
  showGedung?: boolean
  onKoreksi?: (row: RekapRow) => void
  emptyText?: string
}) {
  const [halaman, setHalaman] = useState(1)
  useEffect(() => setHalaman(1), [kunciReset])

  const urut = urutkanRekap(rows)
  const jumlahHalaman = Math.max(1, Math.ceil(urut.length / perHalaman))
  const aktif = Math.min(halaman, jumlahHalaman)
  const dari = (aktif - 1) * perHalaman
  const potongan = urut.slice(dari, dari + perHalaman)
  const tombolCls = 'px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 bg-white hover:bg-gray-50 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'

  return (
    <>
      <RekapTable rows={potongan} {...props} />
      {urut.length > perHalaman && (
        <div className="px-5 py-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
          <span>Menampilkan {dari + 1}–{dari + potongan.length} dari {urut.length} penghuni</span>
          <div className="flex items-center gap-1.5">
            <button type="button" className={tombolCls} disabled={aktif === 1} onClick={() => setHalaman(aktif - 1)} aria-label="Halaman sebelumnya">‹ Sebelumnya</button>
            <span className="px-2 font-semibold text-gray-700">{aktif} / {jumlahHalaman}</span>
            <button type="button" className={tombolCls} disabled={aktif === jumlahHalaman} onClick={() => setHalaman(aktif + 1)} aria-label="Halaman berikutnya">Berikutnya ›</button>
          </div>
        </div>
      )}
    </>
  )
}

// Tabel rekap berbasis daftar penghuni: setiap penghuni wajib absen tampil beserta statusnya
export function RekapTable({ rows, showGedung = false, onKoreksi, emptyText = 'Tidak ada penghuni wajib absen' }: {
  rows: RekapRow[]
  showGedung?: boolean
  onKoreksi?: (row: RekapRow) => void
  emptyText?: string
}) {
  const headers = ['Nama Lengkap', 'NIM', ...(showGedung ? ['Gedung'] : []), 'Kamar', 'Waktu', 'Foto', 'Lokasi GPS', 'Status', 'Keterangan', ...(onKoreksi ? ['Aksi'] : [])]
  const sorted = urutkanRekap(rows)

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-emerald-50/60 border-b border-emerald-100">
            {headers.map(h => (
              <th key={h} className="text-left px-5 py-3.5 text-xs font-bold uppercase tracking-wider text-emerald-950 whitespace-nowrap" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {sorted.length === 0 && (
            <tr>
              <td colSpan={headers.length} className="px-5 py-10 text-center text-sm text-gray-400 font-medium">{emptyText}</td>
            </tr>
          )}
          {sorted.map(({ penghuni: p, detail }) => {
            const rec = detail.presensi
            return (
              <tr key={p.nim} className="hover:bg-emerald-50/30 transition-colors">
                <td className="px-5 py-3.5 font-bold text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>{p.nama}</td>
                <td className="px-5 py-3.5 mono text-xs font-semibold text-gray-600">{p.nim}</td>
                {showGedung && <td className="px-5 py-3.5 text-xs text-gray-600">{p.namaGedung}</td>}
                <td className="px-5 py-3.5 mono text-xs font-bold text-emerald-800">{p.nomorKamar}</td>
                <td className="px-5 py-3.5 mono text-xs font-medium text-gray-700">{jamPresensi(rec) || '–'}</td>
                <td className="px-5 py-2">
                  <div className="flex items-center gap-2">
                    <FotoWajah foto={rec?.fotoWajah} alt={`Foto ${p.nama}`} className="w-10 h-10 rounded-lg hover:ring-2 hover:ring-emerald-500" />
                    {rec?.statusFoto && <FotoBadge status={rec.statusFoto} />}
                  </div>
                </td>
                <td className="px-5 py-3.5 mono text-[11px] text-gray-500">
                  {rec && rec.latitude !== null && rec.longitude !== null ? (
                    <a href={`https://www.google.com/maps?q=${rec.latitude},${rec.longitude}`} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">
                      {Number(rec.latitude).toFixed(5)}, {Number(rec.longitude).toFixed(5)}
                    </a>
                  ) : '–'}
                  {rec?.akurasiMeter != null && <span className="block text-gray-400">±{Math.round(rec.akurasiMeter)} m</span>}
                </td>
                <td className="px-5 py-3.5"><Badge status={detail.status} /></td>
                <td className="px-5 py-3.5 text-xs text-gray-500 font-medium max-w-[260px]">{keteranganStatus(detail) || '–'}</td>
                {onKoreksi && (
                  <td className="px-5 py-3.5">
                    {detail.fase !== 'belum-dibuka' && detail.status !== 'Libur' ? (
                      <button
                        onClick={() => onKoreksi({ penghuni: p, detail })}
                        className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors cursor-pointer"
                      >
                        <Pencil className="w-3 h-3" />
                        <span>Koreksi</span>
                      </button>
                    ) : <span className="text-xs text-gray-300">–</span>}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function formatRentangIzin(tanggal: string, tanggalSelesai: string, sesi: string | null, hariBerulang?: HariIso[] | null) {
  const rentang = formatRentangTanggal(tanggal, tanggalSelesai)
  const rutin = teksHariBerulang(hariBerulang)
  return `${rentang}${rutin ? ` · ${rutin}` : ''} · ${sesi ? `Sesi ${sesi}` : 'Seharian'}`
}

// Foto wajah presensi yang diambil dengan token login (lihat fetchFotoWajah)
export function FotoWajah({ foto, alt, className = 'w-10 h-10 rounded-lg', link = true }: {
  foto: string | null | undefined
  alt: string
  className?: string
  link?: boolean
}) {
  const [src, setSrc] = useState<string | null>(null)
  const [gagal, setGagal] = useState(false)
  // Foto baru diambil saat mendekati layar, agar tabel panjang tidak memicu ratusan permintaan sekaligus
  const penampung = useRef<HTMLDivElement>(null)
  const [terlihat, setTerlihat] = useState(false)

  useEffect(() => {
    if (terlihat || !foto) return
    const el = penampung.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setTerlihat(true)
      return
    }
    const pengamat = new IntersectionObserver(entri => {
      if (entri.some(e => e.isIntersecting)) {
        setTerlihat(true)
        pengamat.disconnect()
      }
    }, { rootMargin: '200px' })
    pengamat.observe(el)
    return () => pengamat.disconnect()
  }, [foto, terlihat])

  useEffect(() => {
    let aktif = true
    let dibuat: string | null = null
    setSrc(null)
    setGagal(false)
    if (!foto || !terlihat) return
    fetchFotoWajah(foto).then(url => {
      if (!aktif) {
        if (url?.startsWith('blob:')) URL.revokeObjectURL(url)
        return
      }
      dibuat = url
      setSrc(url)
      setGagal(!url)
    })
    return () => {
      aktif = false
      if (dibuat?.startsWith('blob:')) URL.revokeObjectURL(dibuat)
    }
  }, [foto, terlihat])

  if (!foto) return <span className="text-xs text-gray-300">–</span>
  if (gagal) return <span className="text-[11px] text-gray-400">Foto tidak tersedia</span>
  if (!src) return <div ref={penampung} className={`${className} bg-gray-100 border border-gray-200 ${terlihat ? 'animate-pulse' : ''}`} />
  const img = <img src={src} alt={alt} className={`${className} object-cover border border-gray-200`} />
  return link ? <a href={src} target="_blank" rel="noreferrer" title="Lihat foto wajah">{img}</a> : img
}

// Tampilan status izin (nilai di database 'Pending' ditampilkan "Menunggu")
export const TAMPILAN_STATUS_IZIN: Record<IzinStatus, { label: string; pill: string; kotak: string }> = {
  Pending: { label: 'Menunggu', pill: 'bg-orange-50 border-orange-300 text-orange-800', kotak: 'bg-orange-100 text-orange-900' },
  Disetujui: { label: 'Disetujui', pill: 'bg-blue-50 border-blue-300 text-blue-800', kotak: 'bg-blue-100 text-blue-900' },
  Ditolak: { label: 'Ditolak', pill: 'bg-red-50 border-red-300 text-red-800', kotak: 'bg-red-100 text-red-900' },
}

const BULAN_SINGKAT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

// Kotak tanggal berwarna status di kartu izin: "Min / 29 / Nov" (satu hari) atau "3 hari / 17–19 / Nov" (rentang)
export function KotakTanggalIzin({ izin }: { izin: IzinRecord }) {
  const mulai = izin.tanggal
  const selesai = izin.tanggalSelesai || izin.tanggal
  const [, m1, d1] = mulai.split('-').map(Number)
  const [, m2, d2] = selesai.split('-').map(Number)
  const isi = selesai <= mulai
    ? { atas: NAMA_HARI[hariIso(mulai)].slice(0, 3), tengah: String(d1), bawah: BULAN_SINGKAT[m1 - 1] }
    : {
        atas: `${dateRangeDesc(mulai, selesai).length} hari`,
        tengah: `${d1}–${d2}`,
        bawah: m1 === m2 ? BULAN_SINGKAT[m1 - 1] : `${BULAN_SINGKAT[m1 - 1]}–${BULAN_SINGKAT[m2 - 1]}`,
      }
  return (
    <div className={`w-16 shrink-0 self-start rounded-md py-1.5 flex flex-col items-center leading-none ${TAMPILAN_STATUS_IZIN[izin.statusPersetujuan].kotak}`} style={{ fontFamily: 'Plus Jakarta Sans' }} aria-hidden="true">
      <span className="text-[10px] font-semibold opacity-75">{isi.atas}</span>
      <span className="text-lg font-extrabold my-1 whitespace-nowrap">{isi.tengah}</span>
      <span className="text-[10px] font-bold uppercase tracking-wide">{isi.bawah}</span>
    </div>
  )
}

// Lampiran bukti izin; berkas yang tersimpan di server dibuka di tab baru (diambil dengan token login)
export function BuktiIzin({ fileBukti, className }: { fileBukti: string; className: string }) {
  const [memuat, setMemuat] = useState(false)
  const [gagal, setGagal] = useState(false)

  if (!adalahBuktiTersimpan(fileBukti)) {
    return (
      <span className={className}>
        <Paperclip className="w-3 h-3 shrink-0" />
        <span>{fileBukti}</span>
      </span>
    )
  }

  const buka = async () => {
    setGagal(false)
    setMemuat(true)
    // Tab dibuka lebih dulu (masih dalam klik) agar tidak diblokir browser, lalu diarahkan ke berkasnya
    const tab = window.open('', '_blank')
    const url = await fetchBuktiIzin(fileBukti)
    setMemuat(false)
    if (!url) {
      tab?.close()
      setGagal(true)
      return
    }
    if (tab) tab.location.href = url
    else window.location.assign(url)
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  return (
    <button type="button" onClick={buka} disabled={memuat} className={`${className} cursor-pointer hover:underline disabled:opacity-60`} title="Buka berkas bukti">
      <Paperclip className="w-3 h-3 shrink-0" />
      <span>{gagal ? 'Bukti tidak dapat dibuka' : memuat ? 'Membuka...' : `Lihat bukti (${fileBukti.split('.').pop()?.toUpperCase()})`}</span>
    </button>
  )
}

export function FotoBadge({ status }: { status: StatusFoto }) {
  const warna: Record<StatusFoto, string> = {
    Menunggu: 'bg-orange-50 border-orange-300 text-orange-800',
    Diterima: 'bg-emerald-50 border-emerald-300 text-emerald-800',
    Ditolak: 'bg-red-50 border-red-300 text-red-800',
  }
  const label: Record<StatusFoto, string> = { Menunggu: 'Foto menunggu', Diterima: 'Foto diterima', Ditolak: 'Foto ditolak' }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border whitespace-nowrap ${warna[status]}`} style={{ fontFamily: 'Plus Jakarta Sans' }}>
      {label[status]}
    </span>
  )
}
