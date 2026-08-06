/* =========================================================
   buku.js - Manajemen Data Buku (dengan stok/jumlah eksemplar)
   ========================================================= */

let daftarBukuCache = [];
let sortFieldBuku = "judul";
let sortDirBuku = "asc";

function initBukuPage() {
  document.getElementById("btnTambahBuku").addEventListener("click", () => {
    document.getElementById("formBuku").reset();
    document.getElementById("bukuDocId").value = "";
    document.getElementById("bukuJumlah").value = 1;
    document.getElementById("bantuanJumlahBuku").textContent =
      "Total eksemplar fisik untuk judul ini. Satu QR ini dipakai bersama untuk semua eksemplarnya.";
    document.getElementById("modalBukuTitle").textContent = "Tambah Buku";
  });

  document.getElementById("formBuku").addEventListener("submit", simpanBuku);
  document.getElementById("searchBuku").addEventListener("input", () => renderTabelBuku());
  document.getElementById("filterStatusBuku").addEventListener("change", () => renderTabelBuku());
  document.getElementById("btnCetakSemuaLabel").addEventListener("click", cetakSemuaLabel);
  document.getElementById("btnUnduhSemuaLabel").addEventListener("click", unduhSemuaLabel);

  muatDaftarBuku();
  perbaruiIkonSortBuku();
}

function aturSortBuku(field) {
  if (sortFieldBuku === field) {
    sortDirBuku = sortDirBuku === "asc" ? "desc" : "asc";
  } else {
    sortFieldBuku = field;
    sortDirBuku = "asc";
  }
  perbaruiIkonSortBuku();
  renderTabelBuku();
}

function perbaruiIkonSortBuku() {
  ["id", "judul", "penulis", "kategori", "tersedia"].forEach(f => {
    const icon = document.getElementById("sortIconBuku-" + f);
    if (!icon) return;
    if (f === sortFieldBuku) {
      icon.className = "bi " + (sortDirBuku === "asc" ? "bi-caret-up-fill" : "bi-caret-down-fill");
    } else {
      icon.className = "bi bi-caret-down";
      icon.style.opacity = "0.25";
    }
  });
}

/* ---------- Helper stok (kompatibel dengan data lama yang belum punya field jumlah/tersedia) ---------- */
function ambilJumlahBuku(b) {
  return typeof b.jumlah === "number" ? b.jumlah : 1;
}
function ambilTersediaBuku(b) {
  if (typeof b.tersedia === "number") return b.tersedia;
  // Data lama: pakai field status sebagai fallback
  return b.status === "Dipinjam" ? 0 : 1;
}

function muatDaftarBuku() {
  booksRef.orderBy("judul").onSnapshot((snap) => {
    daftarBukuCache = snap.docs.map(d => ({ docId: d.id, ...d.data() }));
    renderTabelBuku();
  }, (err) => showToast("Gagal memuat buku: " + err.message, "danger"));
}

