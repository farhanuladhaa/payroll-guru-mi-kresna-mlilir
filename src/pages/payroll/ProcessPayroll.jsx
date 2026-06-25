import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import JSZip from 'jszip'
import { generatePayslip } from '../../utils/pdfGenerator'

function ProcessPayroll() {
  const [salaryRules, setSalaryRules] = useState([])
  const [employees, setEmployees] = useState([])
  const [payrollList, setPayrollList] = useState(() => {
    const saved = sessionStorage.getItem('draft_payrollList')
    return saved ? JSON.parse(saved) : []
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  const [month, setMonth] = useState(() => {
    const saved = sessionStorage.getItem('draft_month')
    return saved ? parseInt(saved) : 3 // Default Maret
  }) 

  const [year, setYear] = useState(() => {
    const saved = sessionStorage.getItem('draft_year')
    return saved ? parseInt(saved) : 2026
  })

  const [payrollType, setPayrollType] = useState(() => {
    const saved = sessionStorage.getItem('draft_type')
    return saved ? saved : 'reguler'
  })

  const [editingIndex, setEditingIndex] = useState(null)
  const [adjustForm, setAdjustForm] = useState({})

  const fileInputRef = useRef(null)

  useEffect(() => {
    sessionStorage.setItem('draft_payrollList', JSON.stringify(payrollList))
    sessionStorage.setItem('draft_month', month)
    sessionStorage.setItem('draft_year', year)
    sessionStorage.setItem('draft_type', payrollType)
  }, [payrollList, month, year, payrollType])

  useEffect(() => { initData() }, [])

  async function initData() {
    try {
      setLoading(true)
      // Ambil data karyawan
      const { data: empData } = await supabase.from('employees').select('*, positions(name)').eq('is_active', true)
      setEmployees(empData || [])

      // Ambil aturan gaji
      const { data: rulesData } = await supabase.from('salary_rules').select('*')
      setSalaryRules(rulesData || [])
    } catch (error) { 
      alert('Gagal memuat data master.') 
    } finally { 
      setLoading(false) 
    }
  }

  // 📝 LOGIKA HITUNG DENGAN PEMBULATAN BULAT (MENDUKUNG GAJI KE-13)
  function calculateRowTotals(item) {
    const teachingAllowance = Number(item.tarif_jampel || 0) * Number(item.jumlah_jampel || 0)

    // 🚀 UPDATE ATURAN KHUSUS GAJI KE-13 & THR
    if (payrollType === 'gaji13' || payrollType === 'thr') {
      
      // Syarat 2: Jika mulai kerja belum 1 tahun (masa bakti < 1), tidak dapat sama sekali (Nol)
      if (item.years_of_service < 1) {
        return {
          teachingAllowance: 0,
          transportAllowance: 0,
          totalTunjangan: 0,
          grossSalary: 0,
          deductions: 0,
          netSalary: 0
        }
      }

      // Syarat 1: Ditambah Tunjangan Jabatan & Tunjangan Lain-lain
      const totalTunjangan = Number(item.tunj_jabatan || 0) + Number(item.tunj_lain || 0)
      const grossSalary = Number(item.gaji_pokok || 0) + teachingAllowance + totalTunjangan

      return {
        teachingAllowance: Math.round(teachingAllowance),
        transportAllowance: 0,
        totalTunjangan: Math.round(totalTunjangan),
        grossSalary: Math.round(grossSalary),
        deductions: 0, // Potongan tetap ditiadakan
        netSalary: Math.round(grossSalary)
      }
    }

    // ─── LOGIKA BULANAN REGULER (TETAP SAMA SEPERTI SEBELUMNYA) ───
    const transportAllowance = 10000 * Number(item.hari_transport || 0)
    
    const totalTunjangan = 
      Number(item.tunj_jabatan || 0) + Number(item.tunj_walikelas || 0) +
      Number(item.tunj_ta || 0) + Number(item.tunj_ekstra || 0) +
      Number(item.admin_bank || 0) + Number(item.tunj_lain || 0)

    const grossSalary = Number(item.gaji_pokok || 0) + teachingAllowance + transportAllowance + totalTunjangan

    const deductions = 
      Number(item.bpjs_kerja || 0) + Number(item.bpjs_kesehatan || 0) +
      Number(item.potongan_ta || 0) + Number(item.kasbon || 0) +
      Number(item.potongan_lain || 0)

    return { 
      teachingAllowance: Math.round(teachingAllowance),
      transportAllowance: Math.round(transportAllowance),
      totalTunjangan: Math.round(totalTunjangan), 
      grossSalary: Math.round(grossSalary), 
      deductions: Math.round(deductions), 
      netSalary: Math.round(grossSalary - deductions) 
    }
  }

  // TOTAL THP DI LAYAR UTAMA
  const totalTHP = payrollList.reduce((acc, item) => acc + calculateRowTotals(item).netSalary, 0)

  // FUNGSI DOWNLOAD ZIP PDF SLIP
  async function handleDownloadAll() {
    if (payrollList.length === 0) return alert('Tidak ada data untuk di-download!')
    try {
      setSaving(true)
      const zip = new JSZip()
      for (const item of payrollList) {
        const totals = calculateRowTotals(item)
        const pdfBlob = await generatePayslip({ ...item, ...totals }, month, year)
        zip.file(`Slip_Gaji_${item.full_name}.pdf`, pdfBlob)
      }
      const content = await zip.generateAsync({ type: "blob" })
      const link = document.createElement("a")
      link.href = URL.createObjectURL(content)
      link.download = `Slip_Gaji_Periode_${month}_${year}.zip`
      link.click()
    } catch (error) {
      alert("Gagal mendownload ZIP: " + error.message)
    } finally {
      setSaving(false)
    }
  }

  // 📥 IMPORT CSV (VERSI ANTI HANG / ANTI MACET)
  function handleAttendanceImport(e) {
    const file = e.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (event) => {
      const text = event.target.result
      
      // Filter baris kosong agar tidak dibaca
      const lines = text.split('\n').map(line => line.replace('\r', '').trim()).filter(line => line !== "")
      if (lines.length < 2) return alert("File kosong!")

      const firstLine = lines[0]
      const separator = firstLine.includes(';') ? ';' : ','
      
      // 🚀 PERBAIKAN: Buang regexSplit, pakai split biasa. Ini yang bikin lancar!
      const headers = firstLine.split(separator).map(h => h.replace(/"/g, '').trim().toLowerCase())

      const getIdx = (name) => headers.findIndex(h => h === name)
      const idx = {
        nip: headers.findIndex(h => h === 'employee_code' || h === 'nip'),
        gaji: headers.findIndex(h => h === 'gaji_pokok'), 
        tarif: headers.findIndex(h => h === 'tarif_jampel'),
        jampel: headers.findIndex(h => h === 'jumlah_jampel'),
        trans: headers.findIndex(h => h === 'hari_transport'),
        jab: headers.findIndex(h => h === 'tunj_jabatan' || h === 'tunjangan_jabatan'), 
        wali: headers.findIndex(h => h === 'tunj_walikelas' || h === 'tunjangan_walikelas'),
        tLain: headers.findIndex(h => h === 'tunj_lain' || h === 'tunjangan_lain_lain'),
        tTA: headers.findIndex(h => h === 'tunj_ta'),
        eks: headers.findIndex(h => h === 'tunj_ekstra'),
        adm: headers.findIndex(h => h === 'admin_bank'),
        bpjsK: headers.findIndex(h => h === 'bpjs_kerja'),
        bpjsKes: headers.findIndex(h => h === 'bpjs_kesehatan'),
        pTA: headers.findIndex(h => h === 'potongan_ta'),
        kasbon: headers.findIndex(h => h === 'kasbon'),
        pLain: headers.findIndex(h => h === 'potongan_lain'),
      }

      if (idx.nip === -1) return alert('File CSV tidak sesuai format komplit!')

      const generatedList = []

      // Mapping Tunjangan Jabatan sesuai default-mu
      const tunjJabatanMap = {
        'Wali Kelas': 75000,
        'Waka Keuangan': 200000,
        'Waka Sarpras': 200000,
        'Waka Kurikulum': 100000,
        'Waka Kesiswaan': 200000,
        'Waka TU': 200000,
        'Koordinator Ummi': 250000,
        'Petugas Infaq': 250000,
        'Operator IT': 550000,
      }

      const gajiPokokMap = {
        'Kepala Madrasah': 1250000,
        'Guru Kelas': 300000
      }

      // Mulai Looping
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(separator) 
        const csvNip = cols[idx.nip]?.replace(/"/g, '').trim()
        
        const emp = employees.find(e => e.employee_code === csvNip)
        if (!emp) continue

        const hireDate = new Date(emp.hire_date || new Date())
        const years = Math.max(0, new Date().getFullYear() - hireDate.getFullYear())
        
        // 🚀 FUNGSI PENCARI PINTAR YANG BISA DI-OVERRIDE
        const findRule = (empData, comp, overrideCategory = null) => {
            const posName = empData.positions?.name ? String(empData.positions.name).trim() : ''
            const catName = overrideCategory ? overrideCategory : (empData.category ? String(empData.category).trim() : '')

            let rule;
            // Jika tidak sedang dioverride sertifikasi, cari dari jabatan dulu
            if (!overrideCategory) {
                rule = salaryRules.find(r => r.category === posName && r.salary_component === comp && years >= r.min_year && years <= r.max_year)
            }
            
            // Kalau nggak ketemu dari jabatan (atau sedang dioverride), cari dari kategori
            if (!rule) {
                rule = salaryRules.find(r => r.category === catName && r.salary_component === comp && years >= r.min_year && years <= r.max_year)
            }
            return rule ? rule.final_amount : 0
        }

        // 1. Ambil GAJI POKOK (Tetap Normal mengikuti Jabatan/Kategori asli)
        const autoGajiPokok = findRule(emp, 'fixed_salary')

        // 2. Ambil JAMPEL (Jika status is_sertifikasi TRUE, paksa cari di kategori 'Guru Sertifikasi')
        const autoTarifJampel = emp.is_sertifikasi 
            ? findRule(emp, 'hourly_rate', 'Guru Sertifikasi') 
            : findRule(emp, 'hourly_rate');

        const csvTunjJabatan = idx.jab !== -1 && cols[idx.jab] ? (parseFloat(String(cols[idx.jab]).replace(/"/g, '')) || 0) : 0

        generatedList.push({
          employee_id: emp.id,
          employee_code: emp.employee_code,
          full_name: emp.full_name,
          position_name: emp.positions?.name || '',
          category: emp.category || 'Karyawan',
          years_of_service: years,
          
          gaji_pokok: idx.gaji !== -1 && cols[idx.gaji] ? parseFloat(cols[idx.gaji]) : autoGajiPokok,
          tarif_jampel: idx.tarif !== -1 && cols[idx.tarif] ? parseFloat(cols[idx.tarif]) : autoTarifJampel,
          tunj_jabatan: csvTunjJabatan > 0 ? csvTunjJabatan : (tunjJabatanMap[emp.positions?.name] || 0),
          
          jumlah_jampel: idx.jampel !== -1 ? (parseFloat(cols[idx.jampel]) || 0) : 0,
          hari_transport: idx.trans !== -1 ? (parseFloat(cols[idx.trans]) || 0) : 0,
          tunj_walikelas: idx.wali !== -1 ? (parseFloat(cols[idx.wali]) || 0) : 0,
          tunj_ta: idx.tTA !== -1 ? (parseFloat(cols[idx.tTA]) || 0) : 0,
          tunj_ekstra: idx.eks !== -1 ? (parseFloat(cols[idx.eks]) || 0) : 0,
          admin_bank: idx.adm !== -1 ? (parseFloat(cols[idx.adm]) || 0) : 4000,
          tunj_lain: idx.tLain !== -1 ? (parseFloat(cols[idx.tLain]) || 0) : 0,
          bpjs_kerja: idx.bpjsK !== -1 ? (parseFloat(cols[idx.bpjsK]) || 0) : 0,
          bpjs_kesehatan: idx.bpjsKes !== -1 ? (parseFloat(cols[idx.bpjsKes]) || 0) : 0,
          potongan_ta: idx.pTA !== -1 ? (parseFloat(cols[idx.pTA]) || 0) : 0,
          kasbon: idx.kasbon !== -1 ? (parseFloat(cols[idx.kasbon]) || 0) : 0,
          potongan_lain: idx.pLain !== -1 ? (parseFloat(cols[idx.pLain]) || 0) : 0,
        })
      }
      
      setPayrollList(generatedList)
      alert(`Berhasil menarik ${generatedList.length} data!`)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  function openAdjustment(index) {
    setEditingIndex(index)
    setAdjustForm({ ...payrollList[index] })
  }

  function handleAdjustChange(e) {
    setAdjustForm(prev => ({ ...prev, [e.target.name]: parseFloat(e.target.value) || 0 }))
  }

  function saveAdjustment() {
    const updated = [...payrollList]
    updated[editingIndex] = { ...adjustForm }
    setPayrollList(updated)
    setEditingIndex(null)
  }

  // 💾 SIMPAN KEDUA TABEL (DENGAN KALKULASI TOTAL AKURAT)
  async function handleSavePayroll() {
    if (payrollList.length === 0) return alert('Belum ada data payroll!')

    try {
      setSaving(true)
      const { data: { user } } = await supabase.auth.getUser()
      const adminEmail = user?.email || 'Sistem Admin'

      // Buat detail slips payload dahulu
      const finalPayload = payrollList.map(item => {
        const totals = calculateRowTotals(item)
        return {
          employee_id: item.employee_id,
          period_month: month,
          period_year: year,
          base_salary: item.gaji_pokok,
          hourly_rate: item.tarif_jampel,
          jumlah_jampel: item.jumlah_jampel,
          hari_transport: item.hari_transport,
          gross_salary: totals.grossSalary,
          total_deductions: totals.deductions,
          net_salary: totals.netSalary,
          breakdown_data: {
            tunjangan_jabatan: item.tunj_jabatan,
            tunjangan_walikelas: item.tunj_walikelas,
            tunjangan_ta: item.tunj_ta,
            tunjangan_ekstra: item.tunj_ekstra,
            tunjangan_lain: item.tunj_lain,
            teaching_allowance: totals.teachingAllowance,
            transport_allowance: totals.transportAllowance,
            admin_bank: item.admin_bank,
            bpjs_ketenagakerjaan: item.bpjs_kerja,
            bpjs_kesehatan: item.bpjs_kesehatan,
            potongan_ta: item.potongan_ta,
            kasbon: item.kasbon,
            potongan_lain: item.potongan_lain
          }
        }
      })

      // Hitung ulang total THP langsung dari payload data final untuk validasi 100% sinkron
      const exactTotalAmount = finalPayload.reduce((sum, item) => sum + item.net_salary, 0)

      // Hapus data lama di bulan yang sama agar tidak duplikat
      await supabase.from('payroll_runs').delete().eq('payroll_month', month).eq('payroll_year', year)
      await supabase.from('payroll_slips').delete().eq('period_month', month).eq('period_year', year)

      // Insert ke Master History
      const { data: runData, error: runError } = await supabase
        .from('payroll_runs')
        .insert({
          payroll_month: month,
          payroll_year: year,
          total_employees: payrollList.length,
          total_amount: exactTotalAmount,
          status: payrollType === 'gaji13' ? 'published_gaji13' : 'published', // 👈 MODIFIKASI BARIS INI
          created_by: adminEmail
        })
        .select()
        .single()

      if (runError) throw runError

      // Masukkan run_id ke payload slips
      const slipsWithRunId = finalPayload.map(slip => ({ ...slip, run_id: runData.id }))
      const { error: slipError } = await supabase.from('payroll_slips').insert(slipsWithRunId)
      if (slipError) throw slipError

      sessionStorage.removeItem('draft_payrollList')
      sessionStorage.removeItem('draft_month')
      sessionStorage.removeItem('draft_year')
      sessionStorage.removeItem('draft_type')

      // Kosongkan tabel di layar
      setPayrollList([])

      alert(`Sukses! Data Payroll Periode ${month}/${year} sebesar Rp ${exactTotalAmount.toLocaleString('id-ID')} disimpan permanen.`)
    } catch (error) {
      alert('Gagal menyimpan: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  function handleSendWA(item) {
    const empData = employees.find(e => e.employee_code === item.employee_code)
    let phone = empData?.phone_number

    if (!phone) {
      alert(`Nomor HP untuk ${item.full_name} belum terdaftar di sistem!`)
      return
    }

    // Ubah format nomor HP 08xxx menjadi 628xxx (Standar WhatsApp Web)
    if (phone.startsWith('0')) {
      phone = '62' + phone.substring(1)
    }

    const totals = calculateRowTotals(item)
    const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
    const monthName = monthNames[month - 1]

    // Helper fungsi agar nominal 0 berubah menjadi tanda minus '-' khas kwitansi
    const formatSlipValue = (val) => {
      return Number(val) === 0 ? '-' : formatCurrency(val)
    }

    // Susunan teks pesan komplit berdasarkan Screenshot 2026-06-23 at 02.50.47.png
    const message = 
      `Assalamualaikum Bapak/Ibu *${item.full_name}*, Karyawan MI Kresna Mlilir.\n\n` +
      `Berikut adalah rincian lengkap slip gaji Anda untuk periode *${monthName} ${year}*:\n\n` +
      `*PENERIMAAN:*\n` +
      `• Gaji Pokok: ${formatSlipValue(item.gaji_pokok)}\n` +
      `• TA (Tarbiyatul Amanah): ${formatSlipValue(item.tunj_ta)}\n` +
      `• Tunj. Jampel: ${formatSlipValue(totals.teachingAllowance)}\n` +
      `• Transport (${item.hari_transport} Hari): ${formatSlipValue(totals.transportAllowance)}\n` +
      `• Tunj. Jabatan: ${formatSlipValue(item.tunj_jabatan)}\n` +
      `• Tunj. Wali Kelas: ${formatSlipValue(item.tunj_walikelas)}\n` +
      `• Ekstra: ${formatSlipValue(item.tunj_ekstra)}\n` +
      `• Admin Bank: ${formatSlipValue(item.admin_bank)}\n` +
      `• Tunj. Lain-Lain: ${formatSlipValue(item.tunj_lain)}\n\n` +
      `*POTONGAN:*\n` +
      `• BPJS Ketenagakerjaan: ${formatSlipValue(item.bpjs_kerja)}\n` +
      `• BPJS Kesehatan: ${formatSlipValue(item.bpjs_kesehatan)}\n` +
      `• Potongan TA: ${formatSlipValue(item.potongan_ta)}\n` +
      `• Kasbon/Cicilan: ${formatSlipValue(item.kasbon)}\n` +
      `• Potongan Lain-Lain: ${formatSlipValue(item.potongan_lain)}\n\n` +
      `───────────────────\n` +
      `*TOTAL PENERIMAAN (Kotor):* ${formatCurrency(totals.grossSalary)}\n` +
      `*TOTAL POTONGAN:* ${formatCurrency(totals.deductions)}\n` +
      `*NET SALARY (THP): ${formatCurrency(totals.netSalary)}*\n` +
      `───────────────────\n\n` +
      `Detail slip kertas resmi tetap dapat dicheck melalui Admin Sekolah jika diperlukan. Terima kasih!`

    // Buka tab baru langsung ke WhatsApp Web / Aplikasi WA Laptop
    const waLink = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
    window.open(waLink, '_blank')
  }

  function formatCurrency(value) { return 'Rp' + (Number(value) || 0).toLocaleString('id-ID') }

  if (loading) return <div className="p-10 text-center text-gray-500">Mempersiapkan data kalkulator...</div>

  return (
    <div className="p-4 space-y-6">
      
      {/* ─── BARIS 1: JUDUL & TOTAL PENGELUARAN ─── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight">Process Monthly Payroll</h1>
          <p className="text-sm font-semibold text-gray-400 mt-1">Kalkulasi, verifikasi, dan rilis slip gaji karyawan.</p>
        </div>
        
        <div className="bg-white px-6 py-4 rounded-2xl shadow-sm border border-blue-100 min-w-[240px]">
          <p className="text-xs text-gray-400 font-bold tracking-wider uppercase">TOTAL PENGELUARAN GAJI (THP)</p>
          <p className="text-3xl font-black text-gray-900 mt-1">{formatCurrency(totalTHP)}</p>
        </div>
      </div>

      {/* ─── BARIS 2: CONTROL PANEL (FILTER & ACTION BUTTONS) ─── */}
      <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4 bg-white p-3 rounded-2xl shadow-sm border border-gray-100">
        
        {/* Grup Kiri: Filter Periode & Tipe */}
        <div className="flex flex-wrap items-center gap-2">
          <select 
            value={month} 
            onChange={(e) => setMonth(parseInt(e.target.value))} 
            className="border border-gray-200 p-2 h-11 rounded-xl text-sm font-bold text-gray-700 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'].map((m, idx) => (
              <option key={idx} value={idx + 1}>{m}</option>
            ))}
          </select>

          <select 
            value={year} 
            onChange={(e) => setYear(parseInt(e.target.value))} 
            className="border border-gray-200 p-2 h-11 rounded-xl text-sm font-bold text-gray-700 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {[2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035, 2036, 2037, 2038, 2039, 2040].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          <select 
            value={payrollType} 
            onChange={(e) => setPayrollType(e.target.value)} 
            className={`border p-2 h-11 rounded-xl text-sm font-black bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[200px] ${
              payrollType === 'gaji13' || payrollType === 'thr' ? 'border-purple-500 text-purple-700 font-black' : 'border-gray-200 text-gray-700'
            }`}
          >
            <option value="reguler">Gaji Reguler Bulanan</option>
            <option value="gaji13">Gaji Ke-13</option>
            <option value="thr">Tunjangan Hari Raya (THR)</option>
          </select>
        </div>

        {/* Grup Kanan: Tombol-Tombol Aksi Eksekusi */}
        <div className="flex flex-wrap items-center gap-2">
          <input type="file" accept=".csv" ref={fileInputRef} onChange={handleAttendanceImport} className="hidden" />
          
          <button 
            onClick={() => fileInputRef.current.click()} 
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 h-11 rounded-xl text-sm font-bold transition flex items-center gap-2 shadow-sm"
          >
            <span>📥</span> Import CSV
          </button>
          
          <button 
            onClick={handleDownloadAll} 
            disabled={saving || payrollList.length === 0} 
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 h-11 rounded-xl text-sm font-bold transition disabled:opacity-50 flex items-center gap-2 shadow-sm"
          >
            <span>📦</span> Download ZIP
          </button>
          
          <button 
            onClick={handleSavePayroll} 
            disabled={saving || payrollList.length === 0} 
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 h-11 rounded-xl text-sm font-bold transition disabled:opacity-50 flex items-center gap-2 shadow-sm"
          >
            <span>💾</span> Save & Publish
          </button>
        </div>

      </div>

      {/* TINGGAL LANJUTKAN KE BAGIAN RENDEER <table /> DI BAWAHNYA... */}

      {/* TABEL */}
      <div className="bg-white shadow-md rounded-2xl overflow-hidden border border-gray-100">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-50 text-gray-600 uppercase text-xs font-semibold border-b border-gray-100">
            <tr>
              <th className="p-4">NIP</th>
              <th className="p-4">Karyawan</th>
              <th className="p-4 text-center">Kehadiran</th>
              <th className="p-4 text-right">Gaji Pokok</th>
              <th className="p-4 text-right text-emerald-600">Total Tunjangan</th>
              <th className="p-4 text-right text-rose-600">Total Potongan</th>
              <th className="p-4 text-right font-bold text-blue-600">Net Salary (THP)</th>
              <th className="p-4 text-center">Aksi</th>
            </tr>
          </thead>
          <tbody className="text-sm divide-y divide-gray-50">
            {payrollList.length === 0 ? (
              <tr><td colSpan="7" className="p-12 text-center text-gray-400 font-medium bg-gray-50/50">Belum ada data berjalan periode ini. Silakan import CSV.</td></tr>
            ) : (
              payrollList.map((item, index) => {
                const totals = calculateRowTotals(item)
                const tunjMurni = totals.grossSalary - item.gaji_pokok
                return (
                  <tr key={item.employee_id} className="hover:bg-gray-50/70 transition border-b border-gray-100">
                    {/* Kolom NIP */}
                    <td className="p-5 font-medium text-sm text-gray-500 font-bold">
                      {item.employee_code}
                    </td>
                    
                    {/* Kolom Karyawan */}
                    <td className="p-5">
                      <div className="flex flex-col">
                        <span className="font-extrabold text-base text-gray-900">{item.full_name}</span>
                        <span className="text-xs text-gray-400 font-semibold tracking-wide mt-0.5">{item.position_name}</span>
                      </div>
                    </td>
                    
                    {/* Kolom Kehadiran */}
                    <td className="p-5 text-center whitespace-nowrap">
                      <span className="text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg text-xs font-bold border border-amber-200">{item.jumlah_jampel} Jam</span>
                      <span className="text-purple-800 bg-purple-50 px-2.5 py-1 rounded-lg text-xs font-bold border border-purple-200 ml-1.5">{item.hari_transport} Hari</span>
                    </td>
                    
                    {/* Kolom Gaji Pokok */}
                    <td className="p-5 text-right text-gray-700 text-sm font-bold">{formatCurrency(item.gaji_pokok)}</td>
                    
                    {/* Kolom Total Tunjangan */}
                    <td className="p-5 text-right text-emerald-600 text-sm font-black">+{formatCurrency(totals.totalTunjangan)}</td>
                    
                    {/* Kolom Total Potongan */}
                    <td className="p-5 text-right text-rose-600 text-sm font-black">-{formatCurrency(totals.deductions)}</td>
                    
                    {/* Kolom Net Salary (THP) */}
                    <td className="p-5 text-right text-base font-black text-blue-700 bg-blue-50/30">{formatCurrency(totals.netSalary)}</td>
                    
                    {/* Kolom Aksi */}
                    <td className="p-5 text-center">
                      <div className="flex justify-center gap-2">
                        <button 
                          onClick={() => openAdjustment(index)} 
                          className="px-3 py-1.5 bg-gray-100 text-gray-700 hover:bg-gray-200 text-xs font-bold rounded-xl transition border border-gray-200"
                        >
                          ⚙️ Adjust
                        </button>
                        <button 
                          onClick={() => handleSendWA(item)} 
                          className="px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 text-xs font-bold rounded-xl transition border border-green-200"
                        >
                          💬 Kirim WA
                        </button>
                      </div>                    
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL ADJUSTMENT */}
      {editingIndex !== null && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-4xl shadow-xl">
            <div className="flex justify-between items-center mb-4">
               <h3 className="text-xl font-bold text-gray-800">Edit Variabel Komplit</h3>
               <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-bold">{adjustForm.full_name}</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-h-[60vh] overflow-y-auto p-1">
              <div className="col-span-full border-b pb-1"><h4 className="font-bold text-blue-600 text-sm">Gaji Pokok & Kehadiran</h4></div>
              <div><label className="block text-xs font-bold text-gray-500 mb-1">Gaji Pokok (Rp)</label><input type="number" name="gaji_pokok" value={adjustForm.gaji_pokok} onChange={handleAdjustChange} className="w-full border p-2 rounded-xl text-sm" /></div>
              <div><label className="block text-xs font-bold text-gray-500 mb-1">Tarif Jampel Satuan</label><input type="number" step="0.01" name="tarif_jampel" value={adjustForm.tarif_jampel} onChange={handleAdjustChange} className="w-full border p-2 rounded-xl text-sm" /></div>
              <div><label className="block text-xs font-bold text-gray-500 mb-1">Total Jampel</label><input type="number" name="jumlah_jampel" value={adjustForm.jumlah_jampel} onChange={handleAdjustChange} className="w-full border p-2 rounded-xl text-sm" /></div>
              <div><label className="block text-xs font-bold text-gray-500 mb-1">Transport (Hari)</label><input type="number" name="hari_transport" value={adjustForm.hari_transport} onChange={handleAdjustChange} className="w-full border p-2 rounded-xl text-sm" /></div>

              <div className="col-span-full mt-2 border-b pb-1"><h4 className="font-bold text-emerald-600 text-sm">Tunjangan & Penerimaan Tambahan</h4></div>
              <div><label className="block text-xs font-bold text-gray-500 mb-1">Tunjangan Jabatan</label><input type="number" name="tunj_jabatan" value={adjustForm.tunj_jabatan} onChange={handleAdjustChange} className="w-full border p-2 rounded-xl text-sm" /></div>
              <div><label className="block text-xs font-bold text-gray-500 mb-1">Tunj. Wali Kelas</label><input type="number" name="tunj_walikelas" value={adjustForm.tunj_walikelas} onChange={handleAdjustChange} className="w-full border p-2 rounded-xl text-sm" /></div>
              <div><label className="block text-xs font-bold text-gray-500 mb-1">Tunjangan TA</label><input type="number" name="tunj_ta" value={adjustForm.tunj_ta} onChange={handleAdjustChange} className="w-full border p-2 rounded-xl text-sm" /></div>
              <div><label className="block text-xs font-bold text-gray-500 mb-1">Tunjangan Ekstra</label><input type="number" name="tunj_ekstra" value={adjustForm.tunj_ekstra} onChange={handleAdjustChange} className="w-full border p-2 rounded-xl text-sm" /></div>
              <div><label className="block text-xs font-bold text-gray-500 mb-1">Admin Bank</label><input type="number" name="admin_bank" value={adjustForm.admin_bank} onChange={handleAdjustChange} className="w-full border p-2 rounded-xl text-sm" /></div>
              <div className="col-span-3"><label className="block text-xs font-bold text-emerald-600 mb-1">Tunjangan Lain-Lain</label><input type="number" name="tunj_lain" value={adjustForm.tunj_lain} onChange={handleAdjustChange} className="w-full border border-emerald-300 bg-emerald-50 p-2 rounded-xl text-sm" /></div>

              <div className="col-span-full mt-2 border-b pb-1"><h4 className="font-bold text-rose-600 text-sm">Pemotongan Gaji</h4></div>
              <div><label className="block text-xs font-bold text-gray-500 mb-1">BPJS Ketenagakerjaan</label><input type="number" name="bpjs_kerja" value={adjustForm.bpjs_kerja} onChange={handleAdjustChange} className="w-full border p-2 rounded-xl text-sm text-rose-600" /></div>
              <div><label className="block text-xs font-bold text-gray-500 mb-1">BPJS Kesehatan</label><input type="number" name="bpjs_kesehatan" value={adjustForm.bpjs_kesehatan} onChange={handleAdjustChange} className="w-full border p-2 rounded-xl text-sm text-rose-600" /></div>
              <div><label className="block text-xs font-bold text-gray-500 mb-1">Potongan TA</label><input type="number" name="potongan_ta" value={adjustForm.potongan_ta} onChange={handleAdjustChange} className="w-full border p-2 rounded-xl text-sm text-rose-600" /></div>
              <div><label className="block text-xs font-bold text-gray-500 mb-1">Cicilan Kasbon</label><input type="number" name="kasbon" value={adjustForm.kasbon} onChange={handleAdjustChange} className="w-full border p-2 rounded-xl text-sm text-rose-600" /></div>
              <div className="col-span-4"><label className="block text-xs font-bold text-gray-500 mb-1">Ijin Pribadi / Pot. Lainnya</label><input type="number" name="potongan_lain" value={adjustForm.potongan_lain} onChange={handleAdjustChange} className="w-full border p-2 rounded-xl text-sm text-rose-600" /></div>
            </div>
            <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
              <button onClick={() => setEditingIndex(null)} className="bg-gray-100 text-gray-600 px-4 py-2 rounded-xl text-sm font-semibold">Batal</button>
              <button onClick={saveAdjustment} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700">Terapkan Perubahan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
export default ProcessPayroll