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
  apiKey: "AIzaSyBhNiQOIGRu7j6yZ6WbJx8Gk4YsXUqOono",
  authDomain: "perpustakaan-e19c8.firebaseapp.com",
  projectId: "perpustakaan-e19c8",
  storageBucket: "perpustakaan-e19c8.firebasestorage.app",
  messagingSenderId: "145012738441",
  appId: "1:145012738441:web:612b4c026f9c46e806f958",
  measurementId: "G-3BVXS6SHVY"
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
