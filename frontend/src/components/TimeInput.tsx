import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Clock } from 'lucide-react'

/**
 * Pengganti <input type="time"> dengan pemilih jam bergaya aplikasi.
 * Kontraknya sama dengan input asli: `value` berformat HH:MM ('' = kosong) dan
 * `onChange` dipanggil dengan objek ber-`target.value`.
 */
interface Props {
  value: string
  onChange: (e: { target: { value: string } }) => void
  className?: string
  disabled?: boolean
  placeholder?: string
}

type Kolom = 'jam' | 'menit'

const LEBAR = 216
const TINGGI_ITEM = 36
const JAM = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MENIT = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'))
const valid = (v?: string) => !!v && /^\d{2}:\d{2}/.test(v)

export default function TimeInput({ value, onChange, className = '', disabled, placeholder = '--:--' }: Props) {
  const [buka, setBuka] = useState(false)
  const [kolom, setKolom] = useState<Kolom>('jam')
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const pemicu = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const daftar = { jam: useRef<HTMLDivElement>(null), menit: useRef<HTMLDivElement>(null) }

  const [jam, menit] = valid(value) ? [value.slice(0, 2), value.slice(3, 5)] : ['', '']

  const setNilai = (j: string, m: string) => onChange({ target: { value: `${j}:${m}` } })

  const tutup = (kembalikanFokus = true) => {
    setBuka(false)
    if (kembalikanFokus) pemicu.current?.focus()
  }

  const pilihJam = (j: string) => setNilai(j, menit || '00')
  const pilihMenit = (m: string) => {
    setNilai(jam || '00', m)
    tutup()
  }

  // Posisi panel (fixed) mengikuti tombol; naik ke atas bila ruang di bawah tidak cukup
  const hitungPosisi = () => {
    const r = pemicu.current?.getBoundingClientRect()
    if (!r) return
    const left = Math.min(Math.max(8, r.left), window.innerWidth - LEBAR - 8)
    const tinggi = panel.current?.offsetHeight ?? 320
    const bawah = r.bottom + 6
    const top = bawah + tinggi > window.innerHeight - 8 && r.top - tinggi - 6 > 8 ? r.top - tinggi - 6 : bawah
    setPos({ top, left })
  }

  // Gulir kolom agar nilai terpilih berada di tengah (tanpa ikut menggulir halaman)
  const gulirKe = (k: Kolom, nilai: string, halus = false) => {
    const wadah = daftar[k].current
    const item = wadah?.querySelector<HTMLElement>(`[data-nilai="${nilai}"]`)
    if (!wadah || !item) return
    wadah.scrollTo({ top: item.offsetTop - wadah.clientHeight / 2 + TINGGI_ITEM / 2, behavior: halus ? 'smooth' : 'auto' })
  }

  useLayoutEffect(() => {
    if (!buka) return
    hitungPosisi()
    gulirKe('jam', jam || '00')
    gulirKe('menit', menit || '00')
  }, [buka])

  useEffect(() => {
    if (!buka) return
    panel.current?.querySelector<HTMLElement>(`[data-kolom="${kolom}"][tabindex="0"]`)?.focus({ preventScroll: true })
  }, [buka, kolom, value])

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

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); tutup(); return }
    if (e.key === 'Enter') { e.preventDefault(); tutup(); return }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault()
      setKolom(e.key === 'ArrowLeft' ? 'jam' : 'menit')
      return
    }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      const arah = e.key === 'ArrowUp' ? -1 : 1
      if (kolom === 'jam') {
        const j = JAM[(JAM.indexOf(jam || '00') + arah + 24) % 24]
        setNilai(j, menit || '00')
        gulirKe('jam', j, true)
      } else {
        const m = MENIT[(MENIT.indexOf(menit || '00') + arah + 60) % 60]
        setNilai(jam || '00', m)
        gulirKe('menit', m, true)
      }
    }
  }

  const daftarKolom = (k: Kolom, isi: string[], terpilih: string, aksi: (v: string) => void) => (
    <div className="flex-1 min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 text-center mb-1">{k === 'jam' ? 'Jam' : 'Menit'}</p>
      <div
        ref={daftar[k]}
        role="listbox"
        aria-label={k === 'jam' ? 'Jam' : 'Menit'}
        className="relative h-54 overflow-y-auto overscroll-contain rounded-xl bg-gray-50/60 p-1 [scrollbar-width:thin]"
      >
        {isi.map(v => {
          const aktif = v === terpilih
          return (
            <button
              key={v}
              type="button"
              role="option"
              aria-selected={aktif}
              data-nilai={v}
              data-kolom={k}
              tabIndex={aktif || (!terpilih && v === '00') ? 0 : -1}
              onClick={() => { setKolom(k); aksi(v) }}
              className={`w-full h-9 rounded-lg text-sm font-semibold tabular-nums transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 ${
                aktif
                  ? 'bg-emerald-700 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_4px_10px_-4px_rgb(4_120_87/0.6)]'
                  : 'text-gray-700 hover:bg-emerald-50 hover:text-emerald-900'
              }`}
            >
              {v}
            </button>
          )
        })}
      </div>
    </div>
  )

  return (
    <>
      <button
        ref={pemicu}
        type="button"
        disabled={disabled}
        onClick={() => (buka ? tutup(false) : (setKolom('jam'), setBuka(true)))}
        aria-haspopup="listbox"
        aria-expanded={buka}
        className={`${className} inline-flex items-center gap-2 text-left tabular-nums cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 ${buka ? 'border-emerald-600! ring-2 ring-emerald-500/15' : ''}`}
      >
        <Clock className="w-4 h-4 shrink-0 text-emerald-700" />
        <span className={valid(value) ? '' : 'text-gray-400'}>{valid(value) ? value.slice(0, 5) : placeholder}</span>
      </button>

      {buka && createPortal(
        <div
          ref={panel}
          role="dialog"
          aria-label="Pilih jam"
          onKeyDown={onKey}
          className="dp-pop fixed z-[80] p-3 rounded-2xl border border-white/85 bg-white/90 backdrop-blur-2xl backdrop-saturate-150 text-gray-800 shadow-[inset_0_1px_0_rgb(255_255_255/0.95),0_18px_40px_-16px_rgb(17_24_39/0.3),0_2px_8px_rgb(17_24_39/0.06)]"
          style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: LEBAR, fontFamily: 'Plus Jakarta Sans' }}
        >
          {/* Pratinjau */}
          <div className="flex items-center justify-center gap-1 mb-2 text-2xl font-extrabold tabular-nums text-gray-900">
            <button type="button" onClick={() => setKolom('jam')} className={`px-2 rounded-lg cursor-pointer ${kolom === 'jam' ? 'bg-emerald-50 text-emerald-800' : ''}`}>{jam || '--'}</button>
            <span className="text-gray-300">:</span>
            <button type="button" onClick={() => setKolom('menit')} className={`px-2 rounded-lg cursor-pointer ${kolom === 'menit' ? 'bg-emerald-50 text-emerald-800' : ''}`}>{menit || '--'}</button>
          </div>

          <div className="flex gap-2">
            {daftarKolom('jam', JAM, jam, pilihJam)}
            {daftarKolom('menit', MENIT, menit, pilihMenit)}
          </div>

          <div className="flex justify-end mt-2 pt-2 border-t border-gray-200/70">
            <button
              type="button"
              onClick={() => tutup()}
              className="text-xs font-bold text-emerald-700 hover:text-emerald-900 px-2 py-1 rounded-lg hover:bg-emerald-50 cursor-pointer transition-colors"
            >
              Selesai
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
