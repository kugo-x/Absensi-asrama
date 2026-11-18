import { useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Moon, Sun } from 'lucide-react'
import type { PresensiStatus, Sesi } from '../types'
import { formatTanggal, hitungStatus, jamPresensi, riwayatPenghuni, todayLocal, type DataPresensi, type RiwayatRow } from '../logic'
import { Badge, SectionTitle } from './AppLayout'

/**
 * Kalender kehadiran sebulan untuk penghuni.
 * Warna tiap hari diringkas dari status semua sesi wajib pada hari itu (logika status sama dengan riwayat).
 */

const NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const HARI_KOLOM = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']

type Ringkas = 'hadir' | 'sebagian' | 'alpa' | 'izin' | 'libur' | 'kosong'

const WARNA: Record<Ringkas, string> = {
  hadir: 'bg-emerald-50 border-emerald-200 text-emerald-900',
  sebagian: 'bg-amber-50 border-amber-200 text-amber-900',
  alpa: 'bg-rose-50 border-rose-200 text-rose-900',
  izin: 'bg-amber-50/60 border-amber-200 text-amber-900',
  libur: 'bg-slate-50 border-slate-200 text-slate-700',
  kosong: 'bg-[#fff] border-gray-100 text-gray-500',
}

// Titik per sesi di dalam sel
const TITIK: Record<PresensiStatus, string> = {
  Hadir: 'bg-emerald-600',
  'Tidak Hadir': 'bg-rose-500',
  Izin: 'bg-amber-500',
  Libur: 'bg-slate-400',
  Belum: 'bg-gray-300',
}

const LEGENDA: [string, string][] = [
  ['bg-emerald-600', 'Hadir'],
  ['bg-rose-500', 'Tidak hadir'],
  ['bg-amber-500', 'Izin'],
  ['bg-slate-400', 'Libur'],
  ['bg-gray-300', 'Belum absen'],
]

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

// Absen event milik penghuni (ditandai pada kalender & detail tanggal)
export interface EventKalender { tanggal: string; judul: string; status: 'Hadir' | 'Tidak Hadir'; jam: string }

