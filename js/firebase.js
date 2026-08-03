/* =========================================================
   Konfigurasi Firebase
   ---------------------------------------------------------
   1. Buat project di https://console.firebase.google.com
   2. Aktifkan "Firestore Database" (mode production/test).
   3. Aktifkan "Authentication" > Sign-in method > Email/Password.
   4. Buka Project Settings > General > scroll ke "Your apps"
      > pilih ikon Web (</>) > salin firebaseConfig ke bawah ini.
   ========================================================= */

const firebaseConfig = {
  apiKey: "GANTI_DENGAN_API_KEY",
  authDomain: "GANTI_DENGAN_PROJECT.firebaseapp.com",
  projectId: "GANTI_DENGAN_PROJECT_ID",
  storageBucket: "GANTI_DENGAN_PROJECT.appspot.com",
  messagingSenderId: "GANTI_DENGAN_SENDER_ID",
  appId: "GANTI_DENGAN_APP_ID"
};

// Inisialisasi (menggunakan Firebase compat SDK, dimuat lewat CDN di setiap halaman)
firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

// Koleksi Firestore yang dipakai di seluruh aplikasi
const membersRef = db.collection("members");
const booksRef = db.collection("books");
const transactionsRef = db.collection("transactions");

// Berapa hari batas peminjaman sebelum dianggap terlambat
const BATAS_HARI_PINJAM = 7;
