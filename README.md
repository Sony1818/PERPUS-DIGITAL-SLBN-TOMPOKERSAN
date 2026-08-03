# 📚 Perpustakaan SLB Negeri Tompokersan Lumajang — Sistem Peminjaman & Pengembalian Buku Berbasis QR Code

Aplikasi web untuk mengelola peminjaman dan pengembalian buku perpustakaan **SLB Negeri Tompokersan Lumajang** menggunakan QR Code, dibangun dengan HTML/CSS/JavaScript murni + Firebase, sehingga bisa di-hosting **gratis di GitHub Pages**.

Dirancang agar mudah digunakan oleh guru, siswa, dan petugas perpustakaan — termasuk di lingkungan **SLB** — lewat HP Android maupun komputer, dengan tampilan kontras tinggi, tombol besar, dan alur yang sederhana.

---

## ✨ Fitur

- Login admin/petugas (Firebase Authentication) — via email/sandi **atau** scan Kartu Login Petugas (QR)
- Data anggota (Guru & Siswa) + QR Code otomatis + cetak **atau unduh PNG/JPG** kartu anggota (satuan/massal)
- Data buku + QR Code otomatis + cetak **atau unduh PNG/JPG** label buku (satuan/massal)
- Scan peminjaman via kamera HP/webcam (2 langkah: scan anggota → scan buku)
- Scan pengembalian via kamera + deteksi keterlambatan otomatis
- Dashboard statistik real-time + notifikasi buku terlambat
- Riwayat peminjaman dengan filter (nama, jenis, kelas, tanggal) + export Excel
- Dark mode, pencarian cepat, backup & restore data (file JSON)
- Tampilan responsif (mobile-first) menggunakan Bootstrap 5

---

## 🗂️ Struktur Folder

```
/
├── index.html          → Halaman login
├── dashboard.html       → Statistik & backup/restore
├── anggota.html         → Data anggota + kartu QR
├── buku.html            → Data buku + label QR
├── peminjaman.html      → Scan peminjaman
├── pengembalian.html    → Scan pengembalian
├── riwayat.html         → Riwayat + filter + export Excel
├── css/style.css        → Tema & responsif
├── js/
│   ├── firebase.js      → Konfigurasi Firebase (WAJIB diisi, lihat di bawah)
│   ├── common.js        → Sidebar, topbar, auth guard, dark mode, helper (tambahan pendukung)
│   ├── dashboard.js
│   ├── anggota.js
│   ├── buku.js
│   ├── peminjaman.js
│   ├── pengembalian.js
│   └── riwayat.js
└── assets/
    ├── logo-sekolah.png  → Logo SLBN Tompokersan Lumajang
    └── favicon.png
```

> Catatan: `common.js` dan `dashboard.js` adalah file tambahan (di luar daftar minimal) agar sidebar/topbar/auth/tema tidak perlu ditulis ulang di setiap halaman.

---

## 🔧 1. Konfigurasi Firebase

1. Buka [Firebase Console](https://console.firebase.google.com) → **Add Project** → beri nama (misal `perpustakaan-sekolah`).
2. Di menu kiri, klik **Build → Firestore Database → Create database**. Pilih lokasi terdekat (misal `asia-southeast2`), lalu pilih mode **production**.
3. Klik **Build → Authentication → Get started → Sign-in method → Email/Password → Enable**.
4. Buat akun login untuk petugas: **Authentication → Users → Add user** (email + password).
5. Klik ikon ⚙️ **Project settings → General**, scroll ke "Your apps" → klik ikon **Web (`</>`)** → beri nama app → **Register app**.
6. Salin objek `firebaseConfig` yang muncul, lalu tempel ke file **`js/firebase.js`**, menggantikan bagian `GANTI_DENGAN_...`:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "perpustakaan-sekolah.firebaseapp.com",
  projectId: "perpustakaan-sekolah",
  storageBucket: "perpustakaan-sekolah.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcabc"
};
```

### Aturan Keamanan Firestore (Security Rules)

Karena hanya petugas yang login (Firebase Auth) yang boleh mengubah data, buka **Firestore Database → Rules** dan gunakan aturan berikut, lalu **Publish**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### Index Firestore

Sebagian besar query pada aplikasi ini (filter kombinasi `where` sederhana) tidak memerlukan index khusus. Jika muncul error di console browser berupa link "The query requires an index...", klik saja link tersebut — Firebase akan membuatkan index secara otomatis.

---

## 💻 2. Menjalankan secara Lokal (opsional, untuk uji coba)

Karena tidak ada proses build, Anda cukup membuka file dengan server statis sederhana (browser modern memblokir akses kamera dari `file://`, jadi gunakan server lokal):

```bash
# Python 3
python -m http.server 8080

# atau Node.js
npx serve .
```

Lalu buka `http://localhost:8080`.

> **Izin Kamera**: fitur scan QR memerlukan koneksi **HTTPS** (atau `localhost`). GitHub Pages sudah otomatis menggunakan HTTPS, jadi tidak masalah setelah di-deploy.

---

## 🚀 3. Deploy ke GitHub Pages

1. Buat repository baru di GitHub, misal `perpustakaan-digital`.
2. Upload seluruh isi folder ini (bukan folder itu sendiri, tapi isinya) ke repository tersebut — bisa lewat `git push` atau upload manual di web GitHub.

   ```bash
   git init
   git add .
   git commit -m "Perpustakaan digital - versi awal"
   git branch -M main
   git remote add origin https://github.com/USERNAME/perpustakaan-digital.git
   git push -u origin main
   ```

3. Buka repository di GitHub → **Settings → Pages**.
4. Pada **Build and deployment → Source**, pilih **Deploy from a branch**.
5. Pada **Branch**, pilih `main` dan folder `/ (root)` → **Save**.
6. Tunggu 1–2 menit, lalu akses situs di `https://USERNAME.github.io/perpustakaan-digital/`.
7. Buka **Authentication → Settings → Authorized domains** di Firebase Console, tambahkan domain GitHub Pages Anda (`USERNAME.github.io`) agar login berfungsi.

---

## 📱 4. Panduan Pemakaian Singkat

1. **Login** dengan akun petugas yang dibuat di Firebase Authentication — atau tap tab **"Scan Kartu Petugas"** di halaman login lalu arahkan kamera ke Kartu Login yang sudah dicetak (lihat poin 8 di bawah).
2. Tambahkan data di **Data Anggota** dan **Data Buku** terlebih dahulu.
3. Cetak **kartu anggota** (menu Data Anggota) dan **label buku** (menu Data Buku) — bisa satuan atau massal.
4. Gunakan menu **Peminjaman**: scan kartu anggota → scan QR buku → klik "Pinjam Buku".
5. Gunakan menu **Pengembalian**: scan kartu anggota → scan QR buku yang dikembalikan → klik "Kembalikan Buku". Sistem otomatis menghitung keterlambatan (default: batas pinjam **7 hari**, dapat diubah di `js/firebase.js` pada variabel `BATAS_HARI_PINJAM`).
6. Pantau semuanya lewat **Dashboard**, dan lihat/​filter/​export riwayat lewat menu **Riwayat**.
7. Jika kamera HP tidak mau menyala, gunakan tombol **"Ganti Kamera"** (untuk memilih kamera depan/belakang) atau **"Input Manual"** untuk mengetik ID secara manual.
8. **Login cepat via QR**: buka menu **Dashboard → Kartu Login Petugas**, isi nama, email, dan sandi akun (akun harus sudah ada di Firebase Authentication), lalu klik "Buat Kartu Login" dan cetak. Selanjutnya petugas cukup memilih tab **"Scan Kartu Petugas"** di halaman login dan mengarahkan kamera ke kartu tersebut — tidak perlu mengetik email/sandi lagi.

---

## ⚠️ Catatan Penting

- Untuk QR Code anggota/buku, isi field-nya adalah **ID Anggota** / **ID Buku** apa adanya (bukan URL). Saat dicetak dan discan kembali, aplikasi mencocokkan teks tersebut ke koleksi `members`/`books`.
- Login akun petugas **tidak bisa didaftarkan sendiri lewat halaman ini** (agar tidak sembarang orang bisa membuat akun) — admin harus menambahkannya lewat Firebase Console.
- **Kartu Login Petugas** memuat email & sandi akun dalam bentuk QR (disandikan base64, bukan terenkripsi) — perlakukan seperti kunci fisik: jangan difoto/disebarkan sembarangan, dan segera ganti sandi akun di Firebase Console jika kartu hilang. Fitur ini berbeda dari kartu anggota biasa (yang hanya memuat ID, dipakai untuk scan peminjaman/pengembalian) — QR login **tidak bisa** dipakai untuk pinjam/kembalikan buku, dan sebaliknya kartu anggota biasa **tidak bisa** dipakai untuk login.
- Backup rutin disarankan lewat tombol **Backup Data** di Dashboard, terutama sebelum melakukan perubahan besar.
- Tombol **"Unduh PNG/JPG"** pada kartu anggota/label buku hanya menangkap kartunya saja (bukan screenshot seluruh layar) — cocok untuk dikirim lewat WhatsApp/dicetak di tempat lain. Untuk unduhan "semua kartu/label sekaligus", hasilnya berupa **satu gambar** berisi susunan seluruh kartu/label (grid), bukan file terpisah per kartu.
