import { useState } from 'react'
import { Search } from 'lucide-react'
import type { Gedung, IzinRecord, IzinStatus } from '../types'
import { formatRentangTanggal } from '../logic'
import DateInput from './DateInput'
import { TAMPILAN_STATUS_IZIN } from './PresensiWidgets'

/**
 * Pencarian & filter daftar izin untuk fasil dan admin.
 * useSaringIzin menyimpan state filter dan menghasilkan daftar tersaring; BarisSaringIzin menampilkan kontrolnya.
 */

export type StatusSaring = 'Semua' | IzinStatus

const URUTAN_STATUS: StatusSaring[] = ['Pending', 'Disetujui', 'Ditolak', 'Semua']

// "2026-11" → "November 2026"
function namaBulan(yyyyMm: string): string {
  const [y, m] = yyyyMm.split('-').map(Number)
  return new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date(y, m - 1, 1))
}

export function useSaringIzin(izin: IzinRecord[], statusAwal: StatusSaring = 'Semua') {
  const [status, setStatus] = useState<StatusSaring>(statusAwal)
  const [cari, setCari] = useState('')
  // Satu tanggal tertentu ATAU satu bulan ('YYYY-MM'); memilih salah satu mengosongkan yang lain
  const [tanggal, setTanggal] = useState('')
  const [bulan, setBulan] = useState('')
  const [gedung, setGedung] = useState('')

  const kata = cari.trim().toLowerCase()
  const batas: [string, string] | null = tanggal ? [tanggal, tanggal] : bulan ? [`${bulan}-01`, `${bulan}-31`] : null
  // Izin cocok bila rentang tanggalnya bersinggungan dengan batas (izin 30 Okt–2 Nov ikut di November)
  const tanpaStatus = izin.filter(i =>
    (!gedung || i.namaGedung === gedung) &&
    (!batas || (i.tanggal <= batas[1] && (i.tanggalSelesai || i.tanggal) >= batas[0])) &&
    (!kata || [i.namaPenghuni, i.nim, i.nomorKamar, i.alasan, i.catatanApprover ?? '', formatRentangTanggal(i.tanggal, i.tanggalSelesai)]
      .join(' ').toLowerCase().includes(kata)))

  const jumlah: Record<StatusSaring, number> = {
    Semua: tanpaStatus.length,
    Pending: tanpaStatus.filter(i => i.statusPersetujuan === 'Pending').length,
    Disetujui: tanpaStatus.filter(i => i.statusPersetujuan === 'Disetujui').length,
    Ditolak: tanpaStatus.filter(i => i.statusPersetujuan === 'Ditolak').length,
  }

  return {
    status, setStatus, cari, setCari, gedung, setGedung, tanggal, bulan,
    pilihTanggal: (t: string) => { setTanggal(t); if (t) setBulan('') },
    pilihBulan: (b: string) => { setBulan(b); setTanggal('') },
    hasil: status === 'Semua' ? tanpaStatus : tanpaStatus.filter(i => i.statusPersetujuan === status),
    jumlah,
    total: izin.length,
    daftarBulan: [...new Set(izin.flatMap(i => [i.tanggal.slice(0, 7), (i.tanggalSelesai || i.tanggal).slice(0, 7)]))].sort().reverse(),
    aktif: kata !== '' || tanggal !== '' || bulan !== '' || gedung !== '' || status !== statusAwal,
    reset: () => {
      setStatus(statusAwal)
      setCari('')
      setTanggal('')
      setBulan('')
      setGedung('')
    },
  }
}

export type SaringIzin = ReturnType<typeof useSaringIzin>

const saringCls = 'w-full px-3 py-2 rounded-lg border border-gray-300 hover:border-gray-400 text-sm text-gray-800 bg-white outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15 transition-colors placeholder:text-gray-400'

// gedungList diisi untuk admin (lintas gedung); fasil hanya melihat satu gedung sehingga tidak perlu
// tanpaStatus: chip status disembunyikan (halaman yang sudah punya ubin status sendiri, mis. fasil)
export function BarisSaringIzin({ saring, gedungList, tanpaStatus = false }: { saring: SaringIzin; gedungList?: Gedung[]; tanpaStatus?: boolean }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col lg:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={saring.cari}
            onChange={e => saring.setCari(e.target.value)}
            placeholder="Cari nama, NIM, kamar, alasan, atau tanggal (mis. 29 Nov)..."
            aria-label="Cari izin"
            className={`${saringCls} pl-9`}
          />
        </div>
        <div className={`grid gap-2 ${gedungList ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2'} lg:flex`}>
          <div className="lg:w-44">
            <DateInput clearable placeholder="Cari tanggal" className={saringCls} value={saring.tanggal} onChange={e => saring.pilihTanggal(e.target.value)} />
          </div>
          <select value={saring.bulan} onChange={e => saring.pilihBulan(e.target.value)} aria-label="Bulan izin" className={`${saringCls} lg:w-40`}>
            <option value="">Semua bulan</option>
            {saring.daftarBulan.map(b => <option key={b} value={b}>{namaBulan(b)}</option>)}
          </select>
          {gedungList && (
            <select value={saring.gedung} onChange={e => saring.setGedung(e.target.value)} aria-label="Gedung" className={`${saringCls} col-span-2 sm:col-span-1 lg:w-44`}>
              <option value="">Seluruh gedung</option>
              {gedungList.map(g => <option key={g.id} value={g.nama}>{g.nama}</option>)}
            </select>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5" role={tanpaStatus ? undefined : 'tablist'} aria-label={tanpaStatus ? undefined : 'Saring status izin'}>
        {!tanpaStatus && URUTAN_STATUS.map(f => {
          const aktif = saring.status === f
          return (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={aktif}
              onClick={() => saring.setStatus(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border cursor-pointer transition-colors ${aktif ? 'bg-[#141a17] text-white border-[#141a17]' : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-300'}`}
              style={{ fontFamily: 'Plus Jakarta Sans' }}
            >
              {f === 'Semua' ? 'Semua' : TAMPILAN_STATUS_IZIN[f].label}
              <span className={`ml-1.5 ${aktif ? 'text-emerald-100' : 'text-gray-400'}`}>{saring.jumlah[f]}</span>
            </button>
          )
        })}
        {saring.aktif && (
          <span className="ml-auto flex items-center gap-2 text-xs text-gray-500">
            <span>{saring.hasil.length} dari {saring.total} izin</span>
            <button type="button" onClick={saring.reset} className="font-semibold text-emerald-700 hover:underline cursor-pointer">Reset filter</button>
          </span>
        )}
      </div>
    </div>
  )
}

// Tampilan kosong yang membedakan "belum ada data" dan "tidak ada yang cocok dengan filter"
export function KosongSaringIzin({ saring, teksKosong }: { saring: SaringIzin; teksKosong: string }) {
  const pesan = saring.total === 0 ? teksKosong
    : saring.aktif ? 'Tidak ada izin yang cocok dengan filter'
      : saring.status === 'Pending' ? 'Tidak ada izin yang menunggu keputusan'
        : saring.status === 'Semua' ? teksKosong
          : `Tidak ada izin berstatus ${TAMPILAN_STATUS_IZIN[saring.status].label.toLowerCase()}`
  return (
    <div className="py-12 text-center">
      <p className="text-sm text-gray-500 font-medium">{pesan}</p>
      {saring.aktif && (
        <button type="button" onClick={saring.reset} className="mt-3 rounded-lg px-3.5 py-2 text-sm font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 cursor-pointer">
          Reset filter
        </button>
      )}
    </div>
  )
}
