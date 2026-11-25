/**
 * Logo SIP Asrama: atap gonjong (rumah gadang) membentuk huruf "A" dengan garis oranye.
 * Dua versi dari desain resmi, berganti otomatis mengikuti tema (aturan di index.css):
 * - mode terang: ubin hijau tua #0B3D38, atap putih
 * - mode gelap : ubin putih, atap teal #0E6E63
 */
export const PATH_GONJONG =
  'M120 835 C240 790 318 660 350 550 C378 470 392 330 392 188 C440 420 478 527 512 527 C546 527 584 420 631 188 C631 330 645 470 673 550 C705 660 783 790 903 835 L803 835 C693 790 603 690 546 597 L478 597 C420 690 330 790 220 835 Z'

export default function LogoSIP({ className = 'w-9 h-9', title }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 1024 1024" className={className} role={title ? 'img' : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      <rect className="logo-sip-ubin" width="1024" height="1024" rx="240" fill="#0B3D38" />
      {/* Garis tepi tipis agar ubin hijau tetap terlihat di atas latar hijau gelap (disembunyikan di mode gelap) */}
      <rect className="logo-sip-tepi" x="8" y="8" width="1008" height="1008" rx="232" fill="none" stroke="#fff" strokeOpacity="0.16" strokeWidth="16" />
      <path className="logo-sip-atap" d={PATH_GONJONG} fill="#FFFFFF" />
      <rect x="358" y="700" width="307" height="68" rx="34" fill="#F2994A" />
    </svg>
  )
}
