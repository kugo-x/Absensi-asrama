import { useState } from 'react'
import Cropper, { type Area } from 'react-easy-crop'
import { Camera, Eye, EyeOff, Lock, Pencil } from 'lucide-react'
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
        <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm border-2 border-[#0e4b29]">
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

/** Kartu ganti password; setelah berhasil pengguna diminta login ulang. */
export function KartuGantiPassword({ user, onLogout, pesanLuar }: { user: CurrentUser; onLogout: () => void; pesanLuar?: string }) {
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
    <div className="bg-white rounded-2xl border border-gray-200/90 shadow-2xs overflow-hidden">
      <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/70 flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-800">
          <Lock className="w-4 h-4" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>
            Keamanan & Ganti Password
          </h4>
          <p className="text-[11px] text-gray-400">Perbarui kata sandi akun secara berkala</p>
        </div>
      </div>

      <div className="p-5 space-y-4">
        <div className="grid sm:grid-cols-3 gap-3">
          {[
            { label: 'Password Lama', placeholder: 'Masukkan password lama' },
            { label: 'Password Baru', placeholder: 'Minimal 8 karakter' },
            { label: 'Konfirmasi Baru', placeholder: 'Ulangi password baru' },
          ].map((f, index) => (
            <div key={f.label}>
              <label className="block text-xs font-semibold text-gray-700 mb-1" style={{ fontFamily: 'Plus Jakarta Sans' }}>
                {f.label}
              </label>
              <div className="relative flex items-center">
                <input
                  type={showPassword === index ? 'text' : 'password'}
                  className="w-full px-3 py-2 pr-8 rounded-lg border border-gray-300 text-xs text-gray-800 outline-none focus:border-emerald-700 focus:ring-1 focus:ring-emerald-700 transition-colors placeholder:text-gray-400"
                  placeholder={f.placeholder}
                  value={[passwordLama, passwordBaru, konfirmasi][index]}
                  onChange={e => [setPasswordLama, setPasswordBaru, setKonfirmasi][index](e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(showPassword === index ? null : index)}
                  className="absolute right-2.5 text-gray-400 hover:text-gray-700 cursor-pointer"
                  aria-label={showPassword === index ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showPassword === index ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-100">
          <p className="text-[11px] text-gray-400">Setelah password diubah, Anda akan diminta login ulang demi keamanan.</p>
          <div className="flex items-center gap-3">
            {tampilPesan && <p className="text-xs font-semibold text-emerald-700">{tampilPesan}</p>}
            <button
              type="button"
              onClick={simpanPassword}
              className="py-2 px-5 rounded-lg font-bold text-xs text-white bg-[#0e4b29] hover:bg-[#0b3c20] transition-colors shadow-2xs cursor-pointer"
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
    </div>
  )
}