function renderTabelBuku() {
  const tbody = document.getElementById("tabelBuku");
  const empty = document.getElementById("emptyBuku");
  if (!tbody) return;

  const kw = (document.getElementById("searchBuku").value || "").trim().toLowerCase();
  const filterStatus = document.getElementById("filterStatusBuku").value;

  const data = daftarBukuCache.filter(b => {
    const cocokKw = !kw || b.judul.toLowerCase().includes(kw) || b.id.toLowerCase().includes(kw);
    const tersedia = ambilTersediaBuku(b);
    const cocokStatus = !filterStatus
      || (filterStatus === "Tersedia" && tersedia > 0)
      || (filterStatus === "Habis" && tersedia <= 0);
    return cocokKw && cocokStatus;
  });

  data.sort((a, b) => {
    let va, vb;
    if (sortFieldBuku === "tersedia") {
      va = ambilTersediaBuku(a);
      vb = ambilTersediaBuku(b);
      return sortDirBuku === "asc" ? va - vb : vb - va;
    }
    va = (a[sortFieldBuku] || "").toString().toLowerCase();
    vb = (b[sortFieldBuku] || "").toString().toLowerCase();
    const hasil = va.localeCompare(vb, "id", { numeric: true });
    return sortDirBuku === "asc" ? hasil : -hasil;
  });

  tbody.innerHTML = "";
  data.forEach((b, index) => {
    const jumlah = ambilJumlahBuku(b);
    const tersedia = ambilTersediaBuku(b);
    const badgeClass = tersedia > 0 ? "badge-status-tersedia" : "badge-status-dipinjam";
    const stokLabel = tersedia > 0 ? `${tersedia} / ${jumlah} tersedia` : `0 / ${jumlah} (semua dipinjam)`;

    tbody.innerHTML += `
      <tr>
        <td>${index + 1}</td>
        <td><code>${b.id}</code></td>
        <td>${b.judul}</td>
        <td>${b.penulis || "-"}</td>
        <td>${b.kategori || "-"}</td>
        <td><span class="badge ${badgeClass}">${stokLabel}</span></td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-secondary" onclick="lihatLabelBuku('${b.docId}')" title="Lihat QR"><i class="bi bi-qr-code"></i></button>
          <button class="btn btn-sm btn-outline-primary" onclick="editBuku('${b.docId}')" title="Edit"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-sm btn-outline-danger" onclick="hapusBuku('${b.docId}')" title="Hapus"><i class="bi bi-trash"></i></button>
        </td>
      </tr>`;
  });

  empty.classList.toggle("d-none", data.length > 0);
  tbody.parentElement.parentElement.classList.toggle("d-none", data.length === 0);
}

async function simpanBuku(e) {
  e.preventDefault();
  const docId = document.getElementById("bukuDocId").value;
  const id = document.getElementById("bukuId").value.trim();
  const judul = document.getElementById("bukuJudul").value.trim();
  const penulis = document.getElementById("bukuPenulis").value.trim();
  const penerbit = document.getElementById("bukuPenerbit").value.trim();
  const kategori = document.getElementById("bukuKategori").value.trim();
  const jumlahBaru = parseInt(document.getElementById("bukuJumlah").value, 10);

  if (!jumlahBaru || jumlahBaru < 1) {
    showToast("Jumlah buku minimal 1.", "danger");
    return;
  }

  try {
    if (docId) {
      const bLama = daftarBukuCache.find(x => x.docId === docId);
      const jumlahLama = ambilJumlahBuku(bLama);
      const tersediaLama = ambilTersediaBuku(bLama);
      const sedangDipinjam = jumlahLama - tersediaLama; // eksemplar yg lagi di luar

      if (jumlahBaru < sedangDipinjam) {
        showToast(`Tidak bisa mengubah jumlah jadi ${jumlahBaru} — masih ada ${sedangDipinjam} eksemplar yang sedang dipinjam.`, "danger");
        return;
      }

      const tersediaBaru = jumlahBaru - sedangDipinjam;
      const statusBaru = tersediaBaru > 0 ? "Tersedia" : "Dipinjam";

      await booksRef.doc(docId).update({
        id, judul, penulis, penerbit, kategori,
        jumlah: jumlahBaru, tersedia: tersediaBaru, status: statusBaru
      });
      showToast("Data buku berhasil diperbarui.");
    } else {
      const dup = await booksRef.where("id", "==", id).get();
      if (!dup.empty) {
        showToast("ID Buku sudah digunakan.", "danger");
        return;
      }
      await booksRef.add({
        id, judul, penulis, penerbit, kategori,
        jumlah: jumlahBaru, tersedia: jumlahBaru, status: "Tersedia"
      });
      showToast("Buku baru berhasil ditambahkan.");
    }
    bootstrap.Modal.getInstance(document.getElementById("modalBuku")).hide();
  } catch (err) {
    showToast("Gagal menyimpan: " + err.message, "danger");
  }
}

function editBuku(docId) {
  const b = daftarBukuCache.find(x => x.docId === docId);
  if (!b) return;
  const jumlah = ambilJumlahBuku(b);
  const tersedia = ambilTersediaBuku(b);
  const sedangDipinjam = jumlah - tersedia;

  document.getElementById("bukuDocId").value = b.docId;
  document.getElementById("bukuId").value = b.id;
  document.getElementById("bukuJudul").value = b.judul;
  document.getElementById("bukuPenulis").value = b.penulis || "";
  document.getElementById("bukuPenerbit").value = b.penerbit || "";
  document.getElementById("bukuKategori").value = b.kategori || "";
  document.getElementById("bukuJumlah").value = jumlah;
  document.getElementById("bantuanJumlahBuku").textContent = sedangDipinjam > 0
    ? `Saat ini ${sedangDipinjam} eksemplar sedang dipinjam — jumlah tidak bisa diubah menjadi kurang dari ${sedangDipinjam}.`
    : "Total eksemplar fisik untuk judul ini. Satu QR ini dipakai bersama untuk semua eksemplarnya.";
  document.getElementById("modalBukuTitle").textContent = "Edit Buku";
  new bootstrap.Modal(document.getElementById("modalBuku")).show();
}

