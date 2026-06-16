import { supabase } from '../lib/supabase'

// =========================
// Hitung masa kerja (tahun)
// =========================
function calculateYearsOfService(hireDate) {
  const start = new Date(hireDate)
  const today = new Date()

  let years = today.getFullYear() - start.getFullYear()

  const monthDiff = today.getMonth() - start.getMonth()

  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < start.getDate())
  ) {
    years--
  }

  return Math.max(years, 0)
}

// =========================
// Cari salary rule yang sesuai
// =========================
function findRule(rules, category, component, yearsOfService) {
  return rules.find(
    (rule) =>
      rule.category === category &&
      rule.salary_component === component &&
      yearsOfService >= rule.min_year &&
      yearsOfService <= rule.max_year
  )
}

// =========================
// Get payroll preview
// =========================
export async function getPayrollPreview() {
  // 1. Ambil employee aktif
  const { data: employees, error: empError } = await supabase
    .from('employees')
    .select('*')
    .eq('is_active', true)
    .order('employee_code')

  if (empError) throw empError

  // 2. Ambil salary rules
  const { data: salaryRules, error: ruleError } = await supabase
    .from('salary_rules')
    .select('*')

  if (ruleError) throw ruleError

  // 3. Proses payroll
  const payrollData = employees.map((employee) => {
    const yearsOfService = calculateYearsOfService(
      employee.hire_date
    )

    // =========================
    // Gaji Pokok
    // Ambil langsung dari tabel employees (kolom base_salary)
    // =========================
    const baseSalary = Number(employee.base_salary || 0)

    // Tarif per Jam langsung dari tabel employees
    const hourlyRate = Number(employee.hourly_rate || 0)

    return {
      ...employee,
      yearsOfService,

      // Master payroll
      baseSalary,
      hourlyRate,

      // Input dari admin / attendance
      jumlahJamPelajaran: 0, // jumlah jam pelajaran 1 bulan
      jumlahTransport: 0,    // jumlah transport × 10.000

      // Hasil perhitungan otomatis
      teachingAllowance: 0,   // hourlyRate × jumlahJamPelajaran
      transportAllowance: 0,  // 10.000 × jumlahTransport

      // Manual adjustments
      tunjanganJabatan: 0,
      tunjanganWaliKelas: 0,
      tunjanganEkstrakurikuler: 0,
      tunjanganTarbiyatulAmanah: 0,

      // Default kebijakan sekolah
      adminBank: 4000,

      // Manual lainnya
      otherAllowance: 0,

      // Potongan
      bpjsKetenagakerjaan: 0,
      bpjsKesehatan: 0,
      kasbon: 0,
      otherDeduction: 0,

      // Total awal
      grossSalary: baseSalary,
      totalDeduction: 0,
      netSalary: baseSalary,
    }
  })

  return payrollData
}