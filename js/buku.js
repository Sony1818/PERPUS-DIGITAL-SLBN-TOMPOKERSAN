/* =========================================================
   buku.js - Manajemen Data Buku
   ========================================================= */

let daftarBukuCache = [];

function initBukuPage() {
  document.getElementById("btnTambahBuku").addEventListener("click", () => {
    document.getElementById("formBuku").reset();
    document.getElementById("bukuDocId").value = "";
    document.getElementById("modalBukuTitle").textContent = "Tambah Buku";
  });

  document.getElementById("formBuku").addEventListener("submit", simpanBuku);
  document.getElementById("searchBuku").addEventListener("input", () => renderTabelBuku());
  document.getElementById("filterStatusBuku").addEventListener("change", () => renderTabelBuku());
  document.getElementById("btnCetakSemuaLabel").addEventListener("click", cetakSemuaLabel);

  muatDaftarBuku();
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
    const cocokStatus = !filterStatus || b.status === filterStatus;
    return cocokKw && cocokStatus;
  });

  tbody.innerHTML = "";
  data.forEach(b => {
    tbody.innerHTML += `
      <tr>
        <td><code>${b.id}</code></td>
        <td>${b.judul}</td>
        <td>${b.penulis || "-"}</td>
        <td>${b.kategori || "-"}</td>
        <td>${badgeStatus(b.status)}</td>
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

  try {
    if (docId) {
      await booksRef.doc(docId).update({ id, judul, penulis, penerbit, kategori });
      showToast("Data buku berhasil diperbarui.");
    } else {
      const dup = await booksRef.where("id", "==", id).get();
      if (!dup.empty) {
        showToast("ID Buku sudah digunakan.", "danger");
        return;
      }
      await booksRef.add({ id, judul, penulis, penerbit, kategori, status: "Tersedia" });
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
  document.getElementById("bukuDocId").value = b.docId;
  document.getElementById("bukuId").value = b.id;
  document.getElementById("bukuJudul").value = b.judul;
  document.getElementById("bukuPenulis").value = b.penulis || "";
  document.getElementById("bukuPenerbit").value = b.penerbit || "";
  document.getElementById("bukuKategori").value = b.kategori || "";
  document.getElementById("modalBukuTitle").textContent = "Edit Buku";
  new bootstrap.Modal(document.getElementById("modalBuku")).show();
}

async function hapusBuku(docId) {
  const b = daftarBukuCache.find(x => x.docId === docId);
  if (b && b.status === "Dipinjam") {
    showToast("Buku sedang dipinjam dan tidak bisa dihapus.", "warning");
    return;
  }
  if (!confirm("Yakin ingin menghapus buku ini?")) return;
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

  new bootstrap.Modal(document.getElementById("modalLabel")).show();
}

function buatLabelElemen(b) {
  const label = document.createElement("div");
  label.className = "label-book";
  label.innerHTML = `<div style="font-size:.65rem;opacity:.75;">SLBN TOMPOKERSAN LUMAJANG</div><strong>${b.judul}</strong><br>`;
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
