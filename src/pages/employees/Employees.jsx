import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'

function Employees() {
  const [employees, setEmployees] = useState([])
  const [positions, setPositions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const fileInputRef = useRef(null)

  // 1. TAMBAHKAN BANK_NAME & ACCOUNT_NUMBER DI STATE
  const [form, setForm] = useState({
    nip: '',
    full_name: '',
    hire_date: '',
    position_id: '',
    category: '', 
    bank_name: '', 
    account_number: '',
    is_active: true,
  })

  const [editingId, setEditingId] = useState(null)

  useEffect(() => {
    loadEmployees()
    loadPositions()
  }, [])

  async function loadEmployees() {
    setLoading(true)
    const { data } = await supabase
      .from('employees')
      .select(`
        *,
        positions (
          id,
          name
        )
      `)
      .order('created_at', { ascending: false })

    setEmployees(data || [])
    setLoading(false)
  }

  async function loadPositions() {
    const { data } = await supabase.from('positions').select('*')
    setPositions(data || [])
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target
    setForm({
      ...form,
      [name]: type === 'checkbox' ? checked : value,
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()

    if (!form.nip || !form.full_name || !form.position_id || !form.category) {
      alert('NIP, Nama, Jabatan, dan Kategori wajib diisi')
      return
    }

    // 2. MASUKKAN BANK & REKENING SAAT DISIMPAN KE DB
    const employeeData = {
      employee_code: form.nip, 
      full_name: form.full_name,
      hire_date: form.hire_date || null,
      position_id: form.position_id,
      category: form.category,
      bank_name: form.bank_name ? form.bank_name.toUpperCase() : null, // Paksa huruf besar
      account_number: form.account_number || null,
      is_active: form.is_active,
    }

    if (editingId) {
      const { error } = await supabase
        .from('employees')
        .update(employeeData)
        .eq('id', editingId)
      
      if (error) alert('Gagal mengupdate data: ' + error.message)
    } else {
      const { error } = await supabase
        .from('employees')
        .insert([employeeData])
      
      if (error) alert('Gagal menambah data: ' + error.message)
    }

    resetForm()
    loadEmployees()
  }

  function resetForm() {
    setForm({
      nip: '',
      full_name: '',
      hire_date: '',
      position_id: '',
      category: '',
      bank_name: '',
      account_number: '',
      is_active: true,
    })
    setEditingId(null)
    setShowForm(false)
  }

  async function handleDelete(id) {
    if (confirm('Apakah Anda yakin ingin menghapus karyawan ini?')) {
      await supabase.from('employees').delete().eq('id', id)
      loadEmployees()
    }
  }

  // 3. LOAD DATA BANK & REKENING SAAT TOMBOL EDIT DIKLIK
  function handleEdit(emp) {
    setForm({
      nip: emp.employee_code || '',
      full_name: emp.full_name,
      hire_date: emp.hire_date,
      position_id: emp.position_id,
      category: emp.category || '', 
      bank_name: emp.bank_name || '',
      account_number: emp.account_number || '',
      is_active: emp.is_active,
    })
    setEditingId(emp.id)
    setShowForm(true)
  }

  function handleCSVImport(e) {
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

      const nipIndex = headers.findIndex(h => h === 'employee_code' || h === 'nip')
      const nameIndex = headers.findIndex(h => h === 'full_name' || h === 'nama')
      const posIndex = headers.findIndex(h => h === 'position_name' || h === 'jabatan')
      const catIndex = headers.findIndex(h => h === 'category' || h === 'kategori') 
      const dateIndex = headers.findIndex(h => h === 'hire_date' || h === 'tanggal masuk')

      if (nipIndex === -1 || nameIndex === -1 || posIndex === -1) {
        alert('Format file CSV tidak dikenali. Pastikan ada header employee_code, full_name, dan position_name.')
        return
      }

      const importedData = []
      const unmatchedNames = new Set()

      for (let i = 1; i < lines.length; i++) {
        if (!lines[i]) continue

        const columns = lines[i].split(regexSplit)
        const rawNip = columns[nipIndex]?.replace(/"/g, '').trim()
        const rawFullName = columns[nameIndex]?.replace(/"/g, '').trim()
        const rawPositionName = columns[posIndex]?.replace(/"/g, '').trim()
        const rawCategory = catIndex !== -1 ? columns[catIndex]?.replace(/"/g, '').trim() : 'Karyawan'
        const rawHireDate = dateIndex !== -1 ? columns[dateIndex]?.replace(/"/g, '').trim() : null

        if (!rawNip || !rawFullName) continue

        const matchedPosition = positions.find(
          (p) => p.name.trim().toLowerCase() === rawPositionName?.toLowerCase()
        )

        if (matchedPosition) {
          importedData.push({
            employee_code: rawNip,
            full_name: rawFullName,
            position_id: matchedPosition.id,
            category: rawCategory,
            hire_date: rawHireDate || null,
            is_active: true,
          })
        } else {
          if (rawPositionName) unmatchedNames.add(rawPositionName)
        }
      }

      if (importedData.length > 0) {
        const { error } = await supabase.from('employees').insert(importedData)
        
        if (error) {
          alert('Gagal menyimpan data ke database: ' + error.message)
        } else {
          let successMsg = `Sukses! ${importedData.length} data karyawan berhasil diimpor sekaligus. 🎉`
          if (unmatchedNames.size > 0) {
            successMsg += `\n\n⚠️ Catatan: Ada jabatan dilewati karena tidak terdaftar di DB: [${Array.from(unmatchedNames).join(', ')}]`
          }
          alert(successMsg)
          loadEmployees()
        }
      } else {
        alert('Tidak ada data cocok. Pastikan nama jabatan di Excel/CSV persis sama dengan tabel positions di Supabase.');
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  function formatDate(dateString) {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
  }

  return (
    <div className="p-2">
      {/* HEADER SECTION */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-black">Employees Master Data</h1>
        
        <div className="flex gap-2">
          <input 
            type="file" 
            accept=".csv" 
            ref={fileInputRef} 
            onChange={handleCSVImport} 
            className="hidden" 
          />
          <button 
            onClick={() => fileInputRef.current.click()}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition"
          >
            📥 Import Master CSV
          </button>
          <button 
            onClick={() => { if(showForm) resetForm(); else setShowForm(true); }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition"
          >
            {showForm ? '✖ Tutup Form' : '➕ Tambah Karyawan'}
          </button>
        </div>
      </div>

      {/* FORM SECTION */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white p-6 rounded-2xl shadow-md mb-8 border border-gray-100 space-y-4 max-w-2xl"
        >
          <h3 className="text-lg font-bold text-gray-700">
            {editingId ? 'Edit Data Karyawan' : 'Tambah Karyawan Baru'}
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <input
              name="nip"
              value={form.nip}
              onChange={handleChange}
              placeholder="NIP / Kode Karyawan"
              className="border p-2 rounded-xl w-full"
            />
            <input
              name="full_name"
              value={form.full_name}
              onChange={handleChange}
              placeholder="Nama Lengkap"
              className="border p-2 rounded-xl w-full"
            />
            <input
              type="date"
              name="hire_date"
              value={form.hire_date}
              onChange={handleChange}
              className="border p-2 rounded-xl w-full"
            />
            <select
              name="position_id"
              value={form.position_id}
              onChange={handleChange}
              className="border p-2 rounded-xl w-full"
            >
              <option value="">Pilih Jabatan</option>
              {positions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            <select
              name="category"
              value={form.category}
              onChange={handleChange}
              className="border p-2 rounded-xl w-full col-span-2"
            >
              <option value="">Pilih Kategori Karyawan</option>
              <option value="Guru Kelas">Guru Kelas</option>
              <option value="Guru Ummi">Guru Ummi</option>
              <option value="Karyawan">Karyawan</option>
            </select>

            {/* 4. INPUTAN BANK DAN NOMOR REKENING DI SINI! */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1 ml-1">Nama Bank</label>
              <input
                name="bank_name"
                value={form.bank_name}
                onChange={handleChange}
                placeholder="Contoh: BCA, BNI, BSI"
                className="border p-2 rounded-xl w-full uppercase"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1 ml-1">Nomor Rekening</label>
              <input
                name="account_number"
                value={form.account_number}
                onChange={handleChange}
                placeholder="Contoh: 04501122..."
                className="border p-2 rounded-xl w-full"
              />
            </div>
          </div>

          <div className="flex justify-between items-center pt-2 mt-4 border-t border-gray-100">
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer pt-3">
              <input
                type="checkbox"
                name="is_active"
                checked={form.is_active}
                onChange={handleChange}
                className="rounded"
              />
              Status Karyawan Aktif
            </label>

            <div className="flex gap-2 pt-3">
              <button 
                type="button" 
                onClick={resetForm} 
                className="bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-300"
              >
                Batal
              </button>
              <button className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700">
                Simpan
              </button>
            </div>
          </div>
        </form>
      )}

      {/* TABLE SECTION */}
      <div className="bg-white shadow-md rounded-2xl overflow-hidden border border-gray-100">
        {loading ? (
          <div className="p-10 text-center text-gray-500">Memuat data karyawan...</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 text-gray-600 uppercase text-xs font-semibold border-b border-gray-100">
              <tr>
                <th className="p-4">NIP</th>
                <th className="p-4">Nama Lengkap</th>
                <th className="p-4">Jabatan (Kategori)</th>
                <th className="p-4">Tanggal Masuk</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-center">Aksi</th>
              </tr>
            </thead>

            <tbody className="text-sm divide-y divide-gray-50">
              {employees.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-gray-400">Belum ada data karyawan. Silakan tambah atau import CSV.</td>
                </tr>
              ) : (
                employees.map((emp) => {
                  const positionName = Array.isArray(emp.positions)
                    ? emp.positions[0]?.name
                    : emp.positions?.name;

                  return (
                    <tr key={emp.id} className="hover:bg-gray-50/70 transition">
                      <td className="p-4 font-medium text-gray-700">
                        {emp.employee_code || '-'}
                      </td>
                      <td className="p-4 text-gray-900 font-semibold">{emp.full_name}</td>
                      <td className="p-4">
                        <div className="flex flex-col gap-1">
                          <span className="font-semibold text-gray-800">{positionName || '-'}</span>
                          <span className="text-xs text-gray-400 font-medium italic">({emp.category || 'Karyawan'})</span>
                        </div>
                      </td>
                      <td className="p-4 text-gray-600">{formatDate(emp.hire_date)}</td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${emp.is_active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                          {emp.is_active ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => handleEdit(emp)}
                            className="px-3 py-1 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg text-xs font-semibold transition"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(emp.id)}
                            className="px-3 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg text-xs font-semibold transition"
                          >
                            Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default Employees