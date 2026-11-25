import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { CheckCircle2, CloudOff, XCircle } from 'lucide-react'

export interface HasilAbsenData {
  jenis: 'sukses' | 'gagal' | 'offline'
  judul: string
  pesan: string
}

/** Popup di tengah layar setelah penghuni mengirim absen (harian / event). */
export default function HasilAbsen({ data, onClose }: { data: HasilAbsenData; onClose: () => void }) {
  useEffect(() => {
    const tutup = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', tutup)
    return () => window.removeEventListener('keydown', tutup)
  }, [onClose])

  const gaya = {
    sukses: { ikon: <CheckCircle2 className="w-9 h-9" />, lingkar: 'bg-emerald-50 text-emerald-600 ring-emerald-100', tombol: 'Oke' },
    offline: { ikon: <CloudOff className="w-9 h-9" />, lingkar: 'bg-amber-50 text-amber-600 ring-amber-100', tombol: 'Oke' },
    gagal: { ikon: <XCircle className="w-9 h-9" />, lingkar: 'bg-rose-50 text-rose-600 ring-rose-100', tombol: 'Coba lagi' },
  }[data.jenis]

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs motion-safe:[animation:lg-pudar_0.2s_ease-out]"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="hasil-absen-judul"
      aria-describedby="hasil-absen-pesan"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-[#fff] rounded-3xl border border-gray-200 shadow-2xl px-6 pt-7 pb-5 text-center motion-safe:[animation:lg-muncul_0.3s_cubic-bezier(0.22,1,0.36,1)]"
        onClick={e => e.stopPropagation()}
      >
        <span className={`mx-auto w-16 h-16 rounded-full ring-8 flex items-center justify-center ${gaya.lingkar}`}>{gaya.ikon}</span>
        <h3 id="hasil-absen-judul" className="mt-5 text-lg font-extrabold text-gray-900 tracking-tight" style={{ fontFamily: 'Plus Jakarta Sans' }}>{data.judul}</h3>
        <p id="hasil-absen-pesan" className="mt-1.5 text-sm text-gray-600 leading-relaxed">{data.pesan}</p>
        <button
          type="button"
          autoFocus
          onClick={onClose}
          className="mt-6 w-full py-3 rounded-xl text-sm font-bold text-white bg-[#141a17] hover:bg-[#2a332e] cursor-pointer"
        >
          {gaya.tombol}
        </button>
      </div>
    </div>,
    document.body,
  )
}
