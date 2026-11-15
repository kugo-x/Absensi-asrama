import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

// Unduh laporan tabel (dipakai halaman admin & fasil)
export type ExportFormat = 'csv' | 'xlsx' | 'doc' | 'pdf'

export function downloadReport(filename: string, headers: string[], rows: unknown[][], format: ExportFormat, title: string) {
  const escapeCell = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`
  const content = [headers, ...rows].map(row => row.map(escapeCell).join(',')).join('\r\n')
  if (format === 'xlsx') {
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows])
    worksheet['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: headers.length - 1 } }) }
    worksheet['!cols'] = headers.map((header, index) => ({
      wch: Math.min(32, Math.max(header.length + 2, ...rows.slice(0, 100).map(row => String(row[index] ?? '').length + 2))),
    }))
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Laporan')
    XLSX.writeFile(workbook, filename)
    return
  }

  if (format === 'pdf') {
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    pdf.setFontSize(14)
    pdf.text(title, 14, 14)
    pdf.setFontSize(8)
    pdf.text(`Dicetak ${new Intl.DateTimeFormat('id-ID', { dateStyle: 'long' }).format(new Date())}`, 14, 20)
    autoTable(pdf, {
      head: [headers],
      body: rows.map(row => row.map(value => String(value ?? ''))),
      startY: 25,
      theme: 'grid',
      styles: { fontSize: 7, cellPadding: 2, overflow: 'linebreak' },
      headStyles: { fillColor: [6, 95, 70], textColor: 255 },
      alternateRowStyles: { fillColor: [240, 253, 244] },
      margin: { left: 10, right: 10 },
    })
    pdf.save(filename)
    return
  }

  if (format === 'doc') {
    const tableRows = [headers, ...rows].map((row, index) => `<tr>${row.map(value => index === 0 ? `<th>${String(value ?? '')}</th>` : `<td>${String(value ?? '')}</td>`).join('')}</tr>`).join('')
    const html = `<html><head><meta charset="utf-8"><style>body{font-family:Arial;color:#19352a}h1{font-size:18pt}p{font-size:9pt;color:#666}table{border-collapse:collapse;font-family:Arial;font-size:10pt;width:100%}th,td{border:1px solid #9bb5a5;padding:6px;text-align:left}th{background:#065f46;color:#fff}tr:nth-child(even){background:#f0fdf4}</style></head><body><h1>${title}</h1><p>Dicetak ${new Intl.DateTimeFormat('id-ID', { dateStyle: 'long' }).format(new Date())}</p><table>${tableRows}</table></body></html>`
    const blob = new Blob([html], { type: 'application/msword' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
    return
  }

  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
