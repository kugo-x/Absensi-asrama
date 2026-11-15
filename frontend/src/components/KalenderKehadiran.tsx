import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { PresensiStatus, Sesi } from '../types'
import { formatTanggal, hitungStatus, jamPresensi, keteranganStatus, riwayatPenghuni, todayLocal, type DataPresensi, type RiwayatRow } from '../logic'
import { SectionTitle } from './AppLayout'

/**
 * Kalender kehadiran sebulan untuk penghuni.
 * Warna tiap hari diringkas dari status semua sesi wajib pada hari itu (logika status sama dengan riwayat).
 */

const NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const HARI_KOLOM = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']

type Ringkas = 'hadir' | 'sebagian' | 'alpa' | 'izin' | 'libur' | 'kosong'

const WARNA: Record<Ringkas, string> = {
  hadir: 'bg-emerald-600 text-white',
  sebagian: 'bg-amber-200 text-amber-900',
  alpa: 'bg-rose-500 text-white',
  izin: 'bg-amber-400 text-amber-950',
  libur: 'bg-sky-100 text-sky-800',
  kosong: 'bg-gray-50 text-gray-400 border border-gray-200',
}

const LEGENDA: [Ringkas, string][] = [
  ['hadir', 'Hadir semua sesi'],
  ['sebagian', 'Ada yang terlewat'],
  ['alpa', 'Tidak hadir'],
  ['izin', 'Izin'],
  ['libur', 'Libur'],
  ['kosong', 'Tidak ada sesi / belum'],
]

const WARNA_STATUS: Record<PresensiStatus, string> = {
  Hadir: 'text-emerald-700',
  'Tidak Hadir': 'text-rose-700',
  Izin: 'text-amber-700',
  Libur: 'text-sky-700',
  Belum: 'text-gray-400',
}

function ringkas(baris: RiwayatRow[]): Ringkas {
  const st = baris.map(r => r.detail.status).filter(s => s !== 'Belum')
  if (st.length === 0) return 'kosong'
  if (st.every(s => s === 'Libur')) return 'libur'
  if (st.every(s => s === 'Hadir')) return 'hadir'
  if (st.every(s => s === 'Izin')) return 'izin'
  if (st.every(s => s === 'Tidak Hadir')) return 'alpa'
  if (st.includes('Tidak Hadir')) return 'sebagian'
  return 'hadir' // campuran Hadir + Izin/Libur: tidak ada yang terlewat
}

const pad = (n: number) => String(n).padStart(2, '0')

