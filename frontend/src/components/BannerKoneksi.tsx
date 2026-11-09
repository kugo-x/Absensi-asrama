import { useEffect, useState } from 'react'
import { WifiOff, FlaskConical, RotateCw } from 'lucide-react'
import { EVENT_KONEKSI, OFFLINE_DEMO, statusKoneksiTerakhir } from '../api'

/**
 * Peringatan koneksi di atas konten halaman.
 * - Server tidak bisa dihubungi: data TIDAK diganti data contoh; pengguna diberi tahu dengan jelas.
 * - Mode demo (VITE_OFFLINE_DEMO=true): penanda bahwa yang tampil adalah data contoh.
 */
export default function BannerKoneksi() {
  const [terputus, setTerputus] = useState(() => statusKoneksiTerakhir() === false)

  useEffect(() => {
    const ubah = (e: Event) => setTerputus(!(e as CustomEvent<{ ok: boolean }>).detail.ok)
    window.addEventListener(EVENT_KONEKSI, ubah)
    return () => window.removeEventListener(EVENT_KONEKSI, ubah)
  }, [])

  if (terputus) {
    return (
      <div role="alert" className="mb-4 flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900">
        <WifiOff className="w-5 h-5 shrink-0 text-rose-600" />
        <div className="flex-1 text-[13px]">
          <p className="font-bold">Server tidak dapat dihubungi</p>
          <p className="text-rose-800/80">
            {OFFLINE_DEMO
              ? 'Mode demo aktif: perubahan hanya disimpan sementara di browser ini.'
              : 'Data yang tampil mungkin kosong atau belum terbaru, dan perubahan tidak dapat disimpan. Periksa backend lalu coba lagi.'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 cursor-pointer"
        >
          <RotateCw className="w-3.5 h-3.5" />
          Coba lagi
        </button>
      </div>
    )
  }

  if (OFFLINE_DEMO) {
    return (
      <div className="mb-4 flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-[13px]">
        <FlaskConical className="w-4 h-4 shrink-0 text-amber-600" />
        <span><strong>Mode demo</strong> — data contoh dipakai bila server tidak tersedia.</span>
      </div>
    )
  }
  return null
}
