import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import logoUnandUrl from './assets/logo-unand.png'

/**
 * Ekspor laporan formal (dipakai halaman admin & fasil): kop instansi, judul, keterangan,
 * ringkasan, tabel bernomor, blok tanda tangan, dan nomor halaman.
 * PDF memakai jsPDF; Excel memakai ExcelJS (dimuat hanya saat dibutuhkan) karena SheetJS
 * versi gratis tidak dapat menulis gaya sel.
 */

export type ExportFormat = 'csv' | 'xlsx' | 'doc' | 'pdf'

/** Kop laporan. Sesuaikan dengan nama resmi unit pengelola asrama. */
export const KOP_LAPORAN = {
  instansi: 'UNIVERSITAS ANDALAS',
  unit: 'UNIT PENGELOLA ASRAMA MAHASISWA',
  alamat: 'Kampus Limau Manis, Padang, Sumatera Barat 25163',
  kota: 'Padang',
  aplikasi: 'Sistem Informasi Presensi Asrama',
}

type Nilai = string | number | null | undefined

export interface LaporanFormal {
  judul: string
  // Baris keterangan di bawah judul, mis. [['Periode', '1–17 Nov 2026'], ['Gedung', 'Asrama Putra A']]
  keterangan?: [string, string][]
  headers: string[]
  rows: Nilai[][]
  // Angka ringkasan di atas tabel, mis. [['Rata-rata hadir', '87%']]
  ringkasan?: [string, Nilai][]
  // Indeks kolom (pada headers) yang berisi angka -> rata tengah
  kolomAngka?: number[]
  // Indeks kolom status -> teks diberi warna sesuai status
  kolomStatus?: number
  penandatangan?: { jabatan: string; nama: string; identitas?: string }
  catatan?: string
}

// ---------- Gaya bersama ----------

const HIJAU_TUA = [14, 75, 41] as const
const HIJAU_MUDA = [245, 250, 247] as const
const GARIS = [205, 213, 209] as const
const TEKS = [31, 41, 55] as const
const ABU = [107, 114, 128] as const

const WARNA_STATUS: Record<string, readonly [number, number, number]> = {
  Hadir: [4, 120, 87], Disetujui: [29, 78, 216], Aktif: [4, 120, 87], Diterima: [4, 120, 87],
  'Tidak Hadir': [190, 18, 60], Ditolak: [190, 18, 60], Nonaktif: [107, 114, 128], 'Perlu ditegur': [190, 18, 60],
  Izin: [180, 83, 9], Menunggu: [194, 65, 12], Pending: [194, 65, 12],
  Belum: [107, 114, 128], Libur: [3, 105, 161],
}

const hex = (rgb: readonly number[]) => rgb.map(n => n.toString(16).padStart(2, '0')).join('').toUpperCase()
const teks = (v: Nilai) => (v === null || v === undefined ? '' : String(v))

function tanggalCetak(d = new Date()) {
  return {
    panjang: new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(d),
    lengkap: new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeStyle: 'short' }).format(d),
  }
}

// Kolom "No" ditambahkan di depan; banyak kolom -> kertas mendatar
function siapkan(l: LaporanFormal) {
  const headers = ['No', ...l.headers]
  const rows = l.rows.map((r, i) => [i + 1, ...r])
  return { headers, rows, lanskap: headers.length > 7 }
}

// Logo kop sebagai data URL (dimuat sekali). Gagal dimuat -> laporan memakai lambang aplikasi.
const LOGO_RASIO = 248 / 203
let logoTersimpan: Promise<string | null> | null = null
function muatLogo(): Promise<string | null> {
  logoTersimpan ??= fetch(logoUnandUrl)
    .then(res => (res.ok ? res.blob() : Promise.reject(new Error('logo'))))
    .then(blob => new Promise<string>((selesai, gagal) => {
      const reader = new FileReader()
      reader.onload = () => selesai(String(reader.result))
      reader.onerror = gagal
      reader.readAsDataURL(blob)
    }))
    .catch(() => null)
  return logoTersimpan
}

function unduhBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// ---------- PDF ----------

