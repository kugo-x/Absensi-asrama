import { useEffect, useState } from 'react'
import { Moon, Pencil, Info, Eye, ArrowRight } from 'lucide-react'
import type { Gedung, HariIso, JadwalHari, Sesi } from '../types'
import { saveSesiGedungApi } from '../api'
import { NAMA_HARI, SEMUA_HARI, hariIso, todayLocal } from '../logic'
import TimeInput from './TimeInput'
import { KartuProfil } from './ProfilAkun'

/**
 * Absen malam per gedung.
 * - Admin hanya mengatur sesi global (mis. Subuh).
 * - Absen malam diatur fasil PJ masing-masing gedung; gedung yang belum mengatur tidak punya absen malam.
 */

const NAMA_SESI = 'Malam'

function sesiMalam(sesiList: Sesi[], namaGedung?: string | null): Sesi | undefined {
  return sesiList.find(s => s.idGedung != null && s.nama === NAMA_SESI && s.namaGedung === namaGedung)
}

type ModeHari = 'utama' | 'khusus' | 'libur'
type DraftHari = Record<HariIso, { mode: ModeHari; mulai: string; selesai: string }>

function draftDari(sesi: Sesi | undefined): DraftHari {
  const d = {} as DraftHari
  for (const h of SEMUA_HARI) {
    const k = sesi?.jadwalHari?.find(x => x.hari === h)
    d[h] = !k
      ? { mode: 'utama', mulai: sesi?.jamMulai ?? '18:00', selesai: sesi?.jamSelesai ?? '20:30' }
      : k.aktif
        ? { mode: 'khusus', mulai: k.jamMulai ?? '18:00', selesai: k.jamSelesai ?? '20:30' }
        : { mode: 'libur', mulai: sesi?.jamMulai ?? '18:00', selesai: sesi?.jamSelesai ?? '20:30' }
  }
  return d
}

/** Ringkasan pengecualian: "Jumat 19:30–21:00 · Sabtu tidak ada absen" */
export function teksPengecualian(sesi?: Sesi): string[] {
  return (sesi?.jadwalHari ?? [])
    .slice()
    .sort((a, b) => a.hari - b.hari)
    .map(h => h.aktif ? `${NAMA_HARI[h.hari]} ${h.jamMulai}–${h.jamSelesai}` : `${NAMA_HARI[h.hari]} tanpa absen`)
}

// ------------------------------------------------------------------ Fasil

export interface RingkasMalam { hadir: number; belum: number; tidakHadir: number; izin: number; total: number }

