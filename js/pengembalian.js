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
let daftarTransaksiAktifKembali = []; // semua transaksi Dipinjam utk kombinasi anggota+buku ini

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

  document.getElementById("btnTambahJumlahKembali").addEventListener("click", () => ubahJumlahKembali(1));
  document.getElementById("btnKurangiJumlahKembali").addEventListener("click", () => ubahJumlahKembali(-1));
  document.getElementById("inputJumlahKembali").addEventListener("change", () => ubahJumlahKembali(0));

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
    mainkanBunyiScan(false);
    showToast(`ID Anggota "${kode}" tidak ditemukan.`, "danger");
    return;
  }
  const doc = snap.docs[0];
  anggotaTerpilihKembali = { docId: doc.id, ...doc.data() };
  mainkanBunyiScan(true);

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
    mainkanBunyiScan(false);
    showToast(`ID Buku "${kode}" tidak ditemukan.`, "danger");
    return;
  }
  const bukuDoc = snapBuku.docs[0];
  const buku = { docId: bukuDoc.id, ...bukuDoc.data() };

  // Cari SEMUA transaksi aktif (status Dipinjam) untuk kombinasi anggota + buku ini
  const snapTx = await transactionsRef
    .where("memberId", "==", anggotaTerpilihKembali.id)
    .where("bookId", "==", buku.id)
    .where("status", "==", "Dipinjam")
    .get();

  if (snapTx.empty) {
    mainkanBunyiScan(false);
    document.getElementById("infoBuku").innerHTML =
      `<span class="text-danger">Tidak ditemukan transaksi peminjaman aktif untuk buku "${buku.judul}" oleh anggota ini.</span>`;
    showToast("Transaksi peminjaman tidak ditemukan.", "danger");
    return;
  }

  mainkanBunyiScan(true);
  // Urutkan dari yang paling lama dipinjam (paling berisiko terlambat) agar diprioritaskan saat dikembalikan
  daftarTransaksiAktifKembali = snapTx.docs
    .map(d => ({ docId: d.id, ...d.data() }))
    .sort((a, b) => {
      const ta = a.borrowDate && a.borrowDate.toDate ? a.borrowDate.toDate().getTime() : 0;
      const tb = b.borrowDate && b.borrowDate.toDate ? b.borrowDate.toDate().getTime() : 0;
      return ta - tb;
    });
  bukuTerpilihKembali = buku;

  const jumlahDipinjamAnggotaIni = daftarTransaksiAktifKembali.length;
  const transaksiTertua = daftarTransaksiAktifKembali[0];

  document.getElementById("infoBuku").innerHTML = `
    <div class="identity-card mt-2">
      <div class="avatar-circle" style="background:var(--accent);"><i class="bi bi-book"></i></div>
      <div>
        <strong>${buku.judul}</strong><br>
        <span class="text-muted-soft small">ID: ${buku.id} • Sedang dipinjam anggota ini: ${jumlahDipinjamAnggotaIni} eksemplar (sejak ${formatTanggal(transaksiTertua.borrowDate)})</span>
      </div>
    </div>`;
  document.getElementById("stepBuku").classList.add("done");

  // Siapkan input jumlah
  const inputJumlah = document.getElementById("inputJumlahKembali");
  inputJumlah.value = 1;
  inputJumlah.max = jumlahDipinjamAnggotaIni;
  document.getElementById("wrapperJumlahKembali").classList.remove("d-none");
  document.getElementById("keteranganJumlahKembali").textContent =
    `Anggota ini sedang meminjam ${jumlahDipinjamAnggotaIni} eksemplar buku ini.`;

  perbaruiPeringatanTerlambatKembali();

  document.getElementById("btnKembalikanBuku").disabled = false;
  perbaruiTeksTombolKembali();
  showToast("Buku ditemukan: " + buku.judul);
}

function ubahJumlahKembali(delta) {
  const input = document.getElementById("inputJumlahKembali");
  const maksimal = daftarTransaksiAktifKembali.length || 1;
  let nilai = parseInt(input.value, 10) || 1;
  nilai += delta;
  if (nilai < 1) nilai = 1;
  if (nilai > maksimal) {
    nilai = maksimal;
    showToast(`Anggota ini hanya meminjam ${maksimal} eksemplar buku ini.`, "warning");
  }
  input.value = nilai;
  perbaruiPeringatanTerlambatKembali();
  perbaruiTeksTombolKembali();
}

function perbaruiTeksTombolKembali() {
  const jumlah = parseInt(document.getElementById("inputJumlahKembali").value, 10) || 1;
  document.getElementById("btnKembalikanBuku").innerHTML =
    `<i class="bi bi-box-arrow-in-left"></i> Kembalikan ${jumlah > 1 ? jumlah + " Buku" : "Buku"}`;
}

/** Hitung keterlambatan (hari) untuk satu transaksi berdasarkan tanggal pinjamnya */
function hitungKeterlambatanHari(transaksi) {
  if (!transaksi.borrowDate || !transaksi.borrowDate.toDate) return 0;
  const batas = new Date(transaksi.borrowDate.toDate());
  batas.setDate(batas.getDate() + BATAS_HARI_PINJAM);
  const now = new Date();
  if (now <= batas) return 0;
  return Math.ceil((now - batas) / (1000 * 60 * 60 * 24));
}

function perbaruiPeringatanTerlambatKembali() {
  const jumlah = parseInt(document.getElementById("inputJumlahKembali").value, 10) || 1;
  const dipilih = daftarTransaksiAktifKembali.slice(0, jumlah);
  const jumlahTerlambat = dipilih.filter(t => hitungKeterlambatanHari(t) > 0).length;
  const maksHari = Math.max(0, ...dipilih.map(hitungKeterlambatanHari));

  const alertBox = document.getElementById("alertTerlambat");
  if (jumlahTerlambat > 0) {
    alertBox.textContent = `⚠ ${jumlahTerlambat} dari ${dipilih.length} eksemplar yang dikembalikan sudah terlambat (maks. ${maksHari} hari dari batas waktu).`;
    alertBox.classList.remove("d-none");
  } else {
    alertBox.classList.add("d-none");
  }
}

async function prosesKembalikanBuku() {
  if (!anggotaTerpilihKembali || !bukuTerpilihKembali || daftarTransaksiAktifKembali.length === 0) return;
  const jumlahDikembalikan = parseInt(document.getElementById("inputJumlahKembali").value, 10) || 1;

  const btn = document.getElementById("btnKembalikanBuku");
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner-border spinner-border-sm"></span> Memproses...`;

  try {
    const transaksiDipilih = daftarTransaksiAktifKembali.slice(0, jumlahDikembalikan);
    let totalTerlambat = 0;

    const batch = db.batch();
    transaksiDipilih.forEach(t => {
      const keterlambatanHari = hitungKeterlambatanHari(t);
      if (keterlambatanHari > 0) totalTerlambat++;
      batch.update(transactionsRef.doc(t.docId), {
        returnDate: firebase.firestore.FieldValue.serverTimestamp(),
        status: "Dikembalikan",
        keterlambatanHari
      });
    });

    // Ambil data buku terbaru agar penambahan stok akurat & tidak melebihi jumlah total
    const bukuSnap = await booksRef.doc(bukuTerpilihKembali.docId).get();
    const dataBukuTerbaru = bukuSnap.data() || {};
    const jumlahTotal = typeof dataBukuTerbaru.jumlah === "number" ? dataBukuTerbaru.jumlah : 1;
    const tersediaSaatIni = typeof dataBukuTerbaru.tersedia === "number" ? dataBukuTerbaru.tersedia : 0;
    const tersediaBaru = Math.min(tersediaSaatIni + jumlahDikembalikan, jumlahTotal);

    batch.update(booksRef.doc(bukuTerpilihKembali.docId), {
      jumlah: jumlahTotal,
      tersedia: tersediaBaru,
      status: "Tersedia"
    });

    await batch.commit();

    const pesan = totalTerlambat > 0
      ? `Pengembalian ${jumlahDikembalikan} buku berhasil dicatat. ${totalTerlambat} di antaranya terlambat.`
      : `Pengembalian ${jumlahDikembalikan} buku berhasil dicatat. Tepat waktu.`;
    showToast(pesan, totalTerlambat > 0 ? "warning" : "success");
    resetAlurKembali();
  } catch (err) {
    showToast("Gagal memproses pengembalian: " + err.message, "danger");
    btn.disabled = false;
  } finally {
    perbaruiTeksTombolKembali();
  }
}

function resetAlurKembali() {
  anggotaTerpilihKembali = null;
  bukuTerpilihKembali = null;
  daftarTransaksiAktifKembali = [];
  modeKembali = "anggota";
  document.getElementById("infoAnggota").textContent = "Arahkan kamera ke kartu anggota yang mengembalikan buku.";
  document.getElementById("infoBuku").textContent = "Menunggu anggota terverifikasi...";
  document.getElementById("stepAnggota").classList.remove("done");
  document.getElementById("stepBuku").classList.remove("done");
  document.getElementById("wrapperJumlahKembali").classList.add("d-none");
  document.getElementById("inputJumlahKembali").value = 1;
  document.getElementById("alertTerlambat").classList.add("d-none");
  document.getElementById("btnKembalikanBuku").disabled = true;
  document.getElementById("btnKembalikanBuku").innerHTML = `<i class="bi bi-box-arrow-in-left"></i> Kembalikan Buku`;
}
