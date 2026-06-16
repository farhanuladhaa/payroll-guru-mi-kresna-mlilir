import { jsPDF } from 'jspdf'
import { formatCurrency } from '../utils/formatCurrency'

export function generateSlipPDF(employee, year, month) {
  const doc = new jsPDF()

  let y = 20

  doc.setFontSize(18)
  doc.text('SLIP GAJI', 20, y)

  y += 10
  doc.setFontSize(12)
  doc.text(`Periode: ${month}/${year}`, 20, y)

  y += 15
  doc.text(`Nama: ${employee.employee_name}`, 20, y)
  y += 8
  doc.text(`NIP: ${employee.employee_nip}`, 20, y)
  y += 8
  doc.text(`Jabatan: ${employee.position_name}`, 20, y)

  y += 15
  doc.text(
    `Gaji Pokok: ${formatCurrency(employee.base_salary)}`,
    20,
    y
  )

  y += 8
  doc.text(
    `Tunjangan: ${formatCurrency(employee.allowance)}`,
    20,
    y
  )

  y += 8
  doc.text(
    `Insentif Kehadiran: ${formatCurrency(
      employee.attendance_amount
    )}`,
    20,
    y
  )

  y += 12
  doc.setFontSize(14)
  doc.text(
    `TOTAL GAJI: ${formatCurrency(employee.total_salary)}`,
    20,
    y
  )

  doc.save(
    `Slip_Gaji_${employee.employee_nip}_${month}_${year}.pdf`
  )
}