import { useEffect, useRef, useState } from 'react'
import type { CurrentUser } from '../types'
import { apiLogin } from '../api'
import { User, Lock, Eye, EyeOff, ArrowRight, AlertCircle, ArrowBigUp, Info, ShieldCheck, UserCheck } from 'lucide-react'
import logoUnand from '../assets/logo-unand.png'
import LogoSIP from '../components/LogoSIP'

interface Props {
  onLogin: (user: CurrentUser) => void
}

// Akun demo untuk mencoba sistem (klik untuk mengisi form)
const AKUN_DEMO = [
  { nim: 'admin', password: 'admin123', peran: 'Admin', ikon: ShieldCheck },
  { nim: '2310936001', password: 'fasil123', peran: 'Fasilitator', ikon: UserCheck },
  { nim: '2310933001', password: 'penghuni123', peran: 'Penghuni', ikon: User },
]

function salamWaktu() {
  const jam = new Date().getHours()
  return jam < 11 ? 'Selamat pagi' : jam < 15 ? 'Selamat siang' : jam < 18 ? 'Selamat sore' : 'Selamat malam'
}

// Animasi masuk bergiliran (kurva gerak sama dengan aplikasi; mati bila "kurangi gerakan")
const naik = 'motion-safe:[animation:lg-naik_0.6s_cubic-bezier(0.22,1,0.36,1)_backwards]'
const jeda = (ms: number) => ({ animationDelay: `${ms}ms` })