export default function KalenderKehadiran({ nim, sesiList, data, now, gedung, tanggalMasuk }: {
  nim: string
  sesiList: Sesi[]
  data: DataPresensi
  now: Date
  gedung?: string | null
  tanggalMasuk?: string
}) {
  const today = todayLocal()
  const [bulan, setBulan] = useState(() => today.slice(0, 7)) // YYYY-MM
  const [dipilih, setDipilih] = useState<string | null>(today)

  const [y, m] = bulan.split('-').map(Number)
  const awal = `${bulan}-01`
  const jumlahHari = new Date(y, m, 0).getDate()
  const akhir = `${bulan}-${pad(jumlahHari)}`
  const batasAwalBulan = (tanggalMasuk || '2000-01-01').slice(0, 7)
  const mulaiHitung = tanggalMasuk && tanggalMasuk > awal ? tanggalMasuk : awal
  const sampaiHitung = akhir < today ? akhir : today

  const baris = mulaiHitung <= sampaiHitung ? riwayatPenghuni(nim, mulaiHitung, sampaiHitung, sesiList, data, now, gedung) : []
  const perTanggal = new Map<string, RiwayatRow[]>()
  for (const r of baris) perTanggal.set(r.tanggal, [...(perTanggal.get(r.tanggal) ?? []), r])
  const c = hitungStatus(baris.map(r => r.detail.status))

  // Senin sebagai kolom pertama
  const offset = (new Date(y, m - 1, 1).getDay() + 6) % 7
  const sel: (string | null)[] = [...Array(offset).fill(null), ...Array.from({ length: jumlahHari }, (_, i) => `${bulan}-${pad(i + 1)}`)]

  const geser = (n: number) => {
    const d = new Date(y, m - 1 + n, 1)
    setBulan(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`)
    setDipilih(null)
  }
  const bisaMundur = bulan > batasAwalBulan
  const bisaMaju = bulan < today.slice(0, 7)
  const detail = dipilih ? [...(perTanggal.get(dipilih) ?? [])].reverse() : []

  return (
    <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-2xs">
      <div className="flex items-start justify-between gap-3 mb-4">
        <SectionTitle subtitle={`Kehadiran ${c.persen}% · Hadir ${c.Hadir} dari ${c.wajib} sesi wajib bulan ini`}>Kalender Kehadiran</SectionTitle>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => geser(-1)} disabled={!bisaMundur} aria-label="Bulan sebelumnya" className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="w-32 text-center text-sm font-bold text-gray-800" style={{ fontFamily: 'Plus Jakarta Sans' }}>{NAMA_BULAN[m - 1]} {y}</span>
          <button onClick={() => geser(1)} disabled={!bisaMaju} aria-label="Bulan berikutnya" className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-[minmax(0,400px)_minmax(0,1fr)] gap-5">
        <div>
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5 mb-1">
            {HARI_KOLOM.map(h => <div key={h} className="text-center text-[10px] font-bold uppercase tracking-wider text-gray-400">{h}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {sel.map((t, i) => {
              if (!t) return <div key={`k${i}`} />
              const rows = perTanggal.get(t) ?? []
              const r = ringkas(rows)
              const nanti = t > today
              return (
                <button
                  key={t}
                  onClick={() => setDipilih(t)}
                  data-tgl={t}
                  title={`${formatTanggal(t)}${rows.length ? ' · ' + rows.map(x => `${x.sesi.nama}: ${x.detail.status}`).join(', ') : ''}`}
                  className={`aspect-square rounded-lg text-xs font-bold flex flex-col items-center justify-center transition-all cursor-pointer
                    ${nanti ? 'bg-white text-gray-300 border border-dashed border-gray-200' : WARNA[r]}
                    ${dipilih === t ? 'ring-2 ring-offset-1 ring-emerald-800' : ''} ${t === today ? 'underline underline-offset-2' : ''}`}
                >
                  {Number(t.slice(8))}
                </button>
              )
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5">
            {LEGENDA.map(([k, label]) => (
              <span key={k} className="inline-flex items-center gap-1.5 text-[11px] text-gray-500">
                <span className={`w-3 h-3 rounded ${WARNA[k]}`} />
                {label}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3.5">
          {!dipilih ? (
            <p className="text-xs text-gray-400">Pilih tanggal untuk melihat detail.</p>
          ) : (
            <>
              <p className="text-sm font-bold text-gray-900 mb-2" style={{ fontFamily: 'Plus Jakarta Sans' }}>{formatTanggal(dipilih)}</p>
              {detail.length === 0 ? (
                <p className="text-xs text-gray-400">{dipilih > today ? 'Belum berlangsung.' : dipilih < mulaiHitung ? 'Sebelum Anda terdaftar.' : 'Tidak ada sesi wajib.'}</p>
              ) : (
                <ul className="space-y-2">
                  {detail.map(({ sesi, detail: d }) => {
                    const jam = jamPresensi(d.presensi)
                    const ket = keteranganStatus(d)
                    return (
                      <li key={sesi.id} className="text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-gray-800">Sesi {sesi.nama} <span className="font-normal text-gray-400">{sesi.jamMulai}–{sesi.jamSelesai}</span></span>
                          <span className={`font-bold ${WARNA_STATUS[d.status]}`}>{d.status}</span>
                        </div>
                        {(jam || ket) && <p className="text-[11px] text-gray-500 mt-0.5">{[jam && `Masuk ${jam}`, ket].filter(Boolean).join(' · ')}</p>}
                      </li>
                    )
                  })}
                </ul>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
