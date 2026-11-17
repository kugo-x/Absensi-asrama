import { useMemo, useState } from 'react'
import type { Gedung, Penghuni, Sesi } from '../types'
import { addDays, dateRangeDesc, formatTanggal, hariIso, hitungStatus, statusPerTanggal, todayLocal, type DataPresensi } from '../logic'
import { GrafikTrenKehadiran, IsiTooltip, TARGET_KEHADIRAN, WARNA_STATUS_GRAFIK } from './GrafikKehadiran'

/**
 * Panel tren kehadiran (admin & fasil): 7 hari (batang harian), 12 minggu, atau 6 bulan (garis % hadir).
 * Tren panjang dihitung dengan statusPerTanggal (indeks per NIM) dan hanya dihitung ulang saat pilihan,
 * gedung, atau data berubah — tidak setiap detik jam berjalan.
 */

type ModeTren = '7-hari' | '12-minggu' | '6-bulan'
type Rekap = ReturnType<typeof hitungStatus>
interface Titik { label: string; rentang: string; c: Rekap }

const PILIHAN: [ModeTren, string][] = [['7-hari', '7 hari'], ['12-minggu', '12 minggu'], ['6-bulan', '6 bulan']]
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

const rentangTeks = (a: string, b: string) => (a === b ? formatTanggal(a, 'tanpaHari') : `${formatTanggal(a, 'tanpaHari')} – ${formatTanggal(b, 'tanpaHari')}`)

function kelompokkan(buckets: { label: string; dari: string; sampai: string }[], perTanggal: Map<string, Parameters<typeof hitungStatus>[0]>): Titik[] {
  return buckets.map(b => ({
    label: b.label,
    rentang: rentangTeks(b.dari, b.sampai),
    c: hitungStatus(dateRangeDesc(b.dari, b.sampai).flatMap(t => perTanggal.get(t) ?? [])),
  }))
}

