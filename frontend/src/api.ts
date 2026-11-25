import type { CurrentUser, Gedung, Kamar, Penghuni, PresensiRecord, IzinRecord, Sesi, HariLibur, PresensiStatus, ModeUji, StatusFoto, AturanPresensi, JadwalHari, HariIso, EventAsrama, EventInput, RekapEventResult, GedungInput, KamarInput, LogAktivitas, FotoEvent, Pengumuman, PengumumanInput, RiwayatDitolak } from './types'
import {
  DEMO_ACCOUNTS,
  gedungList as initialGedung,
  kamarList as initialKamar,
  penghuniList as initialPenghuni,
  presensiList as initialPresensi,
  izinList as initialIzin,
  sesiList as initialSesi,
  liburList as initialLibur,
  eventList as initialEvent,
  presensiEventList as initialPresensiEvent,
} from './data/mockData'

const API_BASE = '/api'

/**
 * Mode demo tanpa backend. Data contoh (mockData) HANYA dipakai bila
 * VITE_OFFLINE_DEMO=true (lihat frontend/.env.example). Default: data selalu dari server;
 * bila server tidak bisa dihubungi, aplikasi menampilkan peringatan — bukan data palsu.
 */
export const OFFLINE_DEMO = import.meta.env.VITE_OFFLINE_DEMO === 'true'

/** Isi awal state halaman: data contoh hanya di mode demo, selain itu kosong */
export function awalDemo<T>(contoh: T[]): T[] {
  return OFFLINE_DEMO ? contoh : []
}

// ---------- Status koneksi ke server (untuk banner di AppLayout) ----------

export const EVENT_KONEKSI = 'sip-koneksi'
let koneksiTerakhir: boolean | null = null

/** Kabari aplikasi saat status koneksi ke server berubah */
function laporKoneksi(ok: boolean) {
  if (koneksiTerakhir === ok) return
  koneksiTerakhir = ok
  try { window.dispatchEvent(new CustomEvent(EVENT_KONEKSI, { detail: { ok } })) } catch { /* abaikan */ }
}

export function statusKoneksiTerakhir(): boolean | null {
  return koneksiTerakhir
}

// Token tidak berlaku lagi: hapus dan minta App kembali ke halaman login
function tokenKedaluwarsa() {
  clearAuthToken()
  window.dispatchEvent(new Event('auth-expired'))
}

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

/**
 * GET daftar data dari server.
 * - Berhasil: data apa adanya dari DB (termasuk daftar kosong).
 * - 401: token dihapus + event 'auth-expired' (sama dengan postJson).
 * - Server tidak bisa dihubungi: lapor ke banner koneksi lalu kembalikan [] —
 *   data contoh hanya bila OFFLINE_DEMO.
 */
async function getList<T>(path: string, contoh: T[]): Promise<T[]> {
  try {
    const res = await fetch(`${API_BASE}/${path}`, { headers: authHeaders() })
    if (res.status === 401) {
      tokenKedaluwarsa()
      return []
    }
    if (res.ok && isJson(res)) {
      const data = await res.json()
      if (Array.isArray(data)) {
        laporKoneksi(true)
        return data
      }
    }
    // Respons non-JSON / 5xx = backend mati atau galat server (mis. proxy Vite gagal terhubung)
    if (!isJson(res) || res.status >= 500) laporKoneksi(false)
    else laporKoneksi(true)
  } catch {
    laporKoneksi(false)
  }
  return OFFLINE_DEMO ? contoh : []
}

export interface ApiResult {
  ok: boolean
  message: string
  // true HANYA di mode demo (OFFLINE_DEMO) saat backend tidak bisa dihubungi:
  // halaman boleh menganggap aksi tersimpan secara lokal. Di luar mode demo selalu false.
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
    if (!isJson(res)) {
      laporKoneksi(false)
      return { ok: false, offline: OFFLINE_DEMO, message: 'Server tidak dapat dihubungi.' }
    }
    laporKoneksi(true)
    const json = await res.json()
    if (res.status === 401) tokenKedaluwarsa()
    const message = json.message || json.messages?.error || json.error || (res.ok ? 'Berhasil' : 'Permintaan gagal diproses.')
    if (res.ok) catatAktivitas(path, message)
    return { ok: res.ok, message }
  } catch {
    laporKoneksi(false)
    return { ok: false, offline: OFFLINE_DEMO, message: 'Server tidak dapat dihubungi.' }
  }
}

