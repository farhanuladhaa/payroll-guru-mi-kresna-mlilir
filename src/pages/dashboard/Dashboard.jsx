import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Link } from 'react-router-dom'

function Dashboard() {
  const [stats, setStats] = useState({ totalEmployees: 0, lastPayroll: null, totalExpended: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboard()
  }, [])

  async function loadDashboard() {
    setLoading(true)
    
    // 1. Total Guru
    const { count } = await supabase.from('employees').select('*', { count: 'exact', head: true }).eq('is_active', true)
    
    // 2. Data Payroll Terakhir (dari tabel payroll_runs yang baru kita buat)
    const { data: latest } = await supabase
      .from('payroll_runs')
      .select('*')
      .order('payroll_year', { ascending: false })
      .order('payroll_month', { ascending: false })
      .limit(1)
      .single()

    setStats({
      totalEmployees: count || 0,
      lastPayroll: latest,
      totalExpended: latest?.total_amount || 0
    })
    setLoading(false)
  }

  const formatCurrency = (val) => 'Rp ' + Number(val || 0).toLocaleString('id-ID')
  const getMonthName = (m) => ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'][m - 1]

  if (loading) return <div className="p-10 text-center text-gray-400">Loading Dashboard...</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black text-gray-800">Dashboard Utama</h1>
        <p className="text-gray-500 font-medium">Ringkasan operasional payroll MI Kresna Mlilir.</p>
      </div>

      {/* STATS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-6 rounded-3xl shadow-lg shadow-blue-200 text-white">
          <p className="text-blue-100 font-bold text-xs uppercase tracking-wider mb-2">Total Guru Aktif</p>
          <p className="text-4xl font-black">{stats.totalEmployees}</p>
          <Link to="/employees" className="text-xs mt-4 block underline opacity-80">Kelola Data Guru →</Link>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
          <p className="text-gray-400 font-bold text-xs uppercase tracking-wider mb-2">Pengeluaran Terakhir</p>
          <p className="text-2xl font-black text-gray-800">{formatCurrency(stats.totalExpended)}</p>
          <p className="text-xs text-gray-400 mt-1">Periode: {stats.lastPayroll ? `${getMonthName(stats.lastPayroll.payroll_month)} ${stats.lastPayroll.payroll_year}` : '-'}</p>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <p className="text-gray-400 font-bold text-xs uppercase tracking-wider mb-2">Status Payroll</p>
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${stats.lastPayroll?.status === 'published' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
              {stats.lastPayroll?.status || 'Belum Ada'}
            </span>
          </div>
          <Link to="/payroll-history" className="text-xs font-bold text-blue-600 hover:underline mt-4">Lihat Histori Lengkap →</Link>
        </div>
      </div>

      {/* QUICK ACTIONS */}
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
        <h3 className="font-bold text-gray-800 mb-6">Aksi Cepat</h3>
        <div className="flex gap-4">
          <Link to="/process-payroll" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-bold text-sm transition">
            ➕ Proses Payroll Baru
          </Link>
          <Link to="/salary-rules" className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-3 rounded-2xl font-bold text-sm transition">
            ⚙️ Atur Komponen Gaji
          </Link>
        </div>
      </div>
    </div>
  )
}

export default Dashboard