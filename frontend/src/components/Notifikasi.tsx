import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Bell, CheckCircle2, Inbox, AlertTriangle, Info, CheckCheck, X } from 'lucide-react'

/**
 * Pusat notifikasi sisi klien (belum ada tabel notifikasi di backend / Modul 4).
 * Sumber notifikasi:
 *  1. Turunan data halaman (permintaan masuk, keputusan, peringatan) -> prop `items`
 *  2. Aksi yang berhasil ke server -> event 'sip-aktivitas' dari api.ts, disimpan per akun
 * Status "sudah dibaca" disimpan di localStorage per akun.
 */
export type JenisNotifikasi = 'sukses' | 'permintaan' | 'peringatan' | 'info'

export interface Notifikasi {
  id: string
  jenis: JenisNotifikasi
  judul: string
  pesan?: string
  // ISO / 'YYYY-MM-DD' / 'YYYY-MM-DD HH:MM'; kosong = berlaku saat ini
  waktu?: string
  // Pengganti label waktu relatif, mis. 'Menunggu' atau '12 mnt lagi'
  labelWaktu?: string
  // Menu yang dibuka saat notifikasi diklik
  tab?: string
}

export interface AktivitasDetail {
  judul: string
  pesan: string
}

const MAKS_AKTIVITAS = 30
const MAKS_DIBACA = 400

const kunci = (nim: string, jenis: 'dibaca' | 'aktivitas') => `sip-notif-${jenis}-${nim}`

function baca<T>(k: string, awal: T): T {
  try {
    const v = localStorage.getItem(k)
    return v ? (JSON.parse(v) as T) : awal
  } catch {
    return awal
  }
}
function tulis(k: string, v: unknown) {
  try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* penyimpanan tidak tersedia */ }
}

const keDate = (w?: string) => {
  if (!w) return null
  const d = new Date(w.length === 10 ? `${w}T00:00:00` : w.replace(' ', 'T'))
  return Number.isNaN(d.getTime()) ? null : d
}

