import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'

const pad = (n: number) => String(n).padStart(2, '0')

/** Jam berjalan di header (waktu perangkat, WIB). State sendiri agar detik yang berganti tidak me-render ulang halaman. */
export default function JamDigital() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    // Selaraskan ke awal detik berikutnya, lalu tiap 1 detik
    let interval: ReturnType<typeof setInterval> | undefined
    const awal = setTimeout(() => {
      setNow(new Date())
      interval = setInterval(() => setNow(new Date()), 1000)
    }, 1000 - (Date.now() % 1000))
    return () => {
      clearTimeout(awal)
      if (interval) clearInterval(interval)
    }
  }, [])

  const jam = `${pad(now.getHours())}:${pad(now.getMinutes())}`
  return (
    <div
      className="flex items-center gap-2 h-10 rounded-full px-3.5 bg-white/60 border border-white/80 shadow-[inset_0_1px_0_rgb(255_255_255/0.9),0_2px_8px_-4px_rgb(17_24_39/0.15)] backdrop-blur-xl text-gray-800"
      title={now.toLocaleString('id-ID', { dateStyle: 'full', timeStyle: 'medium' })}
      aria-label={`Pukul ${jam} WIB`}
    >
      <Clock className="w-4 h-4 text-emerald-700" />
      <span className="text-sm font-bold tabular-nums tracking-tight" style={{ fontFamily: 'Plus Jakarta Sans' }}>
        {jam}
        <span className="hidden sm:inline text-gray-400">:{pad(now.getSeconds())}</span>
      </span>
      <span className="text-[10px] font-bold text-gray-400">WIB</span>
    </div>
  )
}
