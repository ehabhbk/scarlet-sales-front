import { formatDateTime } from './format'

export interface PrintRestaurant {
  name?: string | null
  logo?: string | null
  address?: string | null
  phone?: string | null
  tax_number?: string | null
}

export interface PrintMeta {
  label: string
  value: string
}

export interface PrintKpi {
  label: string
  value: string
  tone?: 'default' | 'green' | 'red' | 'blue' | 'amber'
}

export interface PrintColumn {
  label: string
  align?: 'right' | 'left' | 'center'
  nowrap?: boolean
  width?: string
}

export type PrintCell = string | number | null | undefined

export interface PrintSection {
  title?: string
  columns?: PrintColumn[]
  rows?: PrintCell[][]
  footer?: PrintCell[]
  emptyText?: string
  html?: string
}

export interface PrintSummaryRow {
  label: string
  value: string
  tone?: 'default' | 'green' | 'red'
}

export interface PrintReportOptions {
  title: string
  subtitle?: string
  restaurant?: PrintRestaurant | null
  logo?: string | null
  meta?: PrintMeta[]
  kpis?: PrintKpi[]
  sections?: PrintSection[]
  summaryTitle?: string
  summary?: PrintSummaryRow[]
  signatures?: string[]
  footerNote?: string
  orientation?: 'portrait' | 'landscape'
  generatedAt?: Date
}

export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const alignClass = (align?: PrintColumn['align']) => {
  if (align === 'left') return 'num'
  if (align === 'center') return 'center'
  return ''
}

const renderCell = (cell: PrintCell, tag: 'td' | 'th', className = '') => {
  const value = escapeHtml(cell)
  return `<${tag}${className ? ` class="${className}"` : ''}>${value || '-'}</${tag}>`
}

const renderSections = (sections: PrintSection[] = []) => {
  return sections
    .map((section) => {
      const rows = section.rows || []
      const hasTable = Array.isArray(section.columns) && section.columns.length > 0

      let body = ''
      if (section.html) {
        body = `<div class="section-html">${section.html}</div>`
      } else if (hasTable && rows.length > 0) {
        const head = section.columns!
          .map((column) => `<th${column.width ? ` style="width:${escapeHtml(column.width)}"` : ''}>${escapeHtml(column.label)}</th>`)
          .join('')
        const bodyRows = rows
          .map((row) => {
            const cells = row
              .map((cell, index) => {
                const column = section.columns![index]
                const classes = [alignClass(column?.align), column?.nowrap ? 'nowrap' : ''].filter(Boolean).join(' ')
                return renderCell(cell, 'td', classes)
              })
              .join('')
            return `<tr>${cells}</tr>`
          })
          .join('')
        const footer = section.footer
          ? `<tfoot><tr class="total-row">${section.footer
              .map((cell, index) => {
                const column = section.columns![index]
                return renderCell(cell, 'th', alignClass(column?.align))
              })
              .join('')}</tr></tfoot>`
          : ''
        body = `<table><thead><tr>${head}</tr></thead><tbody>${bodyRows}</tbody>${footer}</table>`
      } else if (hasTable) {
        body = `<div class="empty">${escapeHtml(section.emptyText || 'لا توجد بيانات للعرض')}</div>`
      }

      if (!body) return ''
      return `<section class="avoid">${section.title ? `<h2>${escapeHtml(section.title)}</h2>` : ''}${body}</section>`
    })
    .join('')
}

/**
 * Opens a new window with a print-ready A4 report and triggers the browser
 * print dialog. Users can choose "Save as PDF" to export the report.
 */
