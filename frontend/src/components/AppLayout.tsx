import { useEffect, useState } from 'react'
import type { CurrentUser } from '../types'
import NotifikasiBell, { type Notifikasi } from './Notifikasi'
import { Building2, LogOut, Menu, X, Shield, UserCheck, GraduationCap, Calendar, PanelLeftClose, PanelLeftOpen } from 'lucide-react'

interface NavItem { id: string; label: string; icon: React.ReactNode }

interface Props {
  user: CurrentUser
  onLogout: () => void
  navItems: NavItem[]
  activeTab: string
  onTabChange: (id: string) => void
  children: React.ReactNode
  // Notifikasi turunan data halaman (permintaan masuk, keputusan, peringatan)
  notifikasi?: Notifikasi[]
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  fasil: 'Fasilitator',
  penghuni: 'Penghuni Asrama',
}

// Label singkat untuk kartu profil sidebar (label panjang terpotong di lebar sidebar)
const ROLE_PENDEK: Record<string, string> = {
  admin: 'Admin',
  fasil: 'Fasilitator',
  penghuni: 'Penghuni',
}

// Inisial dua huruf dari nama, mis. "Ahmad Fauzi" -> "AF"
function inisial(nama: string): string {
  const kata = nama.trim().split(/\s+/).filter(Boolean)
  return ((kata[0]?.[0] ?? '') + (kata.length > 1 ? kata[kata.length - 1][0] : '')).toUpperCase() || '?'
}

const ROLE_ICONS: Record<string, React.ReactNode> = {
  admin: <Shield className="w-3.5 h-3.5" />,
  fasil: <UserCheck className="w-3.5 h-3.5" />,
  penghuni: <GraduationCap className="w-3.5 h-3.5" />,
}

