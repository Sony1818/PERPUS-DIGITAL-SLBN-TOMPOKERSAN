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
let tersediaBukuPinjam = 0;

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

  document.getElementById("btnTambahJumlahPinjam").addEventListener("click", () => ubahJumlahPinjam(1));
  document.getElementById("btnKurangiJumlahPinjam").addEventListener("click", () => ubahJumlahPinjam(-1));
  document.getElementById("inputJumlahPinjam").addEventListener("change", () => ubahJumlahPinjam(0));

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
    mainkanBunyiScan(false);
    showToast(`ID Anggota "${kode}" tidak ditemukan.`, "danger");
    return;
  }
  const doc = snap.docs[0];
  anggotaTerpilihPinjam = { docId: doc.id, ...doc.data() };
  mainkanBunyiScan(true);

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
    mainkanBunyiScan(false);
    showToast(`ID Buku "${kode}" tidak ditemukan.`, "danger");
    return;
  }
  const doc = snap.docs[0];
  const buku = { docId: doc.id, ...doc.data() };
  const jumlah = typeof buku.jumlah === "number" ? buku.jumlah : 1;
  const tersedia = typeof buku.tersedia === "number" ? buku.tersedia : (buku.status === "Dipinjam" ? 0 : 1);

  if (tersedia <= 0) {
    mainkanBunyiScan(false);
    document.getElementById("infoBuku").innerHTML =
      `<span class="text-danger">Stok buku "${buku.judul}" habis — semua ${jumlah} eksemplar sedang dipinjam.</span>`;
    showToast("Stok buku habis.", "danger");
    return;
  }

  mainkanBunyiScan(true);
  bukuTerpilihPinjam = buku;
  tersediaBukuPinjam = tersedia;

  document.getElementById("infoBuku").innerHTML = `
    <div class="identity-card mt-2">
      <div class="avatar-circle bg-icon-orange" style="background:var(--accent);"><i class="bi bi-book"></i></div>
      <div>
        <strong>${buku.judul}</strong><br>
        <span class="text-muted-soft small">${buku.penulis || "-"} • ID: ${buku.id} • Tersisa ${tersedia} dari ${jumlah} eksemplar</span>
      </div>
    </div>`;
  document.getElementById("stepBuku").classList.add("done");

  // Tampilkan & siapkan input jumlah
  const inputJumlah = document.getElementById("inputJumlahPinjam");
  inputJumlah.value = 1;
  inputJumlah.max = tersedia;
  document.getElementById("wrapperJumlahPinjam").classList.remove("d-none");
  document.getElementById("keteranganJumlahPinjam").textContent = `Maksimal ${tersedia} eksemplar untuk judul ini.`;

  document.getElementById("btnPinjamBuku").disabled = false;
  perbaruiTeksTombolPinjam();
  showToast("Buku terverifikasi: " + buku.judul);
}

function ubahJumlahPinjam(delta) {
  const input = document.getElementById("inputJumlahPinjam");
  let nilai = parseInt(input.value, 10) || 1;
  nilai += delta;
  if (nilai < 1) nilai = 1;
  if (tersediaBukuPinjam > 0 && nilai > tersediaBukuPinjam) {
    nilai = tersediaBukuPinjam;
    showToast(`Stok tersisa hanya ${tersediaBukuPinjam} eksemplar.`, "warning");
  }
  input.value = nilai;
  perbaruiTeksTombolPinjam();
}

function perbaruiTeksTombolPinjam() {
  const jumlah = parseInt(document.getElementById("inputJumlahPinjam").value, 10) || 1;
  document.getElementById("btnPinjamBuku").innerHTML =
    `<i class="bi bi-box-arrow-right"></i> Pinjam ${jumlah > 1 ? jumlah + " Buku" : "Buku"}`;
}

async function prosesPinjamBuku() {
  if (!anggotaTerpilihPinjam || !bukuTerpilihPinjam) return;
  const jumlahDipinjam = parseInt(document.getElementById("inputJumlahPinjam").value, 10) || 1;

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
    if (jumlahDipinjam > tersediaTerbaru) {
      showToast(`Stok tersisa hanya ${tersediaTerbaru} eksemplar, tidak bisa meminjam ${jumlahDipinjam}.`, "danger");
      resetAlurPinjam();
      return;
    }

    // Buat satu transaksi terpisah untuk tiap eksemplar yang dipinjam
    const batch = db.batch();
    for (let i = 0; i < jumlahDipinjam; i++) {
      const ref = transactionsRef.doc();
      batch.set(ref, {
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
    }

    const tersediaBaru = tersediaTerbaru - jumlahDipinjam;
    batch.update(booksRef.doc(bukuTerpilihPinjam.docId), {
      jumlah: jumlah,
      tersedia: tersediaBaru,
      status: tersediaBaru > 0 ? "Tersedia" : "Dipinjam"
    });

    await batch.commit();

    showToast(`Peminjaman berhasil: ${jumlahDipinjam}x "${bukuTerpilihPinjam.judul}" oleh ${anggotaTerpilihPinjam.nama}`);
    resetAlurPinjam();
  } catch (err) {
    showToast("Gagal menyimpan peminjaman: " + err.message, "danger");
    btn.disabled = false;
  } finally {
    perbaruiTeksTombolPinjam();
  }
}

function resetAlurPinjam() {
  anggotaTerpilihPinjam = null;
  bukuTerpilihPinjam = null;
  tersediaBukuPinjam = 0;
  modePinjam = "anggota";
  document.getElementById("infoAnggota").textContent = "Arahkan kamera ke kartu anggota (QR code guru/siswa).";
  document.getElementById("infoBuku").textContent = "Menunggu anggota terverifikasi...";
  document.getElementById("stepAnggota").classList.remove("done");
  document.getElementById("stepBuku").classList.remove("done");
  document.getElementById("wrapperJumlahPinjam").classList.add("d-none");
  document.getElementById("inputJumlahPinjam").value = 1;
  document.getElementById("btnPinjamBuku").disabled = true;
  document.getElementById("btnPinjamBuku").innerHTML = `<i class="bi bi-box-arrow-right"></i> Pinjam Buku`;
}
