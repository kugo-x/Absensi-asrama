import type { Gedung, Kamar, Penghuni } from './types'
import { hunianKamar } from './logic'

// Kolom sheet "Data" — harus persis seperti ini (dibaca oleh pemeriksa impor di halaman admin)
export const KOLOM_TEMPLATE = ['NIM', 'Nama Lengkap', 'Jenis Kelamin (L/P)', 'Email', 'No HP', 'Asal Daerah', 'Nomor Kamar'] as const

const HIJAU_TUA = 'FF0F3E2D'
const HIJAU = 'FF1C7B31'
const HIJAU_MUDA = 'FFF0FCF1'
const ABU_GARIS = 'FFD9E0DB'
const ABU_TEKS = 'FF5B6660'
const KUNING = 'FFFEF3C7'

const KETERANGAN: Record<(typeof KOLOM_TEMPLATE)[number], { wajib: boolean; lebar: number; catatan: string; contoh: string }> = {
  'NIM': { wajib: true, lebar: 16, catatan: 'Wajib. Huruf/angka tanpa spasi, belum terdaftar.', contoh: '2410931001' },
  'Nama Lengkap': { wajib: true, lebar: 28, catatan: 'Wajib. Nama sesuai data kampus.', contoh: 'Andi Saputra' },
  'Jenis Kelamin (L/P)': { wajib: true, lebar: 20, catatan: 'Wajib. Pilih L (laki-laki) atau P (perempuan) dari daftar.', contoh: 'L' },
  'Email': { wajib: false, lebar: 34, catatan: 'Opsional. Alamat email aktif.', contoh: 'andi.saputra@student.unand.ac.id' },
  'No HP': { wajib: false, lebar: 18, catatan: 'Opsional. Nomor WhatsApp (format teks, angka 0 di depan tetap ada).', contoh: '081234567801' },
  'Asal Daerah': { wajib: false, lebar: 20, catatan: 'Opsional. Kota/kabupaten asal.', contoh: 'Padang' },
  'Nomor Kamar': { wajib: false, lebar: 18, catatan: 'Opsional. Pilih dari daftar (lihat sheet "Daftar Kamar"), atau kosongkan untuk ditempatkan nanti.', contoh: '' },
}

const BARIS_ISI = 300

