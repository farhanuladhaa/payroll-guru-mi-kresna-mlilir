import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'

function SalaryRules() {
  const [rules, setRules] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const fileInputRef = useRef(null)

  const [form, setForm] = useState({
    category: '',
    min_year: '',
    max_year: '',
    salary_component: 'hourly_rate',
    base_amount: '',
    increase_percent: '0',
    final_amount: '',
    notes: '',
  })

  const [editingId, setEditingId] = useState(null)

  useEffect(() => {
    loadRules()
  }, [])

  async function loadRules() {
    setLoading(true)
    const { data } = await supabase
      .from('salary_rules')
      .select('*')
      .order('category')
      .order('min_year')

    setRules(data || [])
    setLoading(false)
  }

  function handleChange(e) {
    const { name, value } = e.target
    
    // Otomatis hitung final_amount jika base_amount atau increase_percent berubah
    setForm((prev) => {
      const updated = { ...prev, [name]: value }
      if (name === 'base_amount' || name === 'increase_percent') {
        const base = parseFloat(updated.base_amount) || 0
        const percent = parseFloat(updated.increase_percent) || 0
        updated.final_amount = Math.round(base + (base * percent))
      }
      return updated
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()

    if (!form.category || form.min_year === '' || form.max_year === '' || !form.base_amount) {
      alert('Kategori, Range Tahun, dan Nominal Dasar wajib diisi!')
      return
    }

    const ruleData = {
      category: form.category,
      min_year: parseInt(form.min_year),
      max_year: parseInt(form.max_year),
      salary_component: form.salary_component,
      base_amount: parseFloat(form.base_amount),
      increase_percent: parseFloat(form.increase_percent),
      final_amount: parseFloat(form.final_amount || form.base_amount),
      notes: form.notes,
    }

    if (editingId) {
      const { error } = await supabase.from('salary_rules').update(ruleData).eq('id', editingId)
      if (error) alert('Gagal update rule: ' + error.message)
    } else {
      const { error } = await supabase.from('salary_rules').insert([ruleData])
      if (error) alert('Gagal menambah rule: ' + error.message)
    }

    resetForm()
    loadRules()
  }

  function resetForm() {
    setForm({
      category: '',
      min_year: '',
      max_year: '',
      salary_component: 'hourly_rate',
      base_amount: '',
      increase_percent: '0',
      final_amount: '',
      notes: '',
    })
    setEditingId(null)
    setShowForm(false)
  }

  async function handleDelete(id) {
    if (confirm('Apakah Anda yakin ingin menghapus aturan gaji ini?')) {
      await supabase.from('salary_rules').delete().eq('id', id)
      loadRules()
    }
  }

  function handleEdit(rule) {
    setForm({
      category: rule.category || '',
      min_year: rule.min_year?.toString() || '0',
      max_year: rule.max_year?.toString() || '0',
      salary_component: rule.salary_component || 'hourly_rate',
      base_amount: rule.base_amount?.toString() || '',
      increase_percent: rule.increase_percent?.toString() || '0',
      final_amount: rule.final_amount?.toString() || '',
      notes: rule.notes || '',
    })
    setEditingId(rule.id)
    setShowForm(true)
  }

  // 🚀 FITUR BULK IMPORT ATURAN GAJI DARI CSV TEMPLATE
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

      const importedData = []

      for (let i = 1; i < lines.length; i++) {
        if (!lines[i]) continue
        const columns = lines[i].split(regexSplit)

        // Mapping index pas dengan file salary_rules.csv kamu
        const category = columns[0]?.replace(/"/g, '').trim()
        const minYear = columns[1]?.replace(/"/g, '').trim()
        const maxYear = columns[2]?.replace(/"/g, '').trim()
        const component = columns[3]?.replace(/"/g, '').trim()
        const baseAmount = columns[4]?.replace(/"/g, '').trim()
        const incPercent = columns[5]?.replace(/"/g, '').trim()
        const finAmount = columns[6]?.replace(/"/g, '').trim()
        const notes = columns[7]?.replace(/"/g, '').trim()

        if (category && minYear && maxYear) {
          importedData.push({
            category,
            min_year: parseInt(minYear) || 0,
            max_year: parseInt(maxYear) || 0,
            salary_component: component || 'hourly_rate',
            base_amount: parseFloat(baseAmount) || 0,
            increase_percent: parseFloat(incPercent) || 0,
            final_amount: parseFloat(finAmount) || parseFloat(baseAmount) || 0,
            notes: notes || '',
          })
        }
      }

      if (importedData.length > 0) {
        // Kosongkan yang lama dulu biar fresh tidak menumpuk double
        await supabase.from('salary_rules').delete().neq('id', '00000000-0000-0000-0000-000000000000')
        
        const { error } = await supabase.from('salary_rules').insert(importedData)
        if (error) {
          alert('Gagal menyimpan aturan ke DB: ' + error.message)
        } else {
          alert(`Sukses! ${importedData.length} aturan kenaikan gaji berhasil diterapkan. 🚀`)
          loadRules()
        }
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  function formatRupiah(num) {
    return 'Rp' + (parseFloat(num) || 0).toLocaleString('id-ID')
  }

  return (
    <div className="p-2">
      {/* HEADER BAR */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-black">Salary Configuration Rules</h1>
        
        <div className="flex gap-2">
          <input type="file" accept=".csv" ref={fileInputRef} onChange={handleCSVImport} className="hidden" />
          <button 
            onClick={() => fileInputRef.current.click()}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition"
          >
            📥 Import Rules CSV
          </button>
          <button 
            onClick={() => { if(showForm) resetForm(); else setShowForm(true); }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition"
          >
            {showForm ? '✖ Tutup Form' : '➕ Tambah Aturan'}
          </button>
        </div>
      </div>

      {/* DYNAMIC TOGGLE FORM */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-2xl shadow-md mb-8 border border-gray-100 space-y-4 max-w-2xl">
          <h3 className="text-lg font-bold text-gray-700">{editingId ? 'Edit Aturan Gaji' : 'Tambah Aturan Gaji Baru'}</h3>
          
          <div className="grid grid-cols-2 gap-4">
            <select name="category" value={form.category} onChange={handleChange} className="border p-2 rounded-xl w-full">
              <option value="">Pilih Kategori</option>
              <option value="Guru Kelas">Guru Kelas</option>
              <option value="Guru Ummi">Guru Ummi</option>
              <option value="Karyawan">Karyawan</option>
            </select>

            <select name="salary_component" value={form.salary_component} onChange={handleChange} className="border p-2 rounded-xl w-full">
              <option value="hourly_rate">Tarif Jampel (Hourly)</option>
              <option value="fixed_salary">Gaji Pokok Tetap</option>
            </select>

            <input type="number" name="min_year" value={form.min_year} onChange={handleChange} placeholder="Masa Kerja Min (Tahun)" className="border p-2 rounded-xl w-full" />
            <input type="number" name="max_year" value={form.max_year} onChange={handleChange} placeholder="Masa Kerja Max (Tahun)" className="border p-2 rounded-xl w-full" />
            <input type="number" name="base_amount" value={form.base_amount} onChange={handleChange} placeholder="Tarif Dasar (Rp)" className="border p-2 rounded-xl w-full" />
            <input type="number" step="0.01" name="increase_percent" value={form.increase_percent} onChange={handleChange} placeholder="Persentase Kenaikan (contoh: 0.05)" className="border p-2 rounded-xl w-full" />
            
            <div className="col-span-2 bg-gray-50 p-3 rounded-xl border font-semibold text-sm text-gray-600">
              Estimasi Tarif Akhir Sistem: <span className="text-blue-600 ml-1">{formatRupiah(form.final_amount || form.base_amount)}</span>
            </div>

            <input name="notes" value={form.notes} onChange={handleChange} placeholder="Catatan Tambahan" className="border p-2 rounded-xl w-full col-span-2" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={resetForm} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium">Batal</button>
            <button className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700">Simpan Aturan</button>
          </div>
        </form>
      )}

      {/* DATA TABLE */}
      <div className="bg-white shadow-md rounded-2xl overflow-hidden border border-gray-100">
        {loading ? (
          <div className="p-10 text-center text-gray-500">Memuat konfigurasi aturan gaji...</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 text-gray-600 uppercase text-xs font-semibold border-b border-gray-100">
              <tr>
                <th className="p-4">Kategori Karyawan</th>
                <th className="p-4 text-center">Masa Bakti (Range)</th>
                <th className="p-4">Komponen</th>
                <th className="p-4">Tarif Dasar</th>
                <th className="p-4 text-center">Kenaikan</th>
                <th className="p-4 font-bold text-blue-600">Tarif Akhir</th>
                <th className="p-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-gray-50">
              {rules.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-gray-400">Belum ada aturan gaji. Silakan klik "Import Rules CSV" untuk memuat template awal.</td>
                </tr>
              ) : (
                rules.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50/70 transition">
                    <td className="p-4 font-bold text-gray-900">{r.category}</td>
                    <td className="p-4 text-center text-gray-600 font-medium">
                      <span className="bg-gray-100 px-2.5 py-1 rounded-md text-xs">
                        {r.min_year} - {r.max_year} Tahun
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${r.salary_component === 'hourly_rate' ? 'bg-amber-50 text-amber-700' : 'bg-purple-50 text-purple-700'}`}>
                        {r.salary_component === 'hourly_rate' ? 'Per Jampel' : 'Gaji Pokok'}
                      </span>
                    </td>
                    <td className="p-4 text-gray-500">{formatRupiah(r.base_amount)}</td>
                    <td className="p-4 text-center font-medium text-emerald-600">+{r.increase_percent * 100}%</td>
                    <td className="p-4 font-bold text-blue-600 bg-blue-50/30">{formatRupiah(r.final_amount)}</td>
                    <td className="p-4 text-center">
                      <div className="flex justify-center gap-2">
                        <button onClick={() => handleEdit(r)} className="px-3 py-1 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg text-xs font-semibold transition">Edit</button>
                        <button onClick={() => handleDelete(r.id)} className="px-3 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-lg text-xs font-semibold transition">Hapus</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default SalaryRules