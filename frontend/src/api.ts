import type { CurrentUser, Gedung, Kamar, Penghuni, PresensiRecord, IzinRecord } from './types'
import { DEMO_ACCOUNTS, gedungList as initialGedung, kamarList as initialKamar, penghuniList as initialPenghuni, presensiList as initialPresensi, izinList as initialIzin } from './data/mockData'

const API_BASE = '/api'

export async function apiLogin(nim: string, pass: string): Promise<CurrentUser> {
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nim, password: pass })
    })
    const json = await res.json()
    if (res.ok && json.data) {
      return json.data as CurrentUser
    }
  } catch (err) {
    console.warn('Backend API login unavailable, falling back to local auth:', err)
  }

  // Fallback to demo accounts
  const account = DEMO_ACCOUNTS.find(a => a.nim === nim && a.password === pass)
  if (account) {
    return {
      nim: account.nim,
      nama: account.nama,
      role: account.role,
      email: account.email,
      nomorKamar: (account as any).nomorKamar,
      namaGedung: (account as any).namaGedung,
    }
  }
  throw new Error('NIM atau password salah.')
}

export async function fetchGedung(): Promise<Gedung[]> {
  try {
    const res = await fetch(`${API_BASE}/gedung`)
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) return data
    }
  } catch (e) {
    console.warn('Falling back to local gedung data')
  }
  return initialGedung
}

export async function fetchKamar(): Promise<Kamar[]> {
  try {
    const res = await fetch(`${API_BASE}/kamar`)
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) return data
    }
  } catch (e) {
    console.warn('Falling back to local kamar data')
  }
  return initialKamar
}

export async function fetchPenghuni(): Promise<Penghuni[]> {
  try {
    const res = await fetch(`${API_BASE}/penghuni`)
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) return data
    }
  } catch (e) {
    console.warn('Falling back to local penghuni data')
  }
  return initialPenghuni
}

export async function addPenghuniApi(penghuni: Partial<Penghuni>): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/penghuni`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(penghuni)
    })
    return res.ok
  } catch (e) {
    return false
  }
}

export async function togglePenghuniStatusApi(nim: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/penghuni/toggle-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nim })
    })
    return res.ok
  } catch (e) {
    return false
  }
}

export async function fetchPresensi(): Promise<PresensiRecord[]> {
  try {
    const res = await fetch(`${API_BASE}/presensi`)
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) return data
    }
  } catch (e) {
    console.warn('Falling back to local presensi data')
  }
  return initialPresensi
}

export async function checkInApi(data: { nim: string; sesi: string; tanggal: string; status?: string; keterangan?: string }): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/presensi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    return res.ok
  } catch (e) {
    return false
  }
}

export async function fetchIzin(): Promise<IzinRecord[]> {
  try {
    const res = await fetch(`${API_BASE}/izin`)
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) return data
    }
  } catch (e) {
    console.warn('Falling back to local izin data')
  }
  return initialIzin
}

export async function submitIzinApi(data: { nim: string; alasan: string; tanggal: string; fileBukti?: string }): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/izin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    return res.ok
  } catch (e) {
    return false
  }
}

export async function updateIzinStatusApi(id: number, status: 'Disetujui' | 'Ditolak', approverNim: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/izin/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status, approverNim })
    })
    return res.ok
  } catch (e) {
    return false
  }
}
