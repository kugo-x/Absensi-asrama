import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CurrentUser } from '../types'
import NotifikasiBell, { type Notifikasi } from './Notifikasi'
import BannerKoneksi from './BannerKoneksi'
import { Building2, LogOut, Menu, X, Shield, UserCheck, GraduationCap, Calendar, ChevronLeft } from 'lucide-react'

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

  // Animasi keluar untuk modal, toast, dan popup. Komponen-komponen itu dilepas React
  // seketika saat ditutup; agar tidak hilang mendadak, salinan visualnya (tidak bisa diklik,
  // tanpa state) dipudarkan sebentar lalu dibuang. Murni tampilan — logika tidak tersentuh.
  const lapisanKeluar = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const SALINAN = ['modal-keluar', 'toast-keluar', 'pop-keluar']
    const mo = new MutationObserver(daftar => {
      for (const m of daftar) {
        m.removedNodes.forEach(node => {
          if (!(node instanceof HTMLElement) || SALINAN.some(k => node.classList.contains(k))) return
          const induk = m.target as HTMLElement
          let wadah: Element | null = null
          let kelas = ''
          if (node.classList.contains('dp-pop') && induk === document.body) {
            wadah = document.body
            kelas = 'pop-keluar'
          } else if (node.classList.contains('fixed') && induk.closest('main') && lapisanKeluar.current) {
            wadah = lapisanKeluar.current
            kelas = node.classList.contains('inset-0') ? 'modal-keluar' : 'toast-keluar'
          }
          if (!wadah) return
          const salinan = node.cloneNode(true) as HTMLElement
          salinan.classList.remove('dp-pop')
          salinan.classList.add(kelas)
          salinan.setAttribute('aria-hidden', 'true')
          salinan.setAttribute('inert', '')
          salinan.style.pointerEvents = 'none'
          salinan.removeAttribute('id')
          salinan.querySelectorAll('[id]').forEach(e => e.removeAttribute('id'))
          wadah.appendChild(salinan)
          const buang = () => salinan.remove()
          salinan.addEventListener('animationend', e => { if (e.target === salinan) buang() })
          window.setTimeout(buang, 450)
        })
      }
    })
    mo.observe(document.body, { childList: true, subtree: true })
    return () => mo.disconnect()
  }, [])

  // Judul tab browser mengikuti halaman yang sedang dibuka
  const judulHalaman = (navItems.find(n => n.id === activeTab)?.label ?? 'Dashboard').replace(/\s*\(\d+\)$/, '')
  useEffect(() => {
    document.title = `${judulHalaman} · SIP Asrama`
  }, [judulHalaman])

  // Teks sidebar memudar saat diciutkan (cepat) dan muncul kembali setelah panel cukup lebar
  const pudar = `transition-opacity ${ciut ? 'duration-150 lg:opacity-0 lg:pointer-events-none' : 'duration-300 delay-150'}`

  // Kelompok menu di sidebar: profil dipisah ke bagian "Akun"
  const grupMenu = [
    { judul: 'Menu Utama', items: navItems.filter(n => n.id !== 'profil') },
    { judul: 'Akun', items: navItems.filter(n => n.id === 'profil') },
  ].filter(g => g.items.length > 0)

  // Penanda menu aktif yang bergeser mengikuti tombol menu yang dipilih
  const tombolRef = useRef<Record<string, HTMLButtonElement | null>>({})
  const [indikator, setIndikator] = useState<{ top: number; height: number } | null>(null)
  const navRef = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    const ukur = () => {
      const el = tombolRef.current[activeTab]
      const baru = el ? { top: el.offsetTop, height: el.offsetHeight } : null
      setIndikator(lama => (lama && baru && lama.top === baru.top && lama.height === baru.height ? lama : baru))
    }
    ukur()
    // Ukur ulang setiap kali ukuran sidebar berubah (termasuk selama animasi ciut/lebar),
    // agar penanda tidak tertinggal di posisi saat sidebar masih sempit.
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(ukur) : null
    if (navRef.current) ro?.observe(navRef.current)
    window.addEventListener('resize', ukur)
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', ukur)
    }
  }, [activeTab, ciut, navItems.length])

  const todayFormatted = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date())

  return (
    <div className="liquid flex min-h-screen text-gray-800">
      {/* Latar laci menu (mobile): selalu ada agar bisa memudar masuk & keluar */}
      <div
        aria-hidden={!sidebarOpen}
        className={`fixed inset-0 bg-gray-950/40 backdrop-blur-sm z-45 lg:hidden transition-opacity duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar: panel mengambang di desktop, laci geser di mobile.
          Saat diciutkan, ikon TIDAK berpindah posisi: panel hanya menyempit dan teks memudar,
          sehingga animasinya mulus (tanpa lompatan tata letak). */}
      <div className={`group/sidebar fixed lg:sticky top-0 left-0 z-50 lg:z-40 h-screen shrink-0 lg:p-3 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] lg:translate-x-0 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <aside
          className={`relative flex flex-col h-full overflow-hidden text-white lg:rounded-[24px] transition-[width] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${
            ciut ? 'lg:w-[68px]' : 'lg:w-[252px]'
          } w-[276px]`}
          style={{
            background: 'linear-gradient(180deg, #0f3322 0%, #0b2a1c 45%, #092317 100%)',
            boxShadow: 'inset 0 0 0 1px rgb(255 255 255 / 0.06), inset 0 1px 0 rgb(255 255 255 / 0.06), 0 14px 36px -16px rgb(17 24 39 / 0.5)',
            fontFamily: 'Plus Jakarta Sans',
          }}
        >
          {/* Brand */}
          <div className="flex items-center gap-3 shrink-0 h-[76px] pl-4 pr-3">
            <div className="w-9 h-9 shrink-0 rounded-xl bg-emerald-400 flex items-center justify-center text-emerald-950 shadow-[inset_0_-2px_0_rgb(0_0_0/0.12)]">
              <Building2 className="w-5 h-5" strokeWidth={2.3} />
            </div>
            <div className={`min-w-0 flex-1 whitespace-nowrap ${pudar}`}>
              <div className="font-extrabold text-[15px] leading-tight tracking-tight">SIP Asrama</div>
              <div className="text-[11px] font-medium text-emerald-200/50">Universitas Andalas</div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              aria-label="Tutup menu"
              className="lg:hidden w-8 h-8 shrink-0 flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/8 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mx-3 h-px shrink-0 bg-white/[0.07]" />

          {/* Navigasi */}
          <nav ref={navRef} className="relative flex-1 overflow-y-auto overflow-x-hidden px-3 py-4">
            {/* Penanda menu aktif yang bergeser (efek pegas) */}
            {indikator && (
              <span
                aria-hidden
                className="absolute left-3 right-3 rounded-xl ring-1 ring-inset ring-emerald-300/15 transition-[translate,height] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] will-change-[translate]"
                style={{
                  top: 0,
                  height: indikator.height,
                  translate: `0 ${indikator.top}px`,
                  background: 'linear-gradient(90deg, rgb(52 211 153 / 0.2) 0%, rgb(52 211 153 / 0.07) 60%, rgb(52 211 153 / 0.03) 100%)',
                }}
              >
                <span className="absolute -left-3 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-emerald-400" />
              </span>
            )}

            {grupMenu.map(grup => (
              <div key={grup.judul} className="mb-4 last:mb-0">
                <p className={`px-3 pb-2 whitespace-nowrap overflow-hidden text-[10.5px] font-semibold uppercase tracking-[0.14em] text-emerald-100/30 ${pudar}`}>
                  {grup.judul}
                </p>
                <div className="space-y-1">
                  {grup.items.map(item => {
                    const isActive = activeTab === item.id
                    // Label seperti "Validasi Foto (3)" ditampilkan sebagai label + badge angka
                    const m = item.label.match(/^(.*?)\s*\((\d+)\)$/)
                    const label = m ? m[1] : item.label
                    const badge = m ? m[2] : null
                    return (
                      <button
                        key={item.id}
                        ref={el => { tombolRef.current[item.id] = el }}
                        onClick={() => { onTabChange(item.id); setSidebarOpen(false) }}
                        title={ciut ? item.label : undefined}
                        aria-current={isActive ? 'page' : undefined}
                        className={`group relative z-10 w-full flex items-center gap-3 h-11 px-3 rounded-xl text-[13.5px] text-left whitespace-nowrap cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 ${
                          isActive ? 'text-white font-semibold' : 'text-emerald-50/60 font-medium hover:text-white hover:bg-white/[0.045]'
                        }`}
                      >
                        <span className={`relative shrink-0 [&_svg]:w-[19px] [&_svg]:h-[19px] transition-[color,scale] duration-300 ${
                          isActive ? 'text-emerald-300' : 'text-emerald-100/40 group-hover:text-emerald-100/80 group-hover:scale-110'
                        }`}>
                          {item.icon}
                          {badge && (
                            <span className={`absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-[#0b2a1c] transition-opacity duration-300 opacity-0 ${ciut ? 'lg:opacity-100' : ''}`} />
                          )}
                        </span>
                        <span className={`flex-1 min-w-0 truncate ${pudar}`}>{label}</span>
                        {badge && (
                          <span className={`min-w-5 h-5 px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center tabular-nums bg-amber-400 text-amber-950 ${pudar}`}>
                            {badge}
                          </span>
                        )}
                        {isActive && !badge && (
                          <span className={`w-1.5 h-1.5 shrink-0 rounded-full bg-emerald-400/80 ${pudar}`} />
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* Profil + keluar */}
          <div className="shrink-0 px-3 pb-3 pt-2 space-y-1">
            <div className="h-px bg-white/[0.07] mb-2" />
            <div className="flex items-center gap-3 h-12 pl-1 pr-2 rounded-xl whitespace-nowrap" title={ciut ? `${user.nama} · ${ROLE_LABELS[user.role]}` : undefined}>
              <div className="relative shrink-0">
                <div className="w-9 h-9 rounded-full bg-emerald-600 text-white font-bold text-[12px] tracking-wide flex items-center justify-center overflow-hidden ring-2 ring-emerald-300/25">
                  {user.fotoProfil ? <img src={user.fotoProfil} alt="Foto profil" className="h-full w-full object-cover" /> : inisial(user.nama)}
                </div>
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#092317]" aria-label="Sedang aktif" />
              </div>
              <div className={`flex-1 min-w-0 ${pudar}`}>
                <p className="text-[13.5px] font-bold leading-tight truncate" title={user.nama}>{user.nama}</p>
                <p className="flex items-center gap-1 mt-0.5 text-[11px] font-medium text-emerald-200/55 truncate [&_svg]:w-3 [&_svg]:h-3">
                  {ROLE_ICONS[user.role]}
                  <span className="truncate">{ROLE_PENDEK[user.role]}</span>
                </p>
              </div>
            </div>
            <button
              onClick={onLogout}
              aria-label="Keluar akun"
              title={ciut ? 'Keluar akun' : undefined}
              className="group w-full flex items-center gap-3 h-11 px-3 rounded-xl text-[13.5px] font-medium text-left whitespace-nowrap text-emerald-50/50 hover:text-rose-200 hover:bg-rose-500/15 cursor-pointer"
            >
              <LogOut className="w-[19px] h-[19px] shrink-0 text-emerald-100/40 group-hover:text-rose-300 transition-colors duration-300" />
              <span className={pudar}>Keluar Akun</span>
            </button>
          </div>
        </aside>

        {/* Tombol ciutkan/lebarkan: bulatan di tepi kanan sidebar (desktop) */}
        <button
          onClick={() => setCiut(c => !c)}
          aria-label={ciut ? 'Lebarkan menu' : 'Ciutkan menu'}
          title={ciut ? 'Lebarkan menu' : 'Ciutkan menu'}
          className={`hidden lg:flex absolute right-0 top-[50px] z-10 w-6 h-6 items-center justify-center rounded-full bg-white text-emerald-900 ring-1 ring-black/5 shadow-[0_2px_8px_-2px_rgb(17_24_39/0.35)] hover:scale-110 hover:bg-emerald-50 transition-[scale,background-color] duration-300 cursor-pointer`}
        >
          <ChevronLeft className={`w-3.5 h-3.5 transition-[rotate] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] ${ciut ? 'rotate-180' : ''}`} strokeWidth={2.5} />
        </button>
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
          <BannerKoneksi />
          {children}
          {/* Wadah salinan animasi keluar (tanpa anak React) */}
          <div ref={lapisanKeluar} className="contents" aria-hidden />
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
