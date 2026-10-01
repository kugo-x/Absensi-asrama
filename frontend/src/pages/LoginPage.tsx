import { useState } from 'react'
import type { CurrentUser } from '../types'
import { DEMO_ACCOUNTS } from '../data/mockData'
import { apiLogin } from '../api'
import { 
  Building2, 
  User, 
  Lock, 
  Eye, 
  EyeOff, 
  LogIn, 
  Shield, 
  UserCheck, 
  GraduationCap, 
  AlertCircle
} from 'lucide-react'

interface Props {
  onLogin: (user: CurrentUser) => void
}

export default function LoginPage({ onLogin }: Props) {
  const [nim, setNim] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

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

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#f5f7f5] text-gray-800">
      {/* Sisi Kiri: Profil & Informasi Kampus */}
      <div className="lg:w-[48%] bg-[#0e4b29] text-white flex flex-col justify-between p-8 lg:p-14 xl:p-16 border-r border-[#0a381e]">
        {/* Logo & Identitas Kampus */}
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-emerald-300 shrink-0">
            <Building2 className="w-7 h-7" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-300">
              Universitas Andalas
            </p>
            <h2 className="text-lg font-bold text-white tracking-tight" style={{ fontFamily: 'Plus Jakarta Sans' }}>
              UPT Asrama Mahasiswa
            </h2>
          </div>
        </div>

        {/* Judul Sistem - Vertically Centered & Prominent */}
        <div className="my-auto py-10 max-w-xl">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-[1.15] tracking-tight" style={{ fontFamily: 'Plus Jakarta Sans' }}>
            Sistem Informasi Presensi Asrama
          </h1>
          <p className="text-xl lg:text-2xl font-bold text-emerald-300 mt-2" style={{ fontFamily: 'Plus Jakarta Sans' }}>
            (SIP-ASRAMA)
          </p>

          <p className="mt-6 text-emerald-100/90 text-sm lg:text-base leading-relaxed">
            Portal terpadu pencatatan kehadiran mandiri, pengelolaan perizinan, dan pemantauan tata tertib penghuni asrama Universitas Andalas.
          </p>
        </div>

        {/* Footer Kampus */}
        <div className="pt-4 border-t border-white/10 text-xs text-emerald-200/70">
          <p className="font-medium">© 2026 UPT Asrama Mahasiswa Universitas Andalas</p>
          <p className="text-[11px] text-emerald-200/50 mt-0.5">Kampus Limau Manis, Padang, Sumatera Barat 25163</p>
        </div>
      </div>

      {/* Sisi Kanan: Form Login Bersih */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-sm bg-white rounded-xl border border-gray-200 p-7 shadow-xs">
          <div className="mb-6">
            <h3 className="text-xl font-bold text-gray-900 tracking-tight" style={{ fontFamily: 'Plus Jakarta Sans' }}>
              Masuk Akun
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              Gunakan NIM dan kata sandi Anda untuk mengakses sistem
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                NIM / Username
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3 text-gray-400">
                  <User className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  value={nim}
                  onChange={e => setNim(e.target.value)}
                  placeholder="Masukkan NIM Anda"
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700 transition-colors"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                Kata Sandi
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3 text-gray-400">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Masukkan kata sandi"
                  className="w-full pl-9 pr-10 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700 transition-colors"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-lg font-bold text-xs text-white bg-[#0e4b29] hover:bg-[#0b3c20] transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              style={{ fontFamily: 'Plus Jakarta Sans' }}
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Memverifikasi...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Masuk ke Akun</span>
                </>
              )}
            </button>
          </form>

          {/* Akun Demo Cepat */}
          <div className="mt-6 pt-5 border-t border-gray-200">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-2.5" style={{ fontFamily: 'Plus Jakarta Sans' }}>
              Pilihan Akun Demo (Klik untuk Isi):
            </p>
            <div className="grid gap-2">
              <button
                type="button"
                onClick={() => fillDemo('admin', 'admin123')}
                className="w-full text-left p-2.5 rounded-lg border border-gray-200 bg-gray-50 hover:bg-emerald-50 hover:border-emerald-400 transition-colors flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <Shield className="w-4 h-4 text-emerald-700" />
                  <div>
                    <span className="text-xs font-bold text-gray-800" style={{ fontFamily: 'Plus Jakarta Sans' }}>Administrator</span>
                    <p className="text-[11px] text-gray-500 mono">admin / admin123</p>
                  </div>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-white border border-gray-200 text-gray-600">Pilih</span>
              </button>

              <button
                type="button"
                onClick={() => fillDemo('2310936001', 'fasil123')}
                className="w-full text-left p-2.5 rounded-lg border border-gray-200 bg-gray-50 hover:bg-blue-50 hover:border-blue-400 transition-colors flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <UserCheck className="w-4 h-4 text-blue-700" />
                  <div>
                    <span className="text-xs font-bold text-gray-800" style={{ fontFamily: 'Plus Jakarta Sans' }}>Fasilitator (Fasil)</span>
                    <p className="text-[11px] text-gray-500 mono">2310936001 / fasil123</p>
                  </div>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-white border border-gray-200 text-gray-600">Pilih</span>
              </button>

              <button
                type="button"
                onClick={() => fillDemo('2310933001', 'penghuni123')}
                className="w-full text-left p-2.5 rounded-lg border border-gray-200 bg-gray-50 hover:bg-amber-50 hover:border-amber-400 transition-colors flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <GraduationCap className="w-4 h-4 text-amber-700" />
                  <div>
                    <span className="text-xs font-bold text-gray-800" style={{ fontFamily: 'Plus Jakarta Sans' }}>Mahasiswa Penghuni</span>
                    <p className="text-[11px] text-gray-500 mono">2310933001 / penghuni123</p>
                  </div>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-white border border-gray-200 text-gray-600">Pilih</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