// Garis % hadir per periode; satu seri, satu sumbu (0–100%), titik kosong (tanpa sesi wajib) memutus garis
function GrafikGarisPersen({ titik }: { titik: Titik[] }) {
  const n = titik.length
  const x = (i: number) => ((i + 0.5) / n) * 100
  const y = (t: Titik) => 100 - t.c.persen
  const ada = (t: Titik) => t.c.wajib > 0

  // Segmen berurutan yang punya data
  const segmen: number[][] = []
  titik.forEach((t, i) => {
    if (!ada(t)) return
    const akhir = segmen[segmen.length - 1]
    if (akhir && akhir[akhir.length - 1] === i - 1) akhir.push(i)
    else segmen.push([i])
  })
  const garis = segmen.map(s => s.map((i, k) => `${k ? 'L' : 'M'}${x(i)},${y(titik[i])}`).join(' ')).join(' ')
  const area = segmen.map(s => `M${x(s[0])},100 ${s.map(i => `L${x(i)},${y(titik[i])}`).join(' ')} L${x(s[s.length - 1])},100 Z`).join(' ')
  const terakhir = [...titik.keys()].reverse().find(i => ada(titik[i]))
  // Sorotan titik tertinggi & terendah (bila ada cukup data dan nilainya berbeda)
  const indeksAda = [...titik.keys()].filter(i => ada(titik[i]))
  const tertinggi = indeksAda.length >= 3 ? indeksAda.reduce((a, b) => (titik[b].c.persen > titik[a].c.persen ? b : a)) : undefined
  const terendah = indeksAda.length >= 3 ? indeksAda.reduce((a, b) => (titik[b].c.persen < titik[a].c.persen ? b : a)) : undefined
  const adaSorotan = tertinggi !== undefined && terendah !== undefined && titik[tertinggi].c.persen !== titik[terendah].c.persen

  return (
    <div>
      <div className="relative ml-9 h-48 mt-5">
        {[0, 25, 50, 75, 100].map(v => (
          <div key={v} className="absolute left-0 right-0 border-t border-gray-100" style={{ top: `${100 - v}%` }}>
            <span className="absolute -left-9 -translate-y-1/2 w-7 text-right text-[10px] text-gray-400 tabular-nums">{v}%</span>
          </div>
        ))}
        {/* Garis target */}
        {/* Warna lewat style: kelas warna garis tepi dapat tertimpa aturan tema kaca (index.css) */}
        <div className="absolute left-0 right-0 h-0.5 -translate-y-1/2 rounded-full pointer-events-none" style={{ top: `${100 - TARGET_KEHADIRAN}%`, background: '#f59e0b' }}>
          {/* Label di kiri: titik terbaru (berlabel nilai) selalu di kanan */}
          <span className="absolute left-1 -top-4 text-[10px] font-semibold text-amber-700">Target {TARGET_KEHADIRAN}%</span>
        </div>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full overflow-visible" aria-hidden="true">
          <path d={area} fill={WARNA_STATUS_GRAFIK.Hadir} fillOpacity={0.1} />
          <path d={garis} fill="none" stroke={WARNA_STATUS_GRAFIK.Hadir} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
        {titik.map((t, i) => ada(t) && (
          <span
            key={i}
            className={`absolute rounded-full ring-2 ring-white -translate-x-1/2 -translate-y-1/2 pointer-events-none ${adaSorotan && (i === tertinggi || i === terendah) ? 'w-3.5 h-3.5' : 'w-2.5 h-2.5'}`}
            style={{ left: `${x(i)}%`, top: `${y(t)}%`, background: adaSorotan && i === terendah ? WARNA_STATUS_GRAFIK['Tidak Hadir'] : WARNA_STATUS_GRAFIK.Hadir }}
          />
        ))}
        {adaSorotan && tertinggi !== terakhir && (
          <span className="absolute -translate-x-1/2 -translate-y-full -mt-2.5 text-[10px] font-bold text-emerald-800 bg-white/90 px-1 rounded whitespace-nowrap pointer-events-none" style={{ left: `${x(tertinggi!)}%`, top: `${y(titik[tertinggi!])}%` }}>
            Tertinggi {titik[tertinggi!].c.persen}%
          </span>
        )}
        {adaSorotan && terendah !== terakhir && (
          <span className="absolute -translate-x-1/2 mt-2.5 text-[10px] font-bold text-rose-700 bg-white/90 px-1 rounded whitespace-nowrap pointer-events-none" style={{ left: `${x(terendah!)}%`, top: `${y(titik[terendah!])}%` }}>
            Terendah {titik[terendah!].c.persen}%
          </span>
        )}
        {terakhir !== undefined && (
          <span className="absolute -translate-x-1/2 -translate-y-full -mt-2 text-xs font-bold text-gray-900 tabular-nums pointer-events-none" style={{ left: `${x(terakhir)}%`, top: `${y(titik[terakhir])}%` }}>
            {titik[terakhir].c.persen}%
          </span>
        )}
        {/* Area sentuh per periode (lebih lebar dari titiknya) + garis bidik & tooltip */}
        {titik.map((t, i) => (
          <div
            key={`hit-${i}`}
            className="group absolute top-0 bottom-0 outline-none"
            style={{ left: `${(i / n) * 100}%`, width: `${100 / n}%` }}
            tabIndex={0}
            aria-label={`${t.rentang}: ${ada(t) ? `${t.c.persen}% hadir` : 'tidak ada sesi wajib'}`}
          >
            <div className="hidden group-hover:block group-focus:block absolute left-1/2 top-0 bottom-0 w-px bg-gray-300" />
            <div className={`pointer-events-none hidden group-hover:block group-focus:block absolute top-0 z-10 w-48 rounded-lg bg-gray-900 text-white text-[11px] p-2.5 shadow-lg ${i > n / 2 ? 'right-1/2 mr-2' : 'left-1/2 ml-2'}`}>
              <IsiTooltip judul={t.rentang} c={t.c} />
            </div>
          </div>
        ))}
      </div>
      <div className="ml-9 flex mt-1.5">
        {titik.map((t, i) => (
          <span key={i} className={`flex-1 text-center text-[10px] leading-tight whitespace-nowrap ${i === n - 1 ? 'font-bold text-gray-900' : 'text-gray-500'}`}>{t.label}</span>
        ))}
      </div>
    </div>
  )
}