export default function AppLayout({ user, onLogout, navItems, activeTab, onTabChange, children, notifikasi = [] }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  // Sidebar desktop diciutkan jadi ikon saja; diingat per perangkat
  const [ciut, setCiut] = useState(() => {
    try { return localStorage.getItem('sip-sidebar-ciut') === '1' } catch { return false }
  })

  useEffect(() => {
    try { localStorage.setItem('sip-sidebar-ciut', ciut ? '1' : '0') } catch { /* penyimpanan tidak tersedia */ }
  }, [ciut])

  useEffect(() => {
    setSidebarOpen(false)
  }, [activeTab])

  const todayFormatted = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date())

  return (
    <div className="liquid flex min-h-screen text-gray-800">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-gray-950/40 backdrop-blur-sm z-45 lg:hidden"
          onClick={() => setSidebarOpen(false)} 
        />
      )}

      {/* Sidebar: panel mengambang di desktop, laci geser di mobile */}
      <div className={`fixed lg:sticky top-0 left-0 z-50 lg:z-40 h-screen shrink-0 lg:p-3 transition-transform duration-300 ease-out lg:translate-x-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <aside
          className={`relative flex flex-col h-full overflow-hidden text-white lg:rounded-3xl lg:border lg:border-white/10 backdrop-blur-xl transition-[width] duration-300 ease-out ${
            ciut ? 'lg:w-19' : 'lg:w-62'
          } w-68`}
          style={{
            // Panel gelap polos, sedikit tembus pandang
            background: 'rgb(12 44 29 / 0.96)',
            boxShadow: 'inset 0 1px 0 rgb(255 255 255 / 0.08), 0 10px 30px -12px rgb(17 24 39 / 0.35)',
            fontFamily: 'Plus Jakarta Sans',
          }}
        >
          {/* Brand */}
          <div className={`relative flex items-center gap-3 pt-5 pb-4 ${ciut ? 'lg:justify-center lg:px-0' : ''} px-5`}>
            <div className="w-10 h-10 shrink-0 rounded-2xl bg-emerald-500 flex items-center justify-center text-white">
              <Building2 className="w-5 h-5" strokeWidth={2.4} />
            </div>
            <div className={`min-w-0 flex-1 ${ciut ? 'lg:hidden' : ''}`}>
              <div className="font-extrabold text-[15px] leading-tight tracking-tight">SIP Asrama</div>
              <div className="text-[11px] font-medium text-emerald-300/80 truncate">Universitas Andalas</div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              aria-label="Tutup menu"
              className="lg:hidden p-1.5 rounded-xl text-white/60 hover:text-white hover:bg-white/10 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigasi */}
          <nav className={`relative flex-1 overflow-y-auto overflow-x-hidden py-2 space-y-1 ${ciut ? 'lg:px-3' : ''} px-3`}>
            <p className={`px-3 pt-2 pb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-200/40 ${ciut ? 'lg:hidden' : ''}`}>
              Menu
            </p>
            {navItems.map(item => {
              const isActive = activeTab === item.id
              // Label seperti "Validasi Foto (3)" ditampilkan sebagai label + badge angka
              const m = item.label.match(/^(.*?)\s*\((\d+)\)$/)
              const label = m ? m[1] : item.label
              const badge = m ? m[2] : null
              return (
                <button
                  key={item.id}
                  onClick={() => { onTabChange(item.id); setSidebarOpen(false) }}
                  title={ciut ? item.label : undefined}
                  aria-current={isActive ? 'page' : undefined}
                  className={`group relative w-full flex items-center gap-3 rounded-2xl text-[13px] font-semibold text-left cursor-pointer transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/70 ${
                    ciut ? 'lg:justify-center lg:px-0 lg:py-2' : ''
                  } px-2 py-2 ${
                    isActive
                      ? 'bg-white text-emerald-950 shadow-lg shadow-black/20'
                      : 'text-emerald-50/70 hover:text-white hover:bg-white/7'
                  }`}
                >
                  <span className={`relative w-9 h-9 shrink-0 rounded-xl flex items-center justify-center transition-colors ${
                    isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-white/6 text-emerald-300/90 group-hover:bg-white/10 group-hover:text-emerald-200'
                  }`}>
                    {item.icon}
                    {badge && ciut && (
                      <span className="hidden lg:block absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-[#0a2e1c]" />
                    )}
                  </span>
                  <span className={`flex-1 truncate ${ciut ? 'lg:hidden' : ''}`}>{label}</span>
                  {badge && (
                    <span className={`min-w-5 h-5 px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center ${
                      isActive ? 'bg-emerald-600 text-white' : 'bg-amber-400 text-amber-950'
                    } ${ciut ? 'lg:hidden' : ''}`}>
                      {badge}
                    </span>
                  )}
                </button>
              )
            })}
          </nav>

          {/* Ciutkan (desktop) */}
          <div className={`relative hidden lg:flex px-3 pb-2 ${ciut ? 'justify-center' : 'justify-end'}`}>
            <button
              onClick={() => setCiut(c => !c)}
              aria-label={ciut ? 'Lebarkan menu' : 'Ciutkan menu'}
              title={ciut ? 'Lebarkan menu' : 'Ciutkan menu'}
              className="p-2 rounded-xl text-emerald-200/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              {ciut ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </button>
          </div>

          {/* Profil + keluar */}
          <div className="relative p-3 pt-2">
            <div className={`group/profil flex items-center gap-3 rounded-2xl bg-white/5 border border-white/10 transition-colors hover:bg-white/8 ${
              ciut ? 'lg:flex-col lg:p-2 lg:gap-2' : ''
            } p-2`}>
              {/* Avatar: foto profil atau inisial */}
              <div className="relative shrink-0" title={ciut ? `${user.nama} · ${ROLE_LABELS[user.role]}` : undefined}>
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white font-extrabold text-[13px] tracking-wide flex items-center justify-center overflow-hidden ring-1 ring-white/15">
                  {user.fotoProfil ? <img src={user.fotoProfil} alt="Foto profil" className="h-full w-full object-cover" /> : inisial(user.nama)}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#0c2c1d]" aria-label="Sedang aktif" />
              </div>

              {/* Nama, NIM, peran */}
              <div className={`flex-1 min-w-0 ${ciut ? 'lg:hidden' : ''}`}>
                <p className="text-[13px] font-bold leading-tight line-clamp-2 break-words" title={user.nama}>{user.nama}</p>
                <div className="flex items-center gap-1.5 mt-1 min-w-0">
                  <span className="inline-flex items-center gap-1 shrink-0 px-1.5 py-1 rounded-md bg-emerald-400/15 text-emerald-200 text-[10px] font-bold leading-none [&_svg]:w-3 [&_svg]:h-3">
                    {ROLE_ICONS[user.role]}
                    {ROLE_PENDEK[user.role]}
                  </span>
                </div>
              </div>

              <button
                onClick={onLogout}
                aria-label="Keluar akun"
                title="Keluar akun"
                className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xl border border-white/10 text-white/60 hover:text-white hover:bg-rose-500/80 hover:border-rose-400/60 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="sticky top-0 z-20 flex items-center justify-between px-5 lg:px-8 py-3.5 bg-white/55 backdrop-blur-2xl backdrop-saturate-150 border-b border-white/70 shadow-[inset_0_-1px_0_rgb(15_61_35/0.06),0_6px_20px_-16px_rgb(17_24_39/0.2)]">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setSidebarOpen(true)} 
              className="lg:hidden p-2 rounded-xl text-gray-700 bg-white/50 border border-white/70 hover:bg-white/80 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <h2 className="font-bold text-base text-gray-900 leading-tight" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                {navItems.find(n => n.id === activeTab)?.label ?? 'Dashboard'}
              </h2>
              <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-0.5">
                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                <span>{todayFormatted}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <NotifikasiBell nim={user.nim} items={notifikasi} onBuka={onTabChange} />
            <div className="hidden sm:flex items-center gap-2 rounded-full px-3 py-1.5 bg-white/60 border border-white/80 shadow-[inset_0_1px_0_rgb(255_255_255/0.9),0_2px_8px_-4px_rgb(17_24_39/0.15)] backdrop-blur-xl text-xs text-gray-700 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
              <span>{ROLE_LABELS[user.role]}</span>
            </div>
          </div>
        </header>

        {/* Content Body */}
        <main className="min-w-0 flex-1 overflow-x-hidden p-4 lg:p-6 w-full">
          {children}
        </main>
      </div>
    </div>
  )
}

export function StatCard({ 
  icon, 
  label, 
  value, 
  sub, 
  color
}: { 
  icon: React.ReactNode
  label: string
  value: string | number
  sub?: string
  color?: string
}) {
  return (
    <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-2xs">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1" style={{ fontFamily: 'Plus Jakarta Sans' }}>
            {label}
          </p>
          <p className="text-2xl font-bold tracking-tight text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans', color: color }}>
            {value}
          </p>
          {sub && (
            <p className="text-xs text-gray-500 mt-1 font-medium">
              {sub}
            </p>
          )}
        </div>
        <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-gray-50 text-gray-600 border border-gray-100 shrink-0">
          {icon}
        </div>
      </div>
    </div>
  )
}

export function SectionTitle({ children, subtitle }: { children: React.ReactNode; subtitle?: string }) {
  return (
    <div className="mb-3.5">
      <h3 className="font-bold text-base text-gray-900 tracking-tight" style={{ fontFamily: 'Plus Jakarta Sans' }}>
        {children}
      </h3>
      {subtitle && (
        <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
      )}
    </div>
  )
}

export function ConfirmDialog({ title, message, confirmLabel = 'Konfirmasi', onCancel, onConfirm, loading = false, hideCancel = false, children }: {
  title: string
  message?: string
  confirmLabel?: string
  onCancel: () => void
  onConfirm: () => void
  loading?: boolean
  hideCancel?: boolean
  children?: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-emerald-100">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-extrabold text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>{title}</h3>
            {message && <p className="mt-1 text-sm leading-relaxed text-gray-500">{message}</p>}
          </div>
          <button type="button" onClick={onCancel} className="rounded-lg px-2 py-1 text-xl leading-none text-gray-400 hover:bg-gray-100 hover:text-gray-700 cursor-pointer" aria-label="Tutup">×</button>
        </div>
        {children && <div className="mt-5">{children}</div>}
        <div className="mt-6 flex justify-end gap-2">
          {!hideCancel && <button type="button" onClick={onCancel} className="rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-200 cursor-pointer">Batal</button>}
          <button type="button" onClick={onConfirm} disabled={loading} className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-60 cursor-pointer">
            {loading ? 'Memproses...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export function Badge({ status }: { status: string }) {
  const map: Record<string, { bg: string }> = {
    'Hadir': { bg: 'bg-emerald-50 border-emerald-300 text-emerald-800' },
    'Tidak Hadir': { bg: 'bg-rose-50 border-rose-300 text-rose-800' },
    'Izin': { bg: 'bg-amber-50 border-amber-300 text-amber-800' },
    'Pending': { bg: 'bg-orange-50 border-orange-300 text-orange-800' },
    'Disetujui': { bg: 'bg-blue-50 border-blue-300 text-blue-800' },
    'Ditolak': { bg: 'bg-red-50 border-red-300 text-red-800' },
    'Aktif': { bg: 'bg-emerald-50 border-emerald-300 text-emerald-800' },
    'Non-aktif': { bg: 'bg-gray-100 border-gray-300 text-gray-700' },
    'Belum': { bg: 'bg-gray-100 border-gray-300 text-gray-600' },
    'Libur': { bg: 'bg-sky-50 border-sky-300 text-sky-800' },
    'Fasil': { bg: 'bg-indigo-50 border-indigo-300 text-indigo-800' },
    'Penghuni': { bg: 'bg-teal-50 border-teal-300 text-teal-800' },
  }

  const current = map[status] || { bg: 'bg-gray-100 border-gray-300 text-gray-700' }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${current.bg}`} style={{ fontFamily: 'Plus Jakarta Sans' }}>
      {status}
    </span>
  )
}