export default function LoginPage({ onLogin }: Props) {
  const [nim, setNim] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [capsLock, setCapsLock] = useState(false)
  const [lupa, setLupa] = useState(false)
  const nimRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    document.title = 'Masuk · SIP Asrama'
  }, [])

  // Fokus otomatis ke NIM hanya di layar lebar (di HP keyboard tidak langsung muncul)
  useEffect(() => {
    if (window.matchMedia('(min-width: 1024px)').matches) nimRef.current?.focus()
  }, [])

  // Status Caps Lock untuk peringatan di kolom sandi
  const cekCaps = (e: React.KeyboardEvent<HTMLInputElement>) => setCapsLock(e.getModifierState('CapsLock'))

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = await apiLogin(nim, password)
      onLogin(user)
    } catch (err: any) {
      setError(err?.message || 'NIM atau password salah.')
    } finally {
      setLoading(false)
    }
  }

  const fillDemo = (accountNIM: string, accountPass: string) => {
    setNim(accountNIM)
    setPassword(accountPass)
    setError('')
  }

  // Kolom ditandai merah setelah login gagal, hingga pengguna mengetik ulang
  const salah = !!error
  const kolom = `w-full h-11 pl-10 rounded-xl bg-white border text-sm text-gray-900 placeholder:text-gray-400 outline-none transition-[border-color,box-shadow] duration-200 focus:ring-4 ${
    salah ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-500/10' : 'border-gray-200 hover:border-gray-300 focus:border-emerald-600 focus:ring-emerald-600/10'
  }`
  const fokus = 'outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-2'

  const demoTerpilih = AKUN_DEMO.find(a => a.nim === nim && a.password === password)

  return (
    <div className="liquid min-h-screen flex flex-col lg:grid lg:grid-cols-[1.05fr_1fr] bg-[#f4f7f5] text-gray-800" style={{ fontFamily: 'Plus Jakarta Sans' }}>
      {/* ===== Panel kiri (layar lebar) / pita atas (HP) ===== */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#0b3a25] via-[#0a2e1e] to-[#071f15] text-white">
        <div aria-hidden className="pointer-events-none absolute -top-40 -left-32 w-[460px] h-[460px] rounded-full bg-emerald-400/15 blur-3xl" />

        <div className="relative h-full flex flex-col">
          <div className={`flex items-center gap-3 px-6 sm:px-10 lg:px-14 xl:px-20 pt-6 lg:pt-10 ${naik}`} style={jeda(0)}>
            <div className="w-11 h-11 lg:w-12 lg:h-12 rounded-xl bg-white p-1.5 shadow-lg shadow-black/20 shrink-0 flex items-center justify-center">
              <img src={logoUnand} alt="Logo Universitas Andalas" className="h-full w-auto object-contain" />
            </div>
            <div className="leading-tight">
              <p className="font-bold text-[13px] lg:text-sm">Universitas Andalas</p>
              <p className="text-[11.5px] text-emerald-100/70">UPT Asrama Mahasiswa</p>
            </div>
          </div>

          <div className={`px-6 sm:px-10 lg:px-14 xl:px-20 mt-6 lg:mt-auto lg:pt-10 ${naik}`} style={jeda(100)}>
            <div className="flex items-center gap-3 lg:gap-4">
              <LogoSIP className="w-11 h-11 sm:w-12 sm:h-12 lg:w-[60px] lg:h-[60px] xl:w-[68px] xl:h-[68px] shrink-0 drop-shadow-[0_10px_24px_rgb(47_184_74/0.35)]" />
              <h1 className="text-[30px] sm:text-[36px] lg:text-[52px] xl:text-[60px] font-extrabold leading-none tracking-[-0.035em]">
                SIP <span className="text-emerald-300">Asrama</span>
              </h1>
            </div>
            <p className="mt-2 lg:mt-3 text-[13px] lg:text-[15px] text-emerald-100/70">Sistem Informasi Presensi Asrama</p>
          </div>

          {/* Ilustrasi asrama di malam hari (dekoratif) */}
          <div className={`mt-4 lg:mt-8 sm:max-w-[480px] sm:mx-auto lg:max-w-none w-full ${naik}`} style={jeda(180)}>
            <IlustrasiAsrama className="w-full h-36 sm:h-auto block sm:overflow-visible" />
          </div>
        </div>
      </section>

      {/* ===== Panel kanan: form masuk ===== */}
      <section className="relative flex-1 flex flex-col px-5 sm:px-8 bg-[radial-gradient(rgb(15_81_50/0.07)_1px,transparent_1px)] [background-size:22px_22px]">
        <div className="flex-1 flex items-center justify-center py-6 lg:py-10">
        <div
          className={`w-full max-w-[420px] rounded-3xl bg-[#fff] p-6 sm:p-8 ring-1 ring-black/[0.05] shadow-[0_30px_60px_-30px_rgb(12_42_28/0.35),0_1px_2px_rgb(17_24_39/0.04)] ${naik}`}
          style={jeda(120)}
        >
          <p className="text-[13px] font-semibold text-emerald-700">{salamWaktu()}</p>
          <h2 className="mt-1 mb-6 text-[26px] font-extrabold tracking-tight text-gray-900">Masuk</h2>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="login-nim" className="block text-[12.5px] font-semibold text-gray-700 mb-1.5">NIM / Username</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  id="login-nim"
                  type="text"
                  value={nim}
                  ref={nimRef}
                  onChange={e => { setNim(e.target.value); if (error) setError('') }}
                  aria-invalid={salah}
                  placeholder="Masukkan NIM Anda"
                  autoComplete="username"
                  className={`${kolom} pr-3.5`}
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="login-sandi" className="text-[12.5px] font-semibold text-gray-700">Kata Sandi</label>
                <button
                  type="button"
                  onClick={() => setLupa(l => !l)}
                  aria-expanded={lupa}
                  className={`text-[12px] font-semibold text-emerald-700 hover:text-emerald-900 rounded cursor-pointer ${fokus}`}
                >
                  Lupa kata sandi?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input
                  id="login-sandi"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); if (error) setError('') }}
                  onKeyDown={cekCaps}
                  onKeyUp={cekCaps}
                  onBlur={() => setCapsLock(false)}
                  aria-invalid={salah}
                  placeholder="Masukkan kata sandi"
                  autoComplete="current-password"
                  className={`${kolom} pr-11`}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                  className={`absolute right-1.5 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 cursor-pointer ${fokus}`}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {capsLock && (
                <p className="flex items-center gap-1.5 mt-1.5 text-[12px] font-medium text-amber-700 motion-safe:[animation:lg-naik_0.3s_cubic-bezier(0.22,1,0.36,1)_backwards]">
                  <ArrowBigUp className="w-3.5 h-3.5" />
                  Caps Lock sedang aktif
                </p>
              )}
              {lupa && (
                <p className="flex items-start gap-2 mt-2 px-3 py-2.5 rounded-xl bg-gray-50 text-[12px] leading-relaxed text-gray-600 motion-safe:[animation:lg-naik_0.35s_cubic-bezier(0.22,1,0.36,1)_backwards]">
                  <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-700" />
                  <span>Hubungi admin UPT Asrama untuk mengatur ulang kata sandi Anda.</span>
                </p>
              )}
            </div>

            {error && (
              <div role="alert" className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-rose-50 text-rose-700 text-[12.5px] font-medium motion-safe:[animation:lg-naik_0.35s_cubic-bezier(0.22,1,0.36,1)_backwards]">
                <AlertCircle className="w-4 h-4 shrink-0 mt-px" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`group w-full h-11 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-[#1f2924] to-[#111713] hover:from-[#13633e] hover:to-[#123b28] shadow-[0_10px_20px_-10px_rgb(12_42_28/0.7)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 ${fokus}`}
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/90 border-t-transparent rounded-full animate-spin" />
                  <span>Memverifikasi…</span>
                </>
              ) : (
                <>
                  <span>Masuk</span>
                  <ArrowRight className="w-4 h-4 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </form>

          {/* Akun demo */}
          <div className="mt-6 pt-5 border-t border-dashed border-gray-200">
            <p className="mb-2.5 text-[11.5px] font-semibold text-gray-400">Coba dengan akun demo</p>
            <div className="grid grid-cols-3 gap-2">
              {AKUN_DEMO.map(a => {
                const terpilih = demoTerpilih?.nim === a.nim
                return (
                  <button
                    key={a.nim}
                    type="button"
                    onClick={() => fillDemo(a.nim, a.password)}
                    title={`${a.nim} / ${a.password}`}
                    aria-pressed={terpilih}
                    className={`flex items-center justify-center gap-1.5 h-10 rounded-xl border text-[12px] font-semibold cursor-pointer transition-colors ${fokus} ${
                      terpilih ? 'bg-[#111713] border-[#111713] text-white' : 'bg-white border-gray-200 text-gray-700 hover:border-emerald-300 hover:bg-emerald-50/50'
                    }`}
                  >
                    <a.ikon className={`w-4 h-4 ${terpilih ? 'text-emerald-300' : 'text-emerald-700'}`} />
                    {a.peran}
                  </button>
                )
              })}
            </div>
          </div>

        </div>
        </div>
        <p className="pb-5 text-center text-[11px] text-gray-400">© 2026 UPT Asrama Mahasiswa · Universitas Andalas</p>
      </section>
    </div>
  )
}

