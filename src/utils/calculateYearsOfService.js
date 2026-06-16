export function calculateYearsOfService(hireDate, payrollYear, payrollMonth) {
  const startDate = new Date(hireDate)

  // payrollMonth: 1-12, sedangkan JavaScript memakai 0-11
  // Kita gunakan hari terakhir bulan payroll sebagai acuan
  const payrollDate = new Date(payrollYear, payrollMonth, 0)

  let years = payrollDate.getFullYear() - startDate.getFullYear()

  const monthDiff = payrollDate.getMonth() - startDate.getMonth()
  const dayDiff = payrollDate.getDate() - startDate.getDate()

  // Jika anniversary belum lewat pada tahun tersebut, kurangi 1 tahun
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    years--
  }

  return Math.max(0, years)
}