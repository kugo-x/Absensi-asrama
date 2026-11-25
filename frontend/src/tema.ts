import { useEffect, useState } from 'react'

// Tema tampilan: 'terang' | 'gelap'. Pilihan disimpan per perangkat; bila belum pernah memilih,
// mengikuti pengaturan sistem. Kelas .dark dipasang di <html> (lihat juga skrip awal di index.html).
export type Tema = 'terang' | 'gelap'
const KUNCI = 'sip-tema'

function simpanan(): Tema | null {
  try {
    const v = localStorage.getItem(KUNCI)
    return v === 'gelap' || v === 'terang' ? v : null
  } catch {
    return null
  }
}

const sistemGelap = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches

export function temaAwal(): Tema {
  return simpanan() ?? (sistemGelap() ? 'gelap' : 'terang')
}

function terapkan(t: Tema, halus: boolean) {
  const html = document.documentElement
  if (halus) {
    html.classList.add('ganti-tema')
    window.setTimeout(() => html.classList.remove('ganti-tema'), 350)
  }
  html.classList.toggle('dark', t === 'gelap')
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'gelap' ? '#0c100e' : '#0c2a1c')
}

const pendengar = new Set<(t: Tema) => void>()

export function useTema(): [Tema, () => void] {
  const [tema, setTema] = useState<Tema>(temaAwal)

  useEffect(() => {
    pendengar.add(setTema)
    // Ikuti perubahan tema sistem selama pengguna belum memilih sendiri
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    const ubahSistem = () => {
      if (simpanan()) return
      const t: Tema = mq?.matches ? 'gelap' : 'terang'
      terapkan(t, true)
      pendengar.forEach(f => f(t))
    }
    mq?.addEventListener?.('change', ubahSistem)
    return () => {
      pendengar.delete(setTema)
      mq?.removeEventListener?.('change', ubahSistem)
    }
  }, [])

  const toggle = () => {
    const baru: Tema = document.documentElement.classList.contains('dark') ? 'terang' : 'gelap'
    try { localStorage.setItem(KUNCI, baru) } catch { /* mode privat: tetap berlaku di sesi ini */ }
    terapkan(baru, true)
    pendengar.forEach(f => f(baru))
  }

  return [tema, toggle]
}
