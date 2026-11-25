import { formatTanggal, hariIso, hitungStatus, NAMA_HARI } from '../logic'

/**
 * Grafik kehadiran bersama (dashboard & laporan admin/fasil).
 * Warna status divalidasi skrip dataviz: Hadir/Izin di batas CVD, jadi selalu disertai
 * celah antarsegmen, legenda, dan tooltip; angka lengkap tersedia di tabel/laporan.
 */

export const WARNA_STATUS_GRAFIK = { Hadir: '#22993b', Izin: '#d97706', 'Tidak Hadir': '#e11d48' } as const

type KunciGrafik = keyof typeof WARNA_STATUS_GRAFIK
const URUTAN: KunciGrafik[] = ['Hadir', 'Izin', 'Tidak Hadir']

type Rekap = ReturnType<typeof hitungStatus>

export function LegendaKehadiran({ tambahan }: { tambahan?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600">
      {URUTAN.map(k => (
        <span key={k} className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: WARNA_STATUS_GRAFIK[k] }} />
          {k}
        </span>
      ))}
      {tambahan && <span className="ml-auto text-gray-500">{tambahan}</span>}
    </div>
  )
}

export function IsiTooltip({ judul, c }: { judul: string; c: Rekap }) {
  return (
    <>
      <p className="font-bold mb-1">{judul}</p>
      {c.wajib === 0 ? <p className="text-gray-300">{c.Libur > 0 ? 'Libur' : 'Tidak ada sesi wajib'}</p> : (
        <>
          {URUTAN.map(k => (
            <p key={k} className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm" style={{ background: WARNA_STATUS_GRAFIK[k] }} />{k}</span>
              <span className="font-semibold">{c[k]}</span>
            </p>
          ))}
          <p className="mt-1 pt-1 border-t border-white/15 flex justify-between"><span>Kehadiran</span><span className="font-bold">{c.persen}%</span></p>
        </>
      )}
    </>
  )
}

/**
 * Batang bertumpuk per hari: Hadir (bawah), Izin, Tidak Hadir (atas); detail lewat tooltip.
 * Untuk periode panjang (hingga 92 hari) label tanggal ditampilkan berselang.
 */
