import React, { useState } from 'react'
import type { Gedung, Kamar, Penghuni, GedungInput, KamarInput } from '../types'
import { X, Building2, DoorClosed, AlertCircle, Trash2, BedDouble } from 'lucide-react'
import MapPicker from './MapPicker'

// ----------------------------------------------------
// 1. Modal Tambah / Edit Gedung (Admin)
// ----------------------------------------------------
export interface GedungFormModalProps {
  gedung?: Gedung | null
  fasilList: Penghuni[]
  onClose: () => void
  onSave: (data: GedungInput & { id?: number }) => Promise<{ ok: boolean; message: string }>
}

export function GedungFormModal({
  gedung,
  fasilList,
  onClose,
  onSave,
}: GedungFormModalProps) {
  const isEdit = Boolean(gedung)

  const [nama, setNama] = useState(gedung?.nama ?? '')
  const [jenis, setJenis] = useState<'Putra' | 'Putri'>(gedung?.jenis ?? 'Putra')
  const [nimPj, setNimPj] = useState<string | null>(gedung?.nimPj ?? null)
  // Fasil PJ harus sesuai jenis gedung: putra -> laki-laki, putri -> perempuan
  const jkGedung = jenis === 'Putri' ? 'P' : 'L'
  const fasilCocok = fasilList.filter(f => !f.jenisKelamin || f.jenisKelamin === jkGedung)
  const gantiJenis = (j: 'Putra' | 'Putri') => {
    setJenis(j)
    const pj = fasilList.find(f => f.nim === nimPj)
    if (pj?.jenisKelamin && pj.jenisKelamin !== (j === 'Putri' ? 'P' : 'L')) setNimPj(null)
  }
  const [latitude, setLatitude] = useState<number | null>(gedung?.latitude ?? -0.914488)
  const [longitude, setLongitude] = useState<number | null>(gedung?.longitude ?? 100.466542)
  const [radiusMeter, setRadiusMeter] = useState(gedung?.radiusMeter ?? 50)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    if (!nama.trim()) {
      setErrorMsg('Nama gedung wajib diisi.')
      return
    }

    setLoading(true)
    const res = await onSave({
      id: gedung?.id,
      nama: nama.trim(),
      jenis,
      nimPj: nimPj || null,
      latitude,
      longitude,
      radiusMeter,
    })
    setLoading(false)

    if (res.ok) {
      onClose()
    } else {
      setErrorMsg(res.message || 'Gagal menyimpan data gedung.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-xl w-full shadow-2xl border border-emerald-100 overflow-hidden my-8 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 modal-header bg-white border-b border-gray-100 text-gray-900 gap-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-10 h-10 shrink-0 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center"><Building2 className="w-5 h-5" /></span>
            <div className="min-w-0">
              <h3 className="text-base font-extrabold text-gray-900 tracking-tight" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                {isEdit ? 'Edit Data Gedung' : 'Tambah Gedung Asrama Baru'}
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Atur nama, penanggung jawab, serta koordinat geofence untuk presensi
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
              Nama Gedung <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Contoh: Asrama Putra C, Asrama Putri B"
              value={nama}
              onChange={e => setNama(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
              Jenis Asrama <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['Putra', 'Putri'] as const).map(j => (
                <button
                  key={j}
                  type="button"
                  onClick={() => gantiJenis(j)}
                  aria-pressed={jenis === j}
                  className={`py-2.5 rounded-xl border text-sm font-bold cursor-pointer transition-colors ${jenis === j ? 'bg-[#141a17] border-[#141a17] text-white' : 'bg-[#fff] border-gray-200 text-gray-700 hover:border-emerald-300'}`}
                >
                  Asrama {j}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-gray-400 mt-1">Penghuni & fasil yang bisa ditempatkan mengikuti jenis ini ({jenis === 'Putri' ? 'perempuan' : 'laki-laki'}).</p>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
              Fasilitator Penanggung Jawab (PJ Gedung)
            </label>
            <select
              value={nimPj ?? ''}
              onChange={e => setNimPj(e.target.value || null)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm bg-white outline-none focus:border-emerald-600 font-medium"
            >
              <option value="">— Belum ditetapkan —</option>
              {fasilCocok.map(f => (
                <option key={f.nim} value={f.nim}>
                  {f.nama} ({f.nim}){f.jenisKelamin ? '' : ' · gender belum diisi'}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-gray-400 mt-1">
              Fasil yang ditunjuk akan memiliki wewenang menyetujui izin dan mengelola event di gedung ini.
            </p>
          </div>

          {/* Map Picker */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
              Titik Pusat & Radius Geofence Gedung (Leaflet Map)
            </label>
            <MapPicker
              latitude={latitude}
              longitude={longitude}
              radiusMeter={radiusMeter}
              onChange={(lat, lng) => { setLatitude(lat); setLongitude(lng) }}
              onRadiusChange={setRadiusMeter}
              height="250px"
              title="Tentukan Koordinat Gedung pada Peta"
            />
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-md shadow-emerald-700/20 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              {loading ? 'Menyimpan...' : isEdit ? 'Simpan Perubahan' : 'Tambah Gedung'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ----------------------------------------------------
// 2. Modal Tambah / Edit Kamar (Admin)
// ----------------------------------------------------
export interface KamarFormModalProps {
  kamar?: Kamar | null
  gedungList: Gedung[]
  // Untuk menampilkan isi kamar & penghuni yang belum dapat kamar (mode edit)
  penghuni?: Penghuni[]
  onTempatkan?: (p: Penghuni, nomorKamar: string) => Promise<{ ok: boolean; message: string }>
  // Keluarkan penghuni dari kamar ini (tetap aktif, tanpa kamar) — langkah pertama pindah kamar
  onKeluarkan?: (p: Penghuni) => Promise<{ ok: boolean; message: string }>
  defaultGedungId?: number
  onClose: () => void
  onSave: (data: KamarInput, isEdit: boolean) => Promise<{ ok: boolean; message: string }>
}

export function KamarFormModal({
  kamar,
  penghuni = [],
  onTempatkan,
  onKeluarkan,
  gedungList,
  defaultGedungId,
  onClose,
  onSave,
}: KamarFormModalProps) {
  const isEdit = Boolean(kamar)

  // Penghuni yang sedang dikonfirmasi untuk dikeluarkan dari kamar
  const [keluarNim, setKeluarNim] = useState<string | null>(null)
  const [nomorKamar, setNomorKamar] = useState(kamar?.nomorKamar ?? '')
  const [idGedung, setIdGedung] = useState<number>(kamar?.idGedung ?? defaultGedungId ?? gedungList[0]?.id ?? 1)
  const [lantai, setLantai] = useState<number>(kamar?.lantai ?? 1)
  const [kapasitas, setKapasitas] = useState<number>(kamar?.kapasitas ?? 2)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    if (!nomorKamar.trim()) {
      setErrorMsg('Nomor kamar wajib diisi.')
      return
    }
    if (lantai < 1) {
      setErrorMsg('Lantai minimal 1.')
      return
    }
    if (kapasitas < 1) {
      setErrorMsg('Kapasitas minimal 1 orang.')
      return
    }
    if (isEdit && kamar && kapasitas < kamar.penghuniCount) {
      setErrorMsg(`Kapasitas (${kapasitas}) tidak boleh lebih kecil dari jumlah penghuni aktif saat ini (${kamar.penghuniCount}).`)
      return
    }

    setLoading(true)
    const res = await onSave(
      {
        nomorKamar: nomorKamar.trim().toUpperCase(),
        idGedung,
        lantai,
        kapasitas,
      },
      isEdit
    )
    setLoading(false)

    if (res.ok) {
      onClose()
    } else {
      setErrorMsg(res.message || 'Gagal menyimpan data kamar.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] flex flex-col shadow-2xl border border-emerald-100 overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="px-6 py-4 modal-header bg-white border-b border-gray-100 text-gray-900 gap-3 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-10 h-10 shrink-0 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center"><BedDouble className="w-5 h-5" /></span>
            <div className="min-w-0">
              <h3 className="text-base font-extrabold text-gray-900 tracking-tight" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                {isEdit ? `Edit Kamar ${kamar?.nomorKamar}` : 'Tambah Kamar Baru'}
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Atur nomor kamar, penempatan gedung, lantai, dan batas kapasitas
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
              Pilih Gedung <span className="text-rose-500">*</span>
            </label>
            <select
              value={idGedung}
              onChange={e => setIdGedung(Number(e.target.value))}
              disabled={isEdit}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm bg-white outline-none focus:border-emerald-600 font-medium disabled:bg-gray-100 disabled:text-gray-500"
            >
              {gedungList.map(g => (
                <option key={g.id} value={g.id}>
                  {g.nama} ({g.jenis})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
              Nomor Kamar <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              disabled={isEdit}
              placeholder="Contoh: 101-PA, 204-PtA"
              value={nomorKamar}
              onChange={e => setNomorKamar(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm uppercase mono outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 font-bold disabled:bg-gray-100 disabled:text-gray-500"
            />
            {isEdit && <p className="text-[11px] text-gray-400 mt-1">Nomor kamar tidak dapat diubah setelah dibuat.</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                Lantai <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min={1}
                max={20}
                required
                value={lantai}
                onChange={e => setLantai(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-emerald-600 font-medium"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                Kapasitas (Orang) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min={1}
                max={10}
                required
                value={kapasitas}
                onChange={e => setKapasitas(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-emerald-600 font-medium"
              />
            </div>
          </div>

          {isEdit && kamar && (() => {
            const gedungKamar = gedungList.find(g => g.id === kamar.idGedung)
            const jk = gedungKamar?.jenis === 'Putri' ? 'P' : 'L'
            const isi = penghuni.filter(p => p.statusAktif && p.nomorKamar === kamar.nomorKamar)
            // Hanya akun aktif: akun nonaktif (sudah keluar asrama) juga tanpa kamar tetapi bukan untuk ditempatkan
            const tanpaKamar = penghuni.filter(p => p.statusAktif && !p.nomorKamar && (!p.jenisKelamin || p.jenisKelamin === jk))
            const sisa = kapasitas - isi.length
            return (
              <div className="space-y-3">
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-3.5 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between text-xs">
                    <span className="font-bold text-gray-800">Penghuni di kamar ini</span>
                    <span className={`font-bold tabular-nums ${sisa <= 0 ? 'text-rose-600' : 'text-gray-500'}`}>{isi.length}/{kapasitas}</span>
                  </div>
                  {isi.length === 0 ? (
                    <p className="px-3.5 py-3 text-xs text-gray-400">Kamar masih kosong.</p>
                  ) : (
                    <ul className="divide-y divide-gray-100">
                      {isi.map(p => (
                        <li key={p.nim} className="px-3.5 py-2 flex items-center justify-between gap-2 text-xs">
                          <span className="min-w-0">
                            <span className="block font-semibold text-gray-900 truncate">{p.nama}</span>
                            <span className="block mono text-[11px] text-gray-500">{p.nim}</span>
                          </span>
                          <span className="flex items-center gap-1.5 shrink-0">
                            <span className="px-2 py-0.5 rounded-md bg-gray-100 text-[11px] font-semibold text-gray-600">{p.role === 'fasil' ? 'Fasil' : 'Penghuni'}</span>
                            {onKeluarkan && (keluarNim === p.nim ? (
                              <>
                                <button type="button" onClick={() => setKeluarNim(null)} className="px-2 py-1 rounded-lg text-[11px] font-bold text-gray-600 bg-[#fff] border border-gray-200 cursor-pointer">Batal</button>
                                <button
                                  type="button"
                                  disabled={loading}
                                  onClick={async () => {
                                    setErrorMsg('')
                                    const r = await onKeluarkan(p)
                                    if (!r.ok) setErrorMsg(r.message)
                                    setKeluarNim(null)
                                  }}
                                  className="px-2 py-1 rounded-lg text-[11px] font-bold text-white bg-amber-700 hover:bg-amber-800 cursor-pointer disabled:opacity-50"
                                >
                                  Ya, keluarkan
                                </button>
                              </>
                            ) : (
                              <button type="button" onClick={() => setKeluarNim(p.nim)}
                                className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-amber-800 bg-[#fff] border border-amber-200 hover:bg-amber-50 cursor-pointer"
                                title={`Keluarkan ${p.nama} dari kamar ini`}>
                                Keluarkan
                              </button>
                            ))}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-3.5 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between text-xs">
                    <span className="font-bold text-gray-800">Belum dapat kamar</span>
                    <span className="text-gray-500">{jk === 'P' ? 'perempuan' : 'laki-laki'} · {tanpaKamar.length} orang</span>
                  </div>
                  {tanpaKamar.length === 0 ? (
                    <p className="px-3.5 py-3 text-xs text-gray-400">Tidak ada penghuni {jk === 'P' ? 'perempuan' : 'laki-laki'} yang menunggu kamar.</p>
                  ) : (
                    <ul className="divide-y divide-gray-100 max-h-48 overflow-y-auto">
                      {tanpaKamar.map(p => (
                        <li key={p.nim} className="px-3.5 py-2 flex items-center justify-between gap-2 text-xs">
                          <span className="min-w-0">
                            <span className="block font-semibold text-gray-900 truncate">{p.nama}</span>
                            <span className="block mono text-[11px] text-gray-500">{p.nim}{p.jenisKelamin ? '' : ' · gender belum diisi'}</span>
                          </span>
                          {onTempatkan && (
                            <button
                              type="button"
                              disabled={sisa <= 0 || loading}
                              onClick={async () => {
                                setErrorMsg('')
                                const r = await onTempatkan(p, kamar.nomorKamar)
                                if (!r.ok) setErrorMsg(r.message)
                              }}
                              className="shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-bold text-emerald-800 bg-[#fff] border border-emerald-200 hover:bg-emerald-50 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                              title={sisa <= 0 ? 'Kamar sudah penuh' : `Tempatkan ${p.nama} di kamar ini`}
                            >
                              Tempatkan
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )
          })()}

          {/* Actions */}
          <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-md shadow-emerald-700/20 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              {loading ? 'Menyimpan...' : isEdit ? 'Simpan Perubahan' : 'Tambah Kamar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