/** Template impor penghuni (.xlsx) bergaya: sheet Data (diisi), Contoh, Petunjuk, Daftar Kamar. */
export async function unduhTemplateImpor(gedungList: Gedung[], kamarList: Kamar[], penghuni: Penghuni[]): Promise<void> {
  const { default: ExcelJS } = await import('exceljs')
  type Sheet = import('exceljs').Worksheet
  type Cell = import('exceljs').Cell
  const wb = new ExcelJS.Workbook()
  wb.creator = 'SIP Asrama UNAND'
  wb.created = new Date()

  const garis = { style: 'thin' as const, color: { argb: ABU_GARIS } }
  const bingkai = { top: garis, left: garis, bottom: garis, right: garis }
  const isiWarna = (c: Cell, argb: string) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } } }
  const gayaJudulKolom = (c: Cell) => {
    isiWarna(c, HIJAU_TUA)
    c.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
    c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    c.border = { ...bingkai, bottom: { style: 'medium', color: { argb: HIJAU } } }
  }
  const spanduk = (ws: Sheet, baris: number, teks: string, kolomAkhir: number, ukuran = 15) => {
    ws.mergeCells(baris, 1, baris, kolomAkhir)
    const c = ws.getCell(baris, 1)
    c.value = teks
    c.font = { name: 'Calibri', size: ukuran, bold: true, color: { argb: 'FFFFFFFF' } }
    c.alignment = { vertical: 'middle', indent: 1 }
    isiWarna(c, HIJAU_TUA)
    ws.getRow(baris).height = ukuran > 12 ? 30 : 20
  }
  const subjudul = (ws: Sheet, baris: number, teks: string, kolomAkhir: number) => {
    ws.mergeCells(baris, 1, baris, kolomAkhir)
    const c = ws.getCell(baris, 1)
    c.value = teks
    c.font = { name: 'Calibri', size: 10, italic: true, color: { argb: ABU_TEKS } }
    c.alignment = { vertical: 'middle', indent: 1, wrapText: true }
    isiWarna(c, HIJAU_MUDA)
    ws.getRow(baris).height = 20
  }

  // Daftar kamar + sisa tempat (dipakai untuk pilihan "Nomor Kamar")
  const kamarUrut = [...kamarList].sort((a, b) => {
    const ga = gedungList.find(g => g.id === a.idGedung)?.nama ?? ''
    const gb = gedungList.find(g => g.id === b.idGedung)?.nama ?? ''
    return ga.localeCompare(gb) || a.nomorKamar.localeCompare(b.nomorKamar, 'id', { numeric: true })
  })
  const kamarContoh = (jenis: 'Putra' | 'Putri') =>
    kamarUrut.find(k => gedungList.find(g => g.id === k.idGedung)?.jenis === jenis && hunianKamar(k, penghuni) < k.kapasitas)?.nomorKamar ?? ''

  // ---------------- Sheet Data (diisi) — judul kolom tetap di baris 1
  const data = wb.addWorksheet('Data', { properties: { tabColor: { argb: HIJAU } }, views: [{ state: 'frozen', ySplit: 1 }] })
  data.columns = KOLOM_TEMPLATE.map(k => ({ key: k, width: KETERANGAN[k].lebar }))
  const kepala = data.getRow(1)
  KOLOM_TEMPLATE.forEach((k, i) => {
    const c = kepala.getCell(i + 1)
    c.value = k
    gayaJudulKolom(c)
    c.note = { texts: [{ text: `${KETERANGAN[k].wajib ? 'WAJIB' : 'Opsional'} — ${KETERANGAN[k].catatan}` }] }
  })
  kepala.height = 30
  for (let r = 2; r <= BARIS_ISI + 1; r++) {
    const row = data.getRow(r)
    KOLOM_TEMPLATE.forEach((k, i) => {
      const c = row.getCell(i + 1)
      c.border = bingkai
      if (r % 2 === 1) isiWarna(c, 'FFF7FAF8')
      // NIM & No HP sebagai teks agar angka 0 di depan dan NIM panjang tidak berubah
      if (k === 'NIM' || k === 'No HP') c.numFmt = '@'
      if (k === 'Jenis Kelamin (L/P)') {
        c.alignment = { horizontal: 'center' }
        c.dataValidation = { type: 'list', allowBlank: true, formulae: ['"L,P"'], showErrorMessage: true, errorTitle: 'Jenis kelamin', error: 'Isi L (laki-laki) atau P (perempuan).' }
      }
      if (k === 'Nomor Kamar' && kamarUrut.length > 0) {
        c.dataValidation = { type: 'list', allowBlank: true, formulae: [`'Daftar Kamar'!$A$4:$A$${kamarUrut.length + 3}`], showErrorMessage: true, errorTitle: 'Nomor kamar', error: 'Pilih nomor kamar dari daftar, atau kosongkan.' }
      }
    })
  }

  // ---------------- Sheet Contoh
  const contoh = wb.addWorksheet('Contoh', { properties: { tabColor: { argb: 'FFF59E0B' } } })
  contoh.columns = KOLOM_TEMPLATE.map(k => ({ width: KETERANGAN[k].lebar }))
  spanduk(contoh, 1, 'Contoh Pengisian Data Penghuni', KOLOM_TEMPLATE.length)
  subjudul(contoh, 2, 'Ini hanya contoh — data di sheet ini TIDAK ikut diimpor. Salin formatnya ke sheet "Data".', KOLOM_TEMPLATE.length)
  const kepalaContoh = contoh.getRow(4)
  KOLOM_TEMPLATE.forEach((k, i) => { const c = kepalaContoh.getCell(i + 1); c.value = k; gayaJudulKolom(c) })
  kepalaContoh.height = 28
  const barisContoh: string[][] = [
    ['2410931001', 'Andi Saputra', 'L', 'andi.saputra@student.unand.ac.id', '081234567801', 'Padang', kamarContoh('Putra')],
    ['2410932002', 'Nadia Putri Lestari', 'P', 'nadia.putri@student.unand.ac.id', '081234567802', 'Bukittinggi', kamarContoh('Putri')],
    ['2410933003', 'Rahmat Hidayat', 'L', '', '', 'Payakumbuh', ''],
  ]
  barisContoh.forEach((isi, j) => {
    const row = contoh.getRow(5 + j)
    isi.forEach((v, i) => {
      const c = row.getCell(i + 1)
      c.value = v
      c.border = bingkai
      c.numFmt = '@'
      if (i === 2) c.alignment = { horizontal: 'center' }
      if (j % 2 === 1) isiWarna(c, 'FFF7FAF8')
    })
    row.height = 20
  })
  contoh.mergeCells(9, 1, 9, KOLOM_TEMPLATE.length)
  const catatanContoh = contoh.getCell(9, 1)
  catatanContoh.value = 'Baris ke-3 (Rahmat) menunjukkan kolom opsional yang boleh dikosongkan: Email, No HP, dan Nomor Kamar.'
  catatanContoh.font = { size: 10, color: { argb: 'FF92400E' } }
  catatanContoh.alignment = { indent: 1, vertical: 'middle', wrapText: true }
  isiWarna(catatanContoh, KUNING)
  contoh.getRow(9).height = 22

  // ---------------- Sheet Petunjuk
  const pet = wb.addWorksheet('Petunjuk', { properties: { tabColor: { argb: 'FF475569' } } })
  pet.columns = [{ width: 24 }, { width: 11 }, { width: 64 }, { width: 34 }]
  spanduk(pet, 1, 'Petunjuk Impor Data Penghuni — SIP Asrama UNAND', 4)
  subjudul(pet, 2, 'Isi sheet "Data" mulai baris 2. Jangan mengubah, menghapus, atau menukar judul kolom. Password awal akun: penghuni123', 4)
  const kepalaPet = pet.getRow(4)
  ;['Kolom', 'Wajib', 'Keterangan', 'Contoh'].forEach((t, i) => { const c = kepalaPet.getCell(i + 1); c.value = t; gayaJudulKolom(c) })
  kepalaPet.height = 24
  KOLOM_TEMPLATE.forEach((k, j) => {
    const info = KETERANGAN[k]
    const row = pet.getRow(5 + j)
    const nilai = [k, info.wajib ? 'Ya' : 'Tidak', info.catatan, k === 'Nomor Kamar' ? (kamarContoh('Putra') || '101-PA') : info.contoh]
    nilai.forEach((v, i) => {
      const c = row.getCell(i + 1)
      c.value = v
      c.border = bingkai
      c.alignment = { vertical: 'middle', wrapText: true, horizontal: i === 1 ? 'center' : 'left' }
      if (i === 0) c.font = { bold: true }
      if (i === 1) c.font = { bold: true, color: { argb: info.wajib ? 'FFBE123C' : ABU_TEKS } }
      if (j % 2 === 1) isiWarna(c, 'FFF7FAF8')
    })
    row.height = info.catatan.length > 70 ? 36 : 24
  })
  const langkah = [
    '1. Isi data penghuni di sheet "Data" (satu baris = satu penghuni).',
    '2. Jenis Kelamin dan Nomor Kamar dapat dipilih dari daftar pada sel.',
    '3. Nomor kamar harus sesuai jenis gedung (putra/putri) dan masih ada tempat — lihat sheet "Daftar Kamar".',
    '4. Simpan berkas, lalu unggah lewat tombol Impor di halaman Data Penghuni.',
    '5. Baris yang bermasalah akan ditampilkan alasannya dan dilewati; baris lain tetap diimpor.',
  ]
  langkah.forEach((t, j) => {
    const r = 13 + j
    pet.mergeCells(r, 1, r, 4)
    const c = pet.getCell(r, 1)
    c.value = t
    c.alignment = { indent: 1, vertical: 'middle', wrapText: true }
    c.font = { size: 11, color: { argb: 'FF1F2937' } }
    isiWarna(c, j % 2 === 0 ? HIJAU_MUDA : 'FFFFFFFF')
    pet.getRow(r).height = 20
  })

  // ---------------- Sheet Daftar Kamar (sumber pilihan Nomor Kamar)
  const dk = wb.addWorksheet('Daftar Kamar', { properties: { tabColor: { argb: 'FF64748B' } }, views: [{ state: 'frozen', ySplit: 3 }] })
  dk.columns = [{ width: 16 }, { width: 24 }, { width: 10 }, { width: 12 }, { width: 12 }]
  spanduk(dk, 1, 'Daftar Kamar & Sisa Tempat', 5, 13)
  subjudul(dk, 2, `Data langsung dari sistem saat template diunduh (${new Date().toLocaleString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })} WIB). Bila kamar berubah setelahnya, unduh ulang template — saat impor, kamar tetap diperiksa dengan data terbaru.`, 5)
  dk.getRow(2).height = 46
  const kepalaDk = dk.getRow(3)
  ;['Nomor Kamar', 'Gedung', 'Jenis', 'Kapasitas', 'Sisa tempat'].forEach((t, i) => { const c = kepalaDk.getCell(i + 1); c.value = t; gayaJudulKolom(c) })
  kamarUrut.forEach((k, j) => {
    const g = gedungList.find(x => x.id === k.idGedung)
    const sisa = Math.max(0, k.kapasitas - hunianKamar(k, penghuni))
    const row = dk.getRow(4 + j)
    ;[k.nomorKamar, g?.nama ?? '-', g?.jenis ?? '-', k.kapasitas, sisa].forEach((v, i) => {
      const c = row.getCell(i + 1)
      c.value = v
      c.border = bingkai
      if (i >= 2) c.alignment = { horizontal: 'center' }
      if (i === 4) c.font = { bold: true, color: { argb: sisa === 0 ? 'FFBE123C' : HIJAU } }
      if (j % 2 === 1) isiWarna(c, 'FFF7FAF8')
    })
  })

  const buffer = await wb.xlsx.writeBuffer()
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const a = document.createElement('a')
  a.href = url
  a.download = 'template-impor-penghuni.xlsx'
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