export function GrafikTrenKehadiran({ tren, today, tinggi = 128 }: { tren: { tanggal: string; c: Rekap }[]; today: string; tinggi?: number }) {
  const maks = Math.max(1, ...tren.map(t => t.c.wajib))
  const totalHadir = tren.reduce((n, t) => n + t.c.Hadir, 0)
  const totalWajib = tren.reduce((n, t) => n + t.c.wajib, 0)
  const pendek = tren.length <= 10
  const selang = Math.max(1, Math.ceil(tren.length / 8))

  return (
    <div>
      <div className="mb-4">
        <LegendaKehadiran tambahan={<>Rata-rata <strong className="text-gray-900">{totalWajib > 0 ? Math.round((totalHadir / totalWajib) * 100) : 0}%</strong> hadir</>} />
      </div>

      <div className={`flex items-end justify-between ${pendek ? 'gap-1' : 'gap-px'} border-b border-gray-200`} style={{ height: tinggi }}>
        {tren.map(({ tanggal, c }) => {
          const segmen = URUTAN.filter(k => c[k] > 0)
          const atas = segmen[segmen.length - 1]
          return (
            <div key={tanggal} className="group relative flex-1 h-full flex flex-col items-center justify-end outline-none" tabIndex={0} aria-label={`${formatTanggal(tanggal)}: ${c.Hadir} hadir, ${c.Izin} izin, ${c['Tidak Hadir']} tidak hadir`}>
              <div className="pointer-events-none absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-10 hidden group-hover:block group-focus:block w-44 rounded-lg bg-gray-900 text-white text-[11px] p-2.5 shadow-lg">
                <IsiTooltip judul={formatTanggal(tanggal)} c={c} />
              </div>
              {c.wajib === 0 ? (
                pendek && <span className="mb-1 text-[10px] font-semibold text-gray-400">{c.Libur > 0 ? 'Libur' : '–'}</span>
              ) : (
                <div className="w-full max-w-6 flex flex-col-reverse gap-[2px] group-hover:opacity-85 transition-opacity">
                  {segmen.map(k => (
                    <div
                      key={k}
                      className={k === atas ? (pendek ? 'rounded-t-[4px]' : 'rounded-t-[2px]') : ''}
                      style={{ height: Math.max(2, (c[k] / maks) * (tinggi - 8)), background: WARNA_STATUS_GRAFIK[k] }}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className={`flex justify-between ${pendek ? 'gap-1' : 'gap-px'} mt-1.5`}>
        {tren.map(({ tanggal }, i) => {
          // Label berselang + label terakhir; label berselang yang terlalu dekat dengan label terakhir dilewati
          const terakhir = tren.length - 1
          const tampil = pendek || i === terakhir || (i % selang === 0 && terakhir - i >= selang)
          return (
            <span key={tanggal} className={`flex-1 text-center text-[10px] leading-tight whitespace-nowrap ${tanggal === today ? 'font-bold text-gray-900' : 'text-gray-500'}`}>
              {!tampil ? '' : pendek ? (
                <>
                  {tanggal === today ? 'Hari ini' : NAMA_HARI[hariIso(tanggal)].slice(0, 3)}
                  <span className="block text-gray-400 font-normal">{Number(tanggal.slice(8))}</span>
                </>
              ) : formatTanggal(tanggal, 'tanpaHari').replace(/ \d{4}$/, '')}
            </span>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Bilah komposisi tebal (28px): satu keseluruhan dibagi per status, dibaca sekilas.
 * Persentase dicetak di dalam blok bila muat; legenda menyebut nama & jumlah tiap bagian.
 */
export function BilahKomposisi({ bagian }: { bagian: { label: string; nilai: number; warna: string; teksGelap?: boolean }[] }) {
  const total = bagian.reduce((n, b) => n + b.nilai, 0)
  const ada = bagian.filter(b => b.nilai > 0)
  return (
    <div>
      <div className="h-7 flex gap-[2px]" role="img" aria-label={bagian.map(b => `${b.label} ${b.nilai}`).join(', ')}>
        {total === 0 ? <div className="flex-1 rounded bg-gray-100" /> : ada.map(b => {
          const persen = Math.round((b.nilai / total) * 100)
          return (
            <div
              key={b.label}
              className="group relative rounded flex items-center px-2 min-w-0 outline-none"
              style={{ width: `${(b.nilai / total) * 100}%`, background: b.warna }}
              tabIndex={0}
              aria-label={`${b.label}: ${b.nilai} (${persen}%)`}
            >
              {persen >= 9 && <span className={`text-[11px] font-bold tabular-nums ${b.teksGelap ? 'text-gray-900' : 'text-white'}`}>{persen}%</span>}
              <div className="pointer-events-none absolute bottom-full mb-2 left-0 z-10 hidden group-hover:block group-focus:block whitespace-nowrap rounded-lg bg-gray-900 text-white text-[11px] px-2.5 py-1.5 shadow-lg">
                {b.label}: <strong>{b.nilai}</strong> ({persen}%)
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5">
        {bagian.map(b => (
          <div key={b.label} className="flex items-center gap-1.5 text-xs text-gray-600 min-w-0">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: b.warna }} />
            <span className="truncate">{b.label}</span>
            <span className="font-bold text-gray-900 tabular-nums">{b.nilai}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Daftar meter berperingkat (mis. kehadiran per gedung): satu baris per kelompok, bar sejajar,
 * satu warna (hijau = hadir), angka persentase di kanan; rincian lewat tooltip.
 */
export function DaftarMeter({ data, kosong = 'Belum ada data' }: { data: { label: string; sub?: string; c: Rekap }[]; kosong?: string }) {
  if (data.length === 0) return <p className="text-sm text-gray-400 py-6 text-center">{kosong}</p>
  return (
    <div className="space-y-3.5">
      {data.map(({ label, sub, c }) => {
        return (
          <div key={label} className="group relative outline-none" tabIndex={0} aria-label={`${label}: ${c.wajib > 0 ? `${c.persen}% hadir` : 'tidak ada sesi wajib'}`}>
            <div className="flex items-baseline justify-between gap-2 mb-1">
              <span className="text-sm font-semibold text-gray-800 truncate">
                {label}{sub && <span className="ml-1.5 text-[11px] font-normal text-gray-400">{sub}</span>}
              </span>
              <span className="shrink-0 flex items-baseline gap-1.5">
                <span className="text-sm font-bold text-gray-900 tabular-nums">{c.wajib > 0 ? `${c.persen}%` : '–'}</span>
              </span>
            </div>
            <div className="relative h-2.5 rounded-full" style={{ background: 'var(--color-gray-100)' }}>
              {c.wajib > 0 && <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-500" style={{ width: `${c.persen}%`, background: WARNA_STATUS_GRAFIK.Hadir }} />}
            </div>
            {c.wajib > 0 && (
              <div className="pointer-events-none absolute right-0 bottom-full mb-1 z-10 hidden group-hover:block group-focus:block w-44 rounded-lg bg-gray-900 text-white text-[11px] p-2.5 shadow-lg">
                <IsiTooltip judul={label} c={c} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ---------- Pola mingguan (peta panas hari × sesi) ----------

const HARI_PENDEK = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']
const NAMA_HARI_LENGKAP = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']
// Ramp hijau bertingkat (makin hadir makin gelap); teks putih di 3 tingkat tergelap
const RAMP_HIJAU = [
  // Dua tingkat teratas memakai variabel tema (nilai sama di mode terang) agar tidak menyilaukan di mode gelap
  { batas: 60, warna: 'var(--color-emerald-50)', teks: 'var(--color-emerald-800)' },
  { batas: 70, warna: 'var(--color-emerald-200)', teks: 'var(--color-emerald-800)' },
  { batas: 80, warna: '#4fcc63', teks: '#164f25' },
  { batas: 90, warna: '#22993b', teks: '#ffffff' },
  { batas: 101, warna: '#1a612b', teks: '#ffffff' },
]
const warnaRamp = (persen: number) => RAMP_HIJAU.find(r => persen < r.batas) ?? RAMP_HIJAU[RAMP_HIJAU.length - 1]

type StatusPresensi = Parameters<typeof hitungStatus>[0][number]

/** Kelompokkan baris riwayat (tanggal, sesi, status) menjadi rekap per sesi × hari dalam seminggu */
export function hitungPolaMingguan(baris: { tanggal: string; sesi: { nama: string }; detail: { status: StatusPresensi } }[]) {
  const peta = new Map<string, StatusPresensi[]>()
  const urutanSesi: string[] = []
  for (const r of baris) {
    if (!urutanSesi.includes(r.sesi.nama)) urutanSesi.push(r.sesi.nama)
    const k = `${r.sesi.nama}|${hariIso(r.tanggal)}`
    const ada = peta.get(k)
    if (ada) ada.push(r.detail.status)
    else peta.set(k, [r.detail.status])
  }
  return urutanSesi.map(sesi => ({ sesi, sel: [1, 2, 3, 4, 5, 6, 7].map(h => hitungStatus(peta.get(`${sesi}|${h}`) ?? [])) }))
}

export function PetaPanasPola({ pola }: { pola: ReturnType<typeof hitungPolaMingguan> }) {
  if (pola.length === 0) return <p className="text-sm text-gray-400 py-6 text-center">Belum ada sesi wajib pada periode ini.</p>
  // Sorotan: sel terendah yang punya data
  const sel = pola.flatMap(b => b.sel.map((c, hari) => ({ sesi: b.sesi, hari, c }))).filter(x => x.c.wajib > 0)
  // Sorotan hanya bermakna bila nilainya berbeda-beda (semua sama -> tidak ada yang "paling rendah")
  const beragam = new Set(sel.map(x => x.c.persen)).size > 1
  const terendah = beragam ? sel.reduce((a, b) => (b.c.persen < a.c.persen ? b : a)) : null

  return (
    <div>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: 'auto repeat(7, minmax(0, 1fr))' }}>
        <span />
        {HARI_PENDEK.map((h, i) => <span key={h} className={`text-center text-[10px] font-bold uppercase tracking-wide ${i >= 5 ? 'text-rose-400' : 'text-gray-400'}`}>{h}</span>)}
        {pola.map(b => (
          <div key={b.sesi} className="contents">
            <span className="text-xs font-semibold text-gray-700 pr-1 self-center">{b.sesi}</span>
            {b.sel.map((c, i) => {
              const w = c.wajib > 0 ? warnaRamp(c.persen) : null
              const sorot = !!terendah && terendah.sesi === b.sesi && terendah.hari === i
              return (
                <div
                  key={i}
                  tabIndex={0}
                  aria-label={`${b.sesi} hari ${NAMA_HARI_LENGKAP[i]}: ${c.wajib > 0 ? `${c.persen}% hadir` : 'tidak ada sesi'}`}
                  className={`group relative h-11 rounded-lg flex items-center justify-center text-xs font-bold tabular-nums outline-none ${sorot ? 'ring-2 ring-offset-1 ring-rose-500' : ''}`}
                  style={{ background: w?.warna ?? 'var(--color-gray-50)', color: w?.teks ?? 'var(--color-gray-400)' }}
                >
                  {c.wajib > 0 ? `${c.persen}%` : '–'}
                  {c.wajib > 0 && (
                    <div className={`pointer-events-none absolute bottom-full mb-2 z-10 hidden group-hover:block group-focus:block w-44 rounded-lg bg-gray-900 text-white text-[11px] font-normal p-2.5 shadow-lg text-left ${i >= 4 ? 'right-0' : 'left-0'}`}>
                      <IsiTooltip judul={`${b.sesi} · ${NAMA_HARI_LENGKAP[i]}`} c={c} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
        <div className="flex items-center gap-1 text-[10px] text-gray-500">
          <span>Rendah</span>
          {RAMP_HIJAU.map(r => <span key={r.batas} className="w-5 h-2.5 rounded-sm" style={{ background: r.warna, boxShadow: 'inset 0 0 0 1px rgb(0 0 0 / 0.05)' }} />)}
          <span>Tinggi</span>
        </div>
        {terendah && <p className="text-xs text-gray-600">Paling rendah: <strong className="text-rose-700">{NAMA_HARI_LENGKAP[terendah.hari]} · {terendah.sesi}</strong> ({terendah.c.persen}%)</p>}
      </div>
    </div>
  )
}

// ---------- Sebaran tingkat kehadiran penghuni (histogram) ----------

const RENTANG_SEBARAN = [
  { label: '< 60%', min: 0, max: 59 },
  { label: '60–69%', min: 60, max: 69 },
  { label: '70–79%', min: 70, max: 79 },
  { label: '80–89%', min: 80, max: 89 },
  { label: '90–100%', min: 90, max: 100 },
]

/** Berapa penghuni di tiap rentang tingkat kehadiran; kelompok < 60% disorot sebagai perlu perhatian */
export function HistogramSebaran({ persen }: { persen: number[] }) {
  if (persen.length === 0) return <p className="text-sm text-gray-400 py-6 text-center">Belum ada penghuni dengan sesi wajib pada periode ini.</p>
  const jumlah = RENTANG_SEBARAN.map(r => persen.filter(p => p >= r.min && p <= r.max).length)
  const maks = Math.max(1, ...jumlah)
  return (
    <div>
      <p className="text-xs text-gray-600 mb-3">Jumlah penghuni di tiap rentang tingkat kehadiran · <strong className="text-gray-900">{persen.length}</strong> penghuni</p>
      <div className="flex items-end gap-2 h-32 border-b border-gray-200">
        {jumlah.map((n, i) => {
          return (
            <div key={i} className="flex-1 h-full flex flex-col items-center justify-end" title={`${RENTANG_SEBARAN[i].label}: ${n} penghuni`}>
              <span className="text-xs font-bold tabular-nums mb-1 text-gray-800">{n}</span>
              <div
                className="w-full max-w-10 rounded-t-[4px] transition-all duration-500"
                style={{ height: `${(n / maks) * 85}%`, minHeight: n > 0 ? 3 : 0, background: WARNA_STATUS_GRAFIK.Hadir }}
              />
            </div>
          )
        })}
      </div>
      <div className="flex gap-2 mt-1.5">
        {RENTANG_SEBARAN.map((r, i) => <span key={r.label} className="flex-1 text-center text-[10px] text-gray-500">{r.label}</span>)}
      </div>
    </div>
  )
}
