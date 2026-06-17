import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { generatePayslip } from '../../utils/pdfGenerator'

function PayrollDetail() {
  const { id } = useParams() // Mengambil ID dari URL
  const [runData, setRunData] = useState(null)
  const [slips, setSlips] = useState([])
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(null)

  useEffect(() => {
    loadPayrollDetail()
  }, [id])

  async function loadPayrollDetail() {
    try {
      setLoading(true)

      // 1. Ambil data Master History
      const { data: run, error: runError } = await supabase
        .from('payroll_runs')
        .select('*')
        .eq('id', id)
        .single()
      
      if (runError) throw runError
      setRunData(run)

      // 2. Ambil data Detail Slip Gaji sekaligus Join ke tabel Employees untuk dapat Nama & Kode
      const { data: slipData, error: slipError } = await supabase
        .from('payroll_slips')
        .select('*, employees(employee_code, full_name, category, hire_date)')
        .eq('run_id', id)
        .order('net_salary', { ascending: false }) // Urutkan dari gaji terbesar
      
      if (slipError) throw slipError
      setSlips(slipData || [])

    } catch (error) {
      alert('Gagal memuat detail: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  // FUNGSI DOWNLOAD PDF PER INDIVIDU
  async function handleDownloadSlip(slip) {
    setDownloading(slip.id)
    try {
      // Susun ulang objek data agar sesuai dengan format yang diminta pdfGenerator.js
      const empData = {
        full_name: slip.employees?.full_name || 'Tidak Diketahui',
        gaji_pokok: slip.base_salary,
        tunj_jabatan: slip.breakdown_data.tunjangan_jabatan,
        teachingAllowance: slip.breakdown_data.teaching_allowance,
        transportAllowance: slip.breakdown_data.transport_allowance,
        tunj_ekstra: slip.breakdown_data.tunjangan_ekstra,
        tunj_ta: slip.breakdown_data.tunjangan_ta,
        admin_bank: slip.breakdown_data.admin_bank,
        bpjs_kerja: slip.breakdown_data.bpjs_ketenagakerjaan,
        bpjs_kesehatan: slip.breakdown_data.bpjs_kesehatan,
        potongan_lain: slip.breakdown_data.potongan_lain,
        kasbon: slip.breakdown_data.kasbon,
        netSalary: slip.net_salary
      }

      // Panggil pabrik PDF-nya
      const pdfBlob = await generatePayslip(empData, slip.period_month, slip.period_year)
      
      // Proses download
      const link = document.createElement('a')
      link.href = URL.createObjectURL(pdfBlob)
      link.download = `Slip_Gaji_${empData.full_name}_${slip.period_month}_${slip.period_year}.pdf`
      link.click()
    } catch (error) {
      alert('Gagal membuat PDF: ' + error.message)
    } finally {
      setDownloading(null)
    }
  }

  // Helper Functions
  const formatCurrency = (value) => 'Rp ' + (Number(value) || 0).toLocaleString('id-ID')
  const getMonthName = (m) => ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'][m - 1]
  const formatDate = (dateStr) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  // Tampilan Loading
  if (loading) return <div className="flex justify-center items-center h-64"><div className="animate-pulse text-gray-500 font-bold text-lg">Memuat rincian slip gaji...</div></div>
  if (!runData) return <div className="p-10 text-center text-rose-500 font-bold">Data riwayat tidak ditemukan!</div>

  return (
    <div className="pb-10">
      {/* HEADER & TOMBOL KEMBALI */}
      <div className="flex gap-3">
        {/* TOMBOL BARU: REKAPITULASI */}
        <Link 
            to={`/payroll-history/${id}/rekap`}
            className="bg-emerald-600 text-white hover:bg-emerald-700 border border-emerald-700 px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition flex items-center gap-2"
        >
            📊 Cetak Rekapitulasi
        </Link>
        
        {/* TOMBOL LAMA: TANDA TERIMA */}
        <Link 
            to={`/payroll-history/${id}/tanda-terima`}
            className="bg-indigo-600 text-white hover:bg-indigo-700 border border-indigo-700 px-4 py-2 rounded-xl text-sm font-bold shadow-sm transition flex items-center gap-2"
        >
            ✍️ Cetak Tanda Terima
        </Link>
        
        <div className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-4 py-2 rounded-xl text-sm font-bold uppercase tracking-widest shadow-sm flex items-center">
            {runData.status}
        </div>
        </div>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
          <p className="text-xs text-gray-400 font-bold mb-1">JUMLAH PEGAWAI</p>
          <p className="text-2xl font-black text-gray-800">{runData.total_employees} <span className="text-sm font-medium text-gray-400">Orang</span></p>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 col-span-2">
          <p className="text-xs text-gray-400 font-bold mb-1">TOTAL PENGELUARAN GAJI</p>
          <p className="text-2xl font-black text-green-600">{formatCurrency(runData.total_amount)}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
          <p className="text-xs text-gray-400 font-bold mb-1">TANGGAL DIBUAT</p>
          <p className="text-lg font-bold text-gray-800">{formatDate(runData.created_at)}</p>
        </div>
      </div>

      {/* TABEL PEGAWAI */}
      <div className="bg-white shadow-md rounded-2xl overflow-hidden border border-gray-100">
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
          <h3 className="font-bold text-gray-700">Rincian Penerima Gaji</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-black text-xs uppercase font-semibold">
              <tr>
                <th className="px-6 py-4">Kode</th>
                <th className="px-6 py-4">Nama</th>
                <th className="px-6 py-4">Kategori</th>
                <th className="px-6 py-4">Masa Kerja (Mulai)</th>
                <th className="px-6 py-4 text-right">Gaji Pokok</th>
                <th className="px-6 py-4 text-right">Take Home Pay</th>
                <th className="px-6 py-4 text-center">Slip Gaji</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-gray-100">
              {slips.map((slip) => (
                <tr key={slip.id} className="hover:bg-blue-50/40 transition">
                  <td className="px-6 py-4 font-bold text-gray-500">{slip.employees?.employee_code || '-'}</td>
                  <td className="px-6 py-4 font-bold text-gray-900">{slip.employees?.full_name || 'Data Terhapus'}</td>
                  <td className="px-6 py-4"><span className="bg-gray-100 px-2 py-1 rounded text-xs font-semibold">{slip.employees?.category || '-'}</span></td>
                  <td className="px-6 py-4 text-gray-500">{formatDate(slip.employees?.hire_date)}</td>
                  <td className="px-6 py-4 text-right font-medium">{formatCurrency(slip.base_salary)}</td>
                  <td className="px-6 py-4 text-right font-black text-emerald-600">{formatCurrency(slip.net_salary)}</td>
                  <td className="px-6 py-4 text-center">
                    <button 
                      onClick={() => handleDownloadSlip(slip)}
                      disabled={downloading === slip.id}
                      className="bg-purple-100 hover:bg-purple-200 text-purple-700 px-4 py-2 rounded-xl text-xs font-bold transition disabled:opacity-50"
                    >
                      {downloading === slip.id ? 'Loading...' : '📄 PDF'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default PayrollDetail