export function printReport(options: PrintReportOptions): boolean {
  const win = window.open('', '_blank', 'width=1100,height=850')
  if (!win) return false

  const restaurant = options.restaurant || {}
  const logo = options.logo || restaurant.logo || ''
  const restaurantMeta = [restaurant.address, restaurant.phone ? `هاتف: ${restaurant.phone}` : null, restaurant.tax_number ? `الرقم الضريبي: ${restaurant.tax_number}` : null]
    .filter(Boolean)
    .join(' • ')

  const metaHtml = (options.meta || [])
    .map((item) => `<div><span>${escapeHtml(item.label)}:</span> <b>${escapeHtml(item.value)}</b></div>`)
    .join('')

  const kpiHtml = (options.kpis || [])
    .map(
      (kpi) =>
        `<div class="kpi ${kpi.tone && kpi.tone !== 'default' ? kpi.tone : ''}"><span class="label">${escapeHtml(kpi.label)}</span><span class="value">${escapeHtml(kpi.value)}</span></div>`
    )
    .join('')

  const summaryHtml = (options.summary || [])
    .map(
      (row) =>
        `<tr><th>${escapeHtml(row.label)}</th><td class="num ${row.tone && row.tone !== 'default' ? 'tone-' + row.tone : ''}">${escapeHtml(row.value)}</td></tr>`
    )
    .join('')

  const signatures = options.signatures || []
  const signaturesHtml = signatures.length
    ? `<section class="signatures avoid">${signatures
        .map((label) => `<div class="sign"><div>${escapeHtml(label)}</div></div>`)
        .join('')}</section>`
    : ''

  const generatedAt = options.generatedAt || new Date()
  const pageSize = options.orientation === 'landscape' ? 'A4 landscape' : 'A4 portrait'

  win.document.write(`
    <html dir="rtl"><head><meta charset="utf-8" /><title>${escapeHtml(options.title)}</title>
    <style>
      *{box-sizing:border-box;}
      body{font-family:'Segoe UI',Tahoma,Arial,sans-serif;margin:0;padding:18px;color:#1f2937;font-size:11px;background:#fff;}
      @page{size:${pageSize};margin:10mm;}
      .brand{display:flex;align-items:center;justify-content:space-between;gap:16px;border-bottom:3px solid #0f766e;padding-bottom:12px;margin-bottom:12px;}
      .brand-main{display:flex;align-items:center;gap:12px;}
      .brand img{width:66px;height:66px;object-fit:contain;border-radius:8px;border:1px solid #e5e7eb;padding:4px;background:#fff;}
      .brand h1{margin:0;font-size:20px;color:#0f766e;}
      .brand p{margin:2px 0;color:#6b7280;font-size:10px;}
      .doc-badge{background:#0f766e;color:#fff;padding:7px 16px;border-radius:999px;font-weight:700;font-size:12px;white-space:nowrap;}
      .doc-sub{color:#6b7280;font-size:10px;margin-top:4px;}
      .meta{display:grid;grid-template-columns:repeat(3,1fr);gap:6px 14px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px;padding:10px 12px;margin-bottom:14px;font-size:10.5px;}
      .meta span{color:#6b7280;}
      .meta b{color:#111827;font-weight:600;}
      .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px;}
      .kpi{border:1px solid #e5e7eb;border-radius:10px;padding:10px;background:#fff;}
      .kpi .label{color:#6b7280;font-size:10px;display:block;margin-bottom:4px;}
      .kpi .value{font-size:14px;font-weight:700;color:#111827;}
      .kpi.green .value{color:#047857;}
      .kpi.red .value{color:#b91c1c;}
      .kpi.blue .value{color:#1d4ed8;}
      .kpi.amber .value{color:#b45309;}
      h2{font-size:13px;margin:16px 0 6px;padding:6px 10px;background:#f1f5f9;border-right:4px solid #0f766e;border-radius:4px;color:#0f172a;}
      table{width:100%;border-collapse:collapse;font-size:9.5px;margin-bottom:4px;}
      th,td{border:1px solid #e5e7eb;padding:5px 6px;text-align:right;vertical-align:middle;}
      th{background:#0f766e;color:#fff;font-weight:600;font-size:9.5px;}
      tbody tr:nth-child(even){background:#f8fafc;}
      tfoot th,.total-row th,.total-row td{background:#e2e8f0;color:#0f172a;}
      .total-row th{text-align:right;}
      .num{text-align:left;font-variant-numeric:tabular-nums;white-space:nowrap;}
      .center{text-align:center;}
      .nowrap{white-space:nowrap;}
      .empty{padding:8px;text-align:center;color:#9ca3af;border:1px dashed #d1d5db;border-radius:6px;margin-bottom:6px;}
      .summary table th{width:64%;background:#f8fafc;color:#374151;}
      .summary table td{font-weight:700;}
      .tone-green{color:#047857;}
      .tone-red{color:#b91c1c;}
      .signatures{display:grid;grid-template-columns:repeat(${Math.max(signatures.length, 2)},1fr);gap:40px;margin-top:26px;}
      .sign div{border-top:1px solid #9ca3af;margin-top:34px;padding-top:6px;text-align:center;color:#6b7280;}
      .footer{margin-top:14px;border-top:1px solid #e5e7eb;padding-top:8px;color:#9ca3af;font-size:9px;display:flex;justify-content:space-between;gap:12px;}
      .section-html{font-size:10px;}
      .avoid{page-break-inside:avoid;}
      thead{display:table-header-group;}
      tr{page-break-inside:avoid;}
      @media print{body{padding:0;font-size:10px;}}
    </style></head><body>
      <header class="brand">
        <div class="brand-main">
          ${logo ? `<img src="${escapeHtml(logo)}" alt="logo" />` : ''}
          <div>
            <h1>${escapeHtml(restaurant.name || 'المؤسسة')}</h1>
            ${restaurantMeta ? `<p>${escapeHtml(restaurantMeta)}</p>` : ''}
            ${options.subtitle ? `<p class="doc-sub">${escapeHtml(options.subtitle)}</p>` : ''}
          </div>
        </div>
        <div class="doc-badge">${escapeHtml(options.title)}</div>
      </header>
      ${metaHtml ? `<section class="meta">${metaHtml}</section>` : ''}
      ${kpiHtml ? `<section class="kpis">${kpiHtml}</section>` : ''}
      ${renderSections(options.sections)}
      ${summaryHtml ? `<section class="summary avoid">${options.summaryTitle ? `<h2>${escapeHtml(options.summaryTitle)}</h2>` : ''}<table><tbody>${summaryHtml}</tbody></table></section>` : ''}
      ${signaturesHtml}
      <footer class="footer">
        <span>تم إنشاء التقرير في ${escapeHtml(formatDateTime(generatedAt))}</span>
        <span>${escapeHtml(restaurant.name || '')}${options.footerNote ? ` — ${escapeHtml(options.footerNote)}` : ''}</span>
      </footer>
      <script>window.onload = function(){ window.print(); };</script>
    </body></html>
  `)
  win.document.close()
  return true
}