export default function KalenderKehadiran({ nim, sesiList, data, now, gedung, tanggalMasuk, eventSaya = [] }: {
  eventSaya?: EventKalender[]
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
  const eventTanggal = (t: string) => eventSaya.filter(e => e.tanggal === t)
  const eventDipilih = dipilih ? eventTanggal(dipilih) : []

  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-200/90 shadow-2xs">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-3 mb-4">
        <SectionTitle subtitle={`Kehadiran ${c.persen}% · Hadir ${c.Hadir} dari ${c.wajib} sesi wajib bulan ini`}>Kalender Kehadiran</SectionTitle>
        <div className="flex items-center gap-1 shrink-0 self-start sm:self-auto -ml-1.5 sm:ml-0">
          <button onClick={() => geser(-1)} disabled={!bisaMundur} aria-label="Bulan sebelumnya" className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="w-32 text-center text-sm font-bold text-gray-800" style={{ fontFamily: 'Plus Jakarta Sans' }}>{NAMA_BULAN[m - 1]} {y}</span>
          <button onClick={() => geser(1)} disabled={!bisaMaju} aria-label="Bulan berikutnya" className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,460px)_minmax(0,1fr)] gap-5">
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
              const ev = eventTanggal(t)
              const hariIni = t === today
              return (
                <button
                  key={t}
                  onClick={() => setDipilih(t)}
                  data-tgl={t}
                  aria-pressed={dipilih === t}
                  aria-label={`${formatTanggal(t)}${rows.length ? ' · ' + rows.map(x => `${x.sesi.nama}: ${x.detail.status}`).join(', ') : ''}${ev.length ? ' · Event: ' + ev.map(e => e.judul).join(', ') : ''}`}
                  className={`h-12 sm:h-14 rounded-lg border p-1 flex flex-col items-center justify-between transition-all cursor-pointer hover:border-gray-400
                    ${nanti ? 'bg-[#fff] text-gray-300 border-dashed border-gray-200' : WARNA[r]}
                    ${dipilih === t ? 'ring-2 ring-gray-900 ring-offset-1' : ''}`}
                >
                  <span className={`text-xs font-bold leading-none tabular-nums ${hariIni ? 'w-5 h-5 rounded-full bg-[#141a17] text-white flex items-center justify-center' : 'mt-0.5'}`}>{Number(t.slice(8))}</span>
                  <span className="flex items-center gap-0.5 min-h-1.5">
                    {rows.filter(x => x.detail.status !== 'Belum' || x.detail.fase !== 'belum-dibuka').map(x => (
                      <span key={x.sesi.id} className={`w-1.5 h-1.5 rounded-full ${TITIK[x.detail.status]}`} />
                    ))}
                    {ev.length > 0 && <span className={`w-1.5 h-1.5 rotate-45 ${ev.some(e => e.status === 'Hadir') ? 'bg-emerald-800' : 'bg-rose-700'}`} />}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex flex-col gap-4 min-w-0">
        <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-4">
          {!dipilih ? (
            <p className="text-xs text-gray-400">Pilih tanggal untuk melihat detail.</p>
          ) : (
            <>
              <div className="flex items-baseline justify-between gap-2 mb-3">
                <p className="text-sm font-bold text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>{formatTanggal(dipilih)}</p>
                {(detail.length > 0 || eventDipilih.length > 0) && (
                  <span className="text-[11px] text-gray-400 shrink-0">
                    {[detail.length && `${detail.length} sesi`, eventDipilih.length && `${eventDipilih.length} event`].filter(Boolean).join(' · ')}
                  </span>
                )}
              </div>
              {detail.length === 0 && eventDipilih.length === 0 ? (
                <p className="text-xs text-gray-400">{dipilih > today ? 'Belum berlangsung.' : dipilih < mulaiHitung ? 'Sebelum Anda terdaftar.' : 'Tidak ada sesi wajib.'}</p>
              ) : (
                <ul className="space-y-2">
                  {detail.map(({ sesi, detail: d }) => {
                    const pr = d.presensi
                    const jam = jamPresensi(pr)
                    const chip: { teks: string; kelas: string }[] = []
                    if (jam) chip.push({ teks: `Masuk ${jam} WIB`, kelas: 'bg-gray-100 text-gray-700' })
                    if (pr?.statusFoto === 'Menunggu') chip.push({ teks: 'Foto menunggu validasi', kelas: 'bg-amber-50 text-amber-800' })
                    if (pr?.statusFoto === 'Diterima') chip.push({ teks: 'Foto diterima', kelas: 'bg-emerald-50 text-emerald-800' })
                    if (pr?.statusFoto === 'Ditolak') chip.push({ teks: 'Foto ditolak', kelas: 'bg-rose-50 text-rose-700' })
                    if (pr?.otomatis) chip.push({ teks: 'Dicatat otomatis', kelas: 'bg-gray-100 text-gray-500' })
                    else if (pr?.dikoreksiOleh && pr.statusFoto !== 'Ditolak') chip.push({ teks: 'Dikoreksi fasil', kelas: 'bg-slate-100 text-slate-700' })
                    // Satu baris keterangan saja, tanpa mengulang info chip
                    const catatan = pr?.statusFoto === 'Ditolak' && pr.catatanValidasi ? `Catatan fasil: ${pr.catatanValidasi}`
                      : d.libur ? d.libur.keterangan
                      : d.izin ? `Izin: ${d.izin.alasan}`
                      : pr?.dikoreksiOleh && pr.keterangan && !/^Foto ditolak/.test(pr.keterangan) ? pr.keterangan
                      : ''
                    return (
                      <li key={sesi.id} className="flex items-start gap-3 rounded-lg bg-[#fff] border border-gray-100 px-3 py-2.5">
                        <span className="w-8 h-8 shrink-0 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-600">
                          {/malam/i.test(sesi.nama) ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-gray-900">Sesi {sesi.nama}</p>
                            <Badge status={d.status} />
                          </div>
                          <p className="text-[11px] text-gray-400 tabular-nums">{sesi.jamMulai}–{sesi.jamSelesai} WIB</p>
                          {chip.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {chip.map(c => <span key={c.teks} className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${c.kelas}`}>{c.teks}</span>)}
                            </div>
                          )}
                          {catatan && <p className="text-[11px] text-gray-500 mt-1 leading-snug">{catatan}</p>}
                        </div>
                      </li>
                    )
                  })}
                  {eventDipilih.map(e => (
                    <li key={e.judul} className="flex items-start gap-3 rounded-lg bg-[#fff] border border-gray-100 px-3 py-2.5">
                      <span className="w-8 h-8 shrink-0 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-600">
                        <CalendarDays className="w-4 h-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-gray-900 truncate">{e.judul}</p>
                          <Badge status={e.status} />
                        </div>
                        <p className="text-[11px] text-gray-400">Absen event</p>
                        {e.jam && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-700">Masuk {e.jam} WIB</span>
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>

        {/* Ringkasan bulan & legenda warna */}
        <div className="rounded-xl border border-gray-100 p-4">
          <p className="text-sm font-bold text-gray-900 mb-3" style={{ fontFamily: 'Plus Jakarta Sans' }}>Ringkasan {NAMA_BULAN[m - 1]}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {([
              ['Hadir', c.Hadir, 'text-emerald-700'],
              ['Tidak hadir', c['Tidak Hadir'], 'text-rose-600'],
              ['Izin', c.Izin, 'text-amber-700'],
              ['Libur', c.Libur, 'text-slate-600'],
            ] as const).map(([label, nilai, warna]) => (
              <div key={label} className="px-3 py-2.5 rounded-lg bg-gray-50/80 border border-gray-100">
                <p className="text-[11px] text-gray-500">{label}</p>
                <p className={`text-lg font-extrabold tabular-nums ${warna}`} style={{ fontFamily: 'Plus Jakarta Sans' }}>{nilai}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-gray-100 flex flex-wrap gap-x-4 gap-y-2">
            {LEGENDA.map(([warna, label]) => (
              <span key={label} className="inline-flex items-center gap-1.5 text-[11px] text-gray-500">
                <span className={`w-2.5 h-2.5 rounded-full ${warna}`} />
                {label}
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-500">
              <span className="w-2 h-2 rotate-45 bg-emerald-800" />
              Absen event
            </span>
            <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-500">
              <span className="w-4 h-4 rounded-full bg-[#141a17]" />
              Hari ini
            </span>
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}
