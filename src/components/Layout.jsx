<<<<<<< HEAD
import { Link, Outlet, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function Layout() {
  const location = useLocation()

=======
import { Link, Outlet } from 'react-router-dom'
import { supabase } from '../lib/supabase' // Import supabase di sini

function Layout() {
>>>>>>> 9a14d0b76b9a4203adeaad7a8170c3c4548641bb
  const menu = [
    { name: 'Dashboard', path: '/' },
    { name: 'Process Payroll', path: '/process-payroll' },
    { name: 'Payroll History', path: '/payroll-history' },
    { name: 'Employees', path: '/employees' },
    { name: 'Salary Rules', path: '/salary-rules' }
  ]

  return (
<<<<<<< HEAD
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

=======
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-blue-600 text-white p-6 flex flex-col">
        <h1 className="text-2xl font-bold mb-8">
          Payroll Guru
        </h1>

        <nav className="space-y-2 flex-grow">
          {menu.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className="block px-4 py-3 rounded-lg hover:bg-blue-700 font-medium transition"
            >
              {item.name}
            </Link>
          ))}
        </nav>

        {/* Tombol Logout */}
        <div className="border-t border-blue-500 pt-4 mt-4">
          <button
            onClick={() => supabase.auth.signOut()}
            className="w-full text-left px-4 py-3 rounded-lg text-red-200 hover:bg-blue-700 hover:text-white font-bold transition flex items-center gap-2"
          >
            <span>🚪</span> Log Out
          </button>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 p-8">
        <Outlet />
      </main>
>>>>>>> 9a14d0b76b9a4203adeaad7a8170c3c4548641bb
    </div>
  )
}

export default Layout