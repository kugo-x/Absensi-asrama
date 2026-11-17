import { useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { addDays, formatTanggal, todayLocal } from '../logic'

/**
 * Kalender sebaris untuk memilih beberapa tanggal sekaligus (klik tanggal untuk memilih / membatalkan).
 * `value` berisi tanggal YYYY-MM-DD yang terurut.
 */

const HARI = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

const geserBulan = (awalBulan: string, n: number) => {
  const [y, m] = awalBulan.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export default function PilihBeberapaTanggal({ value, onChange, min, maks = 31 }: {
  value: string[]
  onChange: (tanggal: string[]) => void
  min: string
  maks?: number
}) {
  const hariIni = todayLocal()
  const [bulan, setBulan] = useState(() => (value[0] ?? min).slice(0, 7) + '-01')

  const [y, m] = bulan.split('-').map(Number)
  // Grid 6 minggu, dimulai hari Senin
  const geser = (new Date(y, m - 1, 1).getDay() + 6) % 7
  const sel = Array.from({ length: 42 }, (_, i) => addDays(bulan, i - geser))
  const bisaMundur = geserBulan(bulan, 0) > min.slice(0, 7) + '-01'
  const penuh = value.length >= maks

  const toggle = (s: string) => {
    if (value.includes(s)) onChange(value.filter(t => t !== s))
    else if (!penuh) onChange([...value, s].sort())
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-gray-200 p-3" style={{ fontFamily: 'Plus Jakarta Sans' }}>
        <div className="flex items-center justify-between mb-2">
          <button
            type="button"
            onClick={() => setBulan(b => geserBulan(b, -1))}
            disabled={!bisaMundur}
            aria-label="Bulan sebelumnya"
            className="p-1.5 rounded-lg text-gray-600 hover:bg-emerald-50 hover:text-emerald-800 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-bold text-gray-900">{BULAN[m - 1]} {y}</span>
          <button
            type="button"
            onClick={() => setBulan(b => geserBulan(b, 1))}
            aria-label="Bulan berikutnya"
            className="p-1.5 rounded-lg text-gray-600 hover:bg-emerald-50 hover:text-emerald-800 cursor-pointer transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 mb-1">
          {HARI.map((h, i) => (
            <span key={h} className={`text-center text-[11px] font-bold uppercase tracking-wide py-1 ${i === 6 ? 'text-rose-400' : 'text-gray-400'}`}>{h}</span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-0.5">
          {sel.map(s => {
            const bulanIni = s.slice(0, 7) === bulan.slice(0, 7)
            const terpilih = value.includes(s)
            const mati = s < min || (penuh && !terpilih)
            return (
              <button
                key={s}
                type="button"
                disabled={mati}
                onClick={() => toggle(s)}
                aria-pressed={terpilih}
                aria-label={formatTanggal(s)}
                className={`h-9 rounded-lg text-[13px] font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 ${
                  terpilih
                    ? 'bg-emerald-700 text-white'
                    : mati
                      ? 'text-gray-300 cursor-not-allowed'
                      : `${bulanIni ? 'text-gray-800' : 'text-gray-400'} hover:bg-emerald-50 hover:text-emerald-900 cursor-pointer`
                } ${s === hariIni && !terpilih ? 'ring-1 ring-inset ring-emerald-300' : ''}`}
              >
                {Number(s.slice(8))}
              </button>
            )
          })}
        </div>
      </div>

      {value.length === 0 ? (
        <p className="text-[11px] text-gray-500">Klik tanggal di kalender untuk memilihnya. Tanggal tidak harus berurutan.</p>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[11px] font-semibold text-gray-600">{value.length} tanggal dipilih{penuh ? ` (maksimal ${maks})` : ''}</p>
            <button type="button" onClick={() => onChange([])} className="text-[11px] font-semibold text-red-600 hover:underline cursor-pointer">Hapus semua</button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {value.map(s => (
              <span key={s} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-md text-[11px] font-semibold border bg-emerald-50 border-emerald-200 text-emerald-800">
                {formatTanggal(s, 'tanpaHari')}
                <button type="button" onClick={() => toggle(s)} aria-label={`Hapus ${formatTanggal(s, 'tanpaHari')}`} className="p-0.5 rounded hover:bg-emerald-100 cursor-pointer">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
