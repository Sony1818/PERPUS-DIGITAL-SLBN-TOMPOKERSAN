/* =========================================================
   riwayat.js - Riwayat Peminjaman & Pengembalian
   ========================================================= */

let daftarRiwayatCache = [];

function initRiwayatPage() {
  ["filterNama", "filterKelas"].forEach(id =>
    document.getElementById(id).addEventListener("input", renderTabelRiwayat)
  );
  ["filterJenis", "filterStatus", "filterDariTanggal", "filterSampaiTanggal"].forEach(id =>
    document.getElementById(id).addEventListener("change", renderTabelRiwayat)
  );
  document.getElementById("btnResetFilter").addEventListener("click", resetFilterRiwayat);
  document.getElementById("btnExportExcel").addEventListener("click", exportRiwayatKeExcel);

  muatRiwayat();
}

function muatRiwayat() {
  transactionsRef.orderBy("borrowDate", "desc").onSnapshot((snap) => {
    daftarRiwayatCache = snap.docs.map(d => ({ docId: d.id, ...d.data() }));
    renderTabelRiwayat();
  }, (err) => showToast("Gagal memuat riwayat: " + err.message, "danger"));
}

function resetFilterRiwayat() {
  document.getElementById("filterNama").value = "";
  document.getElementById("filterJenis").value = "";
  document.getElementById("filterKelas").value = "";
  document.getElementById("filterStatus").value = "";
  document.getElementById("filterDariTanggal").value = "";
  document.getElementById("filterSampaiTanggal").value = "";
  renderTabelRiwayat();
}

function ambilDataTerfilter() {
  const nama = document.getElementById("filterNama").value.trim().toLowerCase();
  const jenis = document.getElementById("filterJenis").value;
  const kelas = document.getElementById("filterKelas").value.trim().toLowerCase();
  const status = document.getElementById("filterStatus").value;
  const dari = document.getElementById("filterDariTanggal").value ? new Date(document.getElementById("filterDariTanggal").value) : null;
  const sampai = document.getElementById("filterSampaiTanggal").value ? new Date(document.getElementById("filterSampaiTanggal").value) : null;
  if (sampai) sampai.setHours(23, 59, 59, 999);

  return daftarRiwayatCache.filter(t => {
    if (nama && !t.memberName.toLowerCase().includes(nama)) return false;
    if (jenis && t.memberJenis !== jenis) return false;
    if (kelas && !(t.memberKelas || "").toLowerCase().includes(kelas)) return false;
    if (status && t.status !== status) return false;
    if ((dari || sampai) && t.borrowDate && t.borrowDate.toDate) {
      const tgl = t.borrowDate.toDate();
      if (dari && tgl < dari) return false;
      if (sampai && tgl > sampai) return false;
    }
    return true;
  });
}

function renderTabelRiwayat() {
  const tbody = document.getElementById("tabelRiwayat");
  const empty = document.getElementById("emptyRiwayat");
  if (!tbody) return;

  const data = ambilDataTerfilter();
  document.getElementById("jumlahHasil").textContent = `${data.length} data ditemukan`;

  tbody.innerHTML = "";
  data.forEach(t => {
    tbody.innerHTML += `
      <tr>
        <td>${t.memberName}</td>
        <td><code>${t.memberId}</code></td>
        <td>${t.bookTitle}</td>
        <td><code>${t.bookId}</code></td>
        <td>${formatTanggal(t.borrowDate)}</td>
        <td>${t.returnDate ? formatTanggal(t.returnDate) : "-"}</td>
        <td>${badgeStatus(t.status)}</td>
      </tr>`;
  });

  empty.classList.toggle("d-none", data.length > 0);
  tbody.parentElement.parentElement.classList.toggle("d-none", data.length === 0);
}

function exportRiwayatKeExcel() {
  const data = ambilDataTerfilter().map(t => ({
    "Nama Anggota": t.memberName,
    "ID Anggota": t.memberId,
    "Jenis": t.memberJenis || "",
    "Kelas": t.memberKelas || "",
    "Judul Buku": t.bookTitle,
    "ID Buku": t.bookId,
    "Tanggal Pinjam": formatTanggal(t.borrowDate),
    "Tanggal Kembali": t.returnDate ? formatTanggal(t.returnDate) : "",
    "Status": t.status,
    "Keterlambatan (hari)": t.keterlambatanHari || 0
  }));

  if (data.length === 0) {
    showToast("Tidak ada data untuk diexport.", "warning");
    return;
  }

  exportToExcel(data, `riwayat-peminjaman-${new Date().toISOString().slice(0,10)}.xlsx`, "Riwayat");
  showToast("Export Excel berhasil.");
}
