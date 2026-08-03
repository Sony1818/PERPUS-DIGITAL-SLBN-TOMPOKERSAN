/* =========================================================
   anggota.js - Manajemen Data Anggota (Guru & Siswa)
   ========================================================= */

let daftarAnggotaCache = [];

function initAnggotaPage() {
  document.getElementById("anggotaJenis").addEventListener("change", toggleKelasField);
  toggleKelasField();

  document.getElementById("btnTambahAnggota").addEventListener("click", () => {
    document.getElementById("formAnggota").reset();
    document.getElementById("anggotaDocId").value = "";
    document.getElementById("modalAnggotaTitle").textContent = "Tambah Anggota";
    toggleKelasField();
  });

  document.getElementById("formAnggota").addEventListener("submit", simpanAnggota);
  document.getElementById("searchAnggota").addEventListener("input", (e) => renderTabelAnggota(e.target.value));
  document.getElementById("btnCetakSemuaKartu").addEventListener("click", cetakSemuaKartu);
  document.getElementById("btnUnduhSemuaKartu").addEventListener("click", unduhSemuaKartu);

  muatDaftarAnggota();
}

function toggleKelasField() {
  const jenis = document.getElementById("anggotaJenis").value;
  document.getElementById("wrapperKelas").style.display = jenis === "Siswa" ? "block" : "none";
}

function muatDaftarAnggota() {
  membersRef.orderBy("nama").onSnapshot((snap) => {
    daftarAnggotaCache = snap.docs.map(d => ({ docId: d.id, ...d.data() }));
    renderTabelAnggota(document.getElementById("searchAnggota")?.value || "");
  }, (err) => showToast("Gagal memuat anggota: " + err.message, "danger"));
}

function renderTabelAnggota(keyword = "") {
  const tbody = document.getElementById("tabelAnggota");
  const empty = document.getElementById("emptyAnggota");
  if (!tbody) return;

  const kw = keyword.trim().toLowerCase();
  const data = daftarAnggotaCache.filter(a =>
    !kw || a.nama.toLowerCase().includes(kw) || a.id.toLowerCase().includes(kw)
  );

  tbody.innerHTML = "";
  data.forEach(a => {
    tbody.innerHTML += `
      <tr>
        <td><code>${a.id}</code></td>
        <td>${a.nama}</td>
        <td><span class="badge ${a.jenis === "Guru" ? "bg-primary" : "bg-secondary"}">${a.jenis}</span></td>
        <td>${a.kelas || "-"}</td>
        <td class="text-end">
          <button class="btn btn-sm btn-outline-secondary" onclick="lihatKartuAnggota('${a.docId}')" title="Lihat Kartu"><i class="bi bi-qr-code"></i></button>
          <button class="btn btn-sm btn-outline-primary" onclick="editAnggota('${a.docId}')" title="Edit"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-sm btn-outline-danger" onclick="hapusAnggota('${a.docId}')" title="Hapus"><i class="bi bi-trash"></i></button>
        </td>
      </tr>`;
  });

  empty.classList.toggle("d-none", data.length > 0);
  tbody.parentElement.parentElement.classList.toggle("d-none", data.length === 0);
}

async function simpanAnggota(e) {
  e.preventDefault();
  const docId = document.getElementById("anggotaDocId").value;
  const id = document.getElementById("anggotaId").value.trim();
  const nama = document.getElementById("anggotaNama").value.trim();
  const jenis = document.getElementById("anggotaJenis").value;
  const kelas = document.getElementById("anggotaKelas").value.trim();

  const data = { id, nama, jenis, kelas: jenis === "Siswa" ? kelas : "", qrCode: id };

  try {
    if (docId) {
      await membersRef.doc(docId).update(data);
      showToast("Data anggota berhasil diperbarui.");
    } else {
      // cek duplikasi ID anggota
      const dup = await membersRef.where("id", "==", id).get();
      if (!dup.empty) {
        showToast("ID Anggota sudah digunakan.", "danger");
        return;
      }
      await membersRef.add(data);
      showToast("Anggota baru berhasil ditambahkan.");
    }
    bootstrap.Modal.getInstance(document.getElementById("modalAnggota")).hide();
  } catch (err) {
    showToast("Gagal menyimpan: " + err.message, "danger");
  }
}

