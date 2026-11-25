import { useState, type ReactNode } from 'react'
import { addDays, formatTanggal, hariIso, hitungStatus, NAMA_HARI } from '../logic'
import { IsiTooltip, WARNA_STATUS_GRAFIK } from './GrafikKehadiran'

/**
 * Visualisasi dashboard fasil. Warna status memakai WARNA_STATUS_GRAFIK (sudah divalidasi);
 * besaran (kalender, histogram, batang kamar) memakai satu hue hijau terang→gelap.
 * Warna netral & ramp memakai variabel CSS agar ikut berganti di mode gelap.
 * Setiap tanda punya tooltip; identitas tidak pernah hanya lewat warna (selalu ada label/legenda).
 */

type Rekap = ReturnType<typeof hitungStatus>
const FONT = { fontFamily: 'Plus Jakarta Sans' }

// ---------- Tooltip bersama ----------
type Tip = { x: number; y: number; isi: ReactNode } | null
function KotakTip({ tip }: { tip: Tip }) {
  if (!tip) return null
  return (
    <div
      role="tooltip"
      className="tetap-terang pointer-events-none absolute z-20 min-w-36 max-w-56 -translate-x-1/2 -translate-y-full rounded-lg bg-gray-900 px-2.5 py-2 text-[11px] leading-snug text-white shadow-lg"
      style={{ left: tip.x, top: tip.y - 8, background: '#111827', color: '#fff' }}
    >
      {tip.isi}
    </div>
  )
}
function useTip() {
  const [tip, setTip] = useState<Tip>(null)
  const tampil = (e: React.MouseEvent | React.FocusEvent, isi: ReactNode) => {
    const wadah = (e.currentTarget as Element).closest('[data-wadah-tip]') as HTMLElement | null
    const kotak = (e.currentTarget as Element).getBoundingClientRect()
    const asal = wadah?.getBoundingClientRect()
    setTip({ x: kotak.left + kotak.width / 2 - (asal?.left ?? 0), y: kotak.top - (asal?.top ?? 0), isi })
  }
  return { tip, tampil, sembunyi: () => setTip(null) }
}

// Ramp hijau satu hue (sequential) untuk besaran kehadiran
const RAMP = ['var(--color-emerald-100)', 'var(--color-emerald-300)', 'var(--color-emerald-500)', 'var(--color-emerald-700)', 'var(--color-emerald-900)']
const warnaRamp = (persen: number) => RAMP[Math.min(4, Math.floor(persen / 20.0001))]
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const namaBulan = (t: string) => BULAN[Number(t.slice(5, 7)) - 1]

// ==================== 1. Donut komposisi ====================
export interface BagianDonut { label: string; nilai: number; warna: string }

