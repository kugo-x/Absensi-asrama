import { useState } from 'react'
import { Download, GraduationCap } from 'lucide-react'
import type { Gedung, Penghuni, Sesi } from '../types'
import {
  bulanDalamRentang, daftarSemester, formatTanggal, hitungStatus, maxDate, penghuniWajibAbsen, riwayatPenghuni, todayLocal,
  type DataPresensi,
} from '../logic'
import { unduhLaporan, type ExportFormat } from '../ekspor'

/**
 * Rekap kehadiran satu semester untuk dikirim ke pihak kampus (admin: semua/gedung tertentu; fasil: gedungnya).
 * Satu baris per penghuni: persentase tiap bulan, total semester, dan status terhadap target kehadiran.
 */

export const TARGET_KEHADIRAN = 80
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
const namaBulan = (k: string) => `${BULAN[Number(k.slice(5, 7)) - 1]} ${k.slice(2, 4)}`

export default function RekapSemester({ penghuni, sesiList, data, now, gedungList, gedungTetap, penandatangan }: {
  penghuni: Penghuni[]
  sesiList: Sesi[]
  data: DataPresensi
  now: Date
  // Admin: boleh memilih gedung; fasil: gedung tetap
  gedungList?: Gedung[]
  gedungTetap?: string
  penandatangan: { jabatan: string; nama: string; identitas?: string }
}) {
  const today = todayLocal()
  const semesterList = daftarSemester(today, 4)
  const [kode, setKode] = useState(semesterList[0].kode)
  const [gedung, setGedung] = useState(gedungTetap ?? '')
  const [memproses, setMemproses] = useState<ExportFormat | null>(null)
  const sem = semesterList.find(s => s.kode === kode) ?? semesterList[0]
  const akhir = sem.selesai < today ? sem.selesai : today
  const berjalan = sem.selesai >= today
  const bulan = bulanDalamRentang(sem.mulai, akhir)
  const namaGedung = gedungTetap ?? gedung

  // Rekap per penghuni sejak tanggal masuknya (tidak dihitung alpa sebelum masuk)
  const baris = penghuniWajibAbsen(penghuni, namaGedung || undefined).map(p => {
    const mulai = p.tanggalMasuk ? maxDate(sem.mulai, p.tanggalMasuk) : sem.mulai
    const riwayat = mulai <= akhir ? riwayatPenghuni(p.nim, mulai, akhir, sesiList, data, now, p.namaGedung) : []
    const perBulan = bulan.map(b => hitungStatus(riwayat.filter(r => r.tanggal.startsWith(b)).map(r => r.detail.status)))
    const total = hitungStatus(riwayat.map(r => r.detail.status))
    return { p, perBulan, total, memenuhi: total.wajib > 0 && total.persen >= TARGET_KEHADIRAN }
  }).sort((a, b) => (a.p.namaGedung || '').localeCompare(b.p.namaGedung || '') || a.p.nomorKamar.localeCompare(b.p.nomorKamar, 'id', { numeric: true }) || a.p.nama.localeCompare(b.p.nama))

  const ada = baris.filter(b => b.total.wajib > 0)
  const hadir = ada.reduce((t, b) => t + b.total.Hadir, 0)
  const wajib = ada.reduce((t, b) => t + b.total.wajib, 0)
  const persen = wajib > 0 ? Math.round((hadir / wajib) * 100) : 0
  const memenuhi = ada.filter(b => b.memenuhi).length
  const warna = (p: number) => p >= TARGET_KEHADIRAN ? 'text-emerald-700' : p >= 60 ? 'text-amber-700' : 'text-rose-600'

  const unduh = async (format: ExportFormat) => {
    setMemproses(format)
    const slug = (namaGedung || 'seluruh-asrama').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    await unduhLaporan(`rekap-semester-${sem.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${slug}.${format}`, {
      judul: 'Rekapitulasi Kehadiran Penghuni Asrama per Semester',
      keterangan: [
        ['Semester', `${sem.label}${berjalan ? ' (berjalan)' : ''}`],
        ['Periode', `${formatTanggal(sem.mulai, 'tanpaHari')} – ${formatTanggal(akhir, 'tanpaHari')}`],
        ['Gedung', namaGedung || 'Seluruh gedung'],
        ['Target kehadiran', `${TARGET_KEHADIRAN}%`],
      ],
      headers: ['NIM', 'Nama', 'Gedung', 'Kamar', ...bulan.map(namaBulan), 'Hadir', 'Izin', 'Tidak Hadir', 'Kehadiran', 'Keterangan'],
      rows: baris.map(b => [
        b.p.nim, b.p.nama, b.p.namaGedung || '–', b.p.nomorKamar,
        ...b.perBulan.map(c => (c.wajib > 0 ? `${c.persen}%` : '–')),
        b.total.Hadir, b.total.Izin, b.total['Tidak Hadir'],
        b.total.wajib > 0 ? `${b.total.persen}%` : '–',
        b.total.wajib === 0 ? 'Belum ada sesi' : b.memenuhi ? 'Memenuhi' : 'Belum memenuhi',
      ]),
      kolomAngka: [...bulan.map((_, i) => 4 + i), 4 + bulan.length, 5 + bulan.length, 6 + bulan.length, 7 + bulan.length],
      kolomStatus: 8 + bulan.length,
      ringkasan: [['Penghuni', baris.length], ['Kehadiran rata-rata', `${persen}%`], [`Memenuhi ≥ ${TARGET_KEHADIRAN}%`, memenuhi], ['Belum memenuhi', ada.length - memenuhi]],
      catatan: `Kehadiran = sesi hadir dibagi sesi wajib (hari libur tidak dihitung; izin yang disetujui dihitung sebagai sesi wajib). Penghuni yang masuk di tengah semester dihitung sejak tanggal masuknya.${berjalan ? ' Semester masih berjalan; angka dihitung sampai hari ini.' : ''}`,
      penandatangan,
    }, format)
    setMemproses(null)
  }

  const kontrol = 'px-3 py-2.5 rounded-xl border border-gray-200 bg-[#fff] text-sm font-medium text-gray-800 outline-none focus:border-emerald-600 cursor-pointer'
  const tombol = 'inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold text-gray-700 bg-[#fff] border border-gray-200 hover:bg-gray-50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'

  return (
    <section className="bg-[#fff] rounded-2xl border border-gray-200/90 shadow-2xs overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex flex-col xl:flex-row xl:items-center gap-3">
        <div className="flex items-center gap-3 xl:mr-auto min-w-0">
          <span className="w-10 h-10 shrink-0 rounded-xl bg-gray-100 text-gray-700 flex items-center justify-center"><GraduationCap className="w-5 h-5" /></span>
          <div className="min-w-0">
            <h3 className="text-base font-extrabold text-gray-900" style={{ fontFamily: 'Plus Jakarta Sans' }}>Rekap Semester</h3>
            <p className="text-xs text-gray-500">Laporan per penghuni untuk pihak kampus · {formatTanggal(sem.mulai, 'tanpaHari')} – {formatTanggal(akhir, 'tanpaHari')}{berjalan ? ' (berjalan)' : ''}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={kode} onChange={e => setKode(e.target.value)} aria-label="Semester" className={kontrol}>
            {semesterList.map((s, i) => <option key={s.kode} value={s.kode}>{s.label}{i === 0 ? ' (berjalan)' : ''}</option>)}
          </select>
          {!gedungTetap && gedungList && (
            <select value={gedung} onChange={e => setGedung(e.target.value)} aria-label="Gedung" className={kontrol}>
              <option value="">Seluruh gedung</option>
              {gedungList.map(g => <option key={g.id} value={g.nama}>{g.nama}</option>)}
            </select>
          )}
          <span className="hidden sm:block w-px h-7 bg-gray-200 mx-1" aria-hidden />
          {([['pdf', 'PDF'], ['xlsx', 'Excel'], ['doc', 'Word']] as const).map(([f, l]) => (
            <button key={f} type="button" onClick={() => unduh(f)} disabled={baris.length === 0 || memproses !== null} className={tombol}>
              <Download className="w-3.5 h-3.5" />{memproses === f ? 'Menyiapkan…' : l}
            </button>
          ))}
        </div>
      </div>

      {/* Ringkasan */}
      <div className="px-5 pt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { l: 'Penghuni', v: baris.length, w: 'text-gray-900' },
          { l: 'Kehadiran rata-rata', v: `${persen}%`, w: warna(persen) },
          { l: `Memenuhi ≥ ${TARGET_KEHADIRAN}%`, v: memenuhi, w: 'text-emerald-700' },
          { l: 'Belum memenuhi', v: ada.length - memenuhi, w: 'text-rose-600' },
        ].map(x => (
          <div key={x.l} className="px-3.5 py-3 rounded-xl bg-gray-50/80 border border-gray-100">
            <p className="text-[11px] font-semibold text-gray-500">{x.l}</p>
            <p className={`text-xl font-extrabold tabular-nums ${x.w}`} style={{ fontFamily: 'Plus Jakarta Sans' }}>{x.v}</p>
          </div>
        ))}
      </div>

      {baris.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-gray-400">Belum ada penghuni wajib absen{namaGedung ? ` di ${namaGedung}` : ''}.</p>
      ) : (
        <>
          {/* Tabel (layar lebar) */}
          <div className="hidden md:block overflow-x-auto mt-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/70 border-y border-gray-100">
                  <th className="text-left px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-500">Penghuni</th>
                  {bulan.map(b => <th key={b} className="text-center px-3 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-500 whitespace-nowrap">{namaBulan(b)}</th>)}
                  <th className="text-center px-3 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-500">Semester</th>
                  <th className="text-left px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {baris.map(b => (
                  <tr key={b.p.nim} className="hover:bg-gray-50/70">
                    <td className="px-5 py-3">
                      <p className="font-semibold text-gray-900 whitespace-nowrap">{b.p.nama}</p>
                      <p className="text-[11px] text-gray-500 whitespace-nowrap"><span className="mono">{b.p.nim}</span> · {b.p.nomorKamar}{!gedungTetap && b.p.namaGedung ? ` · ${b.p.namaGedung}` : ''}</p>
                    </td>
                    {b.perBulan.map((c, i) => (
                      <td key={bulan[i]} className={`px-3 py-3 text-center text-xs font-bold tabular-nums ${c.wajib > 0 ? warna(c.persen) : 'text-gray-300'}`}>{c.wajib > 0 ? `${c.persen}%` : '–'}</td>
                    ))}
                    <td className={`px-3 py-3 text-center font-extrabold tabular-nums ${b.total.wajib > 0 ? warna(b.total.persen) : 'text-gray-300'}`}>
                      {b.total.wajib > 0 ? `${b.total.persen}%` : '–'}
                      <span className="block text-[10px] font-semibold text-gray-400">{b.total.Hadir}/{b.total.wajib} sesi</span>
                    </td>
                    <td className="px-5 py-3">
                      {b.total.wajib === 0
                        ? <span className="text-xs text-gray-400">Belum ada sesi</span>
                        : <span className={`inline-flex px-2 py-0.5 rounded-full border text-[11px] font-bold ${b.memenuhi ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>{b.memenuhi ? 'Memenuhi' : 'Belum memenuhi'}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Kartu (HP) */}
          <ul className="md:hidden divide-y divide-gray-100 mt-4 border-t border-gray-100">
            {baris.map(b => (
              <li key={b.p.nim} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{b.p.nama}</p>
                    <p className="text-[11px] text-gray-500 truncate"><span className="mono">{b.p.nim}</span> · {b.p.nomorKamar}{!gedungTetap && b.p.namaGedung ? ` · ${b.p.namaGedung}` : ''}</p>
                  </div>
                  <span className={`shrink-0 text-lg font-extrabold tabular-nums ${b.total.wajib > 0 ? warna(b.total.persen) : 'text-gray-300'}`}>{b.total.wajib > 0 ? `${b.total.persen}%` : '–'}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {b.perBulan.map((c, i) => (
                    <span key={bulan[i]} className="px-1.5 py-0.5 rounded bg-gray-50 border border-gray-100 text-[10px] font-semibold text-gray-600">
                      {namaBulan(bulan[i])} <span className={c.wajib > 0 ? warna(c.persen) : 'text-gray-300'}>{c.wajib > 0 ? `${c.persen}%` : '–'}</span>
                    </span>
                  ))}
                </div>
                {b.total.wajib > 0 && (
                  <span className={`mt-2 inline-flex px-2 py-0.5 rounded-full border text-[10px] font-bold ${b.memenuhi ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>{b.memenuhi ? 'Memenuhi' : 'Belum memenuhi'}</span>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="px-5 py-3 mt-2 border-t border-gray-100 text-[11px] text-gray-400">
        Target kehadiran {TARGET_KEHADIRAN}%. Semester ganjil 1 Agustus – 31 Januari, genap 1 Februari – 31 Juli. Libur tidak dihitung.
      </p>
    </section>
  )
}
