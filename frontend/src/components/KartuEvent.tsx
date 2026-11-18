import { useEffect, useState, type ReactNode } from 'react'
import { CalendarDays, Clock, Edit, MapPin, Trash2, User } from 'lucide-react'
import type { EventAsrama } from '../types'
import { formatTanggal } from '../logic'
import { fetchSampulEvent } from '../api'

/** Blob URL foto sampul event (null selama dimuat / tidak ada / gagal) */
export function useSampulEvent(nama: string | null | undefined): string | null {
  const [src, setSrc] = useState<string | null>(nama?.startsWith('data:') ? nama : null)
  useEffect(() => {
    let aktif = true
    let timer: ReturnType<typeof setTimeout> | undefined
    setSrc(nama?.startsWith('data:') ? nama : null)
    // Server sibuk / jaringan putus: coba lagi beberapa kali agar sampul tidak hilang permanen
    const muat = (sisa: number) => {
      fetchSampulEvent(nama).then(u => {
        if (!aktif) return
        if (u) setSrc(u)
        else if (nama && sisa > 0) timer = setTimeout(() => muat(sisa - 1), 3000)
      })
    }
    muat(3)
    return () => { aktif = false; if (timer) clearTimeout(timer) }
  }, [nama])
  return src
}

export type StatusEvent = 'Akan Datang' | 'Sedang Berlangsung' | 'Selesai'

const BULAN = ['JAN', 'FEB', 'MAR', 'APR', 'MEI', 'JUN', 'JUL', 'AGU', 'SEP', 'OKT', 'NOV', 'DES']

/**
 * Kartu event bergaya "sampul": pita warna dengan status & cakupan, blok tanggal besar,
 * lalu judul, ringkasan, waktu & lokasi. Isi bawah (aksi/CTA) diberikan lewat children.
 */
