import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'

/**
 * Pengganti <input type="date"> dengan kalender bergaya aplikasi.
 * Kontraknya sama dengan input asli: `value` berformat YYYY-MM-DD ('' = kosong),
 * `onChange` dipanggil dengan objek ber-`target.value`, serta `min`/`max` dihormati.
 */
interface Props {
  value: string
  onChange: (e: { target: { value: string } }) => void
  min?: string
  max?: string
  className?: string
  disabled?: boolean
  // Tampilkan tombol "Hapus" untuk kolom yang boleh dikosongkan
  clearable?: boolean
  placeholder?: string
}

const HARI = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const LEBAR = 296

const pad = (n: number) => String(n).padStart(2, '0')
const keStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const dariStr = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
const valid = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s)
const tambahHari = (s: string, n: number) => {
  const d = dariStr(s)
  d.setDate(d.getDate() + n)
  return keStr(d)
}
const formatTampil = (s: string) =>
  new Intl.DateTimeFormat('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(dariStr(s))

export default function DateInput({ value, onChange, min, max, className = '', disabled, clearable = false, placeholder = 'Pilih tanggal' }: Props) {
  const hariIni = keStr(new Date())
  const [buka, setBuka] = useState(false)
  // Bulan yang ditampilkan (tanggal 1) dan tanggal yang sedang difokus keyboard
  const [bulan, setBulan] = useState(() => (valid(value) ? value : hariIni).slice(0, 7) + '-01')
  const [fokus, setFokus] = useState(valid(value) ? value : hariIni)
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const pemicu = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)

  const diLuarBatas = (s: string) => (valid(min) && s < min!) || (valid(max) && s > max!)

  const bukaKalender = () => {
    if (disabled) return
    const awal = valid(value) ? value : diLuarBatas(hariIni) ? (valid(min) && hariIni < min! ? min! : max!) : hariIni
    setFokus(awal)
    setBulan(awal.slice(0, 7) + '-01')
    setBuka(true)
  }

  const tutup = (kembalikanFokus = true) => {
    setBuka(false)
    if (kembalikanFokus) pemicu.current?.focus()
  }

  const pilih = (s: string) => {
    if (diLuarBatas(s)) return
    onChange({ target: { value: s } })
    tutup()
  }

  // Posisi panel (fixed) mengikuti tombol; naik ke atas bila ruang di bawah tidak cukup
  const hitungPosisi = () => {
    const r = pemicu.current?.getBoundingClientRect()
    if (!r) return
    const width = Math.min(LEBAR, window.innerWidth - 16)
    const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8)
    const tinggi = panel.current?.offsetHeight ?? 360
    const bawah = r.bottom + 6
    const top = bawah + tinggi > window.innerHeight - 8 && r.top - tinggi - 6 > 8 ? r.top - tinggi - 6 : bawah
    setPos({ top, left, width })
  }

  useLayoutEffect(() => {
    if (buka) hitungPosisi()
  }, [buka, bulan])

  useEffect(() => {
    if (!buka) return
    const luar = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node
      if (!panel.current?.contains(t) && !pemicu.current?.contains(t)) tutup(false)
    }
    window.addEventListener('mousedown', luar)
    window.addEventListener('touchstart', luar)
    window.addEventListener('resize', hitungPosisi)
    window.addEventListener('scroll', hitungPosisi, true)
    return () => {
      window.removeEventListener('mousedown', luar)
      window.removeEventListener('touchstart', luar)
      window.removeEventListener('resize', hitungPosisi)
      window.removeEventListener('scroll', hitungPosisi, true)
    }
  }, [buka])

  // Fokus keyboard ikut pindah ke tanggal yang aktif
  useEffect(() => {
    if (buka) panel.current?.querySelector<HTMLButtonElement>(`[data-tgl="${fokus}"]`)?.focus()
  }, [buka, fokus, bulan])

  const geserFokus = (n: number) => {
    const baru = tambahHari(fokus, n)
    setFokus(baru)
    if (baru.slice(0, 7) !== bulan.slice(0, 7)) setBulan(baru.slice(0, 7) + '-01')
  }

  const onKey = (e: React.KeyboardEvent) => {
    const peta: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
    if (e.key in peta) {
      e.preventDefault()
      geserFokus(peta[e.key])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      tutup()
    } else if (e.key === 'Enter' && (e.target as HTMLElement).dataset.tgl) {
      e.preventDefault()
      pilih(fokus)
    }
  }

  const gantiBulan = (n: number) => {
    const d = dariStr(bulan)
    d.setMonth(d.getMonth() + n)
    setBulan(keStr(d))
  }

  // Grid 6 minggu, dimulai hari Senin
  const awalBulan = dariStr(bulan)
  const geser = (awalBulan.getDay() + 6) % 7
  const sel = Array.from({ length: 42 }, (_, i) => tambahHari(bulan, i - geser))
  const akhirBulanSebelum = tambahHari(bulan, -1)
  const awalBulanBerikut = (() => { const d = dariStr(bulan); d.setMonth(d.getMonth() + 1); return keStr(d) })()
  const bisaMundur = !(valid(min) && akhirBulanSebelum < min!)
  const bisaMaju = !(valid(max) && awalBulanBerikut > max!)

  return (
    <>
      <button
        ref={pemicu}
        type="button"
        disabled={disabled}
        onClick={() => (buka ? tutup(false) : bukaKalender())}
        aria-haspopup="dialog"
        aria-expanded={buka}
        className={`${className} inline-flex items-center gap-2 text-left cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 ${buka ? 'border-emerald-600! ring-2 ring-emerald-500/15' : ''}`}
      >
        <Calendar className="w-4 h-4 shrink-0 text-emerald-700" />
        <span className={`flex-1 truncate ${valid(value) ? '' : 'text-gray-400'}`}>{valid(value) ? formatTampil(value) : placeholder}</span>
      </button>

      {buka && createPortal(
        <div
          ref={panel}
          role="dialog"
          aria-label="Pilih tanggal"
          onKeyDown={onKey}
          className="dp-pop fixed z-[80] p-3 rounded-2xl border border-white/85 bg-white/90 backdrop-blur-2xl backdrop-saturate-150 text-gray-800 shadow-[inset_0_1px_0_rgb(255_255_255/0.95),0_18px_40px_-16px_rgb(17_24_39/0.3),0_2px_8px_rgb(17_24_39/0.06)]"
          style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: pos?.width ?? LEBAR, fontFamily: 'Plus Jakarta Sans' }}
        >
          {/* Navigasi bulan */}
          <div className="flex items-center justify-between mb-2 px-1">
            <button
              type="button"
              onClick={() => gantiBulan(-1)}
              disabled={!bisaMundur}
              aria-label="Bulan sebelumnya"
              className="p-1.5 rounded-lg text-gray-600 hover:bg-emerald-50 hover:text-emerald-800 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-bold text-gray-900">{BULAN[awalBulan.getMonth()]} {awalBulan.getFullYear()}</span>
            <button
              type="button"
              onClick={() => gantiBulan(1)}
              disabled={!bisaMaju}
              aria-label="Bulan berikutnya"
              className="p-1.5 rounded-lg text-gray-600 hover:bg-emerald-50 hover:text-emerald-800 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Nama hari */}
          <div className="grid grid-cols-7 mb-1">
            {HARI.map((h, i) => (
              <span key={h} className={`text-center text-[11px] font-bold uppercase tracking-wide py-1 ${i === 6 ? 'text-rose-400' : 'text-gray-400'}`}>{h}</span>
            ))}
          </div>

          {/* Tanggal */}
          <div className="grid grid-cols-7 gap-0.5" role="grid">
            {sel.map(s => {
              const d = dariStr(s)
              const bulanIni = s.slice(0, 7) === bulan.slice(0, 7)
              const terpilih = s === value
              const adalahHariIni = s === hariIni
              const mati = diLuarBatas(s)
              return (
                <button
                  key={s}
                  type="button"
                  data-tgl={s}
                  tabIndex={s === fokus ? 0 : -1}
                  disabled={mati}
                  onClick={() => pilih(s)}
                  aria-pressed={terpilih}
                  aria-label={formatTampil(s)}
                  className={`relative h-9 rounded-xl text-[13px] font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 ${
                    terpilih
                      ? 'bg-emerald-700 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_4px_10px_-4px_rgb(4_120_87/0.6)]'
                      : mati
                        ? 'text-gray-300 cursor-not-allowed'
                        : `${bulanIni ? 'text-gray-800' : 'text-gray-400'} hover:bg-emerald-50 hover:text-emerald-900 cursor-pointer`
                  } ${adalahHariIni && !terpilih ? 'text-emerald-700! ring-1 ring-inset ring-emerald-300' : ''}`}
                >
                  {d.getDate()}
                </button>
              )
            })}
          </div>

          {/* Aksi cepat */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-200/70 px-1">
            {clearable ? (
              <button
                type="button"
                onClick={() => { onChange({ target: { value: '' } }); tutup() }}
                className="text-xs font-bold text-gray-500 hover:text-rose-600 px-2 py-1 rounded-lg hover:bg-rose-50 cursor-pointer transition-colors"
              >
                Hapus
              </button>
            ) : <span />}
            <button
              type="button"
              onClick={() => pilih(hariIni)}
              disabled={diLuarBatas(hariIni)}
              className="text-xs font-bold text-emerald-700 hover:text-emerald-900 px-2 py-1 rounded-lg hover:bg-emerald-50 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Hari ini
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