// Lambang aplikasi (gedung) dari favicon, digambar sebagai vektor
function gambarLambang(pdf: jsPDF, x: number, y: number, s: number) {
  pdf.setFillColor(12, 42, 28)
  pdf.roundedRect(x, y, s, s, s * 0.22, s * 0.22, 'F')
  pdf.setDrawColor(110, 231, 183)
  pdf.setLineWidth(s * 0.045)
  const u = s / 36
  pdf.rect(x + 13 * u, y + 7 * u, 10 * u, 22 * u)
  pdf.rect(x + 8 * u, y + 17 * u, 5 * u, 12 * u)
  pdf.rect(x + 23 * u, y + 14 * u, 5 * u, 15 * u)
  for (const yy of [11, 15, 19, 23]) pdf.line(x + 16 * u, y + yy * u, x + 20 * u, y + yy * u)
}

async function buatPdf(l: LaporanFormal, filename: string) {
  const { headers, rows, lanskap } = siapkan(l)
  const pdf = new jsPDF({ orientation: lanskap ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' })
  const W = pdf.internal.pageSize.getWidth()
  const H = pdf.internal.pageSize.getHeight()
  const M = 15
  const tgl = tanggalCetak()
  const logo = await muatLogo()

  // Kop: logo universitas di kiri, teks instansi di tengah
  if (logo) pdf.addImage(logo, 'PNG', M, 7.5, 18, 18 * LOGO_RASIO)
  else gambarLambang(pdf, M, 10, 17)
  pdf.setTextColor(...TEKS)
  pdf.setFont('times', 'bold')
  pdf.setFontSize(14)
  pdf.text(KOP_LAPORAN.instansi, W / 2, 15, { align: 'center' })
  pdf.setFontSize(12)
  pdf.text(KOP_LAPORAN.unit, W / 2, 21, { align: 'center' })
  pdf.setFont('times', 'normal')
  pdf.setFontSize(9.5)
  pdf.text(KOP_LAPORAN.alamat, W / 2, 26, { align: 'center' })
  pdf.setDrawColor(...TEKS)
  pdf.setLineWidth(0.7)
  pdf.line(M, 31, W - M, 31)
  pdf.setLineWidth(0.2)
  pdf.line(M, 32.1, W - M, 32.1)

  // Judul
  let y = 40
  pdf.setFont('times', 'bold')
  pdf.setFontSize(13)
  const judul = l.judul.toUpperCase()
  pdf.text(judul, W / 2, y, { align: 'center' })
  const lebarJudul = pdf.getTextWidth(judul)
  pdf.setLineWidth(0.3)
  pdf.line(W / 2 - lebarJudul / 2, y + 1.2, W / 2 + lebarJudul / 2, y + 1.2)
  y += 9

  // Keterangan (label : nilai)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  const keterangan: [string, string][] = [...(l.keterangan ?? []), ['Tanggal cetak', tgl.lengkap]]
  const lebarLabel = Math.max(...keterangan.map(([k]) => pdf.getTextWidth(k))) + 3
  for (const [k, v] of keterangan) {
    pdf.setTextColor(...ABU)
    pdf.text(k, M, y)
    pdf.setTextColor(...TEKS)
    pdf.text(':', M + lebarLabel, y)
    pdf.text(pdf.splitTextToSize(v, W - 2 * M - lebarLabel - 4), M + lebarLabel + 3, y)
    y += 5
  }

  // Ringkasan dalam kotak berjajar
  if (l.ringkasan?.length) {
    y += 2
    const n = l.ringkasan.length
    const jarak = 3
    const lebar = (W - 2 * M - jarak * (n - 1)) / n
    l.ringkasan.forEach(([label, nilai], i) => {
      const x = M + i * (lebar + jarak)
      pdf.setFillColor(...HIJAU_MUDA)
      pdf.setDrawColor(...GARIS)
      pdf.setLineWidth(0.2)
      pdf.roundedRect(x, y, lebar, 14, 1.5, 1.5, 'FD')
      pdf.setFontSize(7.5)
      pdf.setTextColor(...ABU)
      pdf.text(label, x + 3, y + 5)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(11)
      pdf.setTextColor(...HIJAU_TUA)
      pdf.text(teks(nilai), x + 3, y + 11)
      pdf.setFont('helvetica', 'normal')
    })
    y += 19
  } else {
    y += 3
  }

  // Halaman lanjutan: kepala ringkas agar pembaca tahu laporan apa yang sedang dibaca
  const kepalaLanjutan = () => {
    pdf.setFont('times', 'bold')
    pdf.setFontSize(9)
    pdf.setTextColor(...TEKS)
    pdf.text(KOP_LAPORAN.instansi, M, 13)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(...ABU)
    pdf.text(l.judul, W - M, 13, { align: 'right' })
    pdf.setDrawColor(...GARIS)
    pdf.setLineWidth(0.3)
    pdf.line(M, 15.5, W - M, 15.5)
  }

  // Tabel
  const kolomTengah = new Set([0, ...(l.kolomAngka ?? []).map(i => i + 1)])
  const kolomStatus = l.kolomStatus !== undefined ? l.kolomStatus + 1 : -1
  autoTable(pdf, {
    head: [headers],
    body: rows.map(r => r.map(teks)),
    startY: y,
    theme: 'grid',
    margin: { left: M, right: M, top: 22, bottom: 18 },
    styles: { font: 'helvetica', fontSize: headers.length > 9 ? 7 : 8, cellPadding: { top: 1.3, bottom: 1.3, left: 1.8, right: 1.8 }, lineColor: [...GARIS], lineWidth: 0.15, textColor: [...TEKS], valign: 'middle', overflow: 'linebreak' },
    headStyles: { fillColor: [...HIJAU_TUA], textColor: 255, fontStyle: 'bold', halign: 'center' },
    alternateRowStyles: { fillColor: [...HIJAU_MUDA] },
    columnStyles: Object.fromEntries([...kolomTengah].map(i => [i, { halign: 'center' as const }])),
    didParseCell: data => {
      if (data.section === 'body' && data.column.index === kolomStatus) {
        const warna = WARNA_STATUS[String(data.cell.raw)]
        if (warna) {
          data.cell.styles.textColor = [...warna]
          data.cell.styles.fontStyle = 'bold'
        }
      }
    },
    didDrawPage: data => {
      if (data.pageNumber > 1) kepalaLanjutan()
    },
  })
  y = (pdf as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY

  if (rows.length === 0) {
    pdf.setFont('helvetica', 'italic')
    pdf.setFontSize(9)
    pdf.setTextColor(...ABU)
    pdf.text('Tidak ada data pada filter yang dipilih.', W / 2, y + 7, { align: 'center' })
    y += 8
  }
  if (l.catatan) {
    pdf.setFont('helvetica', 'italic')
    pdf.setFontSize(8)
    pdf.setTextColor(...ABU)
    const baris = pdf.splitTextToSize(`Catatan: ${l.catatan}`, W - 2 * M)
    pdf.text(baris, M, y + 6)
    y += 4 + baris.length * 3.5
  }

  // Tanda tangan: tinggi blok ±31 mm (ruang paraf ±2 cm); pindah halaman hanya bila benar-benar tidak muat
  if (l.penandatangan) {
    const jarakAtas = 10
    const tinggiBlok = 31
    if (y + jarakAtas + tinggiBlok > H - 15) {
      pdf.addPage()
      kepalaLanjutan()
      y = 28
    } else {
      y += jarakAtas
    }
    const x = W - M - 70
    pdf.setFont('times', 'normal')
    pdf.setFontSize(11)
    pdf.setTextColor(...TEKS)
    pdf.text(`${KOP_LAPORAN.kota}, ${tgl.panjang}`, x, y)
    pdf.text(l.penandatangan.jabatan, x, y + 6)
    pdf.setFont('times', 'bold')
    const nama = l.penandatangan.nama
    pdf.text(nama, x, y + 26)
    pdf.setDrawColor(...TEKS)
    pdf.setLineWidth(0.3)
    pdf.line(x, y + 27, x + pdf.getTextWidth(nama), y + 27)
    if (l.penandatangan.identitas) {
      pdf.setFont('times', 'normal')
      pdf.text(l.penandatangan.identitas, x, y + 31)
    }
  }

  // Kaki halaman di setiap halaman: sumber & nomor halaman
  const total = pdf.getNumberOfPages()
  for (let i = 1; i <= total; i++) {
    pdf.setPage(i)
    pdf.setDrawColor(...GARIS)
    pdf.setLineWidth(0.2)
    pdf.line(M, H - 12, W - M, H - 12)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(7.5)
    pdf.setTextColor(...ABU)
    pdf.text(`Dicetak dari ${KOP_LAPORAN.aplikasi} · ${tgl.lengkap}`, M, H - 8)
    pdf.text(`Halaman ${i} dari ${total}`, W - M, H - 8, { align: 'right' })
  }

  pdf.save(filename)
}

// ---------- Excel ----------

async function buatExcel(l: LaporanFormal, filename: string) {
  const { default: ExcelJS } = await import('exceljs')
  const { headers, rows, lanskap } = siapkan(l)
  const tgl = tanggalCetak()
  const n = headers.length
  const wb = new ExcelJS.Workbook()
  wb.creator = KOP_LAPORAN.aplikasi
  wb.created = new Date()
  const ws = wb.addWorksheet('Laporan', {
    pageSetup: {
      paperSize: 9, orientation: lanskap ? 'landscape' : 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0,
      margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 },
    },
    headerFooter: { oddFooter: `&L&8Dicetak dari ${KOP_LAPORAN.aplikasi} · ${tgl.lengkap}&R&8Halaman &P dari &N` },
  })

  const tepi = { style: 'thin' as const, color: { argb: `FF${hex(GARIS)}` } }
  const semuaTepi = { top: tepi, left: tepi, bottom: tepi, right: tepi }
  let r = 1
  const barisGabung = (nilai: string, font: Partial<import('exceljs').Font>, tinggi = 18) => {
    ws.mergeCells(r, 1, r, n)
    const c = ws.getCell(r, 1)
    c.value = nilai
    c.font = { name: 'Times New Roman', ...font }
    c.alignment = { horizontal: 'center', vertical: 'middle' }
    ws.getRow(r).height = tinggi
    r++
  }

  // Kop & garis ganda; logo mengapung di kiri baris kop
  const logo = await muatLogo()
  if (logo) {
    const idLogo = wb.addImage({ base64: logo, extension: 'png' })
    ws.addImage(idLogo, { tl: { col: 0.1, row: 0.1 }, ext: { width: 54, height: 54 * LOGO_RASIO } })
  }
  barisGabung(KOP_LAPORAN.instansi, { size: 14, bold: true }, 20)
  barisGabung(KOP_LAPORAN.unit, { size: 12, bold: true })
  barisGabung(KOP_LAPORAN.alamat, { size: 10, color: { argb: `FF${hex(ABU)}` } })
  for (let c = 1; c <= n; c++) ws.getCell(r - 1, c).border = { bottom: { style: 'double', color: { argb: `FF${hex(TEKS)}` } } }
  r++
  barisGabung(l.judul.toUpperCase(), { size: 13, bold: true, underline: true }, 22)
  r++

  // Keterangan & ringkasan: label di kolom 1–2, nilai di kolom 3 dst.
  const labelNilai = (label: string, nilai: Nilai, tebal = false) => {
    ws.mergeCells(r, 1, r, Math.min(2, n))
    ws.getCell(r, 1).value = label
    ws.getCell(r, 1).font = { size: 10, color: { argb: `FF${hex(ABU)}` } }
    if (n >= 3) {
      ws.mergeCells(r, 3, r, n)
      const c = ws.getCell(r, 3)
      c.value = `: ${teks(nilai)}`
      c.font = { size: 10, bold: tebal, color: { argb: `FF${hex(tebal ? HIJAU_TUA : TEKS)}` } }
    }
    r++
  }
  for (const [k, v] of [...(l.keterangan ?? []), ['Tanggal cetak', tgl.lengkap] as [string, string]]) labelNilai(k, v)
  if (l.ringkasan?.length) {
    r++
    ws.getCell(r, 1).value = 'Ringkasan'
    ws.getCell(r, 1).font = { size: 10, bold: true }
    r++
    for (const [k, v] of l.ringkasan) labelNilai(k, v, true)
  }
  r++

  // Tabel
  const barisKepala = r
  const kepala = ws.getRow(r)
  kepala.values = headers
  kepala.height = 22
  kepala.eachCell(c => {
    c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${hex(HIJAU_TUA)}` } }
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    c.border = semuaTepi
  })
  r++
  const kolomTengah = new Set([1, ...(l.kolomAngka ?? []).map(i => i + 2)])
  const kolomStatus = l.kolomStatus !== undefined ? l.kolomStatus + 2 : -1
  rows.forEach((data, i) => {
    const row = ws.getRow(r)
    row.values = data.map(v => (typeof v === 'number' ? v : teks(v)))
    for (let c = 1; c <= n; c++) {
      const cell = row.getCell(c)
      cell.border = semuaTepi
      cell.font = { size: 10, color: { argb: `FF${hex(TEKS)}` } }
      cell.alignment = { vertical: 'middle', horizontal: kolomTengah.has(c) ? 'center' : 'left', wrapText: true }
      if (i % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${hex(HIJAU_MUDA)}` } }
      const warna = c === kolomStatus ? WARNA_STATUS[teks(data[c - 1])] : undefined
      if (warna) cell.font = { size: 10, bold: true, color: { argb: `FF${hex(warna)}` } }
    }
    r++
  })
  if (rows.length === 0) {
    ws.mergeCells(r, 1, r, n)
    ws.getCell(r, 1).value = 'Tidak ada data pada filter yang dipilih.'
    ws.getCell(r, 1).font = { italic: true, color: { argb: `FF${hex(ABU)}` } }
    ws.getCell(r, 1).alignment = { horizontal: 'center' }
    r++
  }
  ws.autoFilter = { from: { row: barisKepala, column: 1 }, to: { row: barisKepala, column: n } }
  // Tanpa kunci baris: kop + keterangan di atas tabel terlalu tinggi untuk dibekukan di layar kecil.
  // Kepala tabel tetap diulang di setiap halaman cetak; garis kisi disembunyikan agar tampak seperti dokumen.
  ws.views = [{ showGridLines: false }]
  ws.pageSetup.printTitlesRow = `${barisKepala}:${barisKepala}`

  // Lebar kolom dari isi terpanjang (dibatasi agar tetap rapi)
  for (let i = 0; i < n; i++) {
    const panjang = Math.max(teks(headers[i]).length, ...rows.slice(0, 200).map(x => teks(x[i]).length))
    ws.getColumn(i + 1).width = i === 0 ? 6 : Math.min(40, Math.max(10, panjang + 2))
  }

  if (l.catatan) {
    r++
    ws.mergeCells(r, 1, r, n)
    ws.getCell(r, 1).value = `Catatan: ${l.catatan}`
    ws.getCell(r, 1).font = { italic: true, size: 9, color: { argb: `FF${hex(ABU)}` } }
    ws.getCell(r, 1).alignment = { wrapText: true }
    r++
  }

  // Tanda tangan di sisi kanan
  if (l.penandatangan) {
    r += 2
    const awal = Math.max(1, n - 2)
    const tulis = (nilai: string, font: Partial<import('exceljs').Font> = {}) => {
      ws.mergeCells(r, awal, r, n)
      const c = ws.getCell(r, awal)
      c.value = nilai
      c.font = { name: 'Times New Roman', size: 11, ...font }
      r++
    }
    tulis(`${KOP_LAPORAN.kota}, ${tgl.panjang}`)
    tulis(l.penandatangan.jabatan)
    r += 3
    tulis(l.penandatangan.nama, { bold: true, underline: true })
    if (l.penandatangan.identitas) tulis(l.penandatangan.identitas)
  }

  const buffer = await wb.xlsx.writeBuffer()
  unduhBlob(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename)
}

