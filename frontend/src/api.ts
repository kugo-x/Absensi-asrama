import type { CurrentUser, Gedung, Kamar, Penghuni, PresensiRecord, IzinRecord, Sesi, HariLibur, PresensiStatus, ModeUji, StatusFoto, AturanPresensi } from './types'
import {
  DEMO_ACCOUNTS,
  gedungList as initialGedung,
  kamarList as initialKamar,
  penghuniList as initialPenghuni,
  presensiList as initialPresensi,
  izinList as initialIzin,
  sesiList as initialSesi,
  liburList as initialLibur,
} from './data/mockData'

const API_BASE = '/api'

const TOKEN_KEY = 'sip-asrama-token'

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function clearAuthToken() {
  localStorage.removeItem(TOKEN_KEY)
}

function authHeaders(headers: Record<string, string> = {}) {
  const token = getAuthToken()
  return token ? { ...headers, Authorization: `Bearer ${token}` } : headers
}

function isJson(res: Response) {
  return (res.headers.get('content-type') || '').includes('application/json')
}

// GET daftar data; jatuh ke data lokal jika backend tidak tersedia
async function getList<T>(path: string, fallback: T[]): Promise<T[]> {
  try {
    const res = await fetch(`${API_BASE}/${path}`, { headers: authHeaders() })
    if (res.ok && isJson(res)) {
      const data = await res.json()
      if (Array.isArray(data)) return data
    }
  } catch (e) {
    console.warn(`Falling back to local ${path} data`)
  }
  return fallback
}

export interface ApiResult {
  ok: boolean
  message: string
  // true jika backend tidak bisa dihubungi (mode demo / offline)
  offline?: boolean
}

async function postJson(path: string, body: unknown): Promise<ApiResult> {
  try {
    const res = await fetch(`${API_BASE}/${path}`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body)
    })
    // Respons non-JSON berarti API backend tidak tersedia (misal dev server tanpa backend)
    if (!isJson(res)) return { ok: false, offline: true, message: 'Server tidak dapat dihubungi.' }
    const json = await res.json()
    if (res.status === 401) {
      clearAuthToken()
      window.dispatchEvent(new Event('auth-expired'))
    }
    return { ok: res.ok, message: json.message || json.messages?.error || json.error || (res.ok ? 'Berhasil' : 'Permintaan gagal diproses.') }
  } catch (e) {
    return { ok: false, offline: true, message: 'Server tidak dapat dihubungi.' }
  }
}

// ---------- Auth ----------

export async function apiLogin(nim: string, pass: string): Promise<CurrentUser> {
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nim, password: pass })
    })
    if (isJson(res)) {
      const json = await res.json()
      if (res.ok && json.data) {
        if (json.token) localStorage.setItem(TOKEN_KEY, json.token)
        return { ...json.data, token: json.token } as CurrentUser
      }
      throw new Error(json.messages?.error || json.message || 'NIM atau password salah.')
    }
  } catch (err) {
    if (err instanceof Error && !(err instanceof TypeError)) throw err
    console.warn('Backend API login unavailable, falling back to local auth:', err)
  }

  // Fallback to demo accounts
  const account = DEMO_ACCOUNTS.find(a => a.nim === nim && a.password === pass)
  if (account) {
    const { password: _password, ...user } = account
    const offlineToken = btoa(JSON.stringify({ nim: user.nim, role: user.role, offline: true }))
    localStorage.setItem(TOKEN_KEY, offlineToken)
    return { ...user, token: offlineToken }
  }
  throw new Error('NIM atau password salah.')
}

// ---------- Master data ----------

export const fetchGedung = () => getList<Gedung>('gedung', initialGedung)
export const fetchKamar = () => getList<Kamar>('kamar', initialKamar)
export const fetchPenghuni = () => getList<Penghuni>('penghuni', initialPenghuni)
export const fetchSesi = () => getList<Sesi>('sesi', initialSesi)
export const fetchLibur = () => getList<HariLibur>('libur', initialLibur)

export const updateGedungApi = (id: number, data: { latitude: number | null; longitude: number | null; radiusMeter: number }) =>
  postJson('gedung/update', { id, ...data })

export const setPjGedungApi = (id: number, nimPj: string | null) =>
  postJson('gedung/pj', { id, nimPj })

export const saveSesiApi = (sesi: Sesi[]) => postJson('sesi', { sesi })

export const addLiburApi = (data: Omit<HariLibur, 'id'>) => postJson('libur', data)

export const deleteLiburApi = (id: number) => postJson('libur/delete', { id })

export const MODE_UJI_MATI: ModeUji = { abaikanJam: false, abaikanRadius: false }

export async function fetchModeUji(): Promise<ModeUji> {
  try {
    const res = await fetch(`${API_BASE}/mode-uji`, { headers: authHeaders() })
    if (!res.ok || !isJson(res)) return MODE_UJI_MATI
    return await res.json()
  } catch {
    return MODE_UJI_MATI
  }
}

export const saveModeUjiApi = (mode: ModeUji) => postJson('mode-uji', mode)

export const ATURAN_PRESENSI_DEFAULT: AturanPresensi = { gpsAkurasiMaks: 100, batasTidakHadir: 3, pengingatMenit: 15 }

export async function fetchAturanPresensi(): Promise<AturanPresensi> {
  try {
    const res = await fetch(`${API_BASE}/aturan-presensi`, { headers: authHeaders() })
    if (res.ok && isJson(res)) return { ...ATURAN_PRESENSI_DEFAULT, ...(await res.json()) }
  } catch {
    // backend tidak tersedia: pakai nilai bawaan
  }
  return ATURAN_PRESENSI_DEFAULT
}

export const saveAturanPresensiApi = (aturan: AturanPresensi) => postJson('aturan-presensi', aturan)

// ---------- Penghuni ----------

export const addPenghuniApi = (penghuni: Partial<Penghuni>) => postJson('penghuni', penghuni)

export const togglePenghuniStatusApi = (nim: string) => postJson('penghuni/toggle-status', { nim })

// Pindah kamar, ubah peran, atau keluarkan dari asrama (nomorKamar null + nonaktif)
export type UbahPenghuni = Pick<Penghuni, 'nim' | 'nama' | 'email' | 'noHp' | 'asal' | 'role' | 'statusAktif'> & { nomorKamar: string | null }

// `nimLama` menunjuk penghuni yang diubah; `data.nim` adalah NIM barunya (boleh sama)
export const updatePenghuniApi = (nimLama: string, data: UbahPenghuni) =>
  postJson('penghuni/update', { ...data, nim: nimLama, nimBaru: data.nim })

export const changePasswordApi = (nim: string, passwordLama: string, passwordBaru: string) =>
  postJson('auth/change-password', { nim, passwordLama, passwordBaru })

export const resetPasswordApi = (nim: string, adminNim: string, adminPassword: string) =>
  postJson('penghuni/reset-password', { nim, adminNim, adminPassword })

export const uploadProfilePhotoApi = (nim: string, fotoProfil: string) =>
  postJson('auth/profile-photo', { nim, fotoProfil })

export const updateProfileApi = (nim: string, data: { nama: string; email: string; noHp: string; asal: string }) =>
  postJson('auth/profile', { nim, ...data })

// ---------- Presensi ----------

export const fetchPresensi = () => getList<PresensiRecord>('presensi', initialPresensi)

// `nim` hanya dipakai mode offline; server mengambil NIM dari token login
export const checkInApi = (data: { nim: string; sesi: string; tanggal: string; latitude: number; longitude: number; akurasi?: number; fotoWajah: string; keterangan?: string }) =>
  postJson('presensi', data)

// Alamat foto wajah presensi: data URL (mode offline) atau nama berkas yang disimpan backend
export function fotoWajahUrl(foto: string | null | undefined): string | null {
  if (!foto) return null
  if (foto.startsWith('data:')) return foto
  return `${API_BASE}/presensi/foto/${encodeURIComponent(foto)}`
}

// Endpoint foto wajib token, sedangkan <img src> tidak mengirim header Authorization.
// Ambil gambarnya lewat fetch lalu jadikan blob URL (pemanggil wajib revokeObjectURL).
export async function fetchFotoWajah(foto: string | null | undefined): Promise<string | null> {
  const url = fotoWajahUrl(foto)
  if (!url || url.startsWith('data:')) return url
  try {
    const res = await fetch(url, { headers: authHeaders() })
    if (!res.ok) return null
    return URL.createObjectURL(await res.blob())
  } catch {
    return null
  }
}

// `korektorNim` hanya dipakai mode offline; server mengambil korektor dari token login
export const koreksiPresensiApi = (data: { nim: string; tanggal: string; sesi: string; status: PresensiStatus; keterangan: string; korektorNim: string }) =>
  postJson('presensi/koreksi', data)

export const validasiFotoApi = (id: number, status: Exclude<StatusFoto, 'Menunggu'>, catatan: string) =>
  postJson('presensi/validasi-foto', { id, status, catatan })

// ---------- Izin ----------

export const fetchIzin = () => getList<IzinRecord>('izin', initialIzin)

export const submitIzinApi = (data: { nim: string; alasan: string; tanggal: string; tanggalSelesai: string; sesi: string | null; fileBukti?: string }) =>
  postJson('izin', data)

export const updateIzinStatusApi = (id: number, status: 'Disetujui' | 'Ditolak', approverNim: string, catatan: string) =>
  postJson('izin/status', { id, status, approverNim, catatan })
