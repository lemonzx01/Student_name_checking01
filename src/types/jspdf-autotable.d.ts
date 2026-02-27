declare module 'jspdf-autotable' {
  import { jsPDF } from 'jspdf'

  interface AutoTableOptions {
    head?: any[][]
    body?: any[][]
    startY?: number
    styles?: Record<string, any>
    headStyles?: Record<string, any>
    alternateRowStyles?: Record<string, any>
    columnStyles?: Record<number, Record<string, any>>
    margin?: Record<string, number>
    theme?: string
    [key: string]: any
  }

  function autoTable(doc: jsPDF, options: AutoTableOptions): void

  export default autoTable
}
