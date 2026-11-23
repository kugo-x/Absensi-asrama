import { addDays, dateRangeDesc, formatTanggal, semesterDari } from '../logic'
import DateInput from './DateInput'

/**
 * Pilihan periode laporan (admin & fasil): pilihan cepat atau rentang tanggal bebas.
 * Rentang bebas dibatasi MAKS_HARI_LAPORAN karena rekap dihitung per penghuni per sesi per hari di browser.
 */

export type PeriodeLaporan = 'hari-ini' | '7' | '30' | 'bulan-ini' | 'bulan-lalu' | 'semester-ini' | 'semester-lalu' | 'rentang'

export const MAKS_HARI_LAPORAN = 92

export const PILIHAN_PERIODE_LAPORAN: [PeriodeLaporan, string][] = [
  ['hari-ini', 'Hari ini'],
  ['7', '7 hari terakhir'],
  ['30', '30 hari terakhir'],
  ['bulan-ini', 'Bulan ini'],
  ['bulan-lalu', 'Bulan lalu'],
  ['semester-ini', 'Semester ini'],
  ['semester-lalu', 'Semester lalu'],
  ['rentang', 'Pilih rentang tanggal…'],
]

export interface SaringPeriode {
  periode: PeriodeLaporan
  dari: string
  sampai: string
}

// Rentang [mulai, akhir] hasil pilihan; null bila rentang bebas belum valid
export function rentangLaporan({ periode, dari, sampai }: SaringPeriode, today: string): [string, string] | null {
  const awalBulanIni = `${today.slice(0, 7)}-01`
  switch (periode) {
    case 'hari-ini': return [today, today]
    case '7': return [addDays(today, -6), today]
    case '30': return [addDays(today, -29), today]
    case 'bulan-ini': return [awalBulanIni, today]
    case 'bulan-lalu': {
      const akhir = addDays(awalBulanIni, -1)
      return [`${akhir.slice(0, 7)}-01`, akhir]
    }
    case 'semester-ini': {
      const s = semesterDari(today)
      return [s.mulai, s.selesai < today ? s.selesai : today]
    }
    case 'semester-lalu': {
      const s = semesterDari(addDays(semesterDari(today).mulai, -1))
      return [s.mulai, s.selesai]
    }
    case 'rentang':
      if (!dari || !sampai || sampai < dari || dateRangeDesc(dari, sampai).length > MAKS_HARI_LAPORAN) return null
      return [dari, sampai]
  }
}

// Teks periode untuk judul laporan, mis. "Bulan ini (1 Nov 2026 – 17 Nov 2026)"
export function labelPeriodeLaporan(saring: SaringPeriode, rentang: [string, string]): string {
  const [a, b] = rentang
  const nama = saring.periode === 'rentang' ? 'Periode'
    : saring.periode.startsWith('semester') ? `Semester ${semesterDari(a).label}`
    : PILIHAN_PERIODE_LAPORAN.find(([p]) => p === saring.periode)![1]
  return `${nama} (${a === b ? formatTanggal(a, 'tanpaHari') : `${formatTanggal(a, 'tanpaHari')} – ${formatTanggal(b, 'tanpaHari')}`})`
}

export function PilihPeriodeLaporan({ nilai, onChange, today, className }: {
  nilai: SaringPeriode
  onChange: (v: SaringPeriode) => void
  today: string
  className: string
}) {
  const pilih = (periode: PeriodeLaporan) => {
    // Rentang bebas dimulai dari bulan berjalan agar langsung terisi
    if (periode === 'rentang' && (!nilai.dari || !nilai.sampai)) onChange({ periode, dari: `${today.slice(0, 7)}-01`, sampai: today })
    else onChange({ ...nilai, periode })
  }
  const salah = nilai.periode === 'rentang' && rentangLaporan(nilai, today) === null

  return (
    <>
      <select value={nilai.periode} onChange={e => pilih(e.target.value as PeriodeLaporan)} aria-label="Periode laporan" className={className}>
        {PILIHAN_PERIODE_LAPORAN.map(([p, label]) => <option key={p} value={p}>{label}</option>)}
      </select>
      {nilai.periode === 'rentang' && (
        <>
          <div className="min-w-40">
            <DateInput max={today} placeholder="Dari tanggal" className={className} value={nilai.dari} onChange={e => onChange({ ...nilai, dari: e.target.value })} />
          </div>
          <div className="min-w-40">
            <DateInput max={today} min={nilai.dari || undefined} placeholder="Sampai tanggal" className={className} value={nilai.sampai} onChange={e => onChange({ ...nilai, sampai: e.target.value })} />
          </div>
          {salah && (
            <p role="alert" className="basis-full text-xs font-semibold text-rose-700">
              Pilih tanggal awal dan akhir yang valid, maksimal {MAKS_HARI_LAPORAN} hari.
            </p>
          )}
        </>
      )}
    </>
  )
}
