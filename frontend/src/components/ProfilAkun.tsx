import { useState, type ReactNode } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import { Camera, ChevronRight, Eye, EyeOff, Lock, Pencil } from 'lucide-react'
import type { CurrentUser } from '../types'
import { ConfirmDialog } from './AppLayout'
import { changePasswordApi, uploadProfilePhotoApi } from '../api'

/** Perbarui data akun yang tersimpan di perangkat lalu beri tahu App agar tampilan ikut berubah. */
export function simpanUserLokal(perubahan: Partial<CurrentUser>) {
  const saved = JSON.parse(localStorage.getItem('sip-asrama-user') || '{}')
  localStorage.setItem('sip-asrama-user', JSON.stringify({ ...saved, ...perubahan }))
  window.dispatchEvent(new Event('profile-updated'))
}

async function potongFoto(imageSrc: string, crop: Area): Promise<string> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image()
    element.onload = () => resolve(element)
    element.onerror = reject
    element.src = imageSrc
  })
  const canvas = document.createElement('canvas')
  const scale = Math.min(1, 640 / crop.width, 640 / crop.height)
  canvas.width = Math.round(crop.width * scale)
  canvas.height = Math.round(crop.height * scale)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas foto tidak tersedia.')
  context.drawImage(image, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.9)
}

/** Foto profil yang bisa diklik untuk diganti (pilih → potong → konfirmasi → simpan). */
export function AvatarProfil({ user, onPesan }: { user: CurrentUser; onPesan?: (pesan: string) => void }) {
  const [fotoProfil, setFotoProfil] = useState(user.fotoProfil || '')
  const [fotoDipilih, setFotoDipilih] = useState<string | null>(null)
  const [pendingFoto, setPendingFoto] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [savingFoto, setSavingFoto] = useState(false)
  const pesan = (p: string) => onPesan?.(p)

  const pilihFoto = (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) return pesan('File foto harus berupa gambar.')
    const reader = new FileReader()
    reader.onload = () => {
      setFotoDipilih(String(reader.result))
      setCrop({ x: 0, y: 0 })
      setZoom(1)
    }
    reader.readAsDataURL(file)
  }

  const selesaiCrop = async () => {
    if (!fotoDipilih || !croppedAreaPixels) return
    try {
      setPendingFoto(await potongFoto(fotoDipilih, croppedAreaPixels))
      setFotoDipilih(null)
    } catch {
      pesan('Foto tidak dapat diproses.')
    }
  }

  const konfirmasiFoto = async () => {
    if (!pendingFoto) return
    const foto = pendingFoto
    setSavingFoto(true)
    try {
      const result = await uploadProfilePhotoApi(user.nim, foto)
      if (result.ok || result.offline) {
        setFotoProfil(foto)
        setPendingFoto(null)
        simpanUserLokal({ fotoProfil: foto })
      }
      pesan(result.message)
    } catch {
      pesan('Foto profil gagal disimpan. Coba lagi.')
    } finally {
      setSavingFoto(false)
    }
  }

  return (
    <>
      <div className="relative inline-block mx-auto">
        <label
          htmlFor={`foto-profil-${user.nim}`}
          className="relative w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-bold bg-white/10 backdrop-blur-md text-white border-2 border-white/30 shadow-md overflow-hidden cursor-pointer group transition-transform hover:scale-105"
          title="Klik untuk ganti foto profil"
        >
          {fotoProfil ? (
            <img src={fotoProfil} alt="Foto profil" className="w-full h-full object-cover" />
          ) : (
            user.nama.charAt(0).toUpperCase()
          )}
          <input id={`foto-profil-${user.nim}`} type="file" accept="image/*" className="hidden" onChange={e => { pilihFoto(e.target.files?.[0]); e.target.value = '' }} />
          <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Camera className="w-5 h-5 text-white" />
            <span className="text-[10px] text-white font-medium mt-0.5">Ubah</span>
          </div>
        </label>
        <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm border-2 border-[#17603d]">
          <Pencil className="h-3 w-3" />
        </span>
      </div>

      {fotoDipilih && (
        <ConfirmDialog
          title="Sesuaikan Foto Profil"
          message="Geser dan atur ukuran foto sebelum melanjutkan."
          confirmLabel="Gunakan Foto Ini"
          onCancel={() => setFotoDipilih(null)}
          onConfirm={selesaiCrop}
        >
          <div className="relative h-64 overflow-hidden rounded-xl bg-gray-900">
            <Cropper
              image={fotoDipilih}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="rect"
              showGrid
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_, pixels) => setCroppedAreaPixels(pixels)}
            />
          </div>
          <label className="mt-4 block text-xs font-bold text-gray-700">
            Zoom
            <input type="range" min={1} max={3} step={0.1} value={zoom} onChange={e => setZoom(Number(e.target.value))} className="mt-2 w-full accent-emerald-700" />
          </label>
        </ConfirmDialog>
      )}
      {pendingFoto && (
        <ConfirmDialog
          title="Konfirmasi Foto Profil"
          message="Gunakan foto ini sebagai foto profil akun Anda?"
          confirmLabel="Simpan Foto"
          onCancel={() => setPendingFoto(null)}
          onConfirm={konfirmasiFoto}
          loading={savingFoto}
        >
          <img src={pendingFoto} alt="Pratinjau foto profil" className="mx-auto h-40 w-40 rounded-xl object-cover border border-emerald-100" />
        </ConfirmDialog>
      )}
    </>
  )
}

