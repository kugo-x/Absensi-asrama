import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Building2, CalendarClock, Edit, Megaphone, Plus, Search, Trash2, X } from 'lucide-react'
import type { Gedung, Pengumuman, PengumumanInput } from '../types'
import type { ApiResult } from '../api'
import { formatTanggal, todayLocal } from '../logic'
import DateInput from './DateInput'

/**
 * Pengumuman: halaman kelola (admin & fasil) dan kartu baca (dashboard penghuni).
 * Admin mengirim ke seluruh asrama atau gedung tertentu; fasil hanya ke gedung binaannya.
 */

export const kedaluwarsa = (p: Pengumuman, today = todayLocal()) => !!p.berlakuSampai && p.berlakuSampai < today

function TargetChip({ p }: { p: Pengumuman }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-100 text-[11px] font-semibold text-gray-700">
      <Building2 className="w-3 h-3" />
      {p.tipe === 'seluruh' ? 'Seluruh asrama' : p.namaGedung || 'Gedung'}
    </span>
  )
}

function infoWaktu(p: Pengumuman): string {
  const dibuat = p.dibuatPada ? formatTanggal(p.dibuatPada.slice(0, 10), 'tanpaHari') : ''
  const pembuat = p.namaPembuat ? `${p.namaPembuat} (${p.peranPembuat === 'admin' ? 'Admin' : 'Fasil'})` : ''
  return [pembuat, dibuat].filter(Boolean).join(' · ')
}

// ------------------------------------------------------------------ Kartu pengumuman (dipakai di semua peran)

