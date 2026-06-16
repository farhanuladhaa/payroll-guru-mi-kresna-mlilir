import { supabase } from '../lib/supabase'

export async function savePayroll(payrollData, month, year) {
  // 1. Hitung total amount
  const totalAmount = payrollData.reduce((sum, employee) => {
    const allowances =
      Number(employee.tunjanganJabatan || 0) +
      Number(employee.tunjanganWaliKelas || 0) +
      Number(employee.tunjanganEkstrakurikuler || 0) +
      Number(employee.tunjanganTarbiyatulAmanah || 0) +
      Number(employee.adminBank || 0) +
      Number(employee.otherAllowance || 0)

    const deductions =
      Number(employee.bpjsKetenagakerjaan || 0) +
      Number(employee.bpjsKesehatan || 0) +
      Number(employee.kasbon || 0) +
      Number(employee.otherDeduction || 0)

    const grossSalary = Number(employee.baseSalary || 0) + allowances
    const netSalary = grossSalary - deductions

    return sum + netSalary
  }, 0)

  // 2. Simpan header payroll
  const { data: run, error: runError } = await supabase
    .from('payroll_runs')
    .insert({
      payroll_month: month,
      payroll_year: year,
      status: 'draft',
      total_employees: payrollData.length,
      total_amount: totalAmount,
    })
    .select()
    .single()

  if (runError) throw runError

  // 3. Siapkan detail payroll
  const details = payrollData.map((employee) => {
    const allowances =
      Number(employee.tunjanganJabatan || 0) +
      Number(employee.tunjanganWaliKelas || 0) +
      Number(employee.tunjanganEkstrakurikuler || 0) +
      Number(employee.tunjanganTarbiyatulAmanah || 0) +
      Number(employee.adminBank || 0) +
      Number(employee.otherAllowance || 0)

    const deductions =
      Number(employee.bpjsKetenagakerjaan || 0) +
      Number(employee.bpjsKesehatan || 0) +
      Number(employee.kasbon || 0) +
      Number(employee.otherDeduction || 0)

    const grossSalary = Number(employee.baseSalary || 0) + allowances
    const netSalary = grossSalary - deductions

    return {
      payroll_run_id: run.id,
      employee_id: employee.id,
      employee_code: employee.employee_code,
      full_name: employee.full_name,
      category: employee.category,
      years_of_service: employee.yearsOfService,

      base_salary: employee.baseSalary,
      hourly_rate: employee.hourlyRate,

      tunjangan_jabatan: employee.tunjanganJabatan || 0,
      tunjangan_wali_kelas: employee.tunjanganWaliKelas || 0,
      tunjangan_ekstrakurikuler: employee.tunjanganEkstrakurikuler || 0,
      tunjangan_tarbiyatul_amanah:
        employee.tunjanganTarbiyatulAmanah || 0,
      admin_bank: employee.adminBank || 0,
      other_allowance: employee.otherAllowance || 0,

      bpjs_ketenagakerjaan:
        employee.bpjsKetenagakerjaan || 0,
      bpjs_kesehatan: employee.bpjsKesehatan || 0,
      kasbon: employee.kasbon || 0,
      other_deduction: employee.otherDeduction || 0,

      gross_salary: grossSalary,
      total_deduction: deductions,
      net_salary: netSalary,
    }
  })

  // 4. Simpan seluruh detail
  const { error: detailError } = await supabase
    .from('payroll_run_details')
    .insert(details)

  if (detailError) throw detailError

  return run
}