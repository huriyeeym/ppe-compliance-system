/**
 * Export helpers for PDF and Excel reports
 */

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'

interface ViolationExportData {
  id: number
  timestamp: string
  camera_name?: string
  camera_location?: string
  missing_ppe: string[]
  severity: string
  status: string
  confidence: number
  assigned_to?: string
  notes?: string
  corrective_action?: string
}

/**
 * Export violations to PDF
 */
export function exportViolationsToPDF(
  violations: ViolationExportData[],
  options: {
    title?: string
    dateRange?: { start: string; end: string }
    companyName?: string
  } = {}
) {
  const doc = new jsPDF('landscape') // Use landscape for more columns

  // Header
  const title = options.title || 'PPE Violation Report'
  const companyName = options.companyName || 'PPE Compliance System'

  doc.setFontSize(20)
  doc.setTextColor(40, 40, 40)
  doc.text(title, 14, 20)

  doc.setFontSize(10)
  doc.setTextColor(100, 100, 100)
  doc.text(companyName, 14, 28)

  // Date range
  if (options.dateRange) {
    const dateText = `Period: ${new Date(options.dateRange.start).toLocaleDateString()} - ${new Date(options.dateRange.end).toLocaleDateString()}`
    doc.text(dateText, 14, 35)
  } else {
    const dateText = `Generated: ${new Date().toLocaleString()}`
    doc.text(dateText, 14, 35)
  }

  // Summary statistics
  const totalViolations = violations.length
  const criticalCount = violations.filter(v => v.severity === 'critical').length
  const highCount = violations.filter(v => v.severity === 'high').length

  doc.setFontSize(12)
  doc.setTextColor(40, 40, 40)
  doc.text('Summary:', 14, 45)

  doc.setFontSize(10)
  doc.text(`Total Violations: ${totalViolations}`, 20, 52)
  doc.text(`Critical: ${criticalCount}`, 20, 59)
  doc.text(`High: ${highCount}`, 20, 66)

  // Table
  const tableData = violations.map(v => [
    v.id.toString(),
    new Date(v.timestamp).toLocaleString('en-US', {
      dateStyle: 'short',
      timeStyle: 'short'
    }),
    v.camera_name || `Camera #${v.id}`,
    v.missing_ppe.join(', '),
    v.severity.toUpperCase(),
    v.status.toUpperCase(),
    `${(v.confidence * 100).toFixed(0)}%`,
    v.assigned_to || '-',
    v.corrective_action ? (v.corrective_action.length > 40 ? v.corrective_action.substring(0, 37) + '...' : v.corrective_action) : '-',
  ])

  autoTable(doc, {
    startY: 75,
    head: [['ID', 'Timestamp', 'Camera', 'Missing PPE', 'Severity', 'Status', 'Conf.', 'Assigned', 'Corrective Action']],
    body: tableData,
    theme: 'striped',
    styles: {
      fontSize: 7,
      cellPadding: 2,
    },
    headStyles: {
      fillColor: [30, 58, 95], // Dark blue
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 7,
    },
    columnStyles: {
      0: { cellWidth: 12 },  // ID
      1: { cellWidth: 28 },  // Timestamp
      2: { cellWidth: 30 },  // Camera
      3: { cellWidth: 35 },  // Missing PPE
      4: { cellWidth: 20 },  // Severity
      5: { cellWidth: 20 },  // Status
      6: { cellWidth: 15 },  // Confidence
      7: { cellWidth: 25 },  // Assigned
      8: { cellWidth: 60 },  // Corrective Action
    },
  })

  // Footer
  const pageCount = (doc as any).internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    doc.text(
      `Page ${i} of ${pageCount}`,
      doc.internal.pageSize.getWidth() / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    )
  }

  // Save
  const filename = `violation-report-${new Date().toISOString().split('T')[0]}.pdf`
  doc.save(filename)
}

/**
 * Export violations to Excel
 */
