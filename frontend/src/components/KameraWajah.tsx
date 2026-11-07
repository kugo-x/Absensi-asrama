import { useEffect, useRef, useState } from 'react'
import { Camera, CameraOff, RefreshCw } from 'lucide-react'

// Lebar maksimum foto yang dikirim; cukup untuk verifikasi wajah dan tetap ringan
const LEBAR_FOTO = 480

type StatusKamera = 'mati' | 'memuat' | 'siap' | 'error'

function pesanErrorKamera(err: unknown): string {
  const name = (err as DOMException)?.name
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Izin kamera ditolak. Izinkan akses kamera pada pengaturan browser, lalu coba lagi.'
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'Kamera tidak ditemukan pada perangkat ini.'
  if (name === 'NotReadableError') return 'Kamera sedang dipakai aplikasi lain. Tutup aplikasi tersebut lalu coba lagi.'
  return 'Kamera tidak dapat dinyalakan.'
}

// Pengambilan foto wajah (swafoto) sebagai bukti kehadiran saat presensi
export default function KameraWajah({ foto, onChange, disabled = false }: {
  foto: string | null
  onChange: (foto: string | null) => void
  disabled?: boolean
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [status, setStatus] = useState<StatusKamera>('mati')
  const [error, setError] = useState('')

  const matikan = () => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }

  // Pastikan kamera dimatikan saat pindah halaman
  useEffect(() => matikan, [])

  const nyalakan = async () => {
    setError('')
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('error')
      setError('Browser tidak mendukung kamera. Buka aplikasi melalui HTTPS atau localhost.')
      return
    }
    setStatus('memuat')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 } }, audio: false })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setStatus('siap')
    } catch (err) {
      matikan()
      setStatus('error')
      setError(pesanErrorKamera(err))
    }
  }

  const ambilFoto = () => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const skala = Math.min(1, LEBAR_FOTO / video.videoWidth)
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(video.videoWidth * skala)
    canvas.height = Math.round(video.videoHeight * skala)
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height)
    onChange(canvas.toDataURL('image/jpeg', 0.8))
    matikan()
    setStatus('mati')
  }

  const ulangi = () => {
    onChange(null)
    nyalakan()
  }

  const kameraTampil = !foto && (status === 'memuat' || status === 'siap')
  const tombolCls = 'flex-1 py-2.5 px-3 rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed'

  return (
    <div className="p-4 rounded-xl bg-gray-50 border border-gray-200">
      <div className="flex items-center justify-between mb-2.5 gap-2">
        <div className="flex items-center gap-2">
          <Camera className="w-4 h-4 text-emerald-700" />
          <span className="text-xs font-bold text-gray-800" style={{ fontFamily: 'Plus Jakarta Sans' }}>Foto Wajah</span>
        </div>
        {foto && <span className="text-[11px] font-semibold px-2 py-0.5 rounded border bg-emerald-100 text-emerald-800 border-emerald-200">Foto siap dikirim</span>}
      </div>

      <div className="relative aspect-[4/3] w-full max-w-sm mx-auto rounded-xl overflow-hidden bg-gray-900">
        {foto && <img src={foto} alt="Foto wajah" className="w-full h-full object-cover" />}
        {/* Pratinjau dicerminkan agar terasa seperti cermin; foto yang disimpan tidak dicerminkan */}
        <video ref={videoRef} playsInline muted className={`w-full h-full object-cover -scale-x-100 ${kameraTampil ? '' : 'hidden'}`} />
        {kameraTampil && status === 'siap' && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-[45%] aspect-[3/4] rounded-[50%] border-2 border-dashed border-white/70" />
          </div>
        )}
        {!foto && !kameraTampil && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 gap-2 p-4 text-center">
            <CameraOff className="w-8 h-8" />
            <span className="text-xs font-medium">{status === 'error' ? 'Kamera tidak aktif' : 'Kamera belum dinyalakan'}</span>
          </div>
        )}
        {status === 'memuat' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-700 mt-2.5 font-medium">{error}</p>}

      <div className="flex gap-2 mt-3">
        {foto ? (
          <button type="button" onClick={ulangi} disabled={disabled} className={`${tombolCls} text-emerald-800 bg-white border border-emerald-200 hover:bg-emerald-50`}>
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Ambil Ulang</span>
          </button>
        ) : status === 'siap' ? (
          <button type="button" onClick={ambilFoto} disabled={disabled} className={`${tombolCls} text-white bg-emerald-700 hover:bg-emerald-800`}>
            <Camera className="w-3.5 h-3.5" />
            <span>Ambil Foto</span>
          </button>
        ) : (
          <button type="button" onClick={nyalakan} disabled={disabled || status === 'memuat'} className={`${tombolCls} text-emerald-800 bg-white border border-emerald-200 hover:bg-emerald-50`}>
            <Camera className="w-3.5 h-3.5" />
            <span>{status === 'error' ? 'Coba Nyalakan Lagi' : 'Nyalakan Kamera'}</span>
          </button>
        )}
      </div>
      <p className="text-[11px] text-gray-500 mt-2">Pastikan wajah terlihat jelas dan tidak tertutup. Foto disimpan sebagai bukti kehadiran.</p>
    </div>
  )
}
