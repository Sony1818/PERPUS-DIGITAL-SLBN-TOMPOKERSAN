/* =========================================================
   peminjaman.js - Scan Peminjaman Buku
   ========================================================= */

let html5QrScannerPinjam = null;
let daftarKameraPinjam = [];
let indexKameraPinjam = 0;
let modePinjam = "anggota"; // "anggota" | "buku"
let sedangMemprosesPinjam = false;

let anggotaTerpilihPinjam = null;
let bukuTerpilihPinjam = null;

function initPeminjamanPage() {
  document.getElementById("btnInputManual").addEventListener("click", () => {
    document.getElementById("wrapperManual").classList.toggle("d-none");
  });
  document.getElementById("btnKirimManual").addEventListener("click", kirimInputManualPinjam);
  document.getElementById("inputManual").addEventListener("keydown", (e) => {
    if (e.key === "Enter") kirimInputManualPinjam();
  });
  document.getElementById("btnGantiKamera").addEventListener("click", gantiKameraPinjam);
  document.getElementById("btnPinjamBuku").addEventListener("click", prosesPinjamBuku);
  document.getElementById("btnResetScan").addEventListener("click", resetAlurPinjam);

  mulaiKameraPinjam();
}

async function mulaiKameraPinjam() {
  try {
    daftarKameraPinjam = await Html5Qrcode.getCameras();
    if (!daftarKameraPinjam || daftarKameraPinjam.length === 0) {
      document.getElementById("infoAnggota").innerHTML =
        `<span class="text-danger">Kamera tidak ditemukan. Gunakan input manual.</span>`;
      return;
    }
    // Prioritaskan kamera belakang jika ada
    indexKameraPinjam = daftarKameraPinjam.findIndex(c => /back|rear|belakang/i.test(c.label));
    if (indexKameraPinjam < 0) indexKameraPinjam = 0;

    html5QrScannerPinjam = new Html5Qrcode("reader");
    await jalankanKameraPinjam();
  } catch (err) {
    console.error(err);
    document.getElementById("infoAnggota").innerHTML =
      `<span class="text-danger">Gagal mengakses kamera: ${err}. Gunakan input manual.</span>`;
  }
}

async function jalankanKameraPinjam() {
  const cameraId = daftarKameraPinjam[indexKameraPinjam].id;
  await html5QrScannerPinjam.start(
    cameraId,
    { fps: 10, qrbox: { width: 230, height: 230 } },
    (decodedText) => prosesHasilScanPinjam(decodedText),
    () => {}
  );
}

async function gantiKameraPinjam() {
  if (daftarKameraPinjam.length < 2) {
    showToast("Hanya ada satu kamera tersedia.", "info");
    return;
  }
  indexKameraPinjam = (indexKameraPinjam + 1) % daftarKameraPinjam.length;
  await html5QrScannerPinjam.stop();
  await jalankanKameraPinjam();
}

function kirimInputManualPinjam() {
  const val = document.getElementById("inputManual").value.trim();
  if (!val) return;
  prosesHasilScanPinjam(val);
  document.getElementById("inputManual").value = "";
}

async function prosesHasilScanPinjam(kode) {
  if (sedangMemprosesPinjam) return;
  sedangMemprosesPinjam = true;
  try {
    if (modePinjam === "anggota") {
      await verifikasiAnggotaPinjam(kode);
    } else {
      await verifikasiBukuPinjam(kode);
    }
  } finally {
    setTimeout(() => { sedangMemprosesPinjam = false; }, 1200);
  }
}

async function verifikasiAnggotaPinjam(kode) {
  const snap = await membersRef.where("id", "==", kode).limit(1).get();
  if (snap.empty) {
    showToast(`ID Anggota "${kode}" tidak ditemukan.`, "danger");
    return;
  }
  const doc = snap.docs[0];
  anggotaTerpilihPinjam = { docId: doc.id, ...doc.data() };

  document.getElementById("infoAnggota").innerHTML = `
    <div class="identity-card mt-2">
      <div class="avatar-circle">${inisialNama(anggotaTerpilihPinjam.nama)}</div>
      <div>
        <strong>${anggotaTerpilihPinjam.nama}</strong><br>
        <span class="text-muted-soft small">${anggotaTerpilihPinjam.jenis}${anggotaTerpilihPinjam.kelas ? " • Kelas " + anggotaTerpilihPinjam.kelas : ""} • ID: ${anggotaTerpilihPinjam.id}</span>
      </div>
    </div>`;
  document.getElementById("stepAnggota").classList.add("done");
  document.getElementById("infoBuku").textContent = "Arahkan kamera ke QR code buku yang ingin dipinjam.";
  modePinjam = "buku";
  showToast("Anggota terverifikasi: " + anggotaTerpilihPinjam.nama);
}

