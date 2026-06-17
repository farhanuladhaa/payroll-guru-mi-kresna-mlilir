import { Link, Outlet, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function Layout() {
  const location = useLocation()

  const menu = [
    { name: 'Dashboard', path: '/' },
    { name: 'Process Payroll', path: '/process-payroll' },
    { name: 'Payroll History', path: '/payroll-history' },
    { name: 'Employees', path: '/employees' },
    { name: 'Salary Rules', path: '/salary-rules' }
  ]

  return (
    <div className="min-h-screen bg-white">
      
      {/* NAVBAR */}
      <header className="bg-green-700 shadow-md">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          
          {/* Logo */}
          <div>
            <h1 className="text-2xl font-bold text-white">
              Payroll Guru
            </h1>
            <p className="text-green-100 text-xs">
              Sistem Penggajian MI Kresna Mlilir
            </p>
          </div>

          {/* Menu */}
          <nav className="flex items-center gap-2">
            {menu.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  location.pathname === item.path
                    ? 'bg-white text-green-700'
                    : 'text-white hover:bg-green-800'
                }`}
              >
                {item.name}
              </Link>
            ))}

            {/* Logout */}
            <button
              onClick={() => supabase.auth.signOut()}
              className="ml-4 border border-white/40 text-white px-4 py-2 rounded-lg font-semibold hover:bg-white hover:text-green-700 transition"
            >
              🚪 Logout
            </button>
          </nav>
        </div>
      </header>

      {/* CONTENT */}
      <main className="max-w-7xl mx-auto p-6 bg-white">
        <Outlet />
      </main>

    </div>
  )
}

export default Layout