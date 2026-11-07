import { Sun, Moon, CheckCircle2, XCircle, FileCheck, Clock, Pencil } from 'lucide-react'
import type { Penghuni, Sesi } from '../types'
import type { StatusDetail } from '../logic'
import { hitungStatus, keteranganStatus } from '../logic'
import { StatCard, Badge } from './AppLayout'
import { fotoWajahUrl } from '../api'

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

// Tabel rekap berbasis daftar penghuni: setiap penghuni wajib absen tampil beserta statusnya
export function RekapTable({ rows, showGedung = false, onKoreksi, emptyText = 'Tidak ada penghuni wajib absen' }: {
  rows: RekapRow[]
  showGedung?: boolean
  onKoreksi?: (row: RekapRow) => void
  emptyText?: string
}) {
  const headers = ['Nama Lengkap', 'NIM', ...(showGedung ? ['Gedung'] : []), 'Kamar', 'Waktu', 'Foto', 'Lokasi GPS', 'Status', 'Keterangan', ...(onKoreksi ? ['Aksi'] : [])]
  // Urutkan agar yang perlu perhatian (Tidak Hadir, Belum) tampil lebih dulu
  const urutan: Record<string, number> = { 'Tidak Hadir': 0, Belum: 1, Izin: 2, Libur: 3, Hadir: 4 }
  const sorted = [...rows].sort((a, b) => urutan[a.detail.status] - urutan[b.detail.status] || a.penghuni.nama.localeCompare(b.penghuni.nama))

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
            const foto = fotoWajahUrl(rec?.fotoWajah)
            return (
              <tr key={p.nim} className="hover:bg-emerald-50/30 transition-colors">
                <td className="px-5 py-3.5 font-bold text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>{p.nama}</td>
                <td className="px-5 py-3.5 mono text-xs font-semibold text-gray-600">{p.nim}</td>
                {showGedung && <td className="px-5 py-3.5 text-xs text-gray-600">{p.namaGedung}</td>}
                <td className="px-5 py-3.5 mono text-xs font-bold text-emerald-800">{p.nomorKamar}</td>
                <td className="px-5 py-3.5 mono text-xs font-medium text-gray-700">{rec?.waktu || '–'}</td>
                <td className="px-5 py-2">
                  {foto ? (
                    <a href={foto} target="_blank" rel="noreferrer" title="Lihat foto wajah">
                      <img src={foto} alt={`Foto ${p.nama}`} className="w-10 h-10 rounded-lg object-cover border border-gray-200 hover:ring-2 hover:ring-emerald-500" />
                    </a>
                  ) : <span className="text-xs text-gray-300">–</span>}
                </td>
                <td className="px-5 py-3.5 mono text-[11px] text-gray-500">
                  {rec && rec.latitude !== null && rec.longitude !== null ? (
                    <a href={`https://www.google.com/maps?q=${rec.latitude},${rec.longitude}`} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">
                      {Number(rec.latitude).toFixed(5)}, {Number(rec.longitude).toFixed(5)}
                    </a>
                  ) : '–'}
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

export function formatRentangIzin(tanggal: string, tanggalSelesai: string, sesi: string | null) {
  const rentang = !tanggalSelesai || tanggalSelesai === tanggal ? tanggal : `${tanggal} s/d ${tanggalSelesai}`
  return `${rentang} · ${sesi ? `Sesi ${sesi}` : 'Seharian'}`
}
