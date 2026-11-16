import React, { useState, useEffect } from 'react'
import type { EventAsrama, Gedung, RekapEventResult, PesertaRekapEvent, ModeUji } from '../types'
import { X, Calendar, Clock, MapPin, Building2, CheckCircle2, XCircle, AlertCircle, Camera, Search, Download, UserCheck, ShieldAlert, Sparkles } from 'lucide-react'
import MapPicker from './MapPicker'
import DateInput from './DateInput'
import TimeInput from './TimeInput'
import KameraWajah from './KameraWajah'
import { getCurrentPosition, distanceMeters } from '../geo'
import { downloadReport, type ExportFormat } from '../ekspor'
import { fetchFotoEvent, fotoEventUrl, fetchFotoWajah, fotoWajahUrl } from '../api'

// ----------------------------------------------------
// 1. Modal Form Tambah / Edit Event
// ----------------------------------------------------
export interface EventFormModalProps {
  event?: EventAsrama | null
  gedungList: Gedung[]
  role: 'admin' | 'fasil'
  fasilIdGedung?: number | null
  onClose: () => void
  onSave: (data: Partial<EventAsrama>) => Promise<{ ok: boolean; message: string }>
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
        <div className="px-6 py-4.5 bg-gradient-to-r from-emerald-800 to-emerald-950 text-white flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-lg font-extrabold tracking-tight" style={{ fontFamily: 'Plus Jakarta Sans' }}>
              {isEdit ? 'Edit Event Asrama' : 'Buat Event Asrama Baru'}
            </h3>
            <p className="text-xs text-emerald-200 mt-0.5">
              {role === 'admin'
                ? 'Kelola event untuk seluruh penghuni asrama atau gedung spesifik'
                : 'Kelola event kegiatan untuk penghuni gedung binaan Anda'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-emerald-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
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
                        ? 'bg-purple-50 border-purple-600 text-purple-900 shadow-xs'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    Gedung Spesifik
                  </button>
                </div>
              ) : (
                <div className="p-2.5 bg-purple-50 border border-purple-200 rounded-xl text-xs font-bold text-purple-900 flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-purple-700" />
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
              <DateInput value={tanggal} onChange={setTanggal} />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                Jam Mulai <span className="text-rose-500">*</span>
              </label>
              <TimeInput value={jamMulai} onChange={setJamMulai} />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
                Jam Selesai <span className="text-rose-500">*</span>
              </label>
              <TimeInput value={jamSelesai} onChange={setJamSelesai} />
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
        <div className="px-6 py-4.5 bg-gradient-to-r from-emerald-800 to-emerald-950 text-white flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${event.tipe === 'seluruh' ? 'bg-emerald-500/30 text-emerald-100' : 'bg-purple-500/30 text-purple-100'}`}>
                {event.tipe === 'seluruh' ? 'Seluruh Asrama' : `Gedung ${event.namaGedung || ''}`}
              </span>
              <span className="text-xs text-emerald-200">
                {event.tanggal} · {event.jamMulai}–{event.jamSelesai} WIB
              </span>
            </div>
            <h3 className="text-lg font-extrabold tracking-tight mt-1" style={{ fontFamily: 'Plus Jakarta Sans' }}>
              {event.judul}
            </h3>
            <p className="text-xs text-emerald-200/90 flex items-center gap-1.5 mt-0.5">
              <MapPin className="w-3.5 h-3.5" />
              {event.lokasi} (Radius: {event.radiusMeter} m)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-emerald-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
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
  penghuniNim,
  onClose,
  onSuccess,
  onAbsen,
}: EventPresensiModalProps) {
  const [foto, setFoto] = useState<string | null>(null)
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)
  const [jarak, setJarak] = useState<number | null>(null)
  const [bacaGps, setBacaGps] = useState(true)
  const [gpsError, setGpsError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Baca GPS Penghuni
  useEffect(() => {
    let aktif = true
    const cekLokasi = async () => {
      setBacaGps(true)
      setGpsError(null)
      try {
        const pos = await getCurrentPosition()
        if (!aktif) return
        setLat(pos.latitude)
        setLng(pos.longitude)

        if (event.latitude !== null && event.longitude !== null) {
          const d = distanceMeters(pos.latitude, pos.longitude, event.latitude, event.longitude)
          setJarak(d)
        } else {
          setJarak(0)
        }
      } catch (err) {
        if (!aktif) return
        setGpsError((err as Error).message)
      } finally {
        if (aktif) setBacaGps(false)
      }
    }
    cekLokasi()
    return () => { aktif = false }
  }, [event.latitude, event.longitude])

  const diLuarRadius = event.latitude !== null && event.longitude !== null && jarak !== null && jarak > event.radiusMeter

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
      setErrorMsg('Foto wajah selfie wajib diambil.')
      return
    }

    setLoading(true)
    const res = await onAbsen({
      idEvent: event.id,
      latitude: lat,
      longitude: lng,
      foto,
    })
    setLoading(false)

    if (res.ok) {
      onSuccess()
      onClose()
    } else {
      setErrorMsg(res.message || 'Gagal melakukan presensi.')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-emerald-100 overflow-hidden my-6">
        {/* Header */}
        <div className="px-6 py-4.5 bg-gradient-to-r from-emerald-800 to-emerald-950 text-white flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-emerald-300 uppercase tracking-wider">Presensi Event Asrama</span>
            <h3 className="text-base font-extrabold tracking-tight" style={{ fontFamily: 'Plus Jakarta Sans' }}>
              {event.judul}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-emerald-200 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Info Waktu & Radius */}
          <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-100 space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-gray-500 font-medium">Lokasi Acara</span>
              <span className="font-bold text-emerald-950 text-right">{event.lokasi}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500 font-medium">Jadwal</span>
              <span className="font-bold text-emerald-900">{event.jamMulai}–{event.jamSelesai} WIB</span>
            </div>
            <div className="flex justify-between items-center border-t border-emerald-100/80 pt-2">
              <span className="text-gray-500 font-medium">Radius Maksimal</span>
              <span className="font-bold text-emerald-950">{event.radiusMeter} Meter</span>
            </div>
          </div>

          {/* Status GPS Penghuni */}
          <div className="p-3.5 rounded-xl border border-gray-100 bg-gray-50 text-xs">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-bold uppercase tracking-wider text-gray-700 text-[11px] flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-700" />
                Validasi Lokasi Anda
              </span>
              {bacaGps && <span className="text-[11px] text-amber-700 font-semibold animate-pulse">Membaca GPS...</span>}
            </div>

            {gpsError ? (
              <div className="text-rose-700 font-semibold text-[11px] flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{gpsError}</span>
              </div>
            ) : jarak !== null ? (
              <div className="flex items-center justify-between">
                <span className="text-gray-600 font-medium">Jarak ke titik acara:</span>
                <span className={`font-extrabold ${diLuarRadius ? 'text-rose-700' : 'text-emerald-700'}`}>
                  {Math.round(jarak)} meter {diLuarRadius ? '(Di Luar Radius)' : '(Dalam Jangkauan)'}
                </span>
              </div>
            ) : (
              <span className="text-gray-400">Menunggu koordinat...</span>
            )}

            {diLuarRadius && (
              <p className="mt-1.5 text-[11px] text-rose-700 font-medium">
                Anda berada {Math.round(jarak! - event.radiusMeter)} m di luar batas. Silakan mendekat ke lokasi acara.
              </p>
            )}
          </div>

          {/* Kamera Selfie */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-700 mb-1.5">
              Ambil Foto Wajah (Swafoto) <span className="text-rose-500">*</span>
            </label>
            <KameraWajah foto={foto} onChange={setFoto} disabled={loading} />
          </div>

          {/* Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleKirim}
              disabled={loading || !foto || diLuarRadius || bacaGps}
              className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-md shadow-emerald-700/20 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              <UserCheck className="w-4 h-4" />
              <span>{loading ? 'Mengirim Presensi...' : 'Kirim Presensi Hadir'}</span>
            </button>
          </div>
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

  useEffect(() => {
    let aktif = true
    if (!foto.startsWith('data:')) {
      fetchFotoEvent(foto).then(url => {
        if (aktif) setBlobUrl(url)
      })
    }
    return () => { aktif = false }
  }, [foto])

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-sm w-full overflow-hidden shadow-2xl border border-gray-100 animate-in fade-in zoom-in-95">
        <div className="p-4 bg-emerald-900 text-white flex items-center justify-between">
          <div className="font-bold text-sm">Foto Bukti: {namaPenghuni}</div>
          <button type="button" onClick={onClose} className="p-1 rounded-lg text-emerald-200 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 flex items-center justify-center bg-gray-950">
          {blobUrl ? (
            <img src={blobUrl} alt={namaPenghuni} className="w-full aspect-[4/3] object-cover rounded-xl" />
          ) : (
            <div className="w-full aspect-[4/3] flex items-center justify-center text-gray-400 text-xs font-medium">
              Memuat foto...
            </div>
          )}
        </div>
        <div className="p-3 bg-gray-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-gray-200 hover:bg-gray-300 text-xs font-bold text-gray-800 cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}
