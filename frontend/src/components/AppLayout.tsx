import { useState } from 'react'
import type { CurrentUser } from '../types'
import { Building2, LogOut, Menu, X, Shield, UserCheck, GraduationCap, Calendar } from 'lucide-react'

interface NavItem { id: string; label: string; icon: React.ReactNode }

interface Props {
  user: CurrentUser
  onLogout: () => void
  navItems: NavItem[]
  activeTab: string
  onTabChange: (id: string) => void
  children: React.ReactNode
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  fasil: 'Fasilitator',
  penghuni: 'Penghuni Asrama',
}

const ROLE_ICONS: Record<string, React.ReactNode> = {
  admin: <Shield className="w-3.5 h-3.5" />,
  fasil: <UserCheck className="w-3.5 h-3.5" />,
  penghuni: <GraduationCap className="w-3.5 h-3.5" />,
}

export default function AppLayout({ user, onLogout, navItems, activeTab, onTabChange, children }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const todayFormatted = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date())

  return (
    <div className="flex min-h-screen bg-[#f4f6f4] text-gray-800">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/40 z-30 lg:hidden" 
          onClick={() => setSidebarOpen(false)} 
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 inset-y-0 left-0 z-40 flex flex-col w-64 h-screen bg-[#0f3d23] text-white transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full'
        }`}
      >
        {/* Brand */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-600/40 border border-emerald-400/30 flex items-center justify-center text-emerald-300">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-sm leading-tight tracking-tight text-white" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                SIP Asrama
              </div>
              <div className="text-[11px] font-medium text-emerald-300">
                Universitas Andalas
              </div>
            </div>
          </div>
          <button 
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1 rounded-md text-white/70 hover:text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Card */}
        <div className="px-5 py-3.5 border-b border-white/10 bg-black/15">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-700 text-white font-bold text-xs flex items-center justify-center border border-emerald-500/40">
              {user.nama.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white truncate" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                {user.nama}
              </p>
              <p className="text-[11px] text-emerald-200/80 truncate mono">
                {user.nim}
              </p>
            </div>
          </div>
          <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-900/60 border border-emerald-700/50 text-[11px] font-semibold text-emerald-200">
            {ROLE_ICONS[user.role]}
            <span>{ROLE_LABELS[user.role]}</span>
          </div>
        </div>

        {/* Navigation List */}
        <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
          <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300/60" style={{ fontFamily: 'Plus Jakarta Sans' }}>
            Menu Aplikasi
          </p>
          {navItems.map(item => {
            const isActive = activeTab === item.id
            return (
              <button
                key={item.id}
                onClick={() => { onTabChange(item.id); setSidebarOpen(false) }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-colors text-left cursor-pointer ${
                  isActive
                    ? 'bg-emerald-800 text-white border-l-3 border-emerald-300 shadow-2xs font-bold'
                    : 'text-white/80 hover:bg-white/10 hover:text-white'
                }`}
                style={{ fontFamily: 'Plus Jakarta Sans' }}
              >
                <span className={isActive ? 'text-emerald-300' : 'text-emerald-400/80'}>
                  {item.icon}
                </span>
                <span className="flex-1 truncate">{item.label}</span>
              </button>
            )
          })}
        </nav>

        {/* Logout Button */}
        <div className="p-3 border-t border-white/10">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-red-200 hover:bg-red-500/20 hover:text-white transition-colors cursor-pointer text-left"
            style={{ fontFamily: 'Plus Jakarta Sans' }}
          >
            <LogOut className="w-4 h-4 text-red-300" />
            <span>Keluar Akun</span>
          </button>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="sticky top-0 z-20 flex items-center justify-between px-5 lg:px-8 py-3.5 bg-white border-b border-gray-200">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setSidebarOpen(true)} 
              className="lg:hidden p-1.5 rounded-md text-gray-600 hover:bg-gray-100"
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
            <div className="hidden sm:flex items-center gap-2 rounded-md px-2.5 py-1 bg-gray-50 border border-gray-200 text-xs text-gray-700 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
              <span>{ROLE_LABELS[user.role]}</span>
            </div>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 p-5 lg:p-7 max-w-7xl w-full mx-auto">
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

export function Badge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string }> = {
    'Hadir': { bg: 'bg-emerald-50 border-emerald-300 text-emerald-800' },
    'Tidak Hadir': { bg: 'bg-rose-50 border-rose-300 text-rose-800' },
    'Izin': { bg: 'bg-amber-50 border-amber-300 text-amber-800' },
    'Pending': { bg: 'bg-orange-50 border-orange-300 text-orange-800' },
    'Disetujui': { bg: 'bg-blue-50 border-blue-300 text-blue-800' },
    'Ditolak': { bg: 'bg-red-50 border-red-300 text-red-800' },
    'Aktif': { bg: 'bg-emerald-50 border-emerald-300 text-emerald-800' },
    'Non-aktif': { bg: 'bg-gray-100 border-gray-300 text-gray-700' },
    'Belum': { bg: 'bg-gray-100 border-gray-300 text-gray-600' },
  }

  const current = map[status] || { bg: 'bg-gray-100 border-gray-300 text-gray-700' }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border ${current.bg}`} style={{ fontFamily: 'Plus Jakarta Sans' }}>
      {status}
    </span>
  )
}