export function JadwalMalamFasil({ gedung, sesiList, onTersimpan, ringkas, onLihatMonitor }: {
  gedung: Gedung
  sesiList: Sesi[]
  onTersimpan: () => void
  // Kehadiran absen malam hari ini (opsional)
  ringkas?: RingkasMalam | null
  onLihatMonitor?: () => void
}) {
  const sesi = sesiMalam(sesiList, gedung.nama)
  const [ubah, setUbah] = useState(false)
  const [mulai, setMulai] = useState(sesi?.jamMulai ?? '18:00')
  const [selesai, setSelesai] = useState(sesi?.jamSelesai ?? '20:30')
  const [aktif, setAktif] = useState(sesi?.aktif ?? true)
  const [hari, setHari] = useState<DraftHari>(() => draftDari(sesi))
  const [menyimpan, setMenyimpan] = useState(false)
  const [pesan, setPesan] = useState<{ ok: boolean; teks: string } | null>(null)
  const hariIni = hariIso(todayLocal())

  // Sinkron saat data dari server datang / berubah
  useEffect(() => {
    if (ubah) return
    setMulai(sesi?.jamMulai ?? '18:00')
    setSelesai(sesi?.jamSelesai ?? '20:30')
    setAktif(sesi?.aktif ?? true)
    setHari(draftDari(sesi))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sesi?.jamMulai, sesi?.jamSelesai, sesi?.aktif, JSON.stringify(sesi?.jadwalHari ?? []), ubah])

  const mulaiUbah = () => { setUbah(true); setPesan(null) }
  const batal = () => { setUbah(false); setPesan(null) }

  const simpan = async () => {
    if (selesai <= mulai) {
      setPesan({ ok: false, teks: 'Jam selesai harus setelah jam mulai.' })
      return
    }
    const salah = SEMUA_HARI.find(h => hari[h].mode === 'khusus' && hari[h].selesai <= hari[h].mulai)
    if (salah) {
      setPesan({ ok: false, teks: `Jam selesai hari ${NAMA_HARI[salah]} harus setelah jam mulai.` })
      return
    }
    const pengecualian: JadwalHari[] = SEMUA_HARI.filter(h => hari[h].mode !== 'utama').map(h => ({
      hari: h,
      aktif: hari[h].mode === 'khusus',
      jamMulai: hari[h].mode === 'khusus' ? hari[h].mulai : null,
      jamSelesai: hari[h].mode === 'khusus' ? hari[h].selesai : null,
    }))
    setMenyimpan(true)
    const r = await saveSesiGedungApi({ jamMulai: mulai, jamSelesai: selesai, aktif, hari: pengecualian })
    setMenyimpan(false)
    setPesan({ ok: r.ok || !!r.offline, teks: r.message })
    if (r.ok || r.offline) {
      setUbah(false)
      onTersimpan()
    }
  }

  // Jadwal efektif satu hari (untuk tampilan)
  const jadwalHari = (h: HariIso) => {
    const d = hari[h]
    if (!sesi && !ubah) return { teks: 'Belum diatur', kelas: 'text-gray-400' }
    if (!aktif) return { teks: 'Tidak diwajibkan', kelas: 'text-amber-700' }
    if (d.mode === 'libur') return { teks: 'Tidak ada absen', kelas: 'text-gray-400' }
    if (d.mode === 'khusus') return { teks: `${d.mulai}–${d.selesai}`, kelas: 'text-gray-900' }
    return { teks: `${mulai}–${selesai}`, kelas: 'text-gray-900' }
  }

  const status = !sesi
    ? { label: 'Belum diatur', kelas: 'bg-gray-100 text-gray-600 border-gray-200' }
    : sesi.aktif
      ? { label: 'Aktif', kelas: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
      : { label: 'Nonaktif', kelas: 'bg-amber-50 text-amber-700 border-amber-200' }
  const malamIni = jadwalHari(hariIni)
  const adaAbsenMalamIni = !!sesi && aktif && /^\d/.test(malamIni.teks)
  const persenHadir = ringkas && ringkas.total > 0 ? Math.round((ringkas.hadir / ringkas.total) * 100) : 0
  const kolomJam = 'px-3 py-2 rounded-xl border border-gray-200 bg-[#fff] text-sm font-medium text-gray-800'
  const judulKartu = 'text-sm font-bold text-gray-900'

  return (
    <div className="space-y-5">
      {/* 1. Kepala: gedung, status, jadwal utama, tombol ubah */}
      <div className="bg-[#fff] rounded-2xl border border-gray-200/90 shadow-2xs p-5 flex flex-col md:flex-row md:items-center gap-4">
        <div className="flex items-center gap-4 min-w-0 md:mr-auto">
          <span className="w-11 h-11 sm:w-12 sm:h-12 shrink-0 rounded-2xl bg-slate-100 text-slate-700 flex items-center justify-center"><Moon className="w-5 h-5 sm:w-6 sm:h-6" /></span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base sm:text-lg font-extrabold text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>Absen Malam {gedung.nama}</h2>
              <span className={`px-2 py-0.5 rounded-md border text-[11px] font-bold ${status.kelas}`}>{status.label}</span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {!sesi ? 'Belum diatur. Penghuni gedung ini belum punya kewajiban absen malam.'
                : `${sesi.aktif ? 'Wajib untuk penghuni gedung ini' : 'Sementara tidak diwajibkan'}${sesi.namaPengatur ? ` · diatur ${sesi.namaPengatur}` : ''}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 md:pl-5 md:border-l md:border-gray-100">
          <div>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Jadwal utama</p>
            <p className="text-xl sm:text-2xl font-extrabold text-gray-900 tabular-nums leading-tight whitespace-nowrap" style={{ fontFamily: 'Plus Jakarta Sans' }}>
              {sesi ? `${sesi.jamMulai}–${sesi.jamSelesai}` : '–'} <span className="text-xs font-semibold text-gray-400">WIB</span>
            </p>
          </div>
          {!ubah && (
            <button
              onClick={mulaiUbah}
              className="ml-auto md:ml-0 shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-[#141a17] hover:bg-[#2a332e] shadow-2xs cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5" />
              {sesi ? 'Ubah jadwal' : 'Atur jadwal'}
            </button>
          )}
        </div>
      </div>

      {/* 2. Jadwal mingguan | kehadiran malam ini (tinggi sama) */}
      <div className={`grid lg:grid-cols-3 gap-5 ${ubah ? 'items-start' : 'items-stretch'}`}>
        <div className="lg:col-span-2 bg-[#fff] rounded-2xl border border-gray-200/90 shadow-2xs flex flex-col">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
            <div>
              <p className={judulKartu} style={{ fontFamily: 'Plus Jakarta Sans' }}>Jadwal Mingguan</p>
              <p className="text-[11px] text-gray-500">{ubah ? 'Atur jam utama, lalu sesuaikan hari tertentu bila perlu' : 'Jam absen malam setiap hari'}</p>
            </div>
            {!ubah && (
              <span className="hidden sm:flex items-center gap-3 text-[11px] text-gray-500">
                <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-slate-300" />Jam khusus</span>
                <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm border border-dashed border-gray-300" />Tanpa absen</span>
              </span>
            )}
          </div>

          {!ubah ? (
            /* Tampilan: kotak per hari */
            <div className="p-5 flex-1 grid grid-cols-4 sm:grid-cols-7 gap-2.5 content-start">
              {SEMUA_HARI.map(h => {
                const d = hari[h]
                const ini = hariIni === h
                const tanpa = !sesi || !aktif || d.mode === 'libur'
                const jam = d.mode === 'khusus' ? [d.mulai, d.selesai] : [mulai, selesai]
                return (
                  <div
                    key={h}
                    className={`rounded-xl border p-3 text-center flex flex-col items-center gap-1 ${
                      tanpa ? 'border-dashed border-gray-200 bg-gray-50/60'
                        : d.mode === 'khusus' ? 'border-slate-300 bg-slate-50' : 'border-gray-200 bg-[#fff]'
                    } ${ini ? 'ring-2 ring-emerald-600 ring-offset-1' : ''}`}
                  >
                    <span className={`text-xs font-bold ${ini ? 'text-emerald-700' : 'text-gray-700'}`}>{NAMA_HARI[h].slice(0, 3)}</span>
                    {tanpa ? (
                      <span className="text-[11px] font-semibold text-gray-400 py-2">{!sesi ? '–' : 'Libur'}</span>
                    ) : (
                      <span className="tabular-nums leading-tight">
                        <span className="block text-sm font-extrabold text-gray-900">{jam[0]}</span>
                        <span className="block text-[11px] text-gray-500 whitespace-nowrap">– {jam[1]}</span>
                      </span>
                    )}
                    {ini && <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-700">Hari ini</span>}
                  </div>
                )
              })}
            </div>
          ) : (
            /* Mode ubah */
            <div className="p-5 flex-1 space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Jam mulai</label>
                  <TimeInput className={kolomJam} value={mulai} onChange={e => setMulai(e.target.value)} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Jam selesai</label>
                  <TimeInput className={kolomJam} value={selesai} onChange={e => setSelesai(e.target.value)} />
                </div>
                <label className="flex items-center gap-2 h-10 px-3 rounded-xl border border-gray-200 bg-[#fff] text-sm font-medium text-gray-700 cursor-pointer select-none">
                  <input type="checkbox" className="accent-emerald-700" checked={aktif} onChange={e => setAktif(e.target.checked)} />
                  Wajibkan absen malam
                </label>
              </div>
              <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
                {SEMUA_HARI.map(h => {
                  const d = hari[h]
                  const set = (ubahan: Partial<DraftHari[HariIso]>) => setHari(prev => ({ ...prev, [h]: { ...prev[h], ...ubahan } }))
                  const ini = hariIni === h
                  return (
                    <li key={h} className={`grid grid-cols-[5.5rem_1fr] sm:grid-cols-[6rem_11rem_1fr] items-center gap-x-3 gap-y-2 px-4 py-2.5 ${ini ? 'bg-emerald-50/50' : ''}`}>
                      <span className={`text-sm font-bold ${ini ? 'text-emerald-800' : 'text-gray-800'}`}>{NAMA_HARI[h]}</span>
                      <select
                        aria-label={`Jadwal hari ${NAMA_HARI[h]}`}
                        className="px-2.5 py-1.5 rounded-lg border border-gray-200 bg-[#fff] text-xs font-medium text-gray-700"
                        value={d.mode}
                        onChange={e => set({ mode: e.target.value as ModeHari })}
                      >
                        <option value="utama">Ikut jadwal utama</option>
                        <option value="khusus">Jam khusus</option>
                        <option value="libur">Tidak ada absen</option>
                      </select>
                      <span className="col-start-2 sm:col-start-auto flex items-center gap-1.5">
                        {d.mode === 'khusus' ? (
                          <>
                            <TimeInput className="px-2.5 py-1.5 rounded-lg border border-gray-200 bg-[#fff] text-xs font-medium text-gray-800" value={d.mulai} onChange={e => set({ mulai: e.target.value })} />
                            <span className="text-xs text-gray-400">–</span>
                            <TimeInput className="px-2.5 py-1.5 rounded-lg border border-gray-200 bg-[#fff] text-xs font-medium text-gray-800" value={d.selesai} onChange={e => set({ selesai: e.target.value })} />
                          </>
                        ) : (
                          <span className="text-xs text-gray-400 tabular-nums">{d.mode === 'utama' ? `${mulai}–${selesai}` : 'Tanpa absen'}</span>
                        )}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          {(ubah || pesan) && (
            <div className="px-5 py-4 border-t border-gray-100 flex flex-wrap items-center gap-3">
              {pesan && <p className={`text-xs font-semibold ${pesan.ok ? 'text-emerald-700' : 'text-rose-700'}`}>{pesan.teks}</p>}
              {ubah && (
                <div className="flex gap-2 ml-auto">
                  <button onClick={batal} className="px-4 py-2.5 rounded-xl text-xs font-bold text-gray-700 bg-[#fff] border border-gray-200 hover:bg-gray-50 cursor-pointer">Batal</button>
                  <button onClick={simpan} disabled={menyimpan} className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-[#141a17] hover:bg-[#2a332e] shadow-2xs cursor-pointer disabled:opacity-60">
                    {menyimpan ? 'Menyimpan…' : 'Simpan Jadwal'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Kehadiran malam ini */}
        <div className="bg-[#fff] rounded-2xl border border-gray-200/90 shadow-2xs flex flex-col">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
            <div>
              <p className={judulKartu} style={{ fontFamily: 'Plus Jakarta Sans' }}>Kehadiran Malam Ini</p>
              <p className="text-[11px] text-gray-500">{NAMA_HARI[hariIni]} · {adaAbsenMalamIni ? `${malamIni.teks} WIB` : 'tanpa absen malam'}</p>
            </div>
            {onLihatMonitor && (
              <button type="button" onClick={onLihatMonitor} className="text-xs font-bold text-gray-600 hover:text-gray-900 inline-flex items-center gap-1 cursor-pointer shrink-0">
                Monitor<ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {!adaAbsenMalamIni || !ringkas ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-5 py-10 gap-2">
              <span className="w-11 h-11 rounded-2xl bg-gray-100 text-gray-400 flex items-center justify-center"><Moon className="w-5 h-5" /></span>
              <p className="text-xs text-gray-500">Tidak ada absen malam hari ini.</p>
            </div>
          ) : (
            <div className="p-5 flex-1 flex flex-col gap-4">
              <div>
                <div className="flex items-baseline justify-between">
                  <span className="text-3xl font-extrabold text-gray-900 tabular-nums" style={{ fontFamily: 'Plus Jakarta Sans' }}>{ringkas.hadir}<span className="text-base text-gray-400 font-bold">/{ringkas.total}</span></span>
                  <span className="text-xs font-bold text-emerald-700">{persenHadir}% hadir</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${persenHadir}%` }} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-auto">
                {[
                  { label: 'Belum', nilai: ringkas.belum, warna: 'text-gray-700' },
                  { label: 'Tidak hadir', nilai: ringkas.tidakHadir, warna: 'text-rose-600' },
                  { label: 'Izin', nilai: ringkas.izin, warna: 'text-amber-700' },
                ].map(x => (
                  <div key={x.label} className="px-3 py-2.5 rounded-xl bg-gray-50/80 border border-gray-100">
                    <p className="text-[11px] text-gray-500 truncate">{x.label}</p>
                    <p className={`text-lg font-extrabold tabular-nums ${x.warna}`} style={{ fontFamily: 'Plus Jakarta Sans' }}>{x.nilai}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. Ketentuan: satu baris ringkas */}
      <div className="bg-[#fff] rounded-2xl border border-gray-200/90 shadow-2xs px-5 py-4">
        <p className="flex items-center gap-1.5 text-xs font-bold text-gray-700 mb-3"><Info className="w-4 h-4 text-gray-400" />Ketentuan</p>
        <ul className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-2 text-xs text-gray-600 leading-relaxed">
          {[
            'Jadwal ini hanya berlaku untuk penghuni gedung Anda.',
            'Tidak absen hingga jam selesai = tercatat Tidak Hadir.',
            'Hari libur dari admin otomatis tanpa absen.',
            'Absen subuh diatur admin untuk semua gedung.',
          ].map((t, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-0.5 w-5 h-5 shrink-0 rounded-full bg-gray-100 text-gray-600 text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ Admin (lihat saja)

export function JadwalMalamAdmin({ sesiList, gedungList }: { sesiList: Sesi[]; gedungList: Gedung[] }) {
  return (
    <KartuProfil
      ikon={<Moon />}
      judul="Absen Malam per Gedung"
      sub="Diatur fasil PJ masing-masing gedung"
      kanan={<span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 text-[11px] font-semibold text-gray-600"><Eye className="w-3.5 h-3.5" />Lihat saja</span>}
    >
      <div className="flex-1 divide-y divide-gray-100">
        {gedungList.map(g => {
          const s = sesiMalam(sesiList, g.nama)
          return (
            <div key={g.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{g.nama}</p>
                <p className="text-[11px] text-gray-500 truncate">
                  {s ? `Diatur ${s.namaPengatur ?? 'fasil'}` : g.namaPj ? `PJ: ${g.namaPj}` : 'Belum ada fasil PJ'}
                </p>
                {s && teksPengecualian(s).length > 0 && (
                  <p className="text-[11px] text-gray-400">{teksPengecualian(s).join(' · ')}</p>
                )}
              </div>
              {!s ? (
                <span className="shrink-0 px-2 py-1 rounded-md bg-gray-100 text-[11px] font-semibold text-gray-500">Belum diatur · tanpa absen malam</span>
              ) : (
                <span className={`shrink-0 px-2 py-1 rounded-md text-[11px] font-bold tabular-nums ${s.aktif ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                  {s.jamMulai}–{s.jamSelesai}{s.aktif ? '' : ' · nonaktif'}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </KartuProfil>
  )
}
