import { useEffect, useRef, useState } from 'react'
import type { CurrentUser } from '../types'
import { apiLogin } from '../api'
import { Building2, User, Lock, Eye, EyeOff, ArrowRight, AlertCircle, ArrowBigUp, Info } from 'lucide-react'

interface Props {
  onLogin: (user: CurrentUser) => void
}

// Akun demo untuk mencoba sistem (klik untuk mengisi form)
const AKUN_DEMO = [
  { nim: 'admin', password: 'admin123', peran: 'Admin' },
  { nim: '2310936001', password: 'fasil123', peran: 'Fasilitator' },
  { nim: '2310933001', password: 'penghuni123', peran: 'Penghuni' },
]

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

  return (
    <div className="liquid relative min-h-screen overflow-hidden text-gray-800" style={{ fontFamily: 'Plus Jakarta Sans' }}>
      {/* Tekstur titik halus yang memudar ke tepi */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background-image:radial-gradient(rgb(15_51_34/0.12)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_70%_60%_at_20%_45%,black_15%,transparent_75%)]"
      />

      <div className="relative mx-auto max-w-6xl min-h-screen flex flex-col px-5 sm:px-8 lg:px-12 py-6 lg:py-8">
        {/* ===== Bilah atas ===== */}
        <header className={`flex items-center justify-between gap-4 ${naik}`} style={jeda(0)}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 shrink-0 rounded-xl bg-[#0c2a1c] flex items-center justify-center text-emerald-300 shadow-[inset_0_1px_0_rgb(255_255_255/0.1)]">
              <Building2 className="w-5 h-5" strokeWidth={2.2} />
            </div>
            <div>
              <p className="font-extrabold text-[15px] leading-tight tracking-tight text-gray-900">SIP Asrama</p>
              <p className="text-[11.5px] font-medium text-gray-500">Universitas Andalas</p>
            </div>
          </div>
        </header>

        <div className="flex-1 grid content-center lg:grid-cols-[1.1fr_1fr] gap-8 sm:gap-10 lg:gap-16 items-center py-8 lg:py-6">
          {/* ===== Kiri: pengantar + ilustrasi gedung ===== */}
          <section className="max-w-[560px]">
            <span className={`hidden lg:inline-flex items-center gap-2 h-7 px-3 rounded-full bg-white/70 ring-1 ring-black/[0.05] text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-800 ${naik}`} style={jeda(60)}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
              Sistem Informasi Presensi Asrama
            </span>

            <h1 className={`lg:mt-5 text-[30px] sm:text-[40px] lg:text-[42px] xl:text-[48px] font-extrabold leading-[1.08] tracking-[-0.025em] text-gray-900 ${naik}`} style={jeda(100)}>
              Setiap kehadiran,
              <span className="block text-emerald-700 sm:whitespace-nowrap">tercatat dengan rapi.</span>
            </h1>

            <p className={`hidden sm:block mt-5 max-w-[460px] text-[15px] leading-[1.7] text-gray-500 ${naik}`} style={jeda(150)}>
              SIP Asrama menghadirkan presensi, perizinan, dan pemantauan penghuni dalam satu ruang yang sederhana — dirancang untuk kehidupan asrama yang lebih tertib.
            </p>

            <div className={`hidden lg:block mt-12 max-w-[460px] ${naik}`} style={jeda(220)}>
              <GedungAsrama />
            </div>
          </section>

          {/* ===== Kanan: form login ===== */}
          <section>
          <div className={`w-full max-w-[400px] mx-auto lg:mx-0 lg:ml-auto ${naik}`} style={jeda(120)}>
            <form
              onSubmit={handleLogin}
              className="rounded-2xl bg-white p-6 sm:p-7 ring-1 ring-black/[0.05] shadow-[0_16px_40px_-20px_rgb(17_24_39/0.25),0_1px_2px_rgb(17_24_39/0.04)] space-y-4"
            >
              <div className="pb-2">
                <h2 className="text-xl font-extrabold tracking-tight text-gray-900">Selamat datang kembali</h2>
                <p className="text-[13px] text-gray-500 mt-1">Masuk untuk melanjutkan ke SIP Asrama.</p>
              </div>

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
                    <span>Hubungi admin UPT Asrama untuk mengatur ulang kata sandi Anda, lalu segera ganti melalui menu Profil.</span>
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
                className={`group w-full h-11 rounded-xl text-sm font-bold text-white bg-[#0c2a1c] hover:bg-[#123b28] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 ${fokus}`}
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
            <div className="mt-6 text-center">
              <p className="text-[12px] text-gray-500 mb-2.5">Ingin mencoba? Gunakan akun demo</p>
              <div className="inline-flex p-1 rounded-xl bg-white ring-1 ring-black/[0.05] shadow-[0_1px_2px_rgb(17_24_39/0.04)]">
                {AKUN_DEMO.map(a => {
                  const terpilih = nim === a.nim && password === a.password
                  return (
                    <button
                      key={a.nim}
                      type="button"
                      onClick={() => fillDemo(a.nim, a.password)}
                      title={`${a.nim} / ${a.password}`}
                      aria-pressed={terpilih}
                      className={`px-3.5 h-8 rounded-lg text-[12.5px] font-semibold cursor-pointer ${fokus} ${
                        terpilih ? 'bg-[#0c2a1c] text-white' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                      }`}
                    >
                      {a.peran}
                    </button>
                  )
                })}
              </div>
              {(() => {
                const pilih = AKUN_DEMO.find(a => a.nim === nim && a.password === password)
                return (
                  <p className={`mt-2 h-4 text-[11.5px] text-gray-400 mono transition-opacity duration-300 ${pilih ? 'opacity-100' : 'opacity-0'}`} aria-live="polite">
                    {pilih ? `${pilih.nim} / ${pilih.password}` : ''}
                  </p>
                )
              })()}
            </div>

          </div>
          </section>
        </div>

        {/* ===== Footer ===== */}
        <footer className="flex flex-col sm:flex-row items-center justify-between gap-1 text-[11.5px] text-gray-400">
          <span>© 2026 UPT Asrama Mahasiswa · Universitas Andalas</span>
          <span className="hidden sm:inline">Kampus Limau Manis, Padang</span>
        </footer>
      </div>
    </div>
  )
}