export function PanelTrenKehadiran({ penghuni, sesiList, data, now, gedungList, judul = 'Tren Kehadiran', aksi }: {
  // Penghuni wajib absen yang dihitung (fasil: gedungnya; admin: seluruh asrama)
  penghuni: Penghuni[]
  sesiList: Sesi[]
  data: DataPresensi
  now: Date
  // Diisi untuk admin agar bisa memilih gedung
  gedungList?: Gedung[]
  judul?: string
  aksi?: React.ReactNode
}) {
  const today = todayLocal()
  const [mode, setMode] = useState<ModeTren>('7-hari')
  const [gedung, setGedung] = useState('')
  const anggota = gedung ? penghuni.filter(p => p.namaGedung === gedung) : penghuni

  const hasil = useMemo(() => {
    if (mode === '7-hari') {
      const mulai = addDays(today, -6)
      const per = statusPerTanggal(anggota, mulai, today, sesiList, data, now)
      return { harian: dateRangeDesc(mulai, today).reverse().map(t => ({ tanggal: t, c: hitungStatus(per.get(t) ?? []) })), titik: [] as Titik[] }
    }
    let buckets: { label: string; dari: string; sampai: string }[]
    if (mode === '12-minggu') {
      // Minggu dimulai Senin; minggu berjalan dihitung sampai hari ini
      const seninIni = addDays(today, -(hariIso(today) - 1))
      buckets = Array.from({ length: 12 }, (_, k) => {
        const dari = addDays(seninIni, -7 * (11 - k))
        const sampai = k === 11 ? today : addDays(dari, 6)
        return { label: `${Number(dari.slice(8))} ${BULAN[Number(dari.slice(5, 7)) - 1]}`, dari, sampai }
      })
    } else {
      const [y, m] = today.split('-').map(Number)
      buckets = Array.from({ length: 6 }, (_, k) => {
        const d = new Date(y, m - 1 - (5 - k), 1)
        const dari = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
        const akhirBulan = new Date(d.getFullYear(), d.getMonth() + 1, 0)
        const sampaiPenuh = `${akhirBulan.getFullYear()}-${String(akhirBulan.getMonth() + 1).padStart(2, '0')}-${String(akhirBulan.getDate()).padStart(2, '0')}`
        // Tahun ditulis lengkap pada bulan pertama & bulan Januari ("Jun 2026"), agar tidak terbaca sebagai tanggal
        return { label: `${BULAN[d.getMonth()]}${d.getMonth() === 0 || k === 0 ? ` ${d.getFullYear()}` : ''}`, dari, sampai: k === 5 ? today : sampaiPenuh }
      })
    }
    const per = statusPerTanggal(anggota, buckets[0].dari, today, sesiList, data, now)
    return { harian: [], titik: kelompokkan(buckets, per) }
    // `now` sengaja tidak menjadi dependensi: tren tidak perlu dihitung ulang setiap jam berdetak
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, gedung, penghuni, sesiList, data, today])

  // Perubahan dibanding periode sebelumnya (dua titik terakhir yang punya data)
  const berdata = hasil.titik.filter(t => t.c.wajib > 0)
  const sekarang = berdata[berdata.length - 1]
  const sebelum = berdata[berdata.length - 2]
  const selisih = sebelum && sekarang ? sekarang.c.persen - sebelum.c.persen : null
  const satuan = mode === '12-minggu' ? 'minggu' : 'bulan'
  // Titik terakhir = periode berjalan (belum selesai) bila memang periode paling akhir
  const berjalan = !!sekarang && sekarang === hasil.titik[hasil.titik.length - 1]

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
        <div>
          <p className="font-bold text-sm text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>{judul}{gedung ? ` · ${gedung}` : ''}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {mode === '7-hari' ? 'Jumlah sesi wajib per hari.' : `Persentase hadir per ${satuan} dari sesi wajib.`} Arahkan kursor untuk detail.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {gedungList && (
            <select value={gedung} onChange={e => setGedung(e.target.value)} aria-label="Gedung" className="px-2.5 py-1.5 rounded-lg border border-gray-300 hover:border-gray-400 text-xs text-gray-800 bg-white outline-none focus:border-emerald-700">
              <option value="">Seluruh asrama</option>
              {gedungList.map(g => <option key={g.id} value={g.nama}>{g.nama}</option>)}
            </select>
          )}
          <div className="flex rounded-lg bg-gray-100 p-0.5" role="radiogroup" aria-label="Rentang tren">
            {PILIHAN.map(([k, label]) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={mode === k}
                onClick={() => setMode(k)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-semibold cursor-pointer transition-colors whitespace-nowrap ${mode === k ? 'bg-white text-emerald-800 shadow-2xs' : 'text-gray-600 hover:text-gray-900'}`}
              >
                {label}
              </button>
            ))}
          </div>
          {aksi}
        </div>
      </div>

      {mode === '7-hari' ? (
        <GrafikTrenKehadiran tren={hasil.harian} today={today} />
      ) : berdata.length === 0 ? (
        <p className="py-12 text-center text-sm text-gray-400">Belum ada sesi wajib pada rentang ini.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-4">
            <span className="text-2xl font-extrabold text-gray-900 tabular-nums" style={{ fontFamily: 'Plus Jakarta Sans' }}>{sekarang.c.persen}%</span>
            <span className="text-xs text-gray-500">hadir {berjalan ? `${satuan} ini (berjalan)` : `pada ${sekarang.rentang}`}</span>
            {selisih !== null && (
              <span className={`text-xs font-bold px-2 py-0.5 rounded-md border ${selisih > 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : selisih < 0 ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                {selisih > 0 ? `▲ naik ${selisih} poin` : selisih < 0 ? `▼ turun ${Math.abs(selisih)} poin` : 'stabil'} dari {satuan} sebelumnya
              </span>
            )}
          </div>
          <GrafikGarisPersen titik={hasil.titik} />
        </>
      )}
    </div>
  )
}