// ---------- Word (HTML yang dibuka Word) ----------

async function buatDoc(l: LaporanFormal, filename: string) {
  const { headers, rows, lanskap } = siapkan(l)
  const tgl = tanggalCetak()
  const logo = await muatLogo()
  const esc = (v: Nilai) => teks(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const kolomTengah = new Set([0, ...(l.kolomAngka ?? []).map(i => i + 1)])
  const kolomStatus = l.kolomStatus !== undefined ? l.kolomStatus + 1 : -1
  const sel = (v: Nilai, i: number) => {
    const warna = i === kolomStatus ? WARNA_STATUS[teks(v)] : undefined
    const gaya = [kolomTengah.has(i) ? 'text-align:center' : '', warna ? `color:#${hex(warna)};font-weight:bold` : ''].filter(Boolean).join(';')
    return `<td${gaya ? ` style="${gaya}"` : ''}>${esc(v)}</td>`
  }
  const keterangan = [...(l.keterangan ?? []), ['Tanggal cetak', tgl.lengkap]].map(([k, v]) => `<tr><td class="lbl">${esc(k)}</td><td>: ${esc(v)}</td></tr>`).join('')
  const ringkasan = l.ringkasan?.length
    ? `<table class="ringkas"><tr>${l.ringkasan.map(([k, v]) => `<td><span>${esc(k)}</span><b>${esc(v)}</b></td>`).join('')}</tr></table>`
    : ''
  const html = `<html><head><meta charset="utf-8"><style>
@page{size:A4 ${lanskap ? 'landscape' : 'portrait'};margin:2cm 1.5cm}
body{font-family:Arial,sans-serif;font-size:10pt;color:#1f2937}
.kop{text-align:center;font-family:'Times New Roman',serif;border-bottom:3px double #1f2937;padding-bottom:6px;margin-bottom:14px}
.kop h1{font-size:14pt;margin:0}.kop h2{font-size:12pt;margin:2px 0}.kop p{font-size:10pt;margin:0;color:#6b7280}
h3{text-align:center;font-family:'Times New Roman',serif;font-size:13pt;text-decoration:underline;margin:0 0 12px}
.ket td{padding:1px 6px 1px 0;font-size:9.5pt}.ket .lbl{color:#6b7280}
.ringkas{width:100%;margin:10px 0}.ringkas td{border:1px solid #cdd5d1;background:#f5faf7;padding:6px}.ringkas span{display:block;font-size:8pt;color:#6b7280}.ringkas b{font-size:12pt;color:#0e4b29}
.data{border-collapse:collapse;width:100%;margin-top:10px}.data th,.data td{border:1px solid #cdd5d1;padding:4px 6px;font-size:9pt;vertical-align:middle}
.data th{background:#0e4b29;color:#fff;text-align:center}.data tr:nth-child(even) td{background:#f5faf7}
.ttd{margin-top:28px;margin-left:60%;font-family:'Times New Roman',serif;font-size:11pt}.ttd .nama{margin-top:56px;font-weight:bold;text-decoration:underline}
.cat{font-style:italic;font-size:8.5pt;color:#6b7280;margin-top:8px}
</style></head><body>
<div class="kop"><table style="width:100%"><tr>
<td style="width:70px;vertical-align:middle">${logo ? `<img src="${logo}" width="58" height="${Math.round(58 * LOGO_RASIO)}" alt="Logo">` : ''}</td>
<td style="text-align:center"><h1>${esc(KOP_LAPORAN.instansi)}</h1><h2>${esc(KOP_LAPORAN.unit)}</h2><p>${esc(KOP_LAPORAN.alamat)}</p></td>
<td style="width:70px"></td></tr></table></div>
<h3>${esc(l.judul.toUpperCase())}</h3>
<table class="ket">${keterangan}</table>${ringkasan}
<table class="data"><thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>
${rows.length ? rows.map(r => `<tr>${r.map(sel).join('')}</tr>`).join('') : `<tr><td colspan="${headers.length}" style="text-align:center;font-style:italic">Tidak ada data pada filter yang dipilih.</td></tr>`}
</tbody></table>
${l.catatan ? `<p class="cat">Catatan: ${esc(l.catatan)}</p>` : ''}
${l.penandatangan ? `<div class="ttd">${esc(KOP_LAPORAN.kota)}, ${esc(tgl.panjang)}<br>${esc(l.penandatangan.jabatan)}<div class="nama">${esc(l.penandatangan.nama)}</div>${l.penandatangan.identitas ? esc(l.penandatangan.identitas) : ''}</div>` : ''}
</body></html>`
  unduhBlob(new Blob(['﻿', html], { type: 'application/msword' }), filename)
}

// ---------- CSV (data mentah, tanpa kop) ----------

function buatCsv(l: LaporanFormal, filename: string) {
  const sel = (v: Nilai) => `"${teks(v).replace(/"/g, '""')}"`
  const isi = [l.headers, ...l.rows].map(r => r.map(sel).join(',')).join('\r\n')
  // BOM agar Excel membaca huruf UTF-8 dengan benar
  unduhBlob(new Blob(['﻿', isi], { type: 'text/csv;charset=utf-8' }), filename)
}

/** Unduh laporan formal dalam format yang dipilih */
export async function unduhLaporan(filename: string, laporan: LaporanFormal, format: ExportFormat): Promise<void> {
  if (format === 'pdf') return buatPdf(laporan, filename)
  if (format === 'xlsx') return buatExcel(laporan, filename)
  if (format === 'doc') return buatDoc(laporan, filename)
  return buatCsv(laporan, filename)
}

/** Bentuk lama (judul + tabel saja); tetap dipakai, mis. rekap event */
export function downloadReport(filename: string, headers: string[], rows: unknown[][], format: ExportFormat, title: string) {
  void unduhLaporan(filename, { judul: title, headers, rows: rows.map(r => r.map(v => (typeof v === 'number' ? v : teks(v as Nilai)))) }, format)
}