async function verifikasiBukuPinjam(kode) {
  const snap = await booksRef.where("id", "==", kode).limit(1).get();
  if (snap.empty) {
    showToast(`ID Buku "${kode}" tidak ditemukan.`, "danger");
    return;
  }
  const doc = snap.docs[0];
  const buku = { docId: doc.id, ...doc.data() };
  const jumlah = typeof buku.jumlah === "number" ? buku.jumlah : 1;
  const tersedia = typeof buku.tersedia === "number" ? buku.tersedia : (buku.status === "Dipinjam" ? 0 : 1);

  if (tersedia <= 0) {
    document.getElementById("infoBuku").innerHTML =
      `<span class="text-danger">Stok buku "${buku.judul}" habis — semua ${jumlah} eksemplar sedang dipinjam.</span>`;
    showToast("Stok buku habis.", "danger");
    return;
  }

  bukuTerpilihPinjam = buku;
  document.getElementById("infoBuku").innerHTML = `
    <div class="identity-card mt-2">
      <div class="avatar-circle bg-icon-orange" style="background:var(--accent);"><i class="bi bi-book"></i></div>
      <div>
        <strong>${buku.judul}</strong><br>
        <span class="text-muted-soft small">${buku.penulis || "-"} • ID: ${buku.id} • Tersisa ${tersedia} dari ${jumlah} eksemplar</span>
      </div>
    </div>`;
  document.getElementById("stepBuku").classList.add("done");
  document.getElementById("btnPinjamBuku").disabled = false;
  showToast("Buku terverifikasi: " + buku.judul);
}

async function prosesPinjamBuku() {
  if (!anggotaTerpilihPinjam || !bukuTerpilihPinjam) return;
  const btn = document.getElementById("btnPinjamBuku");
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Memproses...`;

  try {
    // Cek ulang stok agar tidak double-booking
    const ceklulang = await booksRef.doc(bukuTerpilihPinjam.docId).get();
    const dataTerbaru = ceklulang.data();
    const jumlah = typeof dataTerbaru.jumlah === "number" ? dataTerbaru.jumlah : 1;
    const tersediaTerbaru = typeof dataTerbaru.tersedia === "number" ? dataTerbaru.tersedia : (dataTerbaru.status === "Dipinjam" ? 0 : 1);

    if (tersediaTerbaru <= 0) {
      showToast("Stok buku baru saja habis dipinjam orang lain.", "danger");
      resetAlurPinjam();
      return;
    }

    await transactionsRef.add({
      memberId: anggotaTerpilihPinjam.id,
      memberName: anggotaTerpilihPinjam.nama,
      memberJenis: anggotaTerpilihPinjam.jenis,
      memberKelas: anggotaTerpilihPinjam.kelas || "",
      bookId: bukuTerpilihPinjam.id,
      bookTitle: bukuTerpilihPinjam.judul,
      borrowDate: firebase.firestore.FieldValue.serverTimestamp(),
      returnDate: null,
      status: "Dipinjam"
    });

    const tersediaBaru = tersediaTerbaru - 1;
    await booksRef.doc(bukuTerpilihPinjam.docId).update({
      jumlah: jumlah,
      tersedia: tersediaBaru,
      status: tersediaBaru > 0 ? "Tersedia" : "Dipinjam"
    });

    showToast(`Peminjaman berhasil: ${bukuTerpilihPinjam.judul} oleh ${anggotaTerpilihPinjam.nama}`);
    resetAlurPinjam();
  } catch (err) {
    showToast("Gagal menyimpan peminjaman: " + err.message, "danger");
    btn.disabled = false;
  } finally {
    btn.innerHTML = `<i class="bi bi-box-arrow-right"></i> Pinjam Buku`;
  }
}

function resetAlurPinjam() {
  anggotaTerpilihPinjam = null;
  bukuTerpilihPinjam = null;
  modePinjam = "anggota";
  document.getElementById("infoAnggota").textContent = "Arahkan kamera ke kartu anggota (QR code guru/siswa).";
  document.getElementById("infoBuku").textContent = "Menunggu anggota terverifikasi...";
  document.getElementById("stepAnggota").classList.remove("done");
  document.getElementById("stepBuku").classList.remove("done");
  document.getElementById("btnPinjamBuku").disabled = true;
}