export function exportViolationsToExcel(
  violations: ViolationExportData[],
  options: {
    filename?: string
    sheetName?: string
  } = {}
) {
  // Prepare data
  const data = violations.map(v => ({
    'ID': v.id,
    'Date': new Date(v.timestamp).toLocaleDateString('en-US'),
    'Time': new Date(v.timestamp).toLocaleTimeString('en-US'),
    'Camera': v.camera_name || `Camera #${v.id}`,
    'Location': v.camera_location || '-',
    'Missing PPE': v.missing_ppe.join(', '),
    'Severity': v.severity.toUpperCase(),
    'Status': v.status.toUpperCase(),
    'Confidence': `${(v.confidence * 100).toFixed(1)}%`,
    'Assigned To': v.assigned_to || '-',
    'Notes': v.notes || '-',
    'Corrective Action': v.corrective_action || '-',
  }))

  // Create workbook
  const wb = XLSX.utils.book_new()

  // Create worksheet
  const ws = XLSX.utils.json_to_sheet(data)

  // Set column widths
  ws['!cols'] = [
    { wch: 8 },  // ID
    { wch: 12 }, // Date
    { wch: 10 }, // Time
    { wch: 20 }, // Camera
    { wch: 20 }, // Location
    { wch: 30 }, // Missing PPE
    { wch: 10 }, // Severity
    { wch: 15 }, // Status
    { wch: 10 }, // Confidence
    { wch: 20 }, // Assigned To
    { wch: 40 }, // Notes
    { wch: 50 }, // Corrective Action
  ]

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, options.sheetName || 'Violations')

  // Add summary sheet
  const summary = [
    { 'Metric': 'Total Violations', 'Value': violations.length },
    { 'Metric': 'Critical', 'Value': violations.filter(v => v.severity === 'critical').length },
    { 'Metric': 'High', 'Value': violations.filter(v => v.severity === 'high').length },
    { 'Metric': 'Medium', 'Value': violations.filter(v => v.severity === 'medium').length },
    { 'Metric': 'Low', 'Value': violations.filter(v => v.severity === 'low').length },
    { 'Metric': 'Report Date', 'Value': new Date().toLocaleString('en-US') },
  ]

  const wsSummary = XLSX.utils.json_to_sheet(summary)
  wsSummary['!cols'] = [{ wch: 20 }, { wch: 15 }]
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary')

  // Save
  const filename = options.filename || `violation-report-${new Date().toISOString().split('T')[0]}.xlsx`
  XLSX.writeFile(wb, filename)
}

/**
 * Export statistics summary to PDF
 */
export function exportStatisticsSummaryToPDF(
  stats: {
    total: number
    byPPEType: Record<string, number>
    complianceRate: number
    bySeverity: Record<string, number>
  },
  options: {
    title?: string
    dateRange?: { start: string; end: string }
  } = {}
) {
  const doc = new jsPDF()

  // Header
  doc.setFontSize(20)
  doc.text(options.title || 'PPE Compliance Statistics', 14, 20)

  doc.setFontSize(10)
  doc.setTextColor(100, 100, 100)
  if (options.dateRange) {
    const dateText = `Period: ${new Date(options.dateRange.start).toLocaleDateString()} - ${new Date(options.dateRange.end).toLocaleDateString()}`
    doc.text(dateText, 14, 28)
  } else {
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28)
  }

  // Statistics
  let y = 45

  doc.setFontSize(14)
  doc.setTextColor(40, 40, 40)
  doc.text('Overall Statistics', 14, y)
  y += 10

  doc.setFontSize(11)
  doc.text(`Total Violations: ${stats.total}`, 20, y)
  y += 7
  doc.text(`Compliance Rate: ${stats.complianceRate.toFixed(1)}%`, 20, y)
  y += 12

  // By Severity
  doc.setFontSize(14)
  doc.text('By Severity', 14, y)
  y += 10

  doc.setFontSize(11)
  Object.entries(stats.bySeverity).forEach(([severity, count]) => {
    doc.text(`${severity.toUpperCase()}: ${count}`, 20, y)
    y += 7
  })
  y += 8

  // By PPE Type
  doc.setFontSize(14)
  doc.text('By PPE Type', 14, y)
  y += 10

  doc.setFontSize(11)
  Object.entries(stats.byPPEType).forEach(([type, count]) => {
    doc.text(`${type.replace('_', ' ').toUpperCase()}: ${count}`, 20, y)
    y += 7
  })

  // Save
  const filename = `statistics-summary-${new Date().toISOString().split('T')[0]}.pdf`
  doc.save(filename)
}