// Judul notifikasi untuk setiap aksi yang berhasil (lihat components/Notifikasi.tsx)
const JUDUL_AKTIVITAS: Record<string, string> = {
  'presensi': 'Presensi berhasil',
  'presensi/koreksi': 'Koreksi presensi disimpan',
  'presensi/validasi-foto': 'Validasi foto disimpan',
  'presensi/validasi-foto-massal': 'Foto presensi diterima',
  'izin': 'Pengajuan izin terkirim',
  'izin/status': 'Keputusan izin disimpan',
  'izin/batal': 'Pengajuan izin dibatalkan',
  'penghuni': 'Penghuni ditambahkan',
  'penghuni/update': 'Data penghuni diperbarui',
  'penghuni/toggle-status': 'Status penghuni diubah',
  'penghuni/reset-password': 'Password direset',
  'gedung/update': 'Lokasi gedung diperbarui',
  'gedung/pj': 'PJ gedung diperbarui',
  'sesi': 'Jadwal sesi disimpan',
  'sesi-gedung': 'Jadwal absen malam disimpan',
  'libur': 'Hari libur ditambahkan',
  'libur/delete': 'Hari libur dihapus',
  'libur/update': 'Hari libur diperbarui',
  'event/absen': 'Absen event berhasil',
  'event/validasi-foto': 'Validasi foto event disimpan',
  'event/add': 'Event dibuat',
  'pengumuman/add': 'Pengumuman terkirim',
  'pengumuman/update': 'Pengumuman diperbarui',
  'pengumuman/delete': 'Pengumuman dihapus',
  'event/update': 'Event diperbarui',
  'event/delete': 'Event dihapus',
  'mode-uji': 'Mode uji diperbarui',
  'aturan-presensi': 'Aturan presensi disimpan',
  'auth/change-password': 'Password diubah',
  'auth/profile': 'Profil diperbarui',
  'auth/profile-photo': 'Foto profil diperbarui',
}

