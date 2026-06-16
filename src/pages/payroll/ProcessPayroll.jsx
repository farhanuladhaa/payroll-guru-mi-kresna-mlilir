import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import JSZip from 'jszip'
import { generatePayslip } from '../../utils/pdfGenerator'

function ProcessPayroll() {
  const [employees, setEmployees] = useState([])
  const [payrollList, setPayrollList] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  const [month, setMonth] = useState(3) // Default Maret
  const [year, setYear] = useState(2026)

  const [editingIndex, setEditingIndex] = useState(null)
  const [adjustForm, setAdjustForm] = useState({})

  const fileInputRef = useRef(null)

  useEffect(() => { initData() }, [])

  async function initData() {
    try {
      setLoading(true)
      const { data: empData } = await supabase.from('employees').select('*, positions(name)').eq('is_active', true)
      setEmployees(empData || [])
    } catch (error) { alert('Gagal memuat data karyawan aktif.') } finally { setLoading(false) }
  }

  // 📝 LOGIKA HITUNG DENGAN PEMBULATAN BULAT
  function calculateRowTotals(item) {
    const teachingAllowance = Number(item.tarif_jampel || 0) * Number(item.jumlah_jampel || 0)
    const transportAllowance = 10000 * Number(item.hari_transport || 0)

    const grossSalary = 
      Number(item.gaji_pokok || 0) + teachingAllowance + transportAllowance + 
      Number(item.tunj_jabatan || 0) + Number(item.tunj_walikelas || 0) +
      Number(item.tunj_ta || 0) + Number(item.tunj_ekstra || 0) +
      Number(item.admin_bank || 0) + Number(item.tunj_lain || 0)

    const deductions = 
      Number(item.bpjs_kerja || 0) + Number(item.bpjs_kesehatan || 0) +
      Number(item.potongan_ta || 0) + Number(item.kasbon || 0) +
      Number(item.potongan_lain || 0)

    return { 
      teachingAllowance: Math.round(teachingAllowance),
      transportAllowance: Math.round(transportAllowance),
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

  // 📥 IMPORT CSV DENGAN REGEX RESOLUTION (KEMBALI KE ASLI YANG AMAN)
  function handleAttendanceImport(e) {
    const file = e.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (event) => {
      const text = event.target.result
      const lines = text.split('\n').map(line => line.replace('\r', '').trim())
      if (lines.length < 2) return

      const firstLine = lines[0]
      const separator = firstLine.includes(';') ? ';' : ','
      const regexSplit = new RegExp(`${separator}(?=(?:(?:[^"]*"){2})*[^"]*$)`)
      const headers = firstLine.split(regexSplit).map(h => h.replace(/"/g, '').trim().toLowerCase())

      const getIdx = (name) => headers.findIndex(h => h === name)
      const idx = {
        nip: getIdx('employee_code'), gaji: getIdx('gaji_pokok'), tarif: getIdx('tarif_jampel'),
        jampel: getIdx('jumlah_jampel'), trans: getIdx('hari_transport'), jab: getIdx('tunj_jabatan'),
        wali: getIdx('tunj_walikelas'), tTA: getIdx('tunj_ta'), eks: getIdx('tunj_ekstra'),
        adm: getIdx('admin_bank'), tLain: getIdx('tunj_lain'), bpjsK: getIdx('bpjs_kerja'),
        bpjsKes: getIdx('bpjs_kesehatan'), pTA: getIdx('potongan_ta'), kasbon: getIdx('kasbon'),
        pLain: getIdx('potongan_lain')
      }

      if (idx.nip === -1) return alert('File CSV tidak sesuai format komplit!')

      const generatedList = []

      for (let i = 1; i < lines.length; i++) {
        if (!lines[i]) continue
        const cols = lines[i].split(regexSplit)
        const csvNip = cols[idx.nip]?.replace(/"/g, '').trim()
        
        const emp = employees.find(e => e.employee_code === csvNip)
        if (!emp) continue

        generatedList.push({
          employee_id: emp.id,
          employee_code: emp.employee_code,
          full_name: emp.full_name,
          position_name: emp.positions?.name || '-',
          category: emp.category,
          
          gaji_pokok: parseFloat(cols[idx.gaji]?.replace(/"/g, '')) || 0,
          tarif_jampel: parseFloat(cols[idx.tarif]?.replace(/"/g, '')) || 0,
          jumlah_jampel: parseFloat(cols[idx.jampel]?.replace(/"/g, '')) || 0,
          hari_transport: parseFloat(cols[idx.trans]?.replace(/"/g, '')) || 0,
          tunj_jabatan: parseFloat(cols[idx.jab]?.replace(/"/g, '')) || 0,
          tunj_walikelas: parseFloat(cols[idx.wali]?.replace(/"/g, '')) || 0,
          tunj_ta: parseFloat(cols[idx.tTA]?.replace(/"/g, '')) || 0,
          tunj_ekstra: parseFloat(cols[idx.eks]?.replace(/"/g, '')) || 0,
          admin_bank: parseFloat(cols[idx.adm]?.replace(/"/g, '')) || 0,
          tunj_lain: parseFloat(cols[idx.tLain]?.replace(/"/g, '')) || 0,
          
          bpjs_kerja: parseFloat(cols[idx.bpjsK]?.replace(/"/g, '')) || 0,
          bpjs_kesehatan: parseFloat(cols[idx.bpjsKes]?.replace(/"/g, '')) || 0,
          potongan_ta: parseFloat(cols[idx.pTA]?.replace(/"/g, '')) || 0,
          kasbon: parseFloat(cols[idx.kasbon]?.replace(/"/g, '')) || 0,
          potongan_lain: parseFloat(cols[idx.pLain]?.replace(/"/g, '')) || 0
        })
      }
      setPayrollList(generatedList)
      alert(`Berhasil menarik ${generatedList.length} rekap gaji baseline komplit!`)
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
          status: 'published',
          created_by: adminEmail
        })
        .select()
        .single()

      if (runError) throw runError

      // Masukkan run_id ke payload slips
      const slipsWithRunId = finalPayload.map(slip => ({ ...slip, run_id: runData.id }))
      const { error: slipError } = await supabase.from('payroll_slips').insert(slipsWithRunId)
      if (slipError) throw slipError

      alert(`Sukses! Baseline Payroll ${month}/${year} sebesar Rp ${exactTotalAmount.toLocaleString('id-ID')} disimpan permanen. 📄🎉`)
    } catch (error) {
      alert('Gagal menyimpan: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  function formatCurrency(value) { return 'Rp' + (Number(value) || 0).toLocaleString('id-ID') }

  if (loading) return <div className="p-10 text-center text-gray-500">Mempersiapkan data kalkulator...</div>

  return (
    <div className="p-2">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
           <h1 className="text-3xl font-bold text-blue-600 mb-4">Process Monthly Payroll</h1>
           <div className="bg-white p-4 rounded-2xl shadow-sm border border-blue-100 inline-block">
             <p className="text-xs text-gray-400 font-bold tracking-wider">TOTAL PENGELUARAN GAJI (THP)</p>
             <p className="text-3xl font-black text-blue-700">{formatCurrency(totalTHP)}</p>
           </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 bg-white p-2 rounded-2xl shadow-sm border border-gray-100">
          <select value={month} onChange={(e) => setMonth(parseInt(e.target.value))} className="border p-2 rounded-xl text-sm font-semibold text-gray-700 bg-gray-50">
            {['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'].map((m, idx) => (
              <option key={idx} value={idx + 1}>{m}</option>
            ))}
          </select>
          <select value={year} onChange={(e) => setYear(parseInt(e.target.value))} className="border p-2 rounded-xl text-sm font-semibold text-gray-700 bg-gray-50">
            <option value={2026}>2026</option>
            <option value={2027}>2027</option>
          </select>
          <div className="h-6 w-px bg-gray-200 mx-1"></div>
          
          <input type="file" accept=".csv" ref={fileInputRef} onChange={handleAttendanceImport} className="hidden" />
          <button onClick={() => fileInputRef.current.click()} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition">📥 Import CSV</button>
          <button onClick={handleDownloadAll} disabled={saving || payrollList.length === 0} className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition disabled:opacity-50">📦 Download ZIP</button>
          <button onClick={handleSavePayroll} disabled={saving || payrollList.length === 0} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition disabled:opacity-50">💾 Save & Publish</button>
        </div>
      </div>

      {/* TABEL */}
      <div className="bg-white shadow-md rounded-2xl overflow-hidden border border-gray-100">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-50 text-gray-600 uppercase text-xs font-semibold border-b border-gray-100">
            <tr>
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
                  <tr key={item.employee_id} className="hover:bg-gray-50/70 transition">
                    <td className="p-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-gray-900">{item.full_name}</span>
                        <span className="text-xs text-gray-400 font-medium">{item.position_name}</span>
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-xs">{item.jumlah_jampel} Jam</span>
                      <span className="text-purple-700 bg-purple-50 px-2 py-0.5 rounded text-xs ml-1">{item.hari_transport} Hari</span>
                    </td>
                    <td className="p-4 text-right text-gray-600 font-medium">{formatCurrency(item.gaji_pokok)}</td>
                    <td className="p-4 text-right text-emerald-600 font-semibold">+{formatCurrency(tunjMurni)}</td>
                    <td className="p-4 text-right text-rose-600 font-semibold">-{formatCurrency(totals.deductions)}</td>
                    <td className="p-4 text-right font-bold text-blue-600 bg-blue-50/20">{formatCurrency(totals.netSalary)}</td>
                    <td className="p-4 text-center">
                      <button onClick={() => openAdjustment(index)} className="px-3 py-1 bg-gray-100 text-gray-700 text-xs font-semibold rounded-lg">⚙️ Adjust</button>
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