function waktuRelatif(w: string | undefined, now: Date): string {
  const d = keDate(w)
  if (!d) return 'Sekarang'
  const hanyaTanggal = !!w && w.length === 10
  const selisih = (now.getTime() - d.getTime()) / 1000
  const hari = Math.floor((new Date(now.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86400000)
  if (!hanyaTanggal) {
    if (selisih < 60) return 'Baru saja'
    if (selisih < 3600) return `${Math.floor(selisih / 60)} mnt lalu`
    if (hari === 0) return `${Math.floor(selisih / 3600)} jam lalu`
  } else if (hari === 0) return 'Hari ini'
  if (hari === 1) return 'Kemarin'
  if (hari < 7 && hari > 0) return `${hari} hari lalu`
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(d)
}

const GAYA: Record<JenisNotifikasi, { ikon: React.ReactNode; warna: string }> = {
  sukses: { ikon: <CheckCircle2 className="w-4 h-4" />, warna: 'bg-emerald-100 text-emerald-700' },
  permintaan: { ikon: <Inbox className="w-4 h-4" />, warna: 'bg-blue-100 text-blue-700' },
  peringatan: { ikon: <AlertTriangle className="w-4 h-4" />, warna: 'bg-amber-100 text-amber-700' },
  info: { ikon: <Info className="w-4 h-4" />, warna: 'bg-gray-100 text-gray-600' },
}

const LEBAR = 380

export default function NotifikasiBell({ nim, items, onBuka }: { nim: string; items: Notifikasi[]; onBuka: (tab: string) => void }) {
  const [buka, setBuka] = useState(false)
  const [dibaca, setDibaca] = useState<string[]>(() => baca(kunci(nim, 'dibaca'), []))
  const [aktivitas, setAktivitas] = useState<Notifikasi[]>(() => baca(kunci(nim, 'aktivitas'), []))
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const [now, setNow] = useState(new Date())
  const tombol = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)

  // Muat ulang saat akun berganti
  useEffect(() => {
    setDibaca(baca(kunci(nim, 'dibaca'), []))
    setAktivitas(baca(kunci(nim, 'aktivitas'), []))
  }, [nim])

  // Aksi berhasil dari api.ts
  useEffect(() => {
    const tangkap = (e: Event) => {
      const d = (e as CustomEvent<AktivitasDetail>).detail
      if (!d) return
      const baru: Notifikasi = { id: `akt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, jenis: 'sukses', judul: d.judul, pesan: d.pesan, waktu: new Date().toISOString() }
      setAktivitas(prev => {
        const next = [baru, ...prev].slice(0, MAKS_AKTIVITAS)
        tulis(kunci(nim, 'aktivitas'), next)
        return next
      })
    }
    window.addEventListener('sip-aktivitas', tangkap)
    return () => window.removeEventListener('sip-aktivitas', tangkap)
  }, [nim])

  // Perbarui label waktu relatif
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(t)
  }, [])

  const semua = [...items, ...aktivitas].sort((a, b) => {
    const ta = keDate(a.waktu)?.getTime() ?? Number.MAX_SAFE_INTEGER
    const tb = keDate(b.waktu)?.getTime() ?? Number.MAX_SAFE_INTEGER
    return tb - ta
  })
  const setDibacaSet = new Set(dibaca)
  const belum = semua.filter(n => !setDibacaSet.has(n.id)).length

  const tandai = (ids: string[]) => {
    setDibaca(prev => {
      const next = [...new Set([...ids, ...prev])].slice(0, MAKS_DIBACA)
      tulis(kunci(nim, 'dibaca'), next)
      return next
    })
  }

  const hitungPosisi = () => {
    const r = tombol.current?.getBoundingClientRect()
    if (!r) return
    const width = Math.min(LEBAR, window.innerWidth - 24)
    const left = window.innerWidth < 640 ? (window.innerWidth - width) / 2 : Math.min(Math.max(12, r.right - width), window.innerWidth - width - 12)
    setPos({ top: r.bottom + 8, left, width })
  }

  useLayoutEffect(() => {
    if (buka) hitungPosisi()
  }, [buka])

  useEffect(() => {
    if (!buka) return
    const luar = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node
      if (!panel.current?.contains(t) && !tombol.current?.contains(t)) setBuka(false)
    }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setBuka(false); tombol.current?.focus() } }
    window.addEventListener('mousedown', luar)
    window.addEventListener('touchstart', luar)
    window.addEventListener('keydown', esc)
    window.addEventListener('resize', hitungPosisi)
    return () => {
      window.removeEventListener('mousedown', luar)
      window.removeEventListener('touchstart', luar)
      window.removeEventListener('keydown', esc)
      window.removeEventListener('resize', hitungPosisi)
    }
  }, [buka])

  const klik = (n: Notifikasi) => {
    tandai([n.id])
    if (n.tab) {
      onBuka(n.tab)
      setBuka(false)
    }
  }

  return (
    <>
      <button
        ref={tombol}
        type="button"
        onClick={() => setBuka(b => !b)}
        aria-label={belum ? `Notifikasi, ${belum} belum dibaca` : 'Notifikasi'}
        aria-expanded={buka}
        aria-haspopup="dialog"
        className={`relative w-10 h-10 flex items-center justify-center rounded-full border transition-colors cursor-pointer ${
          buka ? 'bg-white border-emerald-300 text-emerald-800' : 'bg-white/60 border-white/80 text-gray-700 hover:bg-white hover:text-emerald-800'
        } shadow-[inset_0_1px_0_rgb(255_255_255/0.9),0_2px_8px_-4px_rgb(17_24_39/0.15)]`}
      >
        <Bell className={`w-[18px] h-[18px] ${belum ? 'notif-goyang' : ''}`} />
        {belum > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white tabular-nums">
            {belum > 99 ? '99+' : belum}
          </span>
        )}
      </button>

      {buka && createPortal(
        <div
          ref={panel}
          role="dialog"
          aria-label="Notifikasi"
          className="dp-pop fixed z-[80] flex flex-col max-h-[min(560px,calc(100vh-96px))] rounded-2xl border border-white/85 bg-white/92 backdrop-blur-2xl backdrop-saturate-150 text-gray-800 shadow-[inset_0_1px_0_rgb(255_255_255/0.95),0_24px_48px_-20px_rgb(17_24_39/0.35),0_2px_8px_rgb(17_24_39/0.06)]"
          style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: pos?.width ?? LEBAR, fontFamily: 'Plus Jakarta Sans' }}
        >
          <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-3 border-b border-gray-200/70">
            <div>
              <p className="text-sm font-extrabold text-gray-900">Notifikasi</p>
              <p className="text-[11px] text-gray-500">{belum ? `${belum} belum dibaca` : 'Semua sudah dibaca'}</p>
            </div>
            <div className="flex items-center gap-1">
              {belum > 0 && (
                <button
                  type="button"
                  onClick={() => tandai(semua.map(n => n.id))}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold text-emerald-700 hover:bg-emerald-50 cursor-pointer transition-colors"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Tandai dibaca
                </button>
              )}
              <button type="button" onClick={() => setBuka(false)} aria-label="Tutup" className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 cursor-pointer sm:hidden">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="overflow-y-auto overscroll-contain p-2">
            {semua.length === 0 ? (
              <div className="py-10 text-center">
                <div className="w-11 h-11 mx-auto rounded-full bg-gray-100 flex items-center justify-center text-gray-400 mb-2">
                  <Bell className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-gray-500">Belum ada notifikasi</p>
              </div>
            ) : (
              <ul className="space-y-0.5">
                {semua.map(n => {
                  const baru = !setDibacaSet.has(n.id)
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => klik(n)}
                        className={`w-full flex items-start gap-3 p-2.5 rounded-xl text-left transition-colors cursor-pointer ${baru ? 'bg-emerald-50/70 hover:bg-emerald-50' : 'hover:bg-gray-100/80'}`}
                      >
                        <span className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${GAYA[n.jenis].warna}`}>{GAYA[n.jenis].ikon}</span>
                        <span className="flex-1 min-w-0">
                          <span className="flex items-start justify-between gap-2">
                            <span className={`text-[13px] leading-snug ${baru ? 'font-bold text-gray-900' : 'font-semibold text-gray-700'}`}>{n.judul}</span>
                            <span className="shrink-0 text-[10px] text-gray-400 font-medium mt-0.5 whitespace-nowrap">{n.labelWaktu ?? waktuRelatif(n.waktu, now)}</span>
                          </span>
                          {n.pesan && <span className="block text-xs text-gray-500 mt-0.5 leading-relaxed line-clamp-2">{n.pesan}</span>}
                        </span>
                        {baru && <span className="shrink-0 mt-1.5 w-2 h-2 rounded-full bg-emerald-500" aria-label="Belum dibaca" />}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