/**
 * Ilustrasi garis gedung asrama. Beberapa jendela "menyala" bergiliran,
 * melambangkan penghuni yang sudah tercatat hadir. Murni dekoratif.
 */
function GedungAsrama() {
  const garis = 'rgb(15 51 34 / 0.28)'
  const isi = 'rgb(255 255 255 / 0.7)'
  // Jendela gedung utama: 5 kolom x 4 baris; gedung samping: 4 kolom x 3 baris
  const utama = Array.from({ length: 20 }, (_, i) => ({ x: 48 + (i % 5) * 42, y: 56 + Math.floor(i / 5) * 24 }))
  const samping = Array.from({ length: 12 }, (_, i) => ({ x: 296 + (i % 4) * 32, y: 102 + Math.floor(i / 4) * 24 }))
  const menyala = new Set([1, 3, 6, 7, 10, 12, 14, 16, 18, 21, 23, 24, 27, 29, 30])
  let urutan = 0
  const jendela = (j: { x: number; y: number }, w: number, h: number, i: number) => {
    const nyala = menyala.has(i)
    const d = nyala ? 500 + urutan++ * 90 : 0
    return (
      <rect
        key={i}
        x={j.x}
        y={j.y}
        width={w}
        height={h}
        rx={2}
        fill={nyala ? 'rgb(16 185 129 / 0.85)' : isi}
        stroke={nyala ? 'none' : garis}
        strokeWidth={1}
        className={nyala ? 'motion-safe:[animation:lg-pudar_0.8s_cubic-bezier(0.22,1,0.36,1)_backwards]' : undefined}
        style={nyala ? { animationDelay: `${d}ms` } : undefined}
      />
    )
  }
  return (
    <svg viewBox="0 0 460 190" className="w-full h-auto" role="img" aria-label="Ilustrasi gedung asrama">
      {/* Pohon */}
      <line x1="15" y1="188" x2="15" y2="160" stroke={garis} strokeWidth={1.25} />
      <circle cx="15" cy="150" r="12" fill={isi} stroke={garis} strokeWidth={1.25} />
      {/* Gedung utama */}
      <rect x="24" y="32" width="242" height="8" rx="2" fill={isi} stroke={garis} strokeWidth={1.25} />
      <rect x="30" y="40" width="230" height="148" rx="3" fill={isi} stroke={garis} strokeWidth={1.25} />
      {utama.map((j, i) => jendela(j, 22, 14, i))}
      {/* Pintu masuk */}
      <line x1="112" y1="160" x2="178" y2="160" stroke={garis} strokeWidth={1.5} />
      <rect x="125" y="162" width="40" height="26" rx="2" fill="rgb(12 42 28 / 0.9)" />
      <line x1="145" y1="162" x2="145" y2="188" stroke="rgb(255 255 255 / 0.35)" strokeWidth={1} />
      {/* Gedung samping */}
      <rect x="275" y="81" width="160" height="7" rx="2" fill={isi} stroke={garis} strokeWidth={1.25} />
      <rect x="280" y="88" width="150" height="100" rx="3" fill={isi} stroke={garis} strokeWidth={1.25} />
      {samping.map((j, i) => jendela(j, 18, 14, 20 + i))}
      {/* Tanah */}
      <line x1="0" y1="188.5" x2="460" y2="188.5" stroke={garis} strokeWidth={1.25} />
    </svg>
  )
}