// ------------------------------------------------------------------ tata letak halaman profil

export interface StatProfil {
  label: string
  nilai: ReactNode
  onClick?: () => void
  sorot?: boolean // diberi penanda (mis. ada yang menunggu tindakan)
}

/** Banner identitas selebar halaman: foto, nama, NIM, peran, dan ringkasan angka di kanan. */
export function ProfilHeader({ user, peran, keterangan, stats, onPesan }: {
  user: CurrentUser
  peran: string
  keterangan?: ReactNode
  stats: StatProfil[]
  onPesan?: (pesan: string) => void
}) {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-[#0f3e2d] via-[#17603d] to-[#27a150] text-white p-5 sm:p-6 shadow-md">
      <div className="flex flex-col lg:flex-row lg:items-center gap-5">
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <div className="shrink-0"><AvatarProfil user={user} onPesan={onPesan} /></div>
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/15 border border-white/20 text-[11px] font-semibold text-emerald-50">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-300" />
              {peran}
            </span>
            <h2 className="mt-1.5 text-xl sm:text-2xl font-extrabold tracking-tight truncate" style={{ fontFamily: 'Plus Jakarta Sans' }}>{user.nama}</h2>
            <p className="text-xs text-emerald-50/80 mt-0.5 truncate">
              <span className="mono tracking-wide">{user.nim}</span>
              {keterangan ? <span> · {keterangan}</span> : null}
            </p>
          </div>
        </div>
        <div className={`grid gap-2.5 ${stats.length >= 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
          {stats.map(s => {
            const isi = (
              <>
                <p className="text-[11px] font-semibold text-emerald-50/75 leading-tight sm:truncate">{s.label}</p>
                <p className="mt-0.5 text-base sm:text-lg font-extrabold tabular-nums flex items-center gap-1.5 leading-tight" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                  {s.nilai}
                  {s.sorot && <span className="w-2 h-2 rounded-full bg-amber-300" aria-label="perlu tindakan" />}
                </p>
              </>
            )
            const kelas = 'min-w-0 lg:w-36 text-left px-3 py-2.5 sm:px-4 sm:py-3 rounded-xl bg-white/10 border border-white/15'
            return s.onClick ? (
              <button key={s.label} type="button" onClick={s.onClick} className={`${kelas} hover:bg-white/20 transition-colors cursor-pointer relative group`}>
                {isi}
                <ChevronRight className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40 group-hover:text-white/80" />
              </button>
            ) : (
              <div key={s.label} className={kelas}>{isi}</div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/** Kartu standar halaman profil; tingginya mengikuti pasangan di baris yang sama. */
export function KartuProfil({ ikon, judul, sub, kanan, children, className = '' }: {
  ikon: ReactNode
  judul: string
  sub?: string
  kanan?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-200/90 shadow-2xs overflow-hidden flex flex-col h-full ${className}`}>
      <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
        <div className="w-9 h-9 shrink-0 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center [&_svg]:w-[18px] [&_svg]:h-[18px]">{ikon}</div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-bold text-gray-900 truncate" style={{ fontFamily: 'Plus Jakarta Sans' }}>{judul}</h4>
          {sub && <p className="text-[11px] text-gray-400 leading-snug sm:truncate">{sub}</p>}
        </div>
        {kanan}
      </div>
      <div className="flex-1 flex flex-col">{children}</div>
    </div>
  )
}

