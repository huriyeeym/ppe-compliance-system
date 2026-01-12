import jsPDF from 'jspdf'
import 'jspdf-autotable'
import * as XLSX from 'xlsx'

interface ExportData {
  kpis?: {
    totalViolations: number
    criticalViolations: number
    complianceRate: number
    avgDailyViolations: number
  }
  violations?: any[]
  cameras?: any[]
  dateRange?: {
    start: Date
    end: Date
  }
  filters?: {
    domains?: string[]
    cameras?: string[]
    ppeTypes?: string[]
    severities?: string[]
    statuses?: string[]
  }
}

/**
 * Export analytics data to PDF
 */
export async function exportToPDF(data: ExportData): Promise<void> {
  const doc = new jsPDF()
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  let yPosition = 20

  // Header
  doc.setFontSize(20)
  doc.setTextColor(64, 81, 137) // #405189
  doc.text('Analytics Report', pageWidth / 2, yPosition, { align: 'center' })
  yPosition += 10

  // Date Range
  if (data.dateRange) {
    doc.setFontSize(12)
    doc.setTextColor(0, 0, 0)
    const dateStr = `${data.dateRange.start.toLocaleDateString()} - ${data.dateRange.end.toLocaleDateString()}`
    doc.text(`Period: ${dateStr}`, pageWidth / 2, yPosition, { align: 'center' })
    yPosition += 10
  }

  // Filters
  if (data.filters) {
    doc.setFontSize(10)
    doc.setTextColor(100, 100, 100)
    const filterLines: string[] = []
    if (data.filters.domains && data.filters.domains.length > 0) {
      filterLines.push(`Domains: ${data.filters.domains.join(', ')}`)
    }
    if (data.filters.cameras && data.filters.cameras.length > 0) {
      filterLines.push(`Cameras: ${data.filters.cameras.join(', ')}`)
    }
    if (filterLines.length > 0) {
      doc.text(filterLines.join(' | '), pageWidth / 2, yPosition, { align: 'center' })
      yPosition += 10
    }
  }

  yPosition += 5

  // KPIs
  if (data.kpis) {
    doc.setFontSize(14)
    doc.setTextColor(0, 0, 0)
    doc.text('Key Performance Indicators', 14, yPosition)
    yPosition += 8

    doc.setFontSize(10)
    const kpiData = [
      ['Metric', 'Value'],
      ['Total Violations', data.kpis.totalViolations.toString()],
      ['Critical Violations', data.kpis.criticalViolations.toString()],
      ['Compliance Rate', `${data.kpis.complianceRate.toFixed(1)}%`],
      ['Avg. Daily Violations', data.kpis.avgDailyViolations.toString()],
    ]

    ;(doc as any).autoTable({
      startY: yPosition,
      head: [kpiData[0]],
      body: kpiData.slice(1),
      theme: 'striped',
      headStyles: { fillColor: [64, 81, 137] },
      margin: { left: 14, right: 14 },
    })

    yPosition = (doc as any).lastAutoTable.finalY + 15
  }

  // Violations Table
  if (data.violations && data.violations.length > 0) {
    // Check if we need a new page
    if (yPosition > pageHeight - 60) {
      doc.addPage()
      yPosition = 20
    }

    doc.setFontSize(14)
    doc.setTextColor(0, 0, 0)
    doc.text('Violations Summary', 14, yPosition)
    yPosition += 8

    const violationsData = data.violations.slice(0, 50).map(v => [
      new Date(v.timestamp).toLocaleDateString(),
      v.severity,
      v.status,
      v.missing_ppe.map((ppe: any) => ppe.type).join(', ') || 'N/A',
    ])

    ;(doc as any).autoTable({
      startY: yPosition,
      head: [['Date', 'Severity', 'Status', 'Missing PPE']],
      body: violationsData,
      theme: 'striped',
      headStyles: { fillColor: [64, 81, 137] },
      margin: { left: 14, right: 14 },
    })

    yPosition = (doc as any).lastAutoTable.finalY + 10

    if (data.violations.length > 50) {
      doc.setFontSize(10)
      doc.setTextColor(100, 100, 100)
      doc.text(`Showing first 50 of ${data.violations.length} violations`, 14, yPosition)
      yPosition += 5
    }
  }

  // Footer
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(100, 100, 100)
    doc.text(
      `Page ${i} of ${totalPages} | Generated on ${new Date().toLocaleString()}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    )
  }

  // Save PDF
  doc.save(`analytics-report-${new Date().toISOString().split('T')[0]}.pdf`)
}

/**
 * Export analytics data to Excel
 */
export async function exportToExcel(data: ExportData): Promise<void> {
  const workbook = XLSX.utils.book_new()

  // Overview Sheet
  if (data.kpis) {
    const overviewData = [
      ['Metric', 'Value'],
      ['Total Violations', data.kpis.totalViolations],
      ['Critical Violations', data.kpis.criticalViolations],
      ['Compliance Rate', `${data.kpis.complianceRate.toFixed(1)}%`],
      ['Avg. Daily Violations', data.kpis.avgDailyViolations],
    ]
    if (data.dateRange) {
      overviewData.push(['Period Start', data.dateRange.start.toISOString()])
      overviewData.push(['Period End', data.dateRange.end.toISOString()])
    }
    const overviewSheet = XLSX.utils.aoa_to_sheet(overviewData)
    XLSX.utils.book_append_sheet(workbook, overviewSheet, 'Overview')
  }

  // Violations Sheet
  if (data.violations && data.violations.length > 0) {
    const violationsData = data.violations.map(v => ({
      Date: new Date(v.timestamp).toLocaleString(),
      Severity: v.severity,
      Status: v.status,
      'Missing PPE': v.missing_ppe.map((ppe: any) => ppe.type).join(', ') || 'N/A',
      'Camera ID': v.camera_id,
      'Domain ID': v.domain_id,
    }))
    const violationsSheet = XLSX.utils.json_to_sheet(violationsData)
    XLSX.utils.book_append_sheet(workbook, violationsSheet, 'Violations')
  }

  // Cameras Sheet
  if (data.cameras && data.cameras.length > 0) {
    const camerasData = data.cameras.map(c => ({
      Name: c.name,
      Location: c.location || 'N/A',
      'Domain ID': c.domain_id,
      Status: c.is_active ? 'Active' : 'Inactive',
    }))
    const camerasSheet = XLSX.utils.json_to_sheet(camerasData)
    XLSX.utils.book_append_sheet(workbook, camerasSheet, 'Cameras')
  }

  // Save Excel file
  XLSX.writeFile(workbook, `analytics-report-${new Date().toISOString().split('T')[0]}.xlsx`)
}

/**
 * Export chart as PNG (using canvas)
 */
export async function exportChartAsPNG(chartId: string, filename: string): Promise<void> {
  const chartElement = document.getElementById(chartId)
  if (!chartElement) {
    throw new Error(`Chart element with id "${chartId}" not found`)
  }

  // Use html2canvas if available, otherwise use a simple approach
  try {
    // For Recharts, we can use the SVG element
    const svgElement = chartElement.querySelector('svg')
    if (svgElement) {
      const svgData = new XMLSerializer().serializeToString(svgElement)
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
      const svgUrl = URL.createObjectURL(svgBlob)
      
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.fillStyle = 'white'
          ctx.fillRect(0, 0, canvas.width, canvas.height)
          ctx.drawImage(img, 0, 0)
          
          canvas.toBlob((blob) => {
            if (blob) {
              const url = URL.createObjectURL(blob)
              const link = document.createElement('a')
              link.href = url
              link.download = filename
              link.click()
              URL.revokeObjectURL(url)
            }
          }, 'image/png')
        }
        URL.revokeObjectURL(svgUrl)
      }
      img.src = svgUrl
    }
  } catch (error) {
    console.error('Failed to export chart as PNG:', error)
    throw error
  }
}