function editAnggota(docId) {
  const a = daftarAnggotaCache.find(x => x.docId === docId);
  if (!a) return;
  document.getElementById("anggotaDocId").value = a.docId;
  document.getElementById("anggotaId").value = a.id;
  document.getElementById("anggotaNama").value = a.nama;
  document.getElementById("anggotaJenis").value = a.jenis;
  document.getElementById("anggotaKelas").value = a.kelas || "";
  document.getElementById("modalAnggotaTitle").textContent = "Edit Anggota";
  toggleKelasField();
  new bootstrap.Modal(document.getElementById("modalAnggota")).show();
}

async function hapusAnggota(docId) {
  if (!confirm("Yakin ingin menghapus anggota ini? Riwayat peminjaman tidak akan terhapus.")) return;
  try {
    await membersRef.doc(docId).delete();
    showToast("Anggota berhasil dihapus.");
  } catch (err) {
    showToast("Gagal menghapus: " + err.message, "danger");
  }
}

/* ---------- QR Code & Cetak Kartu ---------- */

function buatElemenQR(teks, ukuran = 120) {
  const wrap = document.createElement("div");
  new QRCode(wrap, { text: teks, width: ukuran, height: ukuran, correctLevel: QRCode.CorrectLevel.M });
  return wrap;
}

function lihatKartuAnggota(docId) {
  const a = daftarAnggotaCache.find(x => x.docId === docId);
  if (!a) return;

  const preview = document.getElementById("kartuPreview");
  preview.innerHTML = "";
  preview.appendChild(buatKartuElemen(a));

  document.getElementById("btnCetakKartuTunggal").onclick = () => {
    const area = document.getElementById("printArea");
    area.innerHTML = "";
    area.appendChild(buatKartuElemen(a));
    window.print();
  };

  document.getElementById("btnUnduhKartuPng").onclick = () => {
    unduhElemenSebagaiGambar(preview, `kartu-anggota-${a.id}.png`, "png");
  };
  document.getElementById("btnUnduhKartuJpg").onclick = () => {
    unduhElemenSebagaiGambar(preview, `kartu-anggota-${a.id}.jpg`, "jpg");
  };

  new bootstrap.Modal(document.getElementById("modalKartu")).show();
}

function buatKartuElemen(a) {
  const card = document.createElement("div");
  card.className = "print-card";
  const qrBox = document.createElement("div");
  qrBox.className = "qr-box";
  qrBox.appendChild(buatElemenQR(a.id, 90));

  card.innerHTML = `
    <div class="info">
      <span style="font-size:.68rem;opacity:.85;">SLB NEGERI TOMPOKERSAN LUMAJANG</span>
      <span>KARTU ANGGOTA PERPUSTAKAAN</span>
      <strong>${a.nama}</strong>
      <span>${a.jenis}${a.kelas ? " • Kelas " + a.kelas : ""}</span>
      <span>ID: ${a.id}</span>
    </div>`;
  card.prepend(qrBox);
  return card;
}

function cetakSemuaKartu() {
  if (daftarAnggotaCache.length === 0) {
    showToast("Belum ada data anggota untuk dicetak.", "warning");
    return;
  }
  const area = document.getElementById("printArea");
  area.innerHTML = "";
  area.style.display = "flex";
  area.style.flexWrap = "wrap";
  area.style.gap = "12px";
  daftarAnggotaCache.forEach(a => area.appendChild(buatKartuElemen(a)));
  window.print();
}

async function unduhSemuaKartu() {
  if (daftarAnggotaCache.length === 0) {
    showToast("Belum ada data anggota untuk diunduh.", "warning");
    return;
  }
  const area = document.getElementById("printArea");
  area.innerHTML = "";
  area.style.display = "flex";
  area.style.flexWrap = "wrap";
  area.style.gap = "12px";
  daftarAnggotaCache.forEach(a => area.appendChild(buatKartuElemen(a)));

  showToast("Menyiapkan gambar, mohon tunggu...", "info");
  await unduhElemenSebagaiGambar(area, "semua-kartu-anggota.png", "png");
}
