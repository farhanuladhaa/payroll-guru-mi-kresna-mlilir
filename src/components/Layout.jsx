import { Link, Outlet } from 'react-router-dom'
import { supabase } from '../lib/supabase' // Import supabase di sini

function Layout() {
  const menu = [
    { name: 'Dashboard', path: '/' },
    { name: 'Process Payroll', path: '/process-payroll' },
    { name: 'Payroll History', path: '/payroll-history' },
    { name: 'Employees', path: '/employees' },
    { name: 'Salary Rules', path: '/salary-rules' }
  ]

  return (
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
    </div>
  )
}

export default Layout