export default function KartuEvent({ ev, status, onEdit, onHapus, kehadiran, penyelenggara, sorot = false, children }: {
  ev: EventAsrama
  status: StatusEvent
  onEdit?: () => void
  onHapus?: () => void
  kehadiran?: ReactNode // badge kehadiran penghuni (opsional)
  penyelenggara?: string
  sorot?: boolean // diberi bingkai amber (mis. presensi sedang dibuka & belum absen)
  children?: ReactNode
}) {
  const [, m, d] = ev.tanggal.split('-')
  const selesai = status === 'Selesai'
  const sampul = useSampulEvent(ev.fotoSampul)

  return (
    <div
      className={`group bg-white rounded-2xl border shadow-xs hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 overflow-hidden flex flex-col ${
        sorot ? 'border-amber-300 ring-2 ring-amber-300/40' : 'border-gray-200/90'
      }`}
    >
      {/* Sampul */}
      <div
        className={`relative h-32 px-4 pt-3.5 ${
          sampul ? 'bg-gray-800' : selesai ? 'bg-gradient-to-br from-[#3b4540] to-[#6b7570]' : 'bg-gradient-to-br from-[#0f3e2d] via-[#17603d] to-[#27a150]'
        }`}
      >
        {sampul ? (
          <>
            <img src={sampul} alt={`Sampul ${ev.judul}`} className={`absolute inset-0 w-full h-full object-cover ${selesai ? 'grayscale-[60%]' : ''}`} />
            {/* Lapisan gelap tipis agar badge tetap terbaca di atas foto */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/10 to-black/25" aria-hidden />
          </>
        ) : (
          <CalendarDays className="absolute -right-3 -bottom-5 w-28 h-28 text-white/10" aria-hidden />
        )}
        <div className="relative flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                status === 'Sedang Berlangsung'
                  ? 'bg-amber-300 text-amber-950'
                  : status === 'Akan Datang'
                    ? 'bg-[#fff] text-emerald-800'
                    : sampul ? 'bg-black/50 text-white backdrop-blur-sm' : 'bg-white/20 text-white'
              }`}
            >
              {status === 'Sedang Berlangsung' && <span className="w-1.5 h-1.5 rounded-full bg-amber-900 animate-pulse" />}
              {status}
            </span>
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold text-white border ${sampul ? 'bg-black/50 border-white/10 backdrop-blur-sm' : 'bg-white/15 border-white/20'}`}>
              {ev.tipe === 'seluruh' ? 'Seluruh asrama' : ev.namaGedung || 'Gedung'}
            </span>
          </div>
          {(onEdit || onHapus) && (
            <div className="flex items-center gap-1">
              {onEdit && (
                <button type="button" onClick={onEdit} title="Edit event" aria-label={`Edit ${ev.judul}`}
                  className={`p-2 rounded-lg text-white hover:bg-white hover:text-emerald-800 cursor-pointer transition-colors ${sampul ? 'bg-black/50 backdrop-blur-sm' : 'bg-white/15'}`}>
                  <Edit className="w-3.5 h-3.5" />
                </button>
              )}
              {onHapus && (
                <button type="button" onClick={onHapus} title="Hapus event" aria-label={`Hapus ${ev.judul}`}
                  className={`p-2 rounded-lg text-white hover:bg-white hover:text-rose-700 cursor-pointer transition-colors ${sampul ? 'bg-black/50 backdrop-blur-sm' : 'bg-white/15'}`}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Blok tanggal */}
        <div className="absolute -bottom-6 left-4 w-14 rounded-xl bg-[#fff] shadow-md border border-gray-100 text-center overflow-hidden">
          <p className={`text-[10px] font-extrabold tracking-wider py-0.5 ${selesai ? 'bg-gray-100 text-gray-500' : 'bg-emerald-50 text-emerald-700'}`}>
            {BULAN[Number(m) - 1] ?? ''}
          </p>
          <p className="text-xl font-extrabold text-gray-900 leading-8 tabular-nums" style={{ fontFamily: 'Plus Jakarta Sans' }}>{Number(d)}</p>
        </div>
        {kehadiran && <div className="absolute -bottom-3.5 right-4">{kehadiran}</div>}
      </div>

      {/* Isi */}
      <div className="pt-9 px-5 pb-4 flex-1 flex flex-col">
        <h4 className={`font-extrabold text-base leading-snug line-clamp-2 ${selesai ? 'text-gray-600' : 'text-gray-900'}`} style={{ fontFamily: 'Plus Jakarta Sans' }}>
          {ev.judul}
        </h4>
        {ev.deskripsi && <p className="mt-1 text-xs text-gray-500 line-clamp-2 leading-relaxed">{ev.deskripsi}</p>}

        <div className="mt-3.5 space-y-1.5 text-xs text-gray-600">
          <p className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
            <span className="font-semibold text-gray-800">{formatTanggal(ev.tanggal)}</span>
            <span className="text-gray-300">·</span>
            <span className="tabular-nums">{ev.jamMulai}–{ev.jamSelesai}</span>
          </p>
          <p className="flex items-center gap-2 min-w-0">
            <MapPin className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
            <span className="truncate">{ev.lokasi}</span>
            <span className="shrink-0 text-gray-400">· {ev.radiusMeter} m</span>
          </p>
          {penyelenggara && (
            <p className="flex items-center gap-2 min-w-0">
              <User className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <span className="truncate">{penyelenggara}</span>
            </p>
          )}
        </div>
      </div>

      {children && <div className="px-5 pb-5 mt-auto">{children}</div>}
    </div>
  )
}

/** Ubin "buat event" untuk keadaan kosong / akhir grid */
export function UbinBuatEvent({ onClick, label, keterangan }: { onClick: () => void; label: string; keterangan?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-64 rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50/30 hover:bg-emerald-50 hover:border-emerald-400 text-emerald-800 flex flex-col items-center justify-center gap-2 p-6 text-center cursor-pointer transition-colors"
    >
      <span className="w-12 h-12 rounded-2xl bg-white border border-emerald-200 flex items-center justify-center shadow-xs">
        <CalendarDays className="w-6 h-6 text-emerald-700" />
      </span>
      <span className="text-sm font-bold" style={{ fontFamily: 'Plus Jakarta Sans' }}>+ {label}</span>
      {keterangan && <span className="text-xs text-gray-500 max-w-56">{keterangan}</span>}
    </button>
  )
}
