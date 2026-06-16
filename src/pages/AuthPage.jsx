import { useState } from 'react'
import { supabase } from '../lib/supabase'

function AuthPage() {
  // mode bisa berupa: 'login', 'register', atau 'forgot'
  const [mode, setMode] = useState('login') 
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })

  const showAlert = (type, text) => {
    setMessage({ type, text })
    setTimeout(() => setMessage({ type: '', text: '' }), 5000)
  }

  // 🔐 FUNGSI LOGIN
  async function handleLogin(e) {
    e.preventDefault()
    if (!email || !password) return showAlert('error', 'Semua kolom wajib diisi!')
    
    try {
      setLoading(true)
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
    } catch (err) {
      showAlert('error', 'Gagal Login: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  // 📝 FUNGSI REGISTRASI (DAFTAR USER BARU)
  async function handleRegister(e) {
    e.preventDefault()
    if (!email || !password || !confirmPassword) return showAlert('error', 'Semua kolom wajib diisi!')
    if (password !== confirmPassword) return showAlert('error', 'Konfirmasi password tidak cocok!')
    if (password.length < 6) return showAlert('error', 'Password minimal harus 6 karakter!')

    try {
      setLoading(true)
      const { error, data } = await supabase.auth.signUp({ email, password })
      if (error) throw error
      
      showAlert('success', 'Registrasi Berhasil! Akun Anda sudah aktif dan siap digunakan.')
      setMode('login')
      setPassword('')
      setConfirmPassword('')
    } catch (err) {
      showAlert('error', 'Gagal Registrasi: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  // 🔑 FUNGSI LUPA PASSWORD
  async function handleForgotPassword(e) {
    e.preventDefault()
    if (!email) return showAlert('error', 'Masukkan email Anda terlebih dahulu!')

    try {
      setLoading(true)
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin, // Otomatis balik ke web kita setelah ganti password
      })
      if (error) throw error
      showAlert('success', 'Link reset password telah dikirim ke email Anda! Silakan periksa inbox/spam.')
    } catch (err) {
      showAlert('error', 'Gagal Mengirim Email: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-50 p-4">
      <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md border border-gray-100 transition-all">
        
        {/* LOGO & JUDUL */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-3 text-2xl font-bold">
            MI
          </div>
          <h2 className="text-2xl font-black text-gray-800">Payroll System</h2>
          <p className="text-sm text-gray-400 font-medium mt-1">Sistem Penggajian MI Kresna Mlilir</p>
        </div>

        {/* NOTIFIKASI POP-UP KECIL */}
        {message.text && (
          <div className={`p-3 rounded-xl mb-4 text-xs font-bold text-center ${
            message.type === 'error' ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'
          }`}>
            {message.text}
          </div>
        )}

        {/* FORM LOGIN */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">EMAIL INSTITUSI</label>
              <input className="w-full border p-3 rounded-xl text-sm focus:outline-blue-500" type="email" placeholder="contoh@mikresna.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-bold text-gray-500">PASSWORD</label>
                <button type="button" onClick={() => setMode('forgot')} className="text-xs font-bold text-blue-600 hover:underline">Lupa Password?</button>
              </div>
              <input className="w-full border p-3 rounded-xl text-sm focus:outline-blue-500" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <button className="w-full bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-xl font-bold text-sm shadow-md transition disabled:opacity-50" disabled={loading}>
              {loading ? 'Memproses...' : 'Masuk Aplikasi ➔'}
            </button>
            <p className="text-center text-xs text-gray-400 font-medium pt-2">
              Belum punya akun? <button type="button" onClick={() => setMode('register')} className="text-blue-600 font-bold hover:underline">Daftar Admin Baru</button>
            </p>
          </form>
        )}

        {/* FORM REGISTRASI */}
        {mode === 'register' && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">ALAMAT EMAIL</label>
              <input className="w-full border p-3 rounded-xl text-sm focus:outline-blue-500" type="email" placeholder="adminbaru@mikresna.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">PASSWORD (MINIMAL 6 KARAKTER)</label>
              <input className="w-full border p-3 rounded-xl text-sm focus:outline-blue-500" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">KONFIRMASI PASSWORD</label>
              <input className="w-full border p-3 rounded-xl text-sm focus:outline-blue-500" type="password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>
            <button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white p-3 rounded-xl font-bold text-sm shadow-md transition disabled:opacity-50" disabled={loading}>
              {loading ? 'Mendaftarkan Akun...' : 'Buat Akun Baru ✓'}
            </button>
            <p className="text-center text-xs text-gray-400 font-medium pt-2">
              Sudah punya akun? <button type="button" onClick={() => setMode('login')} className="text-blue-600 font-bold hover:underline">Silakan Login</button>
            </p>
          </form>
        )}

        {/* FORM LUPA PASSWORD */}
        {mode === 'forgot' && (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <p className="text-xs text-gray-400 font-medium mb-2 leading-relaxed">
              Masukkan email terdaftar Anda. Kami akan mengirimkan tautan aman untuk mengatur ulang kata sandi Anda secara langsung.
            </p>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">EMAIL TERDAFTAR</label>
              <input className="w-full border p-3 rounded-xl text-sm focus:outline-blue-500" type="email" placeholder="emailanda@mikresna.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <button className="w-full bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-xl font-bold text-sm shadow-md transition disabled:opacity-50" disabled={loading}>
              {loading ? 'Mengirim...' : 'Kirim Link Reset Ganti Password ✉️'}
            </button>
            <div className="text-center pt-2">
              <button type="button" onClick={() => setMode('login')} className="text-xs text-blue-600 font-bold hover:underline">← Kembali ke Login</button>
            </div>
          </form>
        )}

      </div>
    </div>
  )
}

export default AuthPage