// Hanya tampilan: memberi tahu pusat notifikasi bahwa sebuah aksi berhasil
function catatAktivitas(path: string, pesan: string) {
  try {
    window.dispatchEvent(new CustomEvent('sip-aktivitas', { detail: { judul: JUDUL_AKTIVITAS[path] ?? 'Berhasil', pesan } }))
  } catch {
    // abaikan: notifikasi bukan bagian penting dari aksi
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

// GET daftar tanpa cadangan: null bila server gagal (bukan [] / data contoh), untuk data yang harus akurat
async function getListPasti<T>(path: string): Promise<T[] | null> {
  try {
    const res = await fetch(`${API_BASE}/${path}`, { headers: authHeaders(), cache: 'no-store' })
    if (res.status === 401) { tokenKedaluwarsa(); return null }
    if (res.ok && isJson(res)) {
      const data = await res.json()
      if (Array.isArray(data)) return data as T[]
    }
  } catch { /* server tidak dapat dihubungi */ }
  return null
}

/** Gedung, kamar & penghuni terbaru langsung dari server (dipakai template & pemeriksaan impor). */
export async function fetchDataKamarTerbaru(): Promise<{ gedung: Gedung[]; kamar: Kamar[]; penghuni: Penghuni[] } | null> {
  const [gedung, kamar, penghuni] = await Promise.all([getListPasti<Gedung>('gedung'), getListPasti<Kamar>('kamar'), getListPasti<Penghuni>('penghuni')])
  return gedung && kamar && penghuni ? { gedung, kamar, penghuni } : null
}
export const fetchLibur = () => getList<HariLibur>('libur', initialLibur)

export const addGedungApi = (data: GedungInput) => postJson('gedung/add', data)

export const updateGedungApi = (id: number, data: { latitude: number | null; longitude: number | null; radiusMeter: number }) =>
  postJson('gedung/update', { id, ...data })

export const updateGedungFullApi = (id: number, data: Partial<GedungInput>) =>
  postJson('gedung/update', { id, ...data })

export const deleteGedungApi = (id: number) => postJson('gedung/delete', { id })

export const setPjGedungApi = (id: number, nimPj: string | null) =>
  postJson('gedung/pj', { id, nimPj })

export const addKamarApi = (data: KamarInput) => postJson('kamar/add', data)

export const updateKamarApi = (data: KamarInput) => postJson('kamar/update', data)

export const deleteKamarApi = (nomorKamar: string) => postJson('kamar/delete', { nomorKamar })

// Admin: hanya sesi global (sesi per gedung diatur fasil lewat saveSesiGedungApi)
export const saveSesiApi = (sesi: Sesi[]) => postJson('sesi', { sesi: sesi.filter(s => s.idGedung == null) })

// Fasil PJ: atur absen malam gedung yang dipegang
export const saveSesiGedungApi = (data: { jamMulai: string; jamSelesai: string; aktif: boolean; hari?: JadwalHari[] }) => postJson('sesi-gedung', data)

export const addLiburApi = (data: Omit<HariLibur, 'id'>) => postJson('libur', data)

export const deleteLiburApi = (id: number) => postJson('libur/delete', { id })

export const updateLiburApi = (data: HariLibur) => postJson('libur/update', data)

export async function seedDatabaseApi(): Promise<ApiResult> {
  try {
    const res = await fetch(`${API_BASE}/seed`)
    if (res.ok) {
      const data = await res.json()
      return { ok: true, message: data.message || 'Seeder berhasil dijalankan!' }
    }
    return { ok: false, message: 'Gagal menjalankan seeder.' }
  } catch {
    return { ok: false, message: 'Gagal terhubung ke seeder backend.' }
  }
}

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
export type UbahPenghuni = Pick<Penghuni, 'nim' | 'nama' | 'email' | 'noHp' | 'asal' | 'role' | 'statusAktif'> & { nomorKamar: string | null; jenisKelamin?: 'L' | 'P' | null }

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

// Fasil: terima banyak foto sekaligus (penolakan tetap satu per satu karena wajib bercatatan)
export const validasiFotoMassalApi = (ids: number[]) => postJson('presensi/validasi-foto-massal', { ids })

// ---------- Izin ----------

export const fetchIzin = () => getList<IzinRecord>('izin', initialIzin)

// `nim` hanya dipakai mode offline; server mengambil NIM dari token login.
// Tanggal: satu rentang (tanggal–tanggalSelesai) ATAU beberapa tanggal terpisah (tanggalList).
// `buktiFile` = data URL berkas bukti (PDF/JPG/PNG, maks. 2 MB)
// Pengajuan ulang: `idIzinSebelumnya` = izin yang ditolak; `pakaiBuktiLama` = pakai lagi berkas buktinya
export const submitIzinApi = (data: {
  nim: string; alasan: string; sesi: string | null; buktiFile?: string | null
  idIzinSebelumnya?: number | null; pakaiBuktiLama?: boolean
} & (
  { tanggal: string; tanggalSelesai: string } | { tanggalList: string[] }
)) =>
  postJson('izin', data)

/** Nama berkas bukti yang benar-benar tersimpan di server (data lama hanya berisi teks nama berkas) */
export function adalahBuktiTersimpan(fileBukti: string | null | undefined): boolean {
  return !!fileBukti && /^izin_[A-Za-z0-9_]+\.(pdf|jpg|png)$/.test(fileBukti)
}

// Endpoint bukti wajib token, jadi berkas diambil lewat fetch lalu dijadikan blob URL (pemanggil wajib revokeObjectURL)
// ---------- Log aktivitas (admin) ----------

export interface HasilLogAktivitas {
  data: LogAktivitas[]
  total: number
  halaman: number
  per: number
  pesan?: string
  /** Foto profil pelaku di halaman ini, per NIM */
  foto?: Record<string, string>
}

/** Log aktivitas dengan filter & halaman dari server; null bila gagal dimuat */
export async function fetchLogAktivitas(saring: Record<string, string | number>): Promise<HasilLogAktivitas | null> {
  const qs = new URLSearchParams(Object.entries(saring).filter(([, v]) => v !== '').map(([k, v]) => [k, String(v)]))
  try {
    const res = await fetch(`${API_BASE}/log?${qs}`, { headers: authHeaders() })
    if (res.status === 401) {
      tokenKedaluwarsa()
      return null
    }
    if (!res.ok || !isJson(res)) return null
    laporKoneksi(true)
    return await res.json()
  } catch {
    laporKoneksi(false)
    return null
  }
}

export async function fetchBuktiIzin(fileBukti: string): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/izin/bukti/${encodeURIComponent(fileBukti)}`, { headers: authHeaders() })
    if (!res.ok) return null
    return URL.createObjectURL(await res.blob())
  } catch {
    return null
  }
}

// Penghuni membatalkan izinnya yang masih menunggu keputusan
export const batalIzinApi = (id: number) => postJson('izin/batal', { id })

// `approverNim` hanya dipakai mode offline; server mengambil approver dari token login
export const updateIzinStatusApi = (id: number, status: 'Disetujui' | 'Ditolak', approverNim: string, catatan: string) =>
  postJson('izin/status', { id, status, approverNim, catatan })

// ---------- Event Asrama ----------

export const fetchEvent = () => getList<EventAsrama>('event', initialEvent)

// ---------- Pengumuman ----------
export const fetchPengumuman = () => getList<Pengumuman>('pengumuman', [])
export const fetchRiwayatDitolak = () => getList<RiwayatDitolak>('presensi/riwayat-ditolak', [])
export const addPengumumanApi = (data: PengumumanInput) => postJson('pengumuman/add', data)
export const updatePengumumanApi = (id: number, data: PengumumanInput) => postJson('pengumuman/update', { id, ...data })
export const deletePengumumanApi = (id: number) => postJson('pengumuman/delete', { id })

export const addEventApi = (data: EventInput) => postJson('event/add', data)

export const updateEventApi = (id: number, data: EventInput) => postJson('event/update', { id, ...data })

// Foto sampul event: diambil dengan token lalu disimpan sebagai blob URL.
// Disimpan di memori per nama berkas agar daftar event yang sering dirender ulang tidak mengunduh berulang.
const cacheSampul = new Map<string, Promise<string | null>>()
export function fetchSampulEvent(nama: string | null | undefined): Promise<string | null> {
  if (!nama) return Promise.resolve(null)
  if (nama.startsWith('data:')) return Promise.resolve(nama)
  let p = cacheSampul.get(nama)
  if (!p) {
    p = fetch(`${API_BASE}/event/sampul/${encodeURIComponent(nama)}`, { headers: authHeaders() })
      .then(async res => (res.ok ? URL.createObjectURL(await res.blob()) : null))
      .catch(() => null)
      .then(url => {
        if (!url) cacheSampul.delete(nama) // gagal: boleh dicoba lagi nanti
        return url
      })
    cacheSampul.set(nama, p)
  }
  return p
}

export const deleteEventApi = (id: number) => postJson('event/delete', { id })

export async function fetchRekapEvent(idEvent: number): Promise<RekapEventResult | null> {
  try {
    const res = await fetch(`${API_BASE}/event/rekap/${idEvent}`, { headers: authHeaders() })
    if (res.ok && isJson(res)) {
      return await res.json()
    }
  } catch {
    /* backend down / offline demo */
  }

  if (OFFLINE_DEMO) {
    const ev = initialEvent.find(e => e.id === idEvent)
    if (!ev) return null
    const listPeserta = initialPenghuni.map(p => {
      const pr = initialPresensiEvent.find(pe => pe.idEvent === idEvent && pe.nim === p.nim)
      return {
        nim: p.nim,
        nama: p.nama,
        nomorKamar: p.nomorKamar,
        namaGedung: p.namaGedung,
        status: (pr ? pr.status : 'Belum Absen') as 'Hadir' | 'Tidak Hadir' | 'Belum Absen',
        waktu: pr ? pr.waktu : null,
        jarakMeter: pr ? pr.jarakMeter : null,
        foto: pr ? pr.foto : null,
        keterangan: pr ? pr.keterangan : null,
      }
    })
    const hadir = listPeserta.filter(x => x.status === 'Hadir').length
    const tidakHadir = listPeserta.filter(x => x.status === 'Tidak Hadir').length
    const belum = listPeserta.filter(x => x.status === 'Belum Absen').length
    const total = listPeserta.length
    return {
      event: ev,
      statistik: {
        totalPeserta: total,
        hadir,
        tidakHadir,
        belumAbsen: belum,
        persenHadir: total > 0 ? Math.round((hadir / total) * 100) : 0,
      },
      peserta: listPeserta,
    }
  }

  return null
}

// Fasil: foto absen event penghuni gedung binaan & validasinya
export const fetchFotoValidasiEvent = () => getList<FotoEvent>('event/foto-validasi', [])
export const validasiFotoEventApi = (id: number, status: Exclude<StatusFoto, 'Menunggu'>, catatan: string) =>
  postJson('event/validasi-foto', { id, status, catatan })

export const absenEventApi = (data: { idEvent: number; latitude: number; longitude: number; foto: string }) =>
  postJson('event/absen', data)

export function fotoEventUrl(foto: string | null | undefined): string | null {
  if (!foto) return null
  if (foto.startsWith('data:')) return foto
  return `${API_BASE}/event/foto/${encodeURIComponent(foto)}`
}

export async function fetchFotoEvent(foto: string | null | undefined): Promise<string | null> {
  const url = fotoEventUrl(foto)
  if (!url || url.startsWith('data:')) return url
  try {
    const res = await fetch(url, { headers: authHeaders() })
    if (!res.ok) return null
    return URL.createObjectURL(await res.blob())
  } catch {
    return null
  }
}