async function hapusBuku(docId) {
  const b = daftarBukuCache.find(x => x.docId === docId);
  if (b) {
    const jumlah = ambilJumlahBuku(b);
    const tersedia = ambilTersediaBuku(b);
    if (tersedia < jumlah) {
      showToast("Masih ada eksemplar yang sedang dipinjam, tidak bisa dihapus.", "warning");
      return;
    }
  }
  if (!confirm("Yakin ingin menghapus buku ini beserta seluruh datanya?")) return;
  try {
    await booksRef.doc(docId).delete();
    showToast("Buku berhasil dihapus.");
  } catch (err) {
    showToast("Gagal menghapus: " + err.message, "danger");
  }
}

/* ---------- QR Code & Cetak Label ---------- */

function buatElemenQR(teks, ukuran = 120) {
  const wrap = document.createElement("div");
  new QRCode(wrap, { text: teks, width: ukuran, height: ukuran, correctLevel: QRCode.CorrectLevel.M });
  return wrap;
}

function lihatLabelBuku(docId) {
  const b = daftarBukuCache.find(x => x.docId === docId);
  if (!b) return;

  const preview = document.getElementById("labelPreview");
  preview.innerHTML = "";
  preview.appendChild(buatLabelElemen(b));

  document.getElementById("btnCetakLabelTunggal").onclick = () => {
    const area = document.getElementById("printArea");
    area.innerHTML = "";
    area.appendChild(buatLabelElemen(b));
    window.print();
  };

  document.getElementById("btnUnduhLabelPng").onclick = () => {
    unduhElemenSebagaiGambar(preview, `label-buku-${b.id}.png`, "png");
  };
  document.getElementById("btnUnduhLabelJpg").onclick = () => {
    unduhElemenSebagaiGambar(preview, `label-buku-${b.id}.jpg`, "jpg");
  };

  new bootstrap.Modal(document.getElementById("modalLabel")).show();
}

function buatLabelElemen(b) {
  const jumlah = ambilJumlahBuku(b);
  const label = document.createElement("div");
  label.className = "label-book";
  label.innerHTML = `<div style="font-size:.65rem;opacity:.75;">SLBN TOMPOKERSAN LUMAJANG</div><strong>${b.judul}</strong><br><span style="font-size:.68rem;opacity:.8;">${jumlah} eksemplar</span><br>`;
  label.appendChild(buatElemenQR(b.id, 100));
  const idText = document.createElement("div");
  idText.textContent = "ID: " + b.id;
  idText.className = "mt-1";
  label.appendChild(idText);
  return label;
}

function cetakSemuaLabel() {
  if (daftarBukuCache.length === 0) {
    showToast("Belum ada data buku untuk dicetak.", "warning");
    return;
  }
  const area = document.getElementById("printArea");
  area.innerHTML = "";
  area.style.display = "flex";
  area.style.flexWrap = "wrap";
  area.style.gap = "10px";
  daftarBukuCache.forEach(b => area.appendChild(buatLabelElemen(b)));
  window.print();
}

async function unduhSemuaLabel() {
  if (daftarBukuCache.length === 0) {
    showToast("Belum ada data buku untuk diunduh.", "warning");
    return;
  }
  const area = document.getElementById("printArea");
  area.innerHTML = "";
  area.style.display = "flex";
  area.style.flexWrap = "wrap";
  area.style.gap = "10px";
  daftarBukuCache.forEach(b => area.appendChild(buatLabelElemen(b)));

  showToast("Menyiapkan gambar, mohon tunggu...", "info");
  await unduhElemenSebagaiGambar(area, "semua-label-buku.png", "png");
}
