import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export const generatePayslip = async (employee, month, year) => {
  const doc = new jsPDF();
  
  // 1. Load Logo dengan aman
  let imgData = null;
  try {
    const response = await fetch('/LOGO MI KRESNA MLILIR.png');
    if (response.ok) {
      const blob = await response.blob();
      imgData = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
    }
  } catch (e) {
    console.warn("Logo tidak ditemukan, lanjut tanpa logo.");
  }

  // ==========================================
  // KOTAK HEADER (HIJAU)
  // ==========================================
  doc.setLineWidth(0.5);
  doc.setFillColor(169, 208, 142); // Warna Hijau spesifik MI Kresna
  doc.rect(14, 10, 180, 25, 'FD'); 
  
  if (imgData) doc.addImage(imgData, 'PNG', 16, 12, 17, 21);
  
  doc.setTextColor(0);
  doc.setFont("helvetica", "bold"); 
  doc.setFontSize(11); 
  doc.text("YAYASAN IBAADURRAHMAN MLILIR", 104, 16, {align: 'center'});
  
  doc.setFontSize(13); 
  doc.text("MADRASAH IBTIDAIYAH \"KRESNA\"", 104, 21, {align: 'center'});
  
  doc.setFont("helvetica", "italic"); 
  doc.setFontSize(8.5); 
  doc.text("Terakreditasi \"A\", Berkualitas Unggul, Islami, dan Berbudaya Bersih", 104, 26, {align: 'center'});
  
  doc.setFont("helvetica", "normal"); 
  doc.setFontSize(8); 
  doc.text("Jl. Raya Ponorogo, Mlilir, Dolopo, Madiun. Telp./Fax. (0351) 368513 E-mail: mi.kresna@gmail.com", 104, 30.5, {align: 'center'});


  // ==========================================
  // ISI TABEL
  // ==========================================
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"];
  const periodStr = `${monthNames[month - 1]}-${year.toString().slice(-2)}`;

  // Fungsi helper agar angka 0 menjadi strip "-"
  const formatRp = (num) => {
    if (!num || Number(num) === 0) return "-";
    return Number(num).toLocaleString('id-ID');
  };

  const rows = [
    [{ content: periodStr, colSpan: 4, styles: { halign: 'center', fillColor: [169, 208, 142], fontStyle: 'bold' } }],
    [{ content: employee.full_name, colSpan: 4, styles: { halign: 'center', fillColor: [169, 208, 142], fontStyle: 'bold' } }],
    
    // PENERIMAAN
    [{ content: "Penerimaan :", colSpan: 4, styles: { fontStyle: 'bold' } }],
    ["    Gaji Pokok", "", "Rp", { content: formatRp(employee.gaji_pokok), styles: { halign: 'right' } }],
    ["    Tunj. Jabatan", "", "Rp", { content: formatRp(employee.tunj_jabatan), styles: { halign: 'right' } }],
    ["    Tunj. Jampel", "", "Rp", { content: formatRp(employee.teachingAllowance), styles: { halign: 'right' } }],
    ["    Tunj. Apre", "", "Rp", { content: "-", styles: { halign: 'right' } }],
    ["    Transport", employee.transportAllowance ? `Rp 10.000` : "", "Rp", { content: formatRp(employee.transportAllowance), styles: { halign: 'right' } }],
    ["    Ekstra", employee.tunj_ekstra ? `Rp 25.000` : "", "Rp", { content: formatRp(employee.tunj_ekstra), styles: { halign: 'right' } }],
    ["    TA", "", "Rp", { content: formatRp(employee.tunj_ta), styles: { halign: 'right' } }],
    ["    Admin Bank", "", "Rp", { content: formatRp(employee.admin_bank), styles: { halign: 'right' } }],
    
    // POTONGAN
    [{ content: "Potongan :", colSpan: 4, styles: { fontStyle: 'bold' } }],
    ["    Bpjs Ketenagakerjaan", "", "Rp", { content: formatRp(employee.bpjs_kerja), styles: { halign: 'right' } }],
    ["    Bpjs Kesehatan", "", "Rp", { content: formatRp(employee.bpjs_kesehatan), styles: { halign: 'right' } }],
    ["    Lain-Lain", "", "Rp", { content: formatRp((employee.potongan_lain || 0) + (employee.kasbon || 0)), styles: { halign: 'right' } }],
    
    // TOTAL THP
    [{ content: "Total Penerimaan", colSpan: 2, styles: { fontStyle: 'bold' } }, { content: "Rp", styles: { fontStyle: 'bold' } }, { content: formatRp(employee.netSalary), styles: { fontStyle: 'bold', halign: 'right' } }]
  ];

  autoTable(doc, {
    startY: 35, // Nempel dengan header box
    body: rows,
    theme: 'grid',
    styles: {
      lineColor: [0, 0, 0],
      lineWidth: 0.5,
      textColor: [0, 0, 0],
      fontSize: 10,
      cellPadding: 1.5
    },
    columnStyles: {
      0: { cellWidth: 75 },
      1: { cellWidth: 30, halign: 'center' }, // Kolom satuan (Rp 10.000)
      2: { cellWidth: 15 }, // Kolom "Rp"
      3: { cellWidth: 60 }  // Kolom Angka (1.250.000)
    },
    margin: { left: 14, right: 16 }
  });

  // ==========================================
  // KOTAK TANDA TANGAN DI BAWAH
  // ==========================================
  const finalY = doc.lastAutoTable.finalY;
  
  const footerRows = [
    [
      { content: "Bag. Keuangan\n\n\n\n\nDena Aryani, SE", styles: { halign: 'center', fillColor: [169, 208, 142], valign: 'top', minCellHeight: 25 } },
      { content: "Penerima\n\n\n\n\n" + employee.full_name, styles: { halign: 'center', fillColor: [169, 208, 142], valign: 'top', minCellHeight: 25 } }
    ]
  ];

  autoTable(doc, {
    startY: finalY,
    body: footerRows,
    theme: 'grid',
    styles: {
      lineColor: [0, 0, 0],
      lineWidth: 0.5,
      textColor: [0, 0, 0],
      fontSize: 10,
    },
    columnStyles: {
      0: { cellWidth: 105 }, // Kotak Bagian Keuangan
      1: { cellWidth: 75 }   // Kotak Penerima
    },
    margin: { left: 14, right: 16 }
  });

  return doc.output('blob');
};