import React, { useState, useEffect } from 'react'
import type { EventAsrama, EventInput, Gedung, RekapEventResult, PesertaRekapEvent, ModeUji } from '../types'
import { X, Calendar, Clock, MapPin, Building2, CheckCircle2, XCircle, AlertCircle, Camera, Search, Download, UserCheck, ShieldAlert, Sparkles, CalendarPlus, CalendarDays, ScanFace, ImagePlus, RefreshCw, Trash2 } from 'lucide-react'
import MapPicker from './MapPicker'
import DateInput from './DateInput'
import TimeInput from './TimeInput'
import KameraWajah from './KameraWajah'
import { getCurrentPosition, distanceMeters } from '../geo'
import { downloadReport, type ExportFormat } from '../ekspor'
import Pratinjau from './Pratinjau'
import { useSampulEvent } from './KartuEvent'

// Perkecil gambar sampul di browser (maks. 1600 px, JPEG) agar unggahan ringan
function kecilkanGambar(file: File, lebarMaks = 1600, mutu = 0.82): Promise<string> {
  return new Promise((selesai, gagal) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const skala = Math.min(1, lebarMaks / img.naturalWidth)
      const c = document.createElement('canvas')
      c.width = Math.round(img.naturalWidth * skala)
      c.height = Math.round(img.naturalHeight * skala)
      c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      selesai(c.toDataURL('image/jpeg', mutu))
    }
    img.onerror = () => { URL.revokeObjectURL(url); gagal(new Error('Berkas bukan gambar yang valid.')) }
    img.src = url
  })
}
import { fetchFotoEvent, fetchFotoWajah, fotoWajahUrl } from '../api'

// ----------------------------------------------------
// 1. Modal Form Tambah / Edit Event
// ----------------------------------------------------
export interface EventFormModalProps {
  event?: EventAsrama | null
  gedungList: Gedung[]
  role: 'admin' | 'fasil'
  fasilIdGedung?: number | null
  onClose: () => void
  onSave: (data: EventInput) => Promise<{ ok: boolean; message: string }>
}

export function EventFormModal({
  event,
  gedungList,
  role,
  fasilIdGedung,
  onClose,
  onSave,
}: EventFormModalProps) {
  const isEdit = Boolean(event)

  const defaultGedungId = role === 'fasil' ? (fasilIdGedung ?? gedungList[0]?.id ?? null) : (event?.idGedung ?? null)
  const defaultTipe = role === 'fasil' ? 'gedung' : (event?.tipe ?? 'seluruh')

  const [judul, setJudul] = useState(event?.judul ?? '')
  const [deskripsi, setDeskripsi] = useState(event?.deskripsi ?? '')
  const [tipe, setTipe] = useState<'seluruh' | 'gedung'>(defaultTipe)
  const [idGedung, setIdGedung] = useState<number | null>(defaultGedungId)
  const [tanggal, setTanggal] = useState(event?.tanggal ?? new Intl.DateTimeFormat('en-CA').format(new Date()))
  const [jamMulai, setJamMulai] = useState(event?.jamMulai ?? '19:30')
  const [jamSelesai, setJamSelesai] = useState(event?.jamSelesai ?? '21:30')
  const [lokasi, setLokasi] = useState(event?.lokasi ?? '')
  const [latitude, setLatitude] = useState<number | null>(event?.latitude ?? -0.914488)
  const [longitude, setLongitude] = useState<number | null>(event?.longitude ?? 100.466542)
  const [radiusMeter, setRadiusMeter] = useState(event?.radiusMeter ?? 50)
  // Foto sampul: data URL baru (bila dipilih) atau tandai hapus sampul lama
  const [sampulBaru, setSampulBaru] = useState<string | null>(null)
  const [hapusSampul, setHapusSampul] = useState(false)
  const [memprosesSampul, setMemprosesSampul] = useState(false)
  const sampulLama = useSampulEvent(hapusSampul ? null : event?.fotoSampul)
  const pratinjauSampul = sampulBaru ?? sampulLama
  const pilihSampul = async (file: File | undefined) => {
    if (!file) return
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      setErrorMsg('Foto sampul harus berformat JPG, PNG, atau WEBP.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('Ukuran foto sampul maksimal 10 MB.')
      return
    }
    setErrorMsg('')
    setMemprosesSampul(true)
    try {
      setSampulBaru(await kecilkanGambar(file))
      setHapusSampul(false)
    } catch (e) {
      setErrorMsg((e as Error).message)
    }
    setMemprosesSampul(false)
  }
  const buangSampul = () => {
    setSampulBaru(null)
    if (event?.fotoSampul) setHapusSampul(true)
  }
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')

    if (!judul.trim()) {
      setErrorMsg('Judul event wajib diisi.')
      return
    }
    if (!tanggal) {
      setErrorMsg('Tanggal event wajib diisi.')
      return
    }
    if (!jamMulai || !jamSelesai) {
      setErrorMsg('Jam mulai dan jam selesai wajib diisi.')
      return
    }
    if (jamSelesai <= jamMulai) {
      setErrorMsg('Jam selesai harus setelah jam mulai.')
      return
    }
    if (!lokasi.trim()) {
      setErrorMsg('Nama lokasi / ruangan wajib diisi.')
      return
    }
    if (tipe === 'gedung' && !idGedung) {
      setErrorMsg('Pilih gedung yang mengadakan event.')
      return
    }

    setLoading(true)
    const res = await onSave({
      judul: judul.trim(),
      deskripsi: deskripsi.trim() || null,
      tipe,
      idGedung: tipe === 'gedung' ? idGedung : null,
      tanggal,
      jamMulai,
      jamSelesai,
      lokasi: lokasi.trim(),
      latitude,
      longitude,
      radiusMeter,
      ...(sampulBaru ? { fotoSampul: sampulBaru } : {}),
      ...(hapusSampul && !sampulBaru ? { hapusSampul: true } : {}),
    })
    setLoading(false)

    if (res.ok) {
      onClose()
    } else {
      setErrorMsg(res.message || 'Gagal menyimpan event.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-emerald-100 overflow-hidden my-8 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 modal-header bg-white border-b border-gray-100 text-gray-900 gap-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-10 h-10 shrink-0 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center"><CalendarPlus className="w-5 h-5" /></span>
            <div className="min-w-0">
              <h3 className="text-base font-extrabold text-gray-900 tracking-tight" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                {isEdit ? 'Edit Event Asrama' : 'Buat Event Asrama Baru'}
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {role === 'admin'
                  ? 'Kelola event untuk seluruh penghuni asrama atau gedung spesifik'
                  : 'Kelola event kegiatan untuk penghuni gedung binaan Anda'}
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4.5 overflow-y-auto">
          {errorMsg && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Judul & Deskripsi */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
              Judul Event <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Contoh: Kajian Rutin Bulanan, Gotong Royong Gedung"
              value={judul}
              onChange={e => setJudul(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
              Deskripsi Singkat / Agenda
            </label>
            <textarea
              rows={2}
              placeholder="Jelaskan tujuan, perlengkapan yang perlu dibawa, atau catatan bagi peserta..."
              value={deskripsi}
              onChange={e => setDeskripsi(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 resize-none font-medium"
            />
          </div>

          {/* Foto sampul (opsional) */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
              Foto Sampul <span className="normal-case tracking-normal font-medium text-gray-400">(opsional)</span>
            </label>
            {pratinjauSampul ? (
              <div className="relative rounded-xl overflow-hidden border border-gray-200 bg-gray-100 aspect-[3/1]">
                <img src={pratinjauSampul} alt="Pratinjau foto sampul" className="w-full h-full object-cover" />
                <div className="absolute right-2 bottom-2 flex gap-1.5">
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/95 text-xs font-bold text-gray-800 shadow-sm hover:bg-white cursor-pointer">
                    <RefreshCw className="w-3.5 h-3.5" />Ganti
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => { pilihSampul(e.target.files?.[0]); e.target.value = '' }} />
                  </label>
                  <button type="button" onClick={buangSampul} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/95 text-xs font-bold text-rose-700 shadow-sm hover:bg-white cursor-pointer">
                    <Trash2 className="w-3.5 h-3.5" />Hapus
                  </button>
                </div>
              </div>
            ) : (
              <label
                className={`flex flex-col items-center justify-center gap-1.5 aspect-[3/1] rounded-xl border-2 border-dashed border-gray-200 bg-gray-50/60 text-center px-4 transition-colors ${memprosesSampul ? 'opacity-60' : 'hover:border-emerald-400 hover:bg-emerald-50/40 cursor-pointer'}`}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); pilihSampul(e.dataTransfer.files?.[0]) }}
              >
                <span className="w-10 h-10 rounded-xl bg-[#fff] border border-gray-200 flex items-center justify-center text-gray-500"><ImagePlus className="w-5 h-5" /></span>
                <span className="text-xs font-bold text-gray-700">{memprosesSampul ? 'Memproses foto…' : 'Pilih atau seret foto sampul'}</span>
                <span className="text-[11px] text-gray-400">JPG, PNG, atau WEBP · tampil sebagai cover di kartu event</span>
                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={memprosesSampul} onChange={e => { pilihSampul(e.target.files?.[0]); e.target.value = '' }} />
              </label>
            )}
            {hapusSampul && !sampulBaru && <p className="text-[11px] text-amber-700 font-semibold mt-1.5">Sampul lama akan dihapus saat disimpan.</p>}
          </div>

          {/* Cakupan Peserta (Admin can choose seluruh or gedung; Fasil only gedung) */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                Cakupan Event <span className="text-rose-500">*</span>
              </label>
              {role === 'admin' ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setTipe('seluruh'); setIdGedung(null) }}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      tipe === 'seluruh'
                        ? 'bg-emerald-50 border-emerald-600 text-emerald-900 shadow-xs'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    Seluruh Asrama
                  </button>
                  <button
                    type="button"
                    onClick={() => { setTipe('gedung'); if (!idGedung) setIdGedung(gedungList[0]?.id ?? null) }}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      tipe === 'gedung'
                        ? 'bg-slate-50 border-slate-600 text-slate-900 shadow-xs'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    Gedung Spesifik
                  </button>
                </div>
              ) : (
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-slate-700" />
                  <span>Event Khusus Gedung Binaan</span>
                </div>
              )}
            </div>

            {tipe === 'gedung' && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                  Pilih Gedung <span className="text-rose-500">*</span>
                </label>
                {role === 'admin' ? (
                  <select
                    value={idGedung ?? ''}
                    onChange={e => setIdGedung(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm bg-white outline-none focus:border-emerald-600 font-medium"
                  >
                    {gedungList.map(g => (
                      <option key={g.id} value={g.id}>
                        {g.nama} ({g.jenis})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm font-semibold text-gray-800">
                    {gedungList.find(g => g.id === idGedung)?.nama || 'Gedung Binaan Fasil'}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Tanggal & Waktu */}
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                Tanggal Event <span className="text-rose-500">*</span>
              </label>
              <DateInput value={tanggal} onChange={e => setTanggal(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                Jam Mulai <span className="text-rose-500">*</span>
              </label>
              <TimeInput value={jamMulai} onChange={e => setJamMulai(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                Jam Selesai <span className="text-rose-500">*</span>
              </label>
              <TimeInput value={jamSelesai} onChange={e => setJamSelesai(e.target.value)} />
            </div>
          </div>

          {/* Nama Lokasi */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
              Nama Tempat / Ruangan <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Contoh: Masjid Nurul Ilmi Asrama, Aula Utama, Lapangan Futsal"
              value={lokasi}
              onChange={e => setLokasi(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/10 font-medium"
            />
          </div>

          {/* Titik Peta & Radius Geofence */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
              Titik Koordinat & Radius Presensi (Peta Interaktif)
            </label>
            <p className="text-[11px] text-gray-500 mb-2">
              Tentukan titik tengah lokasi acara. Penghuni wajib berada dalam radius ini saat melakukan presensi event.
            </p>
            <MapPicker
              latitude={latitude}
              longitude={longitude}
              radiusMeter={radiusMeter}
              onChange={(lat, lng) => { setLatitude(lat); setLongitude(lng) }}
              onRadiusChange={setRadiusMeter}
              height="260px"
              title="Pilih Titik Acara pada Peta"
            />
          </div>

          {/* Action Buttons */}
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
              {loading ? 'Menyimpan...' : isEdit ? 'Simpan Perubahan' : 'Buat Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ----------------------------------------------------
// 2. Modal Rekap Kehadiran Event (Admin & Fasil)
// ----------------------------------------------------
export interface EventRekapModalProps {
  rekap: RekapEventResult
  onClose: () => void
}

export function EventRekapModal({ rekap, onClose }: EventRekapModalProps) {
  const { event, statistik, peserta } = rekap
  const [filterStatus, setFilterStatus] = useState<string>('semua')
  const [cari, setCari] = useState('')
  const [fotoModal, setFotoModal] = useState<{ nama: string; foto: string } | null>(null)

  const filtered = peserta.filter(p => {
    if (filterStatus !== 'semua' && p.status !== filterStatus) return false
    if (cari.trim()) {
      const q = cari.toLowerCase()
      return p.nama.toLowerCase().includes(q) || p.nim.toLowerCase().includes(q) || p.nomorKamar.toLowerCase().includes(q)
    }
    return true
  })

  const handleEkspor = (format: ExportFormat) => {
    const headers = ['NIM', 'Nama Mahasiswa', 'Gedung', 'Kamar', 'Status Kehadiran', 'Waktu Presensi', 'Jarak (Meter)', 'Keterangan']
    const rows = filtered.map(p => [
      p.nim,
      p.nama,
      p.namaGedung,
      p.nomorKamar,
      p.status,
      p.waktu || '-',
      p.jarakMeter !== null ? `${p.jarakMeter} m` : '-',
      p.keterangan || '-',
    ])
    downloadReport(`Rekap_Event_${event.judul.replace(/\s+/g, '_')}.${format}`, headers, rows, format, `Rekap Kehadiran Event: ${event.judul}`)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-emerald-100 overflow-hidden my-8 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 modal-header bg-white border-b border-gray-100 text-gray-900 gap-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-10 h-10 shrink-0 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center"><CalendarDays className="w-5 h-5" /></span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${event.tipe === 'seluruh' ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-50 text-slate-800'}`}>
                  {event.tipe === 'seluruh' ? 'Seluruh Asrama' : `Gedung ${event.namaGedung || ''}`}
                </span>
                <span className="text-xs text-gray-500">
                  {event.tanggal} · {event.jamMulai}–{event.jamSelesai} WIB
                </span>
              </div>
              <h3 className="text-base font-extrabold text-gray-900 tracking-tight mt-1" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                {event.judul}
              </h3>
              <p className="text-xs text-gray-500/90 flex items-center gap-1.5 mt-0.5">
                <MapPin className="w-3.5 h-3.5" />
                {event.lokasi} (Radius: {event.radiusMeter} m)
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

        {/* Stats Row */}
        <div className="p-6 bg-emerald-50/50 border-b border-emerald-100 grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
          <div className="bg-white p-3.5 rounded-xl border border-emerald-100 shadow-xs">
            <span className="text-[11px] font-bold text-gray-500 uppercase">Total Peserta Wajib</span>
            <div className="text-xl font-extrabold text-gray-900 mt-0.5">{statistik.totalPeserta}</div>
          </div>
          <div className="bg-white p-3.5 rounded-xl border border-emerald-100 shadow-xs">
            <span className="text-[11px] font-bold text-emerald-700 uppercase">Hadir ({statistik.persenHadir}%)</span>
            <div className="text-xl font-extrabold text-emerald-800 mt-0.5 flex items-center gap-1.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>{statistik.hadir}</span>
            </div>
          </div>
          <div className="bg-white p-3.5 rounded-xl border border-emerald-100 shadow-xs">
            <span className="text-[11px] font-bold text-rose-700 uppercase">Tidak Hadir (Alpa)</span>
            <div className="text-xl font-extrabold text-rose-800 mt-0.5 flex items-center gap-1.5">
              <XCircle className="w-5 h-5 text-rose-600" />
              <span>{statistik.tidakHadir}</span>
            </div>
          </div>
          <div className="bg-white p-3.5 rounded-xl border border-emerald-100 shadow-xs">
            <span className="text-[11px] font-bold text-amber-700 uppercase">Belum Absen</span>
            <div className="text-xl font-extrabold text-amber-800 mt-0.5 flex items-center gap-1.5">
              <AlertCircle className="w-5 h-5 text-amber-600" />
              <span>{statistik.belumAbsen}</span>
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="px-6 py-3 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3 bg-white shrink-0">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari nama, NIM, kamar..."
                value={cari}
                onChange={e => setCari(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-lg border border-gray-200 text-xs outline-none focus:border-emerald-600 w-48 sm:w-60"
              />
            </div>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs bg-white outline-none focus:border-emerald-600 font-medium"
            >
              <option value="semua">Semua Status ({peserta.length})</option>
              <option value="Hadir">Hadir ({statistik.hadir})</option>
              <option value="Tidak Hadir">Tidak Hadir ({statistik.tidakHadir})</option>
              <option value="Belum Absen">Belum Absen ({statistik.belumAbsen})</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleEkspor('xlsx')}
              className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-bold text-emerald-800 hover:bg-emerald-50 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Download className="w-3 h-3 text-emerald-700" />
              <span>Excel</span>
            </button>
            <button
              type="button"
              onClick={() => handleEkspor('pdf')}
              className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-bold text-rose-800 hover:bg-rose-50 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Download className="w-3 h-3 text-rose-700" />
              <span>PDF</span>
            </button>
          </div>
        </div>

        {/* Participant Table */}
        <div className="overflow-y-auto flex-1 p-6">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-gray-200 text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-2.5 pr-2">No</th>
                <th className="py-2.5 px-2">Mahasiswa</th>
                <th className="py-2.5 px-2">Kamar & Gedung</th>
                <th className="py-2.5 px-2">Status</th>
                <th className="py-2.5 px-2">Waktu Presensi</th>
                <th className="py-2.5 px-2">Jarak</th>
                <th className="py-2.5 pl-2 text-center">Foto Bukti</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-400 font-medium">
                    Tidak ada data peserta yang cocok.
                  </td>
                </tr>
              ) : (
                filtered.map((p, idx) => (
                  <tr key={p.nim} className="hover:bg-gray-50/80 transition-colors">
                    <td className="py-2.5 pr-2 text-gray-400 font-semibold">{idx + 1}</td>
                    <td className="py-2.5 px-2">
                      <div className="font-bold text-gray-900">{p.nama}</div>
                      <div className="mono text-[11px] text-gray-400">{p.nim}</div>
                    </td>
                    <td className="py-2.5 px-2">
                      <span className="font-semibold text-gray-800">{p.nomorKamar}</span>
                      <span className="text-gray-400 block text-[11px]">{p.namaGedung}</span>
                    </td>
                    <td className="py-2.5 px-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          p.status === 'Hadir'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : p.status === 'Tidak Hadir'
                            ? 'bg-rose-50 text-rose-800 border border-rose-200'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {p.status === 'Hadir' && <CheckCircle2 className="w-3 h-3 text-emerald-600" />}
                        {p.status === 'Tidak Hadir' && <XCircle className="w-3 h-3 text-rose-600" />}
                        {p.status === 'Belum Absen' && <AlertCircle className="w-3 h-3 text-amber-600" />}
                        {p.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 mono text-gray-600">
                      {p.waktu ? `${p.waktu} WIB` : '—'}
                    </td>
                    <td className="py-2.5 px-2 text-gray-600 font-medium">
                      {p.jarakMeter !== null ? `±${Math.round(p.jarakMeter)} m` : '—'}
                    </td>
                    <td className="py-2.5 pl-2 text-center">
                      {p.foto ? (
                        <button
                          type="button"
                          onClick={() => setFotoModal({ nama: p.nama, foto: p.foto! })}
                          className="px-2 py-1 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-[11px] font-bold cursor-pointer transition-colors"
                        >
                          Lihat Foto
                        </button>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500 shrink-0">
          <span>Menampilkan {filtered.length} dari {peserta.length} peserta</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>

      {/* Popup Foto Preview */}
      {fotoModal && (
        <FotoBuktiModal
          namaPenghuni={fotoModal.nama}
          foto={fotoModal.foto}
          onClose={() => setFotoModal(null)}
        />
      )}
    </div>
  )
}

// ----------------------------------------------------
// 3. Modal Absensi Event oleh Penghuni
// ----------------------------------------------------
export interface EventPresensiModalProps {
  event: EventAsrama
  penghuniNim: string
  onClose: () => void
  onSuccess: () => void
  onAbsen: (data: { idEvent: number; latitude: number; longitude: number; foto: string }) => Promise<{ ok: boolean; message: string }>
}

export function EventPresensiModal({
  event,
  onClose,
  onSuccess,
  onAbsen,
}: EventPresensiModalProps) {
  const [foto, setFoto] = useState<string | null>(null)
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)
  const [akurasi, setAkurasi] = useState<number | null>(null)
  const [jarak, setJarak] = useState<number | null>(null)
  const [bacaGps, setBacaGps] = useState(true)
  const [gpsError, setGpsError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [ulang, setUlang] = useState(0)
  const punyaTitik = event.latitude !== null && event.longitude !== null
  const absenUlang = event.presensiSaya?.statusFoto === 'Ditolak'

  // Baca GPS penghuni (diulang saat tombol "Perbarui" ditekan)
  useEffect(() => {
    let aktif = true
    setBacaGps(true)
    setGpsError(null)
    getCurrentPosition()
      .then(pos => {
        if (!aktif) return
        setLat(pos.latitude)
        setLng(pos.longitude)
        setAkurasi(pos.accuracy)
        setJarak(event.latitude !== null && event.longitude !== null ? distanceMeters(pos.latitude, pos.longitude, event.latitude, event.longitude) : 0)
      })
      .catch(err => { if (aktif) setGpsError((err as Error).message) })
      .finally(() => { if (aktif) setBacaGps(false) })
    return () => { aktif = false }
  }, [event.latitude, event.longitude, ulang])

  // Esc menutup modal (kecuali sedang mengirim)
  useEffect(() => {
    const tutup = (e: KeyboardEvent) => { if (e.key === 'Escape' && !loading) onClose() }
    window.addEventListener('keydown', tutup)
    return () => window.removeEventListener('keydown', tutup)
  }, [onClose, loading])

  const diLuarRadius = punyaTitik && jarak !== null && jarak > event.radiusMeter
  const lokasiSiap = lat !== null && lng !== null && !bacaGps
  const barPct = jarak !== null && event.radiusMeter > 0 ? Math.min(100, (jarak / (event.radiusMeter * 2)) * 100) : 0

  const handleKirim = async () => {
    setErrorMsg('')
    if (lat === null || lng === null) {
      setErrorMsg('Lokasi GPS Anda belum terbaca. Aktifkan GPS dan izin lokasi browser.')
      return
    }
    if (diLuarRadius) {
      setErrorMsg(`Anda berada di luar radius lokasi acara (${Math.round(jarak ?? 0)} m, maksimal ${event.radiusMeter} m). Mohon mendekat ke lokasi.`)
      return
    }
    if (!foto) {
      setErrorMsg('Foto wajah wajib diambil.')
      return
    }
    setLoading(true)
    const res = await onAbsen({ idEvent: event.id, latitude: lat, longitude: lng, foto })
    setLoading(false)
    if (res.ok) {
      onSuccess()
      onClose()
    } else {
      setErrorMsg(res.message || 'Gagal melakukan presensi.')
    }
  }

  const labelTombol = loading ? 'Mengirim…'
    : bacaGps ? 'Membaca lokasi…'
    : !lokasiSiap ? 'Lokasi belum terbaca'
    : diLuarRadius ? 'Di luar radius acara'
    : !foto ? 'Ambil foto terlebih dahulu'
    : absenUlang ? 'Kirim Absen Ulang' : 'Kirim Presensi Hadir'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/50 backdrop-blur-xs motion-safe:[animation:lg-pudar_0.2s_ease-out]"
      role="dialog"
      aria-modal="true"
      aria-label={`Presensi event ${event.judul}`}
    >
      <div className="bg-[#fff] rounded-2xl w-full max-w-3xl max-h-[94vh] flex flex-col shadow-2xl border border-gray-200 overflow-hidden motion-safe:[animation:lg-muncul_0.3s_cubic-bezier(0.22,1,0.36,1)]">
        {/* Header */}
        <div className="px-5 py-4 modal-header bg-[#fff] border-b border-gray-100 text-gray-900 gap-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-10 h-10 shrink-0 rounded-xl bg-gray-100 text-gray-700 flex items-center justify-center"><ScanFace className="w-5 h-5" /></span>
            <div className="min-w-0">
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{absenUlang ? 'Absen ulang event' : 'Presensi event'}</span>
              <h3 className="text-base font-extrabold text-gray-900 tracking-tight truncate" style={{ fontFamily: 'Plus Jakarta Sans' }}>{event.judul}</h3>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={loading} className="p-1.5 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer" aria-label="Tutup">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 grid md:grid-cols-2 gap-5">
          {/* Kolom kiri: kamera */}
          <div className="flex flex-col gap-2 min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-700">Foto wajah <span className="text-rose-500">*</span></p>
            <KameraWajah foto={foto} onChange={setFoto} disabled={loading} />
            <p className="text-[11px] text-gray-400">Foto akan diperiksa fasil. Jika ditolak, Anda bisa absen ulang selama event berlangsung.</p>
          </div>

          {/* Kolom kanan: info acara + lokasi */}
          <div className="flex flex-col gap-4 min-w-0">
            {absenUlang && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs font-medium flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <span>Foto sebelumnya ditolak{event.presensiSaya?.catatanValidasi ? `: "${event.presensiSaya.catatanValidasi}"` : ''}. Ambil foto baru dengan wajah terlihat jelas.</span>
              </div>
            )}

            <dl className="rounded-xl border border-gray-200 divide-y divide-gray-100 text-xs">
              {[
                ['Lokasi acara', event.lokasi],
                ['Jadwal', `${event.jamMulai}–${event.jamSelesai} WIB`],
                ['Radius maksimal', punyaTitik ? `${event.radiusMeter} m dari titik acara` : 'Tanpa batas lokasi'],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                  <dt className="text-gray-500">{k}</dt>
                  <dd className="font-semibold text-gray-900 text-right">{v}</dd>
                </div>
              ))}
            </dl>

            <div className="rounded-xl border border-gray-200 p-3.5 text-xs space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-gray-800 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-gray-500" />Lokasi Anda</span>
                <button
                  type="button"
                  onClick={() => setUlang(n => n + 1)}
                  disabled={bacaGps || loading}
                  className="text-[11px] font-bold text-gray-600 hover:text-gray-900 px-2 py-1 rounded-lg hover:bg-gray-100 cursor-pointer disabled:opacity-50"
                >
                  {bacaGps ? 'Membaca…' : 'Perbarui'}
                </button>
              </div>
              {gpsError ? (
                <p className="text-rose-700 font-semibold flex items-start gap-1.5"><ShieldAlert className="w-4 h-4 shrink-0" /><span>{gpsError}</span></p>
              ) : jarak !== null && punyaTitik ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">Jarak ke titik acara{akurasi !== null ? ` · akurasi ±${Math.round(akurasi)} m` : ''}</span>
                    <span className={`font-extrabold ${diLuarRadius ? 'text-rose-700' : 'text-emerald-700'}`}>{Math.round(jarak)} m</span>
                  </div>
                  <div className="relative h-2 rounded-full bg-gray-200 overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${diLuarRadius ? 'bg-rose-500' : 'bg-emerald-600'}`} style={{ width: `${barPct}%` }} />
                    <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-gray-500" />
                  </div>
                  <p className={`font-semibold ${diLuarRadius ? 'text-rose-700' : 'text-emerald-700'}`}>
                    {diLuarRadius ? `${Math.round(jarak - event.radiusMeter)} m di luar batas, silakan mendekat.` : 'Dalam jangkauan acara.'}
                  </p>
                </>
              ) : jarak !== null ? (
                <p className="text-emerald-700 font-semibold">Lokasi terbaca.</p>
              ) : (
                <p className="text-gray-400">Menunggu koordinat…</p>
              )}
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{errorMsg}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-end gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl border border-gray-200 bg-[#fff] text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleKirim}
            disabled={loading || !foto || diLuarRadius || !lokasiSiap}
            className="px-5 py-2.5 rounded-xl bg-[#141a17] hover:bg-[#2a332e] text-white text-xs font-bold shadow-2xs transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <UserCheck className="w-4 h-4" />}
            <span>{labelTombol}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

// ----------------------------------------------------
// 4. Modal Preview Foto Bukti
// ----------------------------------------------------
export function FotoBuktiModal({
  namaPenghuni,
  foto,
  onClose,
}: {
  namaPenghuni: string
  foto: string
  onClose: () => void
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(foto.startsWith('data:') ? foto : null)
  const [gagal, setGagal] = useState(false)

  useEffect(() => {
    let aktif = true
    let dibuat: string | null = null
    if (!foto.startsWith('data:')) {
      fetchFotoEvent(foto).then(url => {
        if (!aktif) { if (url?.startsWith('blob:')) URL.revokeObjectURL(url); return }
        if (url?.startsWith('blob:')) dibuat = url
        setBlobUrl(url)
        setGagal(!url)
      })
    }
    return () => { aktif = false; if (dibuat) URL.revokeObjectURL(dibuat) }
  }, [foto])

  return <Pratinjau judul={`Foto bukti absen · ${namaPenghuni}`} url={blobUrl} gagal={gagal} onClose={onClose} />
}
