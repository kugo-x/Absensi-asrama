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
  const [nimPj, setNimPj] = useState<string | null>(gedung?.nimPj ?? null)
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
              Fasilitator Penanggung Jawab (PJ Gedung)
            </label>
            <select
              value={nimPj ?? ''}
              onChange={e => setNimPj(e.target.value || null)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm bg-white outline-none focus:border-emerald-600 font-medium"
            >
              <option value="">— Belum ditetapkan —</option>
              {fasilList.map(f => (
                <option key={f.nim} value={f.nim}>
                  {f.nama} ({f.nim})
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
  defaultGedungId?: number
  onClose: () => void
  onSave: (data: KamarInput, isEdit: boolean) => Promise<{ ok: boolean; message: string }>
}

export function KamarFormModal({
  kamar,
  gedungList,
  defaultGedungId,
  onClose,
  onSave,
}: KamarFormModalProps) {
  const isEdit = Boolean(kamar)

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
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-emerald-100 overflow-hidden animate-in fade-in zoom-in-95">
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
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

          {isEdit && kamar && (
            <div className="p-3 bg-slate-50/70 border border-slate-100 rounded-xl text-xs text-slate-900 flex justify-between items-center">
              <span>Penghuni aktif saat ini:</span>
              <span className="font-extrabold">{kamar.penghuniCount} orang</span>
            </div>
          )}

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
