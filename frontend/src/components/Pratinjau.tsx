import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Download, X } from 'lucide-react'

/**
 * Pratinjau berkas (foto wajah, foto absen event, bukti izin) dalam pop-up,
 * menggantikan pembukaan tab baru. Mendukung gambar dan PDF; Esc atau klik latar untuk menutup.
 */
export default function Pratinjau({ judul, keterangan, url, pdf = false, namaUnduh, gagal = false, onClose }: {
  judul: string
  keterangan?: string
  url: string | null // null = sedang dimuat
  gagal?: boolean // berkas tidak dapat dimuat (hilang / jaringan)
  pdf?: boolean
  namaUnduh?: string
  onClose: () => void
}) {
  useEffect(() => {
    const tutup = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', tutup)
    return () => window.removeEventListener('keydown', tutup)
  }, [onClose])

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm motion-safe:[animation:lg-pudar_0.2s_ease-out]"
      role="dialog"
      aria-modal="true"
      aria-label={judul}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className={`w-full ${pdf ? 'max-w-4xl h-[85vh]' : 'max-w-xl'} flex flex-col rounded-2xl overflow-hidden bg-[#fff] shadow-2xl motion-safe:[animation:lg-muncul_0.3s_cubic-bezier(0.22,1,0.36,1)]`}>
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-100">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-gray-900 truncate" style={{ fontFamily: 'Plus Jakarta Sans' }}>{judul}</p>
            {keterangan && <p className="text-xs text-gray-500 truncate">{keterangan}</p>}
          </div>
          {url && (
            <a href={url} download={namaUnduh || true} className="p-2 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100" title="Unduh" aria-label="Unduh">
              <Download className="w-4 h-4" />
            </a>
          )}
          <button type="button" onClick={onClose} className="p-2 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 cursor-pointer" aria-label="Tutup">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className={`bg-gray-950 flex items-center justify-center ${pdf ? 'flex-1' : 'min-h-64'}`}>
          {gagal ? (
            <div className="flex flex-col items-center gap-2 py-16 px-6 text-center text-gray-400 text-xs">
              <span className="text-sm font-semibold text-gray-300">Berkas tidak dapat dimuat</span>
              <span>File mungkin sudah dihapus atau koneksi terputus. Coba lagi nanti.</span>
            </div>
          ) : !url ? (
            <div className="flex flex-col items-center gap-2 py-16 text-gray-400 text-xs">
              <span className="w-6 h-6 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />
              Memuat…
            </div>
          ) : pdf ? (
            <iframe src={url} title={judul} className="w-full h-full bg-white" />
          ) : (
            <img src={url} alt={judul} className="max-h-[75vh] w-full object-contain" />
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