/** Kartu ganti password; setelah berhasil pengguna diminta login ulang. */
export function KartuGantiPassword({ user, onLogout, pesanLuar, susun = false }: { user: CurrentUser; onLogout: () => void; pesanLuar?: string; susun?: boolean }) {
  const [passwordLama, setPasswordLama] = useState('')
  const [passwordBaru, setPasswordBaru] = useState('')
  const [konfirmasi, setKonfirmasi] = useState('')
  const [showPassword, setShowPassword] = useState<number | null>(null)
  const [konfirmasiUbah, setKonfirmasiUbah] = useState(false)
  const [berhasil, setBerhasil] = useState(false)
  const [notice, setNotice] = useState('')
  const tampilPesan = notice || pesanLuar || ''

  const simpanPassword = () => {
    setNotice('')
    if (passwordBaru.length < 8) return setNotice('Password baru minimal 8 karakter.')
    if (passwordBaru !== konfirmasi) return setNotice('Konfirmasi password tidak sama.')
    setKonfirmasiUbah(true)
  }

  const ubahPassword = async () => {
    const result = await changePasswordApi(user.nim, passwordLama, passwordBaru)
    setNotice(result.message)
    setKonfirmasiUbah(false)
    if (result.ok) {
      setPasswordLama('')
      setPasswordBaru('')
      setKonfirmasi('')
      setBerhasil(true)
    }
  }

  return (
    <KartuProfil ikon={<Lock />} judul="Keamanan & Ganti Password" sub="Perbarui kata sandi akun secara berkala">
      <div className="p-5 flex-1 flex flex-col gap-4">
        <div className={`grid gap-3 ${susun ? '' : 'sm:grid-cols-3'}`}>
          {[
            { label: 'Password Lama', placeholder: 'Masukkan password lama' },
            { label: 'Password Baru', placeholder: 'Minimal 8 karakter' },
            { label: 'Konfirmasi Baru', placeholder: 'Ulangi password baru' },
          ].map((f, index) => (
            <div key={f.label}>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                {f.label}
              </label>
              <div className="relative flex items-center">
                <input
                  type={showPassword === index ? 'text' : 'password'}
                  className="w-full px-3.5 py-2.5 pr-9 rounded-xl border border-gray-200 text-sm text-gray-800 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/15 transition-colors placeholder:text-gray-400"
                  placeholder={f.placeholder}
                  value={[passwordLama, passwordBaru, konfirmasi][index]}
                  onChange={e => [setPasswordLama, setPasswordBaru, setKonfirmasi][index](e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(showPassword === index ? null : index)}
                  className="absolute right-1 p-2 rounded-lg text-gray-400 hover:text-gray-700 cursor-pointer"
                  aria-label={showPassword === index ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showPassword === index ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-gray-100">
          <p className="text-[11px] text-gray-400">Setelah password diubah, Anda akan diminta login ulang.</p>
          <div className="flex items-center gap-3">
            {tampilPesan && <p className="text-xs font-semibold text-emerald-700">{tampilPesan}</p>}
            <button
              type="button"
              onClick={simpanPassword}
              className="py-2.5 px-5 rounded-xl font-bold text-xs text-white bg-[#141a17] hover:bg-[#2a332e] transition-colors shadow-2xs cursor-pointer"
              style={{ fontFamily: 'Plus Jakarta Sans' }}
            >
              Simpan Perubahan
            </button>
          </div>
        </div>
      </div>

      {konfirmasiUbah && (
        <ConfirmDialog
          title="Konfirmasi Perubahan Password"
          message="Password belum diubah. Tekan Oke untuk menyimpan password baru, atau Batal untuk tetap menggunakan password lama."
          confirmLabel="Oke"
          onCancel={() => setKonfirmasiUbah(false)}
          onConfirm={ubahPassword}
        />
      )}
      {berhasil && (
        <ConfirmDialog
          title="Password Akun Berhasil Diubah"
          message="Demi keamanan, Anda akan logout dan perlu login kembali dengan password baru."
          confirmLabel="Oke"
          hideCancel
          onCancel={onLogout}
          onConfirm={onLogout}
        />
      )}
    </KartuProfil>
  )
}