/**
 * Ilustrasi asrama di malam hari. Jendela menyala bergiliran (penghuni tercatat hadir),
 * bintang berkelip, pohon bergoyang pelan, dan penanda lokasi berdenyut. Murni dekoratif;
 * semua gerakan berhenti bila pengguna memilih "kurangi gerakan".
 */
function IlustrasiAsrama({ className }: { className?: string }) {
  // Pola acak tetap (bukan Math.random) agar ilustrasi sama di setiap render
  const acak = (i: number) => { const v = Math.sin(i * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v) }

  const bintang = Array.from({ length: 16 }, (_, i) => ({ x: 20 + acak(i + 1) * 560, y: 12 + acak(i + 40) * 110, r: 0.8 + acak(i + 80) * 1.2, d: acak(i + 7) * 4 }))

  // Gedung: [x, y-atap, lebar, tinggi, kolom, baris, lapis] — lapis 0 = depan
  const gedung = [
    { x: 330, y: 150, w: 150, h: 150, kol: 4, bar: 5, lapis: 1 },
    { x: 70, y: 120, w: 230, h: 180, kol: 6, bar: 6, lapis: 0 },
    { x: 470, y: 190, w: 110, h: 110, kol: 3, bar: 3, lapis: 0 },
  ]

  let urut = 0
  const jendela = gedung.flatMap((g, gi) => {
    const lebarJ = 16, tinggiJ = 11
    const celahX = (g.w - g.kol * lebarJ) / (g.kol + 1)
    const celahY = (g.h - 34 - g.bar * tinggiJ) / (g.bar + 1)
    return Array.from({ length: g.kol * g.bar }, (_, i) => {
      const k = i % g.kol, b = Math.floor(i / g.kol)
      const nyala = acak(gi * 100 + i + 3) > 0.35
      return { key: `${gi}-${i}`, x: g.x + celahX + k * (lebarJ + celahX), y: g.y + 14 + celahY + b * (tinggiJ + celahY), w: lebarJ, h: tinggiJ, nyala, d: nyala ? (urut++ % 24) * 0.22 : 0, lapis: g.lapis }
    })
  })

  return (
    <svg viewBox="0 0 600 320" preserveAspectRatio="xMidYMax slice" className={className} role="img" aria-label="Ilustrasi asrama di malam hari">
      <defs>
        <radialGradient id="cahaya-bulan" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fef3c7" stopOpacity="0.35" />
          <stop offset="1" stopColor="#fef3c7" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="tanah" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0f3d27" />
          <stop offset="1" stopColor="#06180f" />
        </linearGradient>
        <mask id="sabit">
          <rect width="600" height="320" fill="#fff" />
          <circle cx="514" cy="55" r="18" fill="#000" />
        </mask>
        <filter id="pendar" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
      </defs>
      <style>{`
        @keyframes ia-kelip { 0%, 100% { opacity: .25 } 50% { opacity: 1 } }
        @keyframes ia-nyala { 0%, 6% { fill: rgb(255 255 255 / .07) } 14%, 82% { fill: #fcd34d } 92%, 100% { fill: rgb(255 255 255 / .07) } }
        @keyframes ia-pendar { 0%, 6% { opacity: 0 } 14%, 82% { opacity: .55 } 92%, 100% { opacity: 0 } }
        @keyframes ia-goyang { 0%, 100% { transform: rotate(-1.6deg) } 50% { transform: rotate(1.6deg) } }
        @keyframes ia-denyut { 0% { transform: scale(.4); opacity: .7 } 100% { transform: scale(2.4); opacity: 0 } }
        @keyframes ia-awan { from { transform: translateX(-120px) } to { transform: translateX(640px) } }
        .ia-kelip { animation: ia-kelip 3.2s ease-in-out infinite }
        .ia-nyala { animation: ia-nyala 7s ease-in-out infinite }
        .ia-pendar { animation: ia-pendar 7s ease-in-out infinite }
        .ia-goyang { transform-box: fill-box; transform-origin: 50% 100%; animation: ia-goyang 5s ease-in-out infinite }
        .ia-denyut { transform-box: fill-box; transform-origin: center; animation: ia-denyut 2.4s ease-out infinite }
        .ia-awan { animation: ia-awan 48s linear infinite }
        @media (prefers-reduced-motion: reduce) {
          .ia-kelip, .ia-nyala, .ia-pendar, .ia-goyang, .ia-denyut, .ia-awan { animation: none }
          .ia-nyala { fill: #fcd34d }
        }
      `}</style>

      {/* Langit: bintang, bulan, awan tipis */}
      {bintang.map((b, i) => <circle key={i} cx={b.x} cy={b.y} r={b.r} fill="#f0fcf1" className="ia-kelip" style={{ animationDelay: `${b.d}s` }} />)}
      <circle cx="505" cy="62" r="58" fill="url(#cahaya-bulan)" />
      <circle cx="505" cy="62" r="20" fill="#fef3c7" mask="url(#sabit)" />
      <g className="ia-awan" opacity="0.12">
        <ellipse cx="60" cy="88" rx="46" ry="9" fill="#f0fcf1" />
        <ellipse cx="88" cy="82" rx="28" ry="8" fill="#f0fcf1" />
      </g>

      {/* Bukit belakang */}
      <path d="M-600 250 C -300 236, -120 262, 0 255 C 90 225, 170 240, 260 228 S 450 215, 600 236 C 760 252, 960 232, 1200 246 L1200 320 L-600 320 Z" fill="#0c3322" />

      {/* Gedung */}
      {gedung.map((g, i) => (
        <g key={i} opacity={g.lapis ? 0.75 : 1}>
          <rect x={g.x - 6} y={g.y} width={g.w + 12} height="8" rx="2" fill={g.lapis ? '#14533a' : '#1b6b4a'} />
          <rect x={g.x} y={g.y + 8} width={g.w} height={g.h - 8} fill={g.lapis ? '#0f4430' : '#125a3d'} stroke="rgb(255 255 255 / .08)" />
        </g>
      ))}

      {/* Jendela: pendar di belakang, lalu kaca jendela */}
      {jendela.filter(j => j.nyala).map(j => (
        <rect key={`p-${j.key}`} x={j.x - 2} y={j.y - 2} width={j.w + 4} height={j.h + 4} rx="3" fill="#fbbf24" filter="url(#pendar)" className="ia-pendar" style={{ animationDelay: `${j.d}s` }} />
      ))}
      {jendela.map(j => (
        <rect
          key={j.key}
          x={j.x}
          y={j.y}
          width={j.w}
          height={j.h}
          rx="1.5"
          fill="rgb(255 255 255 / .07)"
          className={j.nyala ? 'ia-nyala' : undefined}
          style={j.nyala ? { animationDelay: `${j.d}s` } : undefined}
          opacity={j.lapis ? 0.8 : 1}
        />
      ))}

      {/* Pintu masuk gedung utama + lampu */}
      <rect x="165" y="270" width="40" height="30" rx="2" fill="#071f15" />
      <rect x="160" y="265" width="50" height="5" rx="1.5" fill="#1b6b4a" />
      <circle cx="185" cy="262" r="2.2" fill="#fde68a" />
      <circle cx="185" cy="262" r="7" fill="#fde68a" opacity="0.25" filter="url(#pendar)" />

      {/* Penanda lokasi (presensi GPS) di atas gedung utama */}
      <g transform="translate(185 92)">
        <circle r="9" fill="#4fcc63" className="ia-denyut" />
        <circle r="9" fill="#4fcc63" className="ia-denyut" style={{ animationDelay: '1.2s' }} />
        <path d="M0 6 C -6 -1, -7 -5, -7 -8 A 7 7 0 0 1 7 -8 C 7 -5, 6 -1, 0 6 Z" fill="#4fcc63" transform="translate(0 -6)" />
        <circle cy="-14" r="2.6" fill="#0a2e1e" />
      </g>

      {/* Tanah & pohon */}
      <path d="M-600 296 L0 296 C 120 290, 260 300, 380 294 S 540 290, 600 296 L1200 296 L1200 320 L-600 320 Z" fill="url(#tanah)" />
      {[{ x: 32, s: 1 }, { x: 312, s: 0.8 }, { x: 588, s: 0.9 }].map((t, i) => (
        <g key={i} className="ia-goyang" style={{ animationDelay: `${i * 0.8}s` }}>
          <rect x={t.x - 1.5} y={300 - 22 * t.s} width="3" height={22 * t.s} fill="#111713" />
          <circle cx={t.x} cy={300 - 30 * t.s} r={14 * t.s} fill="#1f7a52" />
          <circle cx={t.x - 7 * t.s} cy={300 - 24 * t.s} r={9 * t.s} fill="#1a6a47" />
        </g>
      ))}
    </svg>
  )
}
