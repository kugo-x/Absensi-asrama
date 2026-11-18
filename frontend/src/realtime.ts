import { useEffect, useRef } from 'react'

// Selang pembaruan data (ms). Cukup sering agar terasa realtime, tetap ringan untuk `php spark serve`.
export const SELANG_REALTIME = 5000

/**
 * Menjalankan `muat` berkala selama tab terlihat, dan langsung saat tab kembali aktif / jendela difokuskan.
 * Dipakai agar pengajuan, keputusan, presensi, event, dll. muncul tanpa refresh halaman.
 */
export function useRealtime(muat: () => void, selang = SELANG_REALTIME) {
  const ref = useRef(muat)
  ref.current = muat

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined
    const jalan = () => {
      if (document.visibilityState === 'visible') ref.current()
    }
    const mulai = () => {
      if (timer) clearInterval(timer)
      timer = setInterval(jalan, selang)
    }
    const saatTerlihat = () => {
      if (document.visibilityState === 'visible') {
        jalan()
        mulai()
      }
    }
    mulai()
    document.addEventListener('visibilitychange', saatTerlihat)
    window.addEventListener('focus', jalan)
    return () => {
      if (timer) clearInterval(timer)
      document.removeEventListener('visibilitychange', saatTerlihat)
      window.removeEventListener('focus', jalan)
    }
  }, [selang])
}

/** Setter yang hanya mengganti state bila isinya berubah (mencegah render ulang tiap pembaruan berkala) */
export function bilaBerubah<T>(setter: (fn: (prev: T) => T) => void) {
  return (baru: T) => setter(prev => (JSON.stringify(prev) === JSON.stringify(baru) ? prev : baru))
}
