import { useEffect, useState } from 'react'
import { Moon, Pencil, Info, Eye } from 'lucide-react'
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

export function JadwalMalamFasil({ gedung, sesiList, onTersimpan }: {
  gedung: Gedung
  sesiList: Sesi[]
  onTersimpan: () => void
}) {
  const sesi = sesiMalam(sesiList, gedung.nama)
  const [ubah, setUbah] = useState(false)
  const [mulai, setMulai] = useState(sesi?.jamMulai ?? '18:00')
  const [selesai, setSelesai] = useState(sesi?.jamSelesai ?? '20:30')
  const [aktif, setAktif] = useState(sesi?.aktif ?? true)
  const [hari, setHari] = useState<DraftHari>(() => draftDari(sesi))
  const [menyimpan, setMenyimpan] = useState(false)
  const [pesan, setPesan] = useState<{ ok: boolean; teks: string } | null>(null)

  // Sinkron saat data dari server datang / berubah
  useEffect(() => {
    if (ubah) return
    setMulai(sesi?.jamMulai ?? '18:00')
    setSelesai(sesi?.jamSelesai ?? '20:30')
    setAktif(sesi?.aktif ?? true)
    setHari(draftDari(sesi))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sesi?.jamMulai, sesi?.jamSelesai, sesi?.aktif, JSON.stringify(sesi?.jadwalHari ?? []), ubah])

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

  const status = !sesi
    ? { label: 'Belum diatur', kelas: 'bg-gray-100 text-gray-600' }
    : sesi.aktif
      ? { label: 'Aktif', kelas: 'bg-emerald-50 text-emerald-700' }
      : { label: 'Nonaktif', kelas: 'bg-amber-50 text-amber-700' }

  return (
    <div className="mb-6 rounded-2xl bg-white p-5 border border-emerald-100/80 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className="w-10 h-10 shrink-0 rounded-xl bg-[#0f3e2d] text-emerald-300 flex items-center justify-center"><Moon className="w-5 h-5" /></span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-bold text-sm text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>Absen Malam {gedung.nama}</p>
              <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${status.kelas}`}>{status.label}</span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              {!sesi
                ? 'Belum diatur — penghuni gedung ini belum memiliki kewajiban absen malam.'
                : `${sesi.jamMulai}–${sesi.jamSelesai} WIB${sesi.aktif ? '' : ' (tidak diwajibkan sementara)'}${sesi.namaPengatur ? ` · diatur ${sesi.namaPengatur}` : ''}`}
            </p>
            {sesi && teksPengecualian(sesi).length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {teksPengecualian(sesi).map(t => (
                  <span key={t} className="px-1.5 py-0.5 rounded-md bg-gray-100 text-[10px] font-semibold text-gray-600">{t}</span>
                ))}
              </div>
            )}
          </div>
        </div>
        {!ubah && (
          <button
            onClick={() => { setUbah(true); setPesan(null) }}
            className="shrink-0 inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 cursor-pointer"
          >
            <Pencil className="w-3.5 h-3.5" />
            {sesi ? 'Ubah jadwal' : 'Atur jadwal'}
          </button>
        )}
      </div>

      {ubah && (
        <div className="mt-4 pt-4 border-t border-gray-100 flex flex-col sm:flex-row sm:items-end gap-3">
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Mulai</label>
            <TimeInput className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-800" value={mulai} onChange={e => setMulai(e.target.value)} />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Selesai</label>
            <TimeInput className="px-3 py-2 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-800" value={selesai} onChange={e => setSelesai(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 h-10 px-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 cursor-pointer select-none">
            <input type="checkbox" checked={aktif} onChange={e => setAktif(e.target.checked)} />
            Wajibkan absen malam
          </label>
          <div className="flex gap-2 sm:ml-auto">
            <button onClick={() => { setUbah(false); setPesan(null) }} className="px-4 py-2 rounded-xl text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 cursor-pointer">Batal</button>
            <button onClick={simpan} disabled={menyimpan} className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 cursor-pointer disabled:opacity-60">
              {menyimpan ? 'Menyimpan…' : 'Simpan'}
            </button>
          </div>
        </div>
      )}
      {ubah && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Jadwal per hari</p>
          <p className="text-[11px] text-gray-400 mb-2">Hari yang mengikuti jadwal utama memakai jam di atas.</p>
          <div className="divide-y divide-gray-100 rounded-xl border border-gray-200">
            {SEMUA_HARI.map(h => {
              const d = hari[h]
              const set = (ubahan: Partial<DraftHari[HariIso]>) => setHari(prev => ({ ...prev, [h]: { ...prev[h], ...ubahan } }))
              return (
                <div key={h} className="flex flex-wrap items-center gap-2 px-3 py-2">
                  <span className={`w-16 text-xs font-bold ${hariIso(todayLocal()) === h ? 'text-emerald-700' : 'text-gray-800'}`}>{NAMA_HARI[h]}</span>
                  <select
                    aria-label={`Jadwal hari ${NAMA_HARI[h]}`}
                    className="px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-700"
                    value={d.mode}
                    onChange={e => set({ mode: e.target.value as ModeHari })}
                  >
                    <option value="utama">Ikut jadwal utama</option>
                    <option value="khusus">Jam khusus</option>
                    <option value="libur">Tidak ada absen</option>
                  </select>
                  {d.mode === 'khusus' && (
                    <div className="flex items-center gap-1.5">
                      <TimeInput className="px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-800" value={d.mulai} onChange={e => set({ mulai: e.target.value })} />
                      <span className="text-xs text-gray-400">–</span>
                      <TimeInput className="px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-800" value={d.selesai} onChange={e => set({ selesai: e.target.value })} />
                    </div>
                  )}
                  {d.mode === 'utama' && <span className="text-[11px] text-gray-400 tabular-nums">{mulai}–{selesai}</span>}
                </div>
              )
            })}
          </div>
        </div>
      )}
      {pesan && <p className={`mt-3 text-xs font-semibold ${pesan.ok ? 'text-emerald-700' : 'text-rose-700'}`}>{pesan.teks}</p>}
      <p className="mt-3 flex items-start gap-1.5 text-[11px] text-gray-400">
        <Info className="w-3.5 h-3.5 shrink-0 mt-px" />
        Absen subuh diatur admin untuk semua gedung. Penghuni yang tidak absen hingga sesi ditutup tercatat Tidak Hadir.
      </p>
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