export function DonutKomposisi({ bagian, tengah, sub, ukuran = 168 }: { bagian: BagianDonut[]; tengah: string; sub: string; ukuran?: number }) {
  const [aktif, setAktif] = useState<number | null>(null)
  const total = bagian.reduce((t, b) => t + b.nilai, 0)
  const r = 42, tebal = 14, keliling = 2 * Math.PI * r
  const celah = total > 0 && bagian.filter(b => b.nilai > 0).length > 1 ? 1.2 : 0 // celah 2px antarsegmen
  let jalan = 0
  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <div className="relative shrink-0" style={{ width: ukuran, height: ukuran }}>
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90" role="img" aria-label={`${tengah} ${sub}`}>
          <circle cx="50" cy="50" r={r} fill="none" stroke="var(--color-gray-100)" strokeWidth={tebal} />
          {total > 0 && bagian.map((b, i) => {
            if (b.nilai === 0) return null
            const panjang = (b.nilai / total) * keliling
            const awal = jalan
            jalan += panjang
            return (
              <circle
                key={b.label}
                cx="50" cy="50" r={r} fill="none"
                stroke={b.warna}
                strokeWidth={aktif === i ? tebal + 3 : tebal}
                strokeDasharray={`${Math.max(0.01, panjang - celah)} ${keliling}`}
                strokeDashoffset={-awal}
                className="transition-[stroke-width] duration-200 cursor-pointer"
                onMouseEnter={() => setAktif(i)}
                onMouseLeave={() => setAktif(null)}
              >
                <title>{`${b.label}: ${b.nilai} (${Math.round((b.nilai / total) * 100)}%)`}</title>
              </circle>
            )
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
          {aktif !== null && total > 0 ? (
            <>
              <span className="text-2xl font-extrabold text-gray-900 leading-none" style={FONT}>{Math.round((bagian[aktif].nilai / total) * 100)}%</span>
              <span className="mt-1 text-[11px] text-gray-500">{bagian[aktif].label}</span>
            </>
          ) : (
            <>
              <span className="text-3xl font-extrabold text-gray-900 leading-none" style={FONT}>{tengah}</span>
              <span className="mt-1 text-[11px] text-gray-500">{sub}</span>
            </>
          )}
        </div>
      </div>

      <div className="w-full flex-1 grid grid-cols-2 gap-2.5">
        {bagian.map((b, i) => {
          const persen = total > 0 ? Math.round((b.nilai / total) * 100) : 0
          return (
            <div
              key={b.label}
              onMouseEnter={() => setAktif(i)}
              onMouseLeave={() => setAktif(null)}
              className={`px-3.5 py-3 rounded-xl border transition-colors ${aktif === i ? 'border-gray-300 bg-gray-50' : 'border-gray-100'}`}
            >
              <p className="flex items-center gap-2 text-[11.5px] text-gray-600">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: b.warna }} />
                {b.label}
              </p>
              <p className="mt-1 flex items-baseline gap-1.5">
                <span className="text-2xl font-extrabold text-gray-900 tabular-nums leading-none" style={FONT}>{b.nilai}</span>
                <span className="text-xs text-gray-400 tabular-nums">{persen}%</span>
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ==================== 3. Kalender panas 30 hari ====================
export function KalenderPanas({ hari, today }: { hari: { tanggal: string; c: Rekap }[]; today: string }) {
  const { tip, tampil, sembunyi } = useTip()
  if (hari.length === 0) return <p className="py-8 text-center text-xs text-gray-400">Belum ada data</p>
  const urut = [...hari].sort((a, b) => a.tanggal.localeCompare(b.tanggal))
  // Kalender bulanan: baris = minggu (mulai Senin), kolom = Sen..Min; lebar sel mengikuti kartu
  const pertama = urut[0].tanggal
  const senin = addDays(pertama, -(hariIso(pertama) - 1))
  const peta = new Map(urut.map(h => [h.tanggal, h.c]))
  const minggu: string[][] = []
  for (let t = senin; t <= today; t = addDays(t, 7)) minggu.push(Array.from({ length: 7 }, (_, i) => addDays(t, i)))
  const LABEL_HARI = [1, 2, 3, 4, 5, 6, 7].map(h => NAMA_HARI[h as keyof typeof NAMA_HARI].slice(0, 3))
  const ARSIR = 'repeating-linear-gradient(45deg, var(--color-gray-100) 0 3px, var(--color-gray-200) 3px 5px)'

  return (
    <div className="relative" data-wadah-tip onMouseLeave={sembunyi}>
      <div className="grid grid-cols-[28px_repeat(7,minmax(0,1fr))] gap-1 sm:gap-1.5">
        <span />
        {LABEL_HARI.map((l, i) => <span key={l} className={`text-center text-[10px] font-bold uppercase tracking-wide ${i >= 5 ? 'text-rose-400' : 'text-gray-400'}`}>{l}</span>)}
        {minggu.map((kol, ki) => {
          const awalBulan = kol.find(t => t.endsWith('-01'))
          const label = ki === 0 ? namaBulan(kol[0]) : awalBulan ? namaBulan(awalBulan) : ''
          return (
            <div key={kol[0]} className="contents">
              <span className="text-[10px] font-semibold text-gray-400 self-center">{label}</span>
              {kol.map(t => {
                const c = peta.get(t)
                const diLuar = !c || t > today
                const tanpaSesi = c && c.wajib === 0
                const isi = diLuar ? null : <IsiTooltip judul={formatTanggal(t)} c={c!} />
                return (
                  <button
                    key={t}
                    type="button"
                    disabled={diLuar}
                    aria-label={diLuar ? undefined : `${formatTanggal(t)}: ${tanpaSesi ? 'tanpa sesi wajib' : `${c!.persen}% hadir`}`}
                    onMouseEnter={e => isi && tampil(e, isi)}
                    onFocus={e => isi && tampil(e, isi)}
                    onBlur={sembunyi}
                    className={`h-10 sm:h-11 lg:h-12 rounded-lg px-1.5 py-1 flex flex-col items-start justify-between text-left tabular-nums transition-transform ${diLuar ? 'cursor-default' : 'hover:scale-[1.04] cursor-pointer'} ${t === today ? 'ring-2 ring-offset-1 ring-gray-800' : ''}`}
                    style={{
                      background: diLuar ? 'var(--color-gray-50)' : tanpaSesi ? ARSIR : warnaRamp(c!.persen),
                      color: !diLuar && !tanpaSesi && c!.persen >= 60 ? 'var(--color-emerald-50)' : 'var(--color-gray-500)',
                      opacity: diLuar ? 0.55 : 1,
                    }}
                  >
                    <span className="text-[10px] font-semibold leading-none">{Number(t.slice(8))}</span>
                    {!diLuar && !tanpaSesi && <span className="hidden sm:block self-end text-[10.5px] font-bold leading-none">{c!.persen}%</span>}
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-gray-500">
        <span className="inline-flex items-center gap-1.5">
          Rendah
          {RAMP.map(w => <span key={w} className="w-3.5 h-3.5 rounded-[3px]" style={{ background: w }} />)}
          Tinggi
        </span>
        <span className="inline-flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-[3px]" style={{ background: ARSIR }} />Libur / tanpa sesi</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-[3px] ring-2 ring-gray-800" />Hari ini</span>
      </div>
      <div className="mt-4">
        <RingkasanKalender hari={urut} />
      </div>
      <KotakTip tip={tip} />
    </div>
  )
}

function RingkasanKalender({ hari }: { hari: { tanggal: string; c: Rekap }[] }) {
  const wajib = hari.filter(h => h.c.wajib > 0)
  if (wajib.length === 0) return null
  const terbaik = wajib.reduce((a, b) => (b.c.persen > a.c.persen ? b : a))
  const terendah = wajib.reduce((a, b) => (b.c.persen < a.c.persen ? b : a))
  const rata = Math.round(wajib.reduce((t, h) => t + h.c.persen, 0) / wajib.length)
  const tanpaAlpa = wajib.filter(h => h.c['Tidak Hadir'] === 0).length
  const item = [
    { label: 'Hari terbaik', nilai: `${terbaik.c.persen}%`, ket: formatTanggal(terbaik.tanggal, 'tanpaHari') },
    { label: 'Hari terendah', nilai: `${terendah.c.persen}%`, ket: formatTanggal(terendah.tanggal, 'tanpaHari') },
    { label: 'Rata-rata harian', nilai: `${rata}%`, ket: `${wajib.length} hari bersesi` },
    { label: 'Hari tanpa alpa', nilai: `${tanpaAlpa} hari`, ket: `dari ${wajib.length} hari` },
  ]
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {item.map(i => (
        <div key={i.label} className="px-3 py-2 rounded-xl bg-gray-50 border border-gray-100">
          <p className="text-[10.5px] text-gray-500">{i.label}</p>
          <p className="text-base font-extrabold text-gray-900 tabular-nums leading-tight" style={FONT}>{i.nilai}</p>
          <p className="text-[10px] text-gray-400">{i.ket}</p>
        </div>
      ))}
    </div>
  )
}

// ==================== 4. Bilah kelompok (part-to-whole, jumlah bagian tetap) ====================
export function BilahKelompok({ bagian, satuan }: { bagian: { label: string; nilai: number; warna: string }[]; satuan: string }) {
  const { tip, tampil, sembunyi } = useTip()
  const total = bagian.reduce((t, b) => t + b.nilai, 0)
  if (total === 0) return <p className="text-xs text-gray-400">Belum ada data</p>
  return (
    <div className="relative" data-wadah-tip onMouseLeave={sembunyi}>
      <div className="flex h-7 gap-[2px] rounded-lg overflow-hidden">
        {bagian.filter(b => b.nilai > 0).map(b => {
          const persen = Math.round((b.nilai / total) * 100)
          const isi = <><p className="font-bold">{b.label}</p><p>{b.nilai} {satuan} ({persen}%)</p></>
          return (
            <button
              key={b.label}
              type="button"
              aria-label={`${b.label}: ${b.nilai} ${satuan}`}
              onMouseEnter={e => tampil(e, isi)}
              onFocus={e => tampil(e, isi)}
              onBlur={sembunyi}
              className="h-full flex items-center justify-center text-[11px] font-bold text-white tabular-nums cursor-default hover:brightness-110"
              style={{ width: `${(b.nilai / total) * 100}%`, background: b.warna }}
            >
              {persen >= 12 ? `${persen}%` : ''}
            </button>
          )
        })}
      </div>
      <ul className="mt-2.5 space-y-1">
        {bagian.map(b => (
          <li key={b.label} className="flex items-center gap-2 text-[11.5px]">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: b.warna }} />
            <span className="flex-1 text-gray-600 truncate">{b.label}</span>
            <span className="font-bold text-gray-900 tabular-nums">{b.nilai}</span>
          </li>
        ))}
      </ul>
      <KotakTip tip={tip} />
    </div>
  )
}

// ==================== 5. Batang per sesi (jumlah batang = jumlah sesi, bukan penghuni) ====================
export function BatangSesi({ data }: { data: { nama: string; c: Rekap }[] }) {
  const { tip, tampil, sembunyi } = useTip()
  const ada = data.filter(d => d.c.wajib > 0)
  if (ada.length === 0) return <p className="text-xs text-gray-400">Belum ada data</p>
  return (
    <div className="relative" data-wadah-tip onMouseLeave={sembunyi}>
      <div className="space-y-2">
        {ada.map(d => {
          return (
            <button
              key={d.nama}
              type="button"
              onMouseEnter={e => tampil(e, <IsiTooltip judul={`Sesi ${d.nama}`} c={d.c} />)}
              onFocus={e => tampil(e, <IsiTooltip judul={`Sesi ${d.nama}`} c={d.c} />)}
              onBlur={sembunyi}
              className="w-full grid grid-cols-[56px_1fr_36px] items-center gap-2 text-left cursor-default group"
            >
              <span className="text-[11.5px] font-semibold text-gray-700 truncate">{d.nama}</span>
              <span className="relative h-2.5 rounded-full bg-gray-100">
                <span className="absolute inset-y-0 left-0 rounded-full group-hover:brightness-110" style={{ width: `${Math.max(2, d.c.persen)}%`, background: WARNA_STATUS_GRAFIK.Hadir }} />
              </span>
              <span className="text-right text-xs font-bold text-gray-900 tabular-nums">{d.c.persen}%</span>
            </button>
          )
        })}
      </div>
      <KotakTip tip={tip} />
    </div>
  )
}

// ==================== 6. Histogram waktu presensi ====================
export function HistogramWaktu({ menit }: { menit: number[] }) {
  const { tip, tampil, sembunyi } = useTip()
  if (menit.length === 0) return <p className="py-8 text-center text-xs text-gray-400">Belum ada presensi mandiri</p>
  const LEBAR = 10
  const batasAtas = Math.min(120, Math.max(30, Math.ceil(Math.max(...menit) / LEBAR) * LEBAR))
  const jumlahBin = batasAtas / LEBAR
  const bin = Array.from({ length: jumlahBin }, (_, i) => ({ dari: i * LEBAR, sampai: (i + 1) * LEBAR, n: 0 }))
  menit.forEach(m => { bin[Math.min(jumlahBin - 1, Math.max(0, Math.floor(m / LEBAR)))].n++ })
  const puncak = Math.max(...bin.map(b => b.n))
  const urut = [...menit].sort((a, b) => a - b)
  const median = urut[Math.floor(urut.length / 2)]
  const awal = Math.round((menit.filter(m => m < 15).length / menit.length) * 100)
  const TINGGI = 112

  return (
    <div className="relative" data-wadah-tip onMouseLeave={sembunyi}>
      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-2xl font-extrabold text-gray-900 tabular-nums" style={FONT}>{median}</span>
        <span className="text-xs text-gray-500">menit median setelah sesi dibuka · {awal}% absen di 15 menit pertama</span>
      </div>
      <div className="relative" style={{ height: TINGGI }}>
        {/* garis bantu */}
        {[0.5, 1].map(f => <span key={f} className="absolute inset-x-0 border-t border-dashed border-gray-100" style={{ bottom: TINGGI * f }} />)}
        <div className="absolute inset-0 flex items-end gap-[2px]">
          {bin.map(b => (
            <button
              key={b.dari}
              type="button"
              onMouseEnter={e => tampil(e, <><p className="font-bold">{b.dari}–{b.sampai} menit</p><p>{b.n} presensi ({Math.round((b.n / menit.length) * 100)}%)</p></>)}
              onFocus={e => tampil(e, <><p className="font-bold">{b.dari}–{b.sampai} menit</p><p>{b.n} presensi</p></>)}
              onBlur={sembunyi}
              aria-label={`${b.dari} sampai ${b.sampai} menit: ${b.n} presensi`}
              className="flex-1 h-full flex items-end cursor-default group"
            >
              <span
                className="w-full rounded-t-[4px] transition-[filter] group-hover:brightness-110"
                style={{ height: b.n === 0 ? 2 : `${Math.max(4, (b.n / puncak) * 100)}%`, background: b.n === 0 ? 'var(--color-gray-200)' : 'var(--color-emerald-600)' }}
              />
            </button>
          ))}
        </div>
        {/* penanda median */}
        <span className="absolute top-0 bottom-0 w-0.5 rounded bg-gray-800/70 pointer-events-none" style={{ left: `${Math.min(99, (median / batasAtas) * 100)}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-gray-400 tabular-nums">
        <span>0</span><span>{batasAtas / 2}</span><span>{batasAtas} mnt</span>
      </div>
      <p className="mt-2 text-[11px] text-gray-500 flex items-center gap-1.5"><span className="w-0.5 h-3 rounded bg-gray-800/70" />Median</p>
      <KotakTip tip={tip} />
    </div>
  )
}

// ==================== 7. Hunian kamar per gedung (jumlah baris = jumlah gedung) ====================
export function BatangHunian({ data }: { data: { nama: string; jenis?: string; kamar: number; kapasitas: number; terisi: number }[] }) {
  const { tip, tampil, sembunyi } = useTip()
  if (data.length === 0) return <p className="text-xs text-gray-400">Belum ada gedung</p>
  return (
    <div className="relative" data-wadah-tip onMouseLeave={sembunyi}>
      <div className="space-y-3">
        {data.map(g => {
          const persen = g.kapasitas > 0 ? Math.round((g.terisi / g.kapasitas) * 100) : 0
          const isi = <><p className="font-bold">{g.nama}</p><p>{g.kamar} kamar · {g.kapasitas} tempat</p><p>Terisi {g.terisi} · kosong {Math.max(0, g.kapasitas - g.terisi)}</p></>
          return (
            <button
              key={g.nama}
              type="button"
              onMouseEnter={e => tampil(e, isi)}
              onFocus={e => tampil(e, isi)}
              onBlur={sembunyi}
              className="w-full text-left cursor-default group"
            >
              <span className="flex items-baseline justify-between gap-2 mb-1">
                <span className="text-xs font-semibold text-gray-800 truncate">{g.nama}</span>
                <span className="text-[11px] text-gray-500 tabular-nums shrink-0"><strong className="text-gray-900">{g.terisi}</strong>/{g.kapasitas} tempat</span>
              </span>
              <span className="relative block h-2.5 rounded-full bg-gray-100">
                <span className="absolute inset-y-0 left-0 rounded-full group-hover:brightness-110" style={{ width: `${Math.min(100, persen)}%`, background: 'var(--color-sky-600)' }} />
              </span>
            </button>
          )
        })}
      </div>
      <KotakTip tip={tip} />
    </div>
  )
}
