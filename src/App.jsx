import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { supabase } from './lib/supabase'

// Komponen Auth
import AuthPage from './pages/AuthPage'

// Layout
import Layout from './components/Layout'

// Pages
import Dashboard from './pages/dashboard/Dashboard'
import ProcessPayroll from './pages/payroll/ProcessPayroll'
import PayrollHistory from './pages/payroll/PayrollHistory'
import Employees from './pages/employees/Employees'
import SalaryRules from './pages/salary-rules/SalaryRules'
import PayrollDetail from './pages/payroll/PayrollDetail'

function App() {
  const [session, setSession] = useState(null)
  const [checkingAuth, setCheckingAuth] = useState(true)

  useEffect(() => {
    // 1. Cek status token login saat pertama kali web dibuka
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setCheckingAuth(false)
    })

    // 2. Pasang sensor otomatis jika ada aksi Login / Logout berjalan
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Tampilan loading kilat saat mencocokkan data token
  if (checkingAuth) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-sm font-semibold text-gray-400 animate-pulse">Memverifikasi akses...</div>
      </div>
    )
  }

  // JIKA BELUM LOGIN: Tampilkan Halaman Login (Tanpa Sidebar)
  if (!session) {
    return <AuthPage />
  }

  // JIKA SUDAH LOGIN: Tampilkan Aplikasi Penuh (Pakai Sidebar & Router)
  return (
    <BrowserRouter>
      <Routes>
        {/* Layout utama dengan sidebar */}
        <Route path="/" element={<Layout />}>
          {/* Dashboard */}
          <Route index element={<Dashboard />} />

          {/* Payroll Module */}
          <Route path="process-payroll" element={<ProcessPayroll />} />
          <Route path="payroll-history" element={<PayrollHistory />} />
          <Route path="payroll-history/:id" element={<PayrollDetail />} />

          {/* Master Data */}
          <Route path="employees" element={<Employees />} />
          <Route path="salary-rules" element={<SalaryRules />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )

}

export default App