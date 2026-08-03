/* =========================================================
   pengembalian.js - Scan Pengembalian Buku
   ========================================================= */

let html5QrScannerKembali = null;
let daftarKameraKembali = [];
let indexKameraKembali = 0;
let modeKembali = "anggota"; // "anggota" | "buku"
let sedangMemprosesKembali = false;

let anggotaTerpilihKembali = null;
let bukuTerpilihKembali = null;
let transaksiAktifKembali = null;

function initPengembalianPage() {
  document.getElementById("btnInputManual").addEventListener("click", () => {
    document.getElementById("wrapperManual").classList.toggle("d-none");
  });
  document.getElementById("btnKirimManual").addEventListener("click", kirimInputManualKembali);
  document.getElementById("inputManual").addEventListener("keydown", (e) => {
    if (e.key === "Enter") kirimInputManualKembali();
  });
  document.getElementById("btnGantiKamera").addEventListener("click", gantiKameraKembali);
  document.getElementById("btnKembalikanBuku").addEventListener("click", prosesKembalikanBuku);
  document.getElementById("btnResetScan").addEventListener("click", resetAlurKembali);

  mulaiKameraKembali();
}

async function mulaiKameraKembali() {
  try {
    daftarKameraKembali = await Html5Qrcode.getCameras();
    if (!daftarKameraKembali || daftarKameraKembali.length === 0) {
      document.getElementById("infoAnggota").innerHTML =
        `<span class="text-danger">Kamera tidak ditemukan. Gunakan input manual.</span>`;
      return;
    }
    indexKameraKembali = daftarKameraKembali.findIndex(c => /back|rear|belakang/i.test(c.label));
    if (indexKameraKembali < 0) indexKameraKembali = 0;

    html5QrScannerKembali = new Html5Qrcode("reader");
    await jalankanKameraKembali();
  } catch (err) {
    console.error(err);
    document.getElementById("infoAnggota").innerHTML =
      `<span class="text-danger">Gagal mengakses kamera: ${err}. Gunakan input manual.</span>`;
  }
}

async function jalankanKameraKembali() {
  const cameraId = daftarKameraKembali[indexKameraKembali].id;
  await html5QrScannerKembali.start(
    cameraId,
    { fps: 10, qrbox: { width: 230, height: 230 } },
    (decodedText) => prosesHasilScanKembali(decodedText),
    () => {}
  );
}

async function gantiKameraKembali() {
  if (daftarKameraKembali.length < 2) {
    showToast("Hanya ada satu kamera tersedia.", "info");
    return;
  }
  indexKameraKembali = (indexKameraKembali + 1) % daftarKameraKembali.length;
  await html5QrScannerKembali.stop();
  await jalankanKameraKembali();
}

function kirimInputManualKembali() {
  const val = document.getElementById("inputManual").value.trim();
  if (!val) return;
  prosesHasilScanKembali(val);
  document.getElementById("inputManual").value = "";
}

async function prosesHasilScanKembali(kode) {
  if (sedangMemprosesKembali) return;
  sedangMemprosesKembali = true;
  try {
    if (modeKembali === "anggota") {
      await verifikasiAnggotaKembali(kode);
    } else {
      await verifikasiBukuKembali(kode);
    }
  } finally {
    setTimeout(() => { sedangMemprosesKembali = false; }, 1200);
  }
}

async function verifikasiAnggotaKembali(kode) {
  const snap = await membersRef.where("id", "==", kode).limit(1).get();
  if (snap.empty) {
    showToast(`ID Anggota "${kode}" tidak ditemukan.`, "danger");
    return;
  }
  const doc = snap.docs[0];
  anggotaTerpilihKembali = { docId: doc.id, ...doc.data() };

  document.getElementById("infoAnggota").innerHTML = `
    <div class="identity-card mt-2">
      <div class="avatar-circle">${inisialNama(anggotaTerpilihKembali.nama)}</div>
      <div>
        <strong>${anggotaTerpilihKembali.nama}</strong><br>
        <span class="text-muted-soft small">${anggotaTerpilihKembali.jenis}${anggotaTerpilihKembali.kelas ? " • Kelas " + anggotaTerpilihKembali.kelas : ""} • ID: ${anggotaTerpilihKembali.id}</span>
      </div>
    </div>`;
  document.getElementById("stepAnggota").classList.add("done");
  document.getElementById("infoBuku").textContent = "Arahkan kamera ke QR code buku yang dikembalikan.";
  modeKembali = "buku";
  showToast("Anggota terverifikasi: " + anggotaTerpilihKembali.nama);
}

async function verifikasiBukuKembali(kode) {
  const snapBuku = await booksRef.where("id", "==", kode).limit(1).get();
  if (snapBuku.empty) {
    showToast(`ID Buku "${kode}" tidak ditemukan.`, "danger");
    return;
  }
  const bukuDoc = snapBuku.docs[0];
  const buku = { docId: bukuDoc.id, ...bukuDoc.data() };

  // Cari transaksi aktif (status Dipinjam) untuk kombinasi anggota + buku ini
  const snapTx = await transactionsRef
    .where("memberId", "==", anggotaTerpilihKembali.id)
    .where("bookId", "==", buku.id)
    .where("status", "==", "Dipinjam")
    .limit(1)
    .get();

  if (snapTx.empty) {
    document.getElementById("infoBuku").innerHTML =
      `<span class="text-danger">Tidak ditemukan transaksi peminjaman aktif untuk buku "${buku.judul}" oleh anggota ini.</span>`;
    showToast("Transaksi peminjaman tidak ditemukan.", "danger");
    return;
  }

  transaksiAktifKembali = { docId: snapTx.docs[0].id, ...snapTx.docs[0].data() };
  bukuTerpilihKembali = buku;

  document.getElementById("infoBuku").innerHTML = `
    <div class="identity-card mt-2">
      <div class="avatar-circle" style="background:var(--accent);"><i class="bi bi-book"></i></div>
      <div>
        <strong>${buku.judul}</strong><br>
        <span class="text-muted-soft small">ID: ${buku.id} • Dipinjam sejak ${formatTanggal(transaksiAktifKembali.borrowDate)}</span>
      </div>
    </div>`;
  document.getElementById("stepBuku").classList.add("done");

  // Cek keterlambatan
  const alertBox = document.getElementById("alertTerlambat");
  if (transaksiAktifKembali.borrowDate && transaksiAktifKembali.borrowDate.toDate) {
    const batas = new Date(transaksiAktifKembali.borrowDate.toDate());
    batas.setDate(batas.getDate() + BATAS_HARI_PINJAM);
    const now = new Date();
    if (now > batas) {
      const hariTerlambat = Math.ceil((now - batas) / (1000 * 60 * 60 * 24));
      alertBox.textContent = `⚠ Pengembalian terlambat ${hariTerlambat} hari dari batas waktu peminjaman.`;
      alertBox.classList.remove("d-none");
    } else {
      alertBox.classList.add("d-none");
    }
  }

  document.getElementById("btnKembalikanBuku").disabled = false;
  showToast("Buku ditemukan: " + buku.judul);
}

async function prosesKembalikanBuku() {
  if (!anggotaTerpilihKembali || !bukuTerpilihKembali || !transaksiAktifKembali) return;
  const btn = document.getElementById("btnKembalikanBuku");
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Memproses...`;

  try {
    let statusAkhir = "Dikembalikan";
    let keterlambatanHari = 0;

    if (transaksiAktifKembali.borrowDate && transaksiAktifKembali.borrowDate.toDate) {
      const batas = new Date(transaksiAktifKembali.borrowDate.toDate());
      batas.setDate(batas.getDate() + BATAS_HARI_PINJAM);
      const now = new Date();
      if (now > batas) {
        keterlambatanHari = Math.ceil((now - batas) / (1000 * 60 * 60 * 24));
      }
    }

    await transactionsRef.doc(transaksiAktifKembali.docId).update({
      returnDate: firebase.firestore.FieldValue.serverTimestamp(),
      status: statusAkhir,
      keterlambatanHari
    });

    // Ambil data buku terbaru agar penambahan stok akurat & tidak melebihi jumlah total
    const bukuSnap = await booksRef.doc(bukuTerpilihKembali.docId).get();
    const dataBukuTerbaru = bukuSnap.data() || {};
    const jumlah = typeof dataBukuTerbaru.jumlah === "number" ? dataBukuTerbaru.jumlah : 1;
    const tersediaSaatIni = typeof dataBukuTerbaru.tersedia === "number" ? dataBukuTerbaru.tersedia : 0;
    const tersediaBaru = Math.min(tersediaSaatIni + 1, jumlah);

    await booksRef.doc(bukuTerpilihKembali.docId).update({
      jumlah: jumlah,
      tersedia: tersediaBaru,
      status: "Tersedia"
    });

    const pesan = keterlambatanHari > 0
      ? `Pengembalian berhasil dicatat. Terlambat ${keterlambatanHari} hari.`
      : `Pengembalian berhasil dicatat. Tepat waktu.`;
    showToast(pesan, keterlambatanHari > 0 ? "warning" : "success");
    resetAlurKembali();
  } catch (err) {
    showToast("Gagal memproses pengembalian: " + err.message, "danger");
    btn.disabled = false;
  } finally {
    btn.innerHTML = `<i class="bi bi-box-arrow-in-left"></i> Kembalikan Buku`;
  }
}

function resetAlurKembali() {
  anggotaTerpilihKembali = null;
  bukuTerpilihKembali = null;
  transaksiAktifKembali = null;
  modeKembali = "anggota";
  document.getElementById("infoAnggota").textContent = "Arahkan kamera ke kartu anggota yang mengembalikan buku.";
  document.getElementById("infoBuku").textContent = "Menunggu anggota terverifikasi...";
  document.getElementById("stepAnggota").classList.remove("done");
  document.getElementById("stepBuku").classList.remove("done");
  document.getElementById("alertTerlambat").classList.add("d-none");
  document.getElementById("btnKembalikanBuku").disabled = true;
}
