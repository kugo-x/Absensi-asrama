import { useEffect, useState } from 'react'
import { Moon, Pencil, Info, Eye } from 'lucide-react'
import type { Gedung, Sesi } from '../types'
import { saveSesiGedungApi } from '../api'
import TimeInput from './TimeInput'
import { SectionTitle } from './AppLayout'

/**
 * Absen malam per gedung.
 * - Admin hanya mengatur sesi global (mis. Subuh).
 * - Absen malam diatur fasil PJ masing-masing gedung; gedung yang belum mengatur tidak punya absen malam.
 */

const NAMA_SESI = 'Malam'

function sesiMalam(sesiList: Sesi[], namaGedung?: string | null): Sesi | undefined {
  return sesiList.find(s => s.idGedung != null && s.nama === NAMA_SESI && s.namaGedung === namaGedung)
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
  const [menyimpan, setMenyimpan] = useState(false)
  const [pesan, setPesan] = useState<{ ok: boolean; teks: string } | null>(null)

  // Sinkron saat data dari server datang / berubah
  useEffect(() => {
    if (ubah) return
    setMulai(sesi?.jamMulai ?? '18:00')
    setSelesai(sesi?.jamSelesai ?? '20:30')
    setAktif(sesi?.aktif ?? true)
  }, [sesi?.jamMulai, sesi?.jamSelesai, sesi?.aktif, ubah])

  const simpan = async () => {
    if (selesai <= mulai) {
      setPesan({ ok: false, teks: 'Jam selesai harus setelah jam mulai.' })
      return
    }
    setMenyimpan(true)
    const r = await saveSesiGedungApi({ jamMulai: mulai, jamSelesai: selesai, aktif })
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
          <span className="w-10 h-10 shrink-0 rounded-xl bg-[#0c2a1c] text-emerald-300 flex items-center justify-center"><Moon className="w-5 h-5" /></span>
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
      {pesan && <p className={`mt-3 text-xs font-semibold ${pesan.ok ? 'text-emerald-700' : 'text-red-700'}`}>{pesan.teks}</p>}
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
    <div className="rounded-2xl bg-white p-6 border border-emerald-100/80 shadow-xs">
      <div className="flex items-start justify-between gap-3 mb-4">
        <SectionTitle subtitle="Jam absen malam berbeda tiap gedung dan diatur oleh fasil PJ masing-masing.">Absen Malam per Gedung</SectionTitle>
        <span className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-100 text-[11px] font-semibold text-gray-600"><Eye className="w-3.5 h-3.5" />Lihat saja</span>
      </div>
      <div className="divide-y divide-gray-100">
        {gedungList.map(g => {
          const s = sesiMalam(sesiList, g.nama)
          return (
            <div key={g.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{g.nama}</p>
                <p className="text-[11px] text-gray-500 truncate">
                  {s ? `Diatur ${s.namaPengatur ?? 'fasil'}` : g.namaPj ? `PJ: ${g.namaPj}` : 'Belum ada fasil PJ'}
                </p>
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
    </div>
  )
}