export function KartuPengumuman({ p, onEdit, onHapus, ringkas = false }: {
  p: Pengumuman
  onEdit?: () => void
  onHapus?: () => void
  ringkas?: boolean
}) {
  const [buka, setBuka] = useState(false)
  const habis = kedaluwarsa(p)
  const panjang = p.isi.length > 220 || p.isi.split('\n').length > 4
  return (
    <article className={`rounded-xl border p-4 bg-[#fff] ${p.penting && !habis ? 'border-amber-300 ring-1 ring-amber-200' : 'border-gray-200'} ${habis ? 'opacity-70' : ''}`}>
      <div className="flex items-start gap-3">
        <span className={`w-9 h-9 shrink-0 rounded-xl flex items-center justify-center ${p.penting && !habis ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
          <Megaphone className="w-4 h-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h4 className="text-sm font-bold text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>{p.judul}</h4>
            {p.penting && !habis && <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-wide">Penting</span>}
            {habis && <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 text-[10px] font-bold uppercase tracking-wide">Kedaluwarsa</span>}
          </div>
          <p className="text-[11px] text-gray-500 mt-0.5">{infoWaktu(p)}</p>
          <p className={`text-sm text-gray-700 mt-2 whitespace-pre-line leading-relaxed ${!buka && (ringkas || panjang) ? 'line-clamp-3' : ''}`}>{p.isi}</p>
          {(ringkas || panjang) && p.isi.length > 120 && (
            <button type="button" onClick={() => setBuka(v => !v)} className="mt-1 text-xs font-bold text-gray-600 hover:text-gray-900 cursor-pointer">
              {buka ? 'Tutup' : 'Baca selengkapnya'}
            </button>
          )}
          <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
            {!ringkas && <TargetChip p={p} />}
            {p.berlakuSampai && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-100 text-[11px] font-semibold text-gray-700">
                <CalendarClock className="w-3 h-3" />{habis ? 'Berakhir' : 'Berlaku s.d.'} {formatTanggal(p.berlakuSampai, 'tanpaHari')}
              </span>
            )}
          </div>
        </div>
        {(onEdit || onHapus) && (
          <div className="flex items-center gap-1 shrink-0">
            {onEdit && (
              <button type="button" onClick={onEdit} className="p-2 rounded-lg text-gray-400 hover:text-gray-800 hover:bg-gray-100 cursor-pointer" title="Ubah" aria-label={`Ubah ${p.judul}`}>
                <Edit className="w-4 h-4" />
              </button>
            )}
            {onHapus && (
              <button type="button" onClick={onHapus} className="p-2 rounded-lg text-gray-400 hover:text-rose-700 hover:bg-rose-50 cursor-pointer" title="Hapus" aria-label={`Hapus ${p.judul}`}>
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  )
}

// ------------------------------------------------------------------ Form buat / ubah

function FormPengumuman({ awal, peran, gedungList, namaGedungSaya, onClose, onSimpan }: {
  awal: Pengumuman | null
  peran: 'admin' | 'fasil'
  gedungList: Gedung[]
  namaGedungSaya?: string
  onClose: () => void
  onSimpan: (data: PengumumanInput) => Promise<ApiResult>
}) {
  const today = todayLocal()
  const [judul, setJudul] = useState(awal?.judul ?? '')
  const [isi, setIsi] = useState(awal?.isi ?? '')
  const [penting, setPenting] = useState(awal?.penting ?? false)
  const [tipe, setTipe] = useState<'seluruh' | 'gedung'>(peran === 'fasil' ? 'gedung' : awal?.tipe ?? 'seluruh')
  const [idGedung, setIdGedung] = useState<number | null>(awal?.idGedung ?? null)
  const [sampai, setSampai] = useState(awal?.berlakuSampai ?? '')
  const [menyimpan, setMenyimpan] = useState(false)
  const [galat, setGalat] = useState('')

  useEffect(() => {
    const tutup = (e: KeyboardEvent) => { if (e.key === 'Escape' && !menyimpan) onClose() }
    window.addEventListener('keydown', tutup)
    return () => window.removeEventListener('keydown', tutup)
  }, [onClose, menyimpan])

  const simpan = async () => {
    if (judul.trim().length < 3) return setGalat('Judul minimal 3 karakter.')
    if (!isi.trim()) return setGalat('Isi pengumuman wajib diisi.')
    if (peran === 'admin' && tipe === 'gedung' && !idGedung) return setGalat('Pilih gedung tujuan.')
    setGalat('')
    setMenyimpan(true)
    const r = await onSimpan({ judul: judul.trim(), isi: isi.trim(), penting, tipe, idGedung: tipe === 'gedung' ? idGedung : null, berlakuSampai: sampai || null })
    setMenyimpan(false)
    if (r.ok || r.offline) onClose()
    else setGalat(r.message)
  }

  const kolom = 'w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-[#fff] text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10'
  const label = 'block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5'

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs" role="dialog" aria-modal="true" aria-label={awal ? 'Ubah pengumuman' : 'Buat pengumuman'}
      onMouseDown={e => { if (e.target === e.currentTarget && !menyimpan) onClose() }}>
      <div className="bg-[#fff] rounded-2xl w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl border border-gray-200 overflow-hidden motion-safe:[animation:lg-muncul_0.3s_cubic-bezier(0.22,1,0.36,1)]">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3 shrink-0">
          <span className="w-10 h-10 rounded-xl bg-gray-100 text-gray-700 flex items-center justify-center"><Megaphone className="w-5 h-5" /></span>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-extrabold text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>{awal ? 'Ubah Pengumuman' : 'Buat Pengumuman'}</h3>
            <p className="text-xs text-gray-500">{peran === 'fasil' ? `Dikirim ke penghuni ${namaGedungSaya ?? 'gedung Anda'}` : 'Dikirim ke penghuni sesuai tujuan'}</p>
          </div>
          <button type="button" onClick={onClose} disabled={menyimpan} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 cursor-pointer" aria-label="Tutup"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div>
            <label className={label}>Judul <span className="text-rose-500">*</span></label>
            <input className={kolom} value={judul} maxLength={150} onChange={e => setJudul(e.target.value)} placeholder="Contoh: Pemadaman air hari Sabtu" />
          </div>
          <div>
            <div className="flex items-baseline justify-between">
              <label className={label}>Isi <span className="text-rose-500">*</span></label>
              <span className={`text-[11px] tabular-nums ${isi.length > 1900 ? 'text-amber-700' : 'text-gray-400'}`}>{isi.length}/2000</span>
            </div>
            <textarea className={`${kolom} resize-none`} rows={5} maxLength={2000} value={isi} onChange={e => setIsi(e.target.value)} placeholder="Tulis informasi yang perlu diketahui penghuni..." />
          </div>

          {peran === 'admin' ? (
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className={label}>Tujuan</label>
                <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-gray-100">
                  {([['seluruh', 'Seluruh asrama'], ['gedung', 'Gedung']] as const).map(([v, l]) => (
                    <button key={v} type="button" onClick={() => setTipe(v)} aria-pressed={tipe === v}
                      className={`py-2 rounded-lg text-xs font-bold cursor-pointer transition-colors ${tipe === v ? 'bg-[#fff] text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-800'}`}>{l}</button>
                  ))}
                </div>
              </div>
              {tipe === 'gedung' && (
                <div>
                  <label className={label}>Gedung</label>
                  <select className={kolom} value={idGedung ?? ''} onChange={e => setIdGedung(Number(e.target.value) || null)}>
                    <option value="">Pilih gedung</option>
                    {gedungList.map(g => <option key={g.id} value={g.id}>{g.nama}</option>)}
                  </select>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-gray-600 inline-flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" />Tujuan: penghuni {namaGedungSaya ?? 'gedung Anda'}</p>
          )}

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={label}>Berlaku sampai <span className="normal-case tracking-normal font-medium text-gray-400">(opsional)</span></label>
              <DateInput clearable min={today} placeholder="Tanpa batas" className={kolom} value={sampai} onChange={e => setSampai(e.target.value)} />
            </div>
            <label className="flex items-start gap-3 p-3 rounded-xl border border-gray-200 cursor-pointer select-none self-end">
              <input type="checkbox" className="mt-0.5 w-4 h-4 accent-amber-600" checked={penting} onChange={e => setPenting(e.target.checked)} />
              <span>
                <span className="block text-sm font-bold text-gray-900">Tandai penting</span>
                <span className="block text-[11px] text-gray-500">Notifikasi berbunyi & tampil paling atas</span>
              </span>
            </label>
          </div>
          {galat && <p className="text-xs font-semibold text-rose-700">{galat}</p>}
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-2 shrink-0">
          <button type="button" onClick={onClose} disabled={menyimpan} className="px-4 py-2.5 rounded-xl border border-gray-200 bg-[#fff] text-xs font-bold text-gray-700 hover:bg-gray-50 cursor-pointer">Batal</button>
          <button type="button" onClick={simpan} disabled={menyimpan} className="px-5 py-2.5 rounded-xl bg-[#141a17] hover:bg-[#2a332e] text-white text-xs font-bold shadow-2xs cursor-pointer disabled:opacity-60">
            {menyimpan ? 'Menyimpan…' : awal ? 'Simpan Perubahan' : 'Kirim Pengumuman'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ------------------------------------------------------------------ Halaman kelola (admin & fasil)

export function KelolaPengumuman({ daftar, peran, nimSaya, gedungList, namaGedungSaya, onTambah, onUbah, onHapus }: {
  daftar: Pengumuman[]
  peran: 'admin' | 'fasil'
  nimSaya: string
  gedungList: Gedung[]
  namaGedungSaya?: string
  onTambah: (d: PengumumanInput) => Promise<ApiResult>
  onUbah: (id: number, d: PengumumanInput) => Promise<ApiResult>
  onHapus: (p: Pengumuman) => void
}) {
  const today = todayLocal()
  const [form, setForm] = useState<{ buka: boolean; awal: Pengumuman | null }>({ buka: false, awal: null })
  const [saring, setSaring] = useState<'aktif' | 'habis' | 'semua'>('aktif')
  const [cari, setCari] = useState('')
  const bolehUbah = (p: Pengumuman) => peran === 'admin' || p.createdBy === nimSaya

  const kata = cari.trim().toLowerCase()
  const aktif = daftar.filter(p => !kedaluwarsa(p, today))
  const habis = daftar.filter(p => kedaluwarsa(p, today))
  const tampil = (saring === 'aktif' ? aktif : saring === 'habis' ? habis : daftar)
    .filter(p => !kata || `${p.judul} ${p.isi} ${p.namaGedung ?? ''} ${p.namaPembuat ?? ''}`.toLowerCase().includes(kata))

  const ubin = [
    { k: 'aktif', label: 'Aktif', n: aktif.length },
    { k: 'habis', label: 'Kedaluwarsa', n: habis.length },
    { k: 'semua', label: 'Semua', n: daftar.length },
  ] as const

  return (
    <div className="space-y-5">
      <div className="bg-[#fff] rounded-2xl border border-gray-200/90 shadow-2xs px-5 py-4 flex flex-col md:flex-row md:items-center gap-3">
        <div className="md:mr-auto">
          <h3 className="text-base font-extrabold text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>Pengumuman ke Penghuni</h3>
          <p className="text-xs text-gray-500">
            {peran === 'admin' ? 'Kirim ke seluruh asrama atau gedung tertentu.' : `Kirim ke penghuni ${namaGedungSaya ?? 'gedung Anda'}. Pengumuman dari admin juga tampil di sini.`}
          </p>
        </div>
        <button type="button" onClick={() => setForm({ buka: true, awal: null })}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#141a17] hover:bg-[#2a332e] text-white text-xs font-bold shadow-2xs cursor-pointer">
          <Plus className="w-4 h-4" />Buat Pengumuman
        </button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="inline-flex p-1 rounded-xl bg-gray-100 border border-gray-200 self-start" role="tablist" aria-label="Saring pengumuman">
          {ubin.map(u => (
            <button key={u.k} type="button" role="tab" aria-selected={saring === u.k} onClick={() => setSaring(u.k)}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold cursor-pointer transition-colors ${saring === u.k ? 'bg-[#fff] text-gray-900 shadow-xs' : 'text-gray-500 hover:text-gray-800'}`}>
              {u.label} <span className="text-gray-400 tabular-nums">{u.n}</span>
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-72 sm:ml-auto">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input type="search" value={cari} onChange={e => setCari(e.target.value)} placeholder="Cari judul, isi, gedung..." aria-label="Cari pengumuman"
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 bg-[#fff] text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10" />
        </div>
      </div>

      {tampil.length === 0 ? (
        <div className="bg-[#fff] rounded-2xl border border-dashed border-gray-200 py-14 text-center">
          <Megaphone className="w-8 h-8 text-gray-300 mx-auto" />
          <p className="mt-2 text-sm font-semibold text-gray-600">{kata ? 'Tidak ada pengumuman yang cocok' : saring === 'habis' ? 'Belum ada pengumuman kedaluwarsa' : 'Belum ada pengumuman'}</p>
          {!kata && saring !== 'habis' && <p className="text-xs text-gray-400 mt-0.5">Klik "Buat Pengumuman" untuk mengirim informasi ke penghuni.</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {tampil.map(p => (
            <KartuPengumuman
              key={p.id}
              p={p}
              onEdit={bolehUbah(p) ? () => setForm({ buka: true, awal: p }) : undefined}
              onHapus={bolehUbah(p) ? () => onHapus(p) : undefined}
            />
          ))}
        </div>
      )}

      {form.buka && (
        <FormPengumuman
          awal={form.awal}
          peran={peran}
          gedungList={gedungList}
          namaGedungSaya={namaGedungSaya}
          onClose={() => setForm({ buka: false, awal: null })}
          onSimpan={d => (form.awal ? onUbah(form.awal.id, d) : onTambah(d))}
        />
      )}
    </div>
  )
}

// ------------------------------------------------------------------ Kartu dashboard penghuni

export function PengumumanPenghuni({ daftar }: { daftar: Pengumuman[] }) {
  const [semua, setSemua] = useState(false)
  if (daftar.length === 0) return null
  const tampil = semua ? daftar : daftar.slice(0, 2)
  return (
    <section className="bg-[#fff] rounded-2xl border border-gray-200/90 shadow-2xs overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
        <span className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center"><Megaphone className="w-[18px] h-[18px]" /></span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>Pengumuman</h3>
          <p className="text-[11px] text-gray-400">Dari pengelola & fasilitator asrama</p>
        </div>
        {daftar.length > 2 && (
          <button type="button" onClick={() => setSemua(v => !v)} className="text-xs font-bold text-gray-600 hover:text-gray-900 cursor-pointer shrink-0">
            {semua ? 'Ringkas' : `Semua (${daftar.length})`}
          </button>
        )}
      </div>
      <div className="p-4 space-y-3">
        {tampil.map(p => <KartuPengumuman key={p.id} p={p} ringkas />)}
      </div>
    </section>
  )
}
