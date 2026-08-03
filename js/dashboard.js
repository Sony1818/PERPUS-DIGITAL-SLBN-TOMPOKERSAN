/* =========================================================
   dashboard.js
   ========================================================= */

function awalHariIni() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

async function initDashboard() {
  await Promise.all([
    muatStatistik(),
    muatBukuTerlambat()
  ]);
  muatBackupRestoreHandler();
  muatKartuLoginHandler();
}

async function muatStatistik() {
  try {
    const [booksSnap, membersSnap, txSnap] = await Promise.all([
      booksRef.get(),
      membersRef.get(),
      transactionsRef.get()
    ]);

    const totalBuku = booksSnap.size;
    const totalAnggota = membersSnap.size;
    let dipinjam = 0, tersedia = 0;
    booksSnap.forEach(doc => {
      const b = doc.data();
      if (b.status === "Dipinjam") dipinjam++; else tersedia++;
    });

    const mulaiHariIni = awalHariIni();
    let pinjamHariIni = 0, kembaliHariIni = 0;
    txSnap.forEach(doc => {
      const t = doc.data();
      if (t.borrowDate && t.borrowDate.toDate && t.borrowDate.toDate() >= mulaiHariIni) pinjamHariIni++;
      if (t.returnDate && t.returnDate.toDate && t.returnDate.toDate() >= mulaiHariIni) kembaliHariIni++;
    });

    document.getElementById("statTotalBuku").textContent = totalBuku;
    document.getElementById("statTotalAnggota").textContent = totalAnggota;
    document.getElementById("statDipinjam").textContent = dipinjam;
    document.getElementById("statTersedia").textContent = tersedia;
    document.getElementById("statPinjamHariIni").textContent = pinjamHariIni;
    document.getElementById("statKembaliHariIni").textContent = kembaliHariIni;

    const guru = [];
    membersSnap.forEach(d => { if (d.data().jenis === "Guru") guru.push(d); });
    document.getElementById("ringkasanCepat").innerHTML = `
      <li><i class="bi bi-person-badge"></i> ${guru.length} anggota berstatus Guru</li>
      <li><i class="bi bi-mortarboard"></i> ${totalAnggota - guru.length} anggota berstatus Siswa</li>
      <li><i class="bi bi-journal-check"></i> ${txSnap.size} total transaksi tercatat</li>
    `;
  } catch (err) {
    console.error(err);
    showToast("Gagal memuat statistik: " + err.message, "danger");
  }
}

async function muatBukuTerlambat() {
  try {
    const snap = await transactionsRef.where("status", "==", "Dipinjam").get();
    const tbody = document.getElementById("tabelTerlambat");
    const empty = document.getElementById("emptyTerlambat");
    tbody.innerHTML = "";

    let ada = false;
    const now = new Date();

    snap.forEach(doc => {
      const t = doc.data();
      if (!t.borrowDate || !t.borrowDate.toDate) return;
      const pinjamDate = t.borrowDate.toDate();
      const batas = new Date(pinjamDate);
      batas.setDate(batas.getDate() + BATAS_HARI_PINJAM);
      if (now > batas) {
        ada = true;
        const hariTerlambat = Math.ceil((now - batas) / (1000 * 60 * 60 * 24));
        tbody.innerHTML += `
          <tr>
            <td>${t.memberName}</td>
            <td>${t.bookTitle}</td>
            <td>${formatTanggal(t.borrowDate)}</td>
            <td><span class="badge badge-status-terlambat">${hariTerlambat} hari</span></td>
          </tr>`;
      }
    });

    tbody.parentElement.parentElement.classList.toggle("d-none", !ada);
    empty.classList.toggle("d-none", ada);
  } catch (err) {
    console.error(err);
  }
}

function muatBackupRestoreHandler() {
  document.getElementById("btnBackup").addEventListener("click", backupData);
  document.getElementById("fileRestore").addEventListener("change", restoreData);
}

async function backupData() {
  try {
    showToast("Menyiapkan file backup...", "info");
    const [booksSnap, membersSnap, txSnap] = await Promise.all([
      booksRef.get(), membersRef.get(), transactionsRef.get()
    ]);

    const toArray = (snap) => snap.docs.map(d => ({ id: d.id, ...d.data() }));

    const backup = {
      tanggalBackup: new Date().toISOString(),
      members: toArray(membersSnap),
      books: toArray(booksSnap),
      transactions: toArray(txSnap)
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `backup-perpustakaan-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Backup berhasil diunduh.");
  } catch (err) {
    showToast("Gagal membuat backup: " + err.message, "danger");
  }
}

async function restoreData(e) {
  const file = e.target.files[0];
  if (!file) return;

  if (!confirm("Restore akan menimpa data yang memiliki ID sama. Lanjutkan?")) {
    e.target.value = "";
    return;
  }

  try {
    const text = await file.text();
    const data = JSON.parse(text);
    showToast("Memulihkan data, mohon tunggu...", "info");

    const batchSize = 400; // batas aman Firestore batch (500)
    const tugas = [];

    const tulisKoleksi = async (arr, ref) => {
      if (!Array.isArray(arr)) return;
      for (let i = 0; i < arr.length; i += batchSize) {
        const batch = db.batch();
        arr.slice(i, i + batchSize).forEach(item => {
          const { id, ...rest } = item;
          batch.set(ref.doc(id), rest, { merge: true });
        });
        tugas.push(batch.commit());
      }
    };

    await tulisKoleksi(data.members, membersRef);
    await tulisKoleksi(data.books, booksRef);
    await tulisKoleksi(data.transactions, transactionsRef);
    await Promise.all(tugas);

    showToast("Restore data berhasil.");
    initDashboard();
  } catch (err) {
    showToast("Gagal restore data: " + err.message, "danger");
  } finally {
    e.target.value = "";
  }
}

/* =========================================================
   Kartu Login Petugas (login via scan QR di halaman index.html)
   ========================================================= */

function muatKartuLoginHandler() {
  const form = document.getElementById("formKartuLogin");
  if (!form) return;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const nama = document.getElementById("loginKartuNama").value.trim();
    const email = document.getElementById("loginKartuEmail").value.trim();
    const password = document.getElementById("loginKartuPassword").value;

    if (!nama || !email || !password) return;

    const payload = "LOGINPETUGAS::" + btoa(email + ":" + password);

    const preview = document.getElementById("kartuLoginPreview");
    preview.innerHTML = "";
    preview.appendChild(buatKartuLoginElemen(nama, email, payload));

    document.getElementById("btnCetakKartuLogin").onclick = () => {
      const area = document.getElementById("printArea");
      area.innerHTML = "";
      area.appendChild(buatKartuLoginElemen(nama, email, payload));
      window.print();
    };

    new bootstrap.Modal(document.getElementById("modalKartuLogin")).show();

    // Kosongkan kata sandi dari form segera setelah QR dibuat (tidak disimpan ke mana pun)
    document.getElementById("loginKartuPassword").value = "";
  });
}

function buatKartuLoginElemen(nama, email, payload) {
  const card = document.createElement("div");
  card.className = "print-card";
  card.style.background = "linear-gradient(135deg, var(--accent), var(--accent-dark))";

  const qrBox = document.createElement("div");
  qrBox.className = "qr-box";
  const qrWrap = document.createElement("div");
  new QRCode(qrWrap, { text: payload, width: 90, height: 90, correctLevel: QRCode.CorrectLevel.M });
  qrBox.appendChild(qrWrap);

  card.innerHTML = `
    <div class="info">
      <span>KARTU LOGIN PETUGAS</span>
      <strong>${nama}</strong>
      <span>${email}</span>
      <span>Scan di halaman login untuk masuk otomatis</span>
    </div>`;
  card.prepend(qrBox);
  return card;
}
