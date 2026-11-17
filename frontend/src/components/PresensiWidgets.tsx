import { useEffect, useRef, useState } from 'react'
import { Sun, Moon, CheckCircle2, XCircle, FileCheck, Clock, Pencil, Paperclip, ImageOff } from 'lucide-react'
import type { HariIso, IzinRecord, IzinStatus, Penghuni, Sesi, StatusFoto } from '../types'
import type { StatusDetail } from '../logic'
import { formatRentangTanggal, teksHariBerulang, hitungStatus, jamPresensi, keteranganStatus, dateRangeDesc, hariIso, NAMA_HARI } from '../logic'
import { StatCard, Badge } from './AppLayout'
import { adalahBuktiTersimpan, fetchBuktiIzin, fetchFotoWajah } from '../api'

export function SesiIcon({ nama, className = 'w-4 h-4' }: { nama: string; className?: string }) {
  return /subuh|pagi/i.test(nama) ? <Sun className={`${className} text-amber-500`} /> : <Moon className={`${className} text-slate-500`} />
}

export function SesiToggle({ sesiList, value, onChange }: { sesiList: Sesi[]; value: string; onChange: (nama: string) => void }) {
  return (
    <div className="inline-flex flex-wrap gap-1 p-1 rounded-xl bg-gray-100/80 border border-gray-200/80">
      {sesiList.map(s => (
        <button
          key={s.id}
          type="button"
          onClick={() => onChange(s.nama)}
          aria-pressed={value === s.nama}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            value === s.nama ? 'bg-[#fff] text-gray-900 shadow-sm ring-1 ring-black/5' : 'text-gray-500 hover:text-gray-900'
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
  const ubin = [
    { label: 'Hadir', nilai: c.Hadir, ket: `dari ${rows.length} penghuni`, ikon: <CheckCircle2 className="w-4 h-4" />, warna: 'bg-emerald-50 text-emerald-700' },
    { label: 'Belum absen', nilai: c.Belum, ket: 'Sesi belum ditutup', ikon: <Clock className="w-4 h-4" />, warna: 'bg-gray-100 text-gray-600' },
    { label: 'Tidak hadir', nilai: c['Tidak Hadir'], ket: 'Tanpa keterangan', ikon: <XCircle className="w-4 h-4" />, warna: 'bg-rose-50 text-rose-600' },
    { label: 'Izin / libur', nilai: c.Izin + c.Libur, ket: 'Izin disetujui atau libur', ikon: <FileCheck className="w-4 h-4" />, warna: 'bg-amber-50 text-amber-700' },
  ]
  return (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {ubin.map(u => (
          <div key={u.label} className="bg-[#fff] rounded-2xl border border-gray-200/90 p-4 shadow-2xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-gray-600">{u.label}</span>
              <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${u.warna}`}>{u.ikon}</span>
            </div>
            <p className="mt-1 text-2xl font-extrabold text-gray-900 tabular-nums" style={{ fontFamily: 'Plus Jakarta Sans' }}>{u.nilai}</p>
            <p className="text-[11px] text-gray-400 truncate">{u.ket}</p>
          </div>
        ))}
      </div>
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
  const tombolCls = 'px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 bg-[#fff] hover:bg-gray-50 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'

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
  const headers = ['Penghuni', 'Kamar', 'Waktu', 'Bukti', 'Status', 'Keterangan', ...(onKoreksi ? ['Aksi'] : [])]
  const sorted = urutkanRekap(rows)

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50/70 border-b border-gray-100">
            {headers.map(h => (
              <th key={h} className="text-left px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap">
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
            const ket = keteranganStatus(detail)
            const otomatis = !!rec?.otomatis
            return (
              <tr key={p.nim} className="hover:bg-gray-50/80 transition-colors">
                <td className="px-5 py-3">
                  <p className="font-bold text-gray-900 whitespace-nowrap" style={{ fontFamily: 'Plus Jakarta Sans' }}>{p.nama}</p>
                  <p className="mono text-[11px] text-gray-500">{p.nim}</p>
                </td>
                <td className="px-5 py-3 whitespace-nowrap">
                  <p className="mono text-xs font-bold text-emerald-800">{p.nomorKamar}</p>
                  {showGedung && <p className="text-[11px] text-gray-500">{p.namaGedung}</p>}
                </td>
                <td className="px-5 py-3 mono text-xs font-semibold text-gray-700 whitespace-nowrap">{jamPresensi(rec) || <span className="text-gray-300">–</span>}</td>
                <td className="px-5 py-2.5">
                  {rec?.fotoWajah || (rec && rec.latitude !== null) ? (
                    <div className="flex items-center gap-2.5">
                      {rec?.fotoWajah && <FotoWajah foto={rec.fotoWajah} alt={`Foto ${p.nama}`} className="w-10 h-10 rounded-lg hover:ring-2 hover:ring-emerald-500" />}
                      <div className="min-w-0 space-y-0.5">
                        {rec?.statusFoto && <FotoBadge status={rec.statusFoto} />}
                        {rec && rec.latitude !== null && rec.longitude !== null && (
                          <a href={`https://www.google.com/maps?q=${rec.latitude},${rec.longitude}`} target="_blank" rel="noreferrer" className="block mono text-[11px] text-slate-600 hover:underline whitespace-nowrap">
                            {Number(rec.latitude).toFixed(5)}, {Number(rec.longitude).toFixed(5)}
                            {rec.akurasiMeter != null && <span className="text-gray-400"> · ±{Math.round(rec.akurasiMeter)} m</span>}
                          </a>
                        )}
                      </div>
                    </div>
                  ) : <span className="text-gray-300">–</span>}
                </td>
                <td className="px-5 py-3"><Badge status={detail.status} /></td>
                <td className={`px-5 py-3 text-xs max-w-[260px] ${otomatis ? 'text-gray-400' : 'text-gray-600 font-medium'}`}>{ket || <span className="text-gray-300">–</span>}</td>
                {onKoreksi && (
                  <td className="px-5 py-3.5">
                    {detail.fase !== 'belum-dibuka' && detail.status !== 'Libur' ? (
                      <button
                        onClick={() => onKoreksi({ penghuni: p, detail })}
                        className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg text-emerald-800 bg-[#fff] hover:bg-emerald-50 border border-emerald-200 transition-colors cursor-pointer"
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
  // Kotak seukuran foto agar tata letak (mis. kartu validasi) tidak kempis saat berkas hilang
  if (gagal) return (
    <div className={`${className} bg-gray-50 border border-dashed border-gray-200 flex flex-col items-center justify-center text-center text-gray-400`} title="Foto tidak tersedia">
      <ImageOff className="w-4 h-4 shrink-0" />
      {className.includes('w-full') && <span className="mt-1.5 text-[11px] font-medium">Foto tidak tersedia</span>}
    </div>
  )
  if (!src) return <div ref={penampung} className={`${className} bg-gray-100 border border-gray-200 ${terlihat ? 'animate-pulse' : ''}`} />
  const img = <img src={src} alt={alt} className={`${className} object-cover border border-gray-200`} />
  return link ? <a href={src} target="_blank" rel="noreferrer" title="Lihat foto wajah">{img}</a> : img
}

// Tampilan status izin (nilai di database 'Pending' ditampilkan "Menunggu")
export const TAMPILAN_STATUS_IZIN: Record<IzinStatus, { label: string; pill: string; kotak: string }> = {
  Pending: { label: 'Menunggu', pill: 'bg-amber-50 border-amber-300 text-amber-800', kotak: 'bg-amber-100 text-amber-900' },
  Disetujui: { label: 'Disetujui', pill: 'bg-emerald-50 border-emerald-300 text-emerald-800', kotak: 'bg-emerald-100 text-emerald-900' },
  Ditolak: { label: 'Ditolak', pill: 'bg-rose-50 border-rose-300 text-rose-800', kotak: 'bg-rose-100 text-rose-900' },
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
    Menunggu: 'bg-amber-50 border-amber-300 text-amber-800',
    Diterima: 'bg-emerald-50 border-emerald-300 text-emerald-800',
    Ditolak: 'bg-rose-50 border-rose-300 text-rose-800',
  }
  const label: Record<StatusFoto, string> = { Menunggu: 'Foto menunggu', Diterima: 'Foto diterima', Ditolak: 'Foto ditolak' }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border whitespace-nowrap ${warna[status]}`} style={{ fontFamily: 'Plus Jakarta Sans' }}>
      {label[status]}
    </span>
  )
}
