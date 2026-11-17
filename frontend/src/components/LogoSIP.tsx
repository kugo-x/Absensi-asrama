import { useId } from 'react'

/**
 * Logomark SIP Asrama: pin lokasi (presensi GPS) berisi rumah (asrama)
 * dengan tanda centang (kehadiran tercatat).
 */
export default function LogoSIP({ className = 'w-9 h-9', title }: { className?: string; title?: string }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg viewBox="0 0 48 48" className={className} role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      <defs>
        <linearGradient id={`${id}-latar`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#86e094" />
          <stop offset="0.55" stopColor="#4fcc63" />
          <stop offset="1" stopColor="#22993b" />
        </linearGradient>
        <linearGradient id={`${id}-tanda`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#f0fcf1" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="13" fill={`url(#${id}-latar)`} />
      <rect x="0.75" y="0.75" width="46.5" height="46.5" rx="12.25" fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="1.5" />
      {/* Bayangan lembut di bawah penanda */}
      <ellipse cx="24" cy="42" rx="6" ry="1.6" fill="#164f25" opacity="0.25" />
      {/* Pin lokasi (presensi GPS) */}
      <path d="M24 41.5 C24 41.5 11.5 31 11.5 21 A12.5 12.5 0 0 1 36.5 21 C36.5 31 24 41.5 24 41.5 Z" fill={`url(#${id}-tanda)`} />
      {/* Rumah (asrama) di dalam pin, dengan centang kehadiran */}
      <path d="M17.2 22 L24 15.6 L30.8 22" fill="none" stroke="#1c7b31" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19.4 21 H28.6 V27.2 A1.6 1.6 0 0 1 27 28.8 H21 A1.6 1.6 0 0 1 19.4 27.2 Z" fill="#1c7b31" />
      <path d="M21.6 24.6 L23.4 26.3 L26.6 23" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
