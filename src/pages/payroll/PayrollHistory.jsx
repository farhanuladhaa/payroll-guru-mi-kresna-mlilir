import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Link } from 'react-router-dom'

function PayrollHistory() {
  const [payrolls, setPayrolls] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadPayrolls()
  }, [])

  async function loadPayrolls() {
    setLoading(true)

    const { data, error } = await supabase
      .from('payroll_runs')
      .select('*')
      .order('payroll_year', { ascending: false })
      .order('payroll_month', { ascending: false })

    if (error) {
      console.error(error)
    } else {
      setPayrolls(data || [])
    }

    setLoading(false)
  }

  // FUNGSI DELETE RIWAYAT PAYROLL
  async function handleDelete(id, monthName, year) {
    const isConfirmed = window.confirm(`⚠️ PERINGATAN!\n\nApakah Anda yakin ingin menghapus permanen riwayat penggajian bulan ${monthName} ${year}?\nSemua slip gaji di bulan ini juga akan terhapus dan tidak bisa dikembalikan.`)
    
    if (!isConfirmed) return

    try {
      setLoading(true)
      
      // 1. Hapus Detail Slip Gajinya Dulu (Biar tidak ada Foreign Key Error)
      await supabase.from('payroll_slips').delete().eq('run_id', id)
      
      // 2. Hapus Master History-nya
      const { error } = await supabase.from('payroll_runs').delete().eq('id', id)
      
      if (error) throw error

      alert(`Sukses menghapus riwayat penggajian ${monthName} ${year}.`)
      loadPayrolls() // Refresh tabel setelah dihapus
    } catch (error) {
      alert('Gagal menghapus riwayat: ' + error.message)
      setLoading(false)
    }
  }

  function getMonthName(month) {
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
    return months[month - 1]
  }

  // Helper untuk format Rupiah
  function formatCurrency(value) {
    return 'Rp ' + (Number(value) || 0).toLocaleString('id-ID')
  }

  // Helper untuk format Timestamp ke gaya Indonesia
  function formatTime(timestamp) {
    if (!timestamp) return '-'
    const date = new Date(timestamp)
    return date.toLocaleString('id-ID', { 
      day: '2-digit', month: 'short', year: 'numeric', 
      hour: '2-digit', minute: '2-digit' 
    }) + ' WIB'
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-pulse text-gray-500 font-semibold">Memuat riwayat...</div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-3xl font-bold text-black">Payroll History</h1>
      <p className="text-gray-500 mb-8 text-sm">Riwayat seluruh payroll yang telah diproses dan diterbitkan.</p>

      <div className="bg-white shadow-md rounded-2xl overflow-hidden border border-gray-100">
        <table className="w-full text-left">
          <thead className="bg-gray-50 text-black-600 text-xs uppercase font-semibold">
            <tr>
              <th className="px-6 py-4 font-semibold">PERIODE</th>
              <th className="px-6 py-4 font-semibold">WAKTU PROSES</th>
              <th className="px-6 py-4 font-semibold">DIUNGGAH OLEH</th>
              <th className="px-6 py-4 font-semibold text-center">JUMLAH PEGAWAI</th>
              <th className="px-6 py-4 font-semibold text-right">TOTAL PENGELUARAN (THP)</th>
              <th className="px-6 py-4 font-semibold text-center">AKSI</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100 text-sm">
            {payrolls.length === 0 ? (
              <tr>
                <td colSpan="6" className="p-12 text-center text-gray-400 font-medium bg-gray-50">
                  Belum ada payroll yang disimpan. Silakan proses di menu Process Payroll.
                </td>
              </tr>
            ) : (
              payrolls.map((payroll) => {
                const monthName = getMonthName(payroll.payroll_month)
                
                return (
                  <tr key={payroll.id} className="hover:bg-blue-50/50 transition">
                    <td className="px-6 py-4">
                      <Link to={`/payroll-history/${payroll.id}`} className="text-blue-600 hover:text-blue-800 font-bold hover:underline flex items-center gap-2">
                        📄 {monthName} {payroll.payroll_year}
                      </Link>
                    </td>
                    
                    {/* TIMESTAMP */}
                    <td className="px-6 py-4 text-gray-600 font-medium">
                      {formatTime(payroll.created_at)}
                    </td>

                    {/* USER PEMBUAT */}
                    <td className="px-6 py-4">
                      <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs font-bold">
                        👤 {payroll.created_by || 'Admin'}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-center font-bold text-gray-700">
                      {payroll.total_employees} org
                    </td>

                    <td className="px-6 py-4 text-right font-black text-emerald-600">
                      {formatCurrency(payroll.total_amount)}
                    </td>

                    {/* TOMBOL AKSI */}
                    <td className="px-6 py-4 text-center">
                      <div className="flex justify-center gap-2">
                        <Link 
                          to={`/payroll-history/${payroll.id}`}
                          className="bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1"
                        >
                          👁️ View
                        </Link>
                        <button 
                          onClick={() => handleDelete(payroll.id, monthName, payroll.payroll_year)}
                          className="bg-rose-100 hover:bg-rose-200 text-rose-700 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1"
                        >
                          🗑️ Delete
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
    </div>
  )
}

export default PayrollHistory