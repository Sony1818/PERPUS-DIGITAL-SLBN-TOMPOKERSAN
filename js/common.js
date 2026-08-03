/* =========================================================
   common.js
   Fungsi bersama yang dipakai di semua halaman:
   - Render sidebar & topbar
   - Proteksi login (redirect ke index.html jika belum login)
   - Dark mode
   - Helper format tanggal, toast notifikasi, dsb.
   ========================================================= */

const MENU_ITEMS = [
  { href: "dashboard.html",    icon: "bi-speedometer2",     label: "Dashboard" },
  { href: "anggota.html",      icon: "bi-people",           label: "Data Anggota" },
  { href: "buku.html",         icon: "bi-book",             label: "Data Buku" },
  { href: "peminjaman.html",   icon: "bi-box-arrow-right",  label: "Peminjaman" },
  { href: "pengembalian.html", icon: "bi-box-arrow-in-left",label: "Pengembalian" },
  { href: "riwayat.html",      icon: "bi-clock-history",    label: "Riwayat" },
];

function currentPage() {
  const path = window.location.pathname.split("/").pop();
  return path === "" ? "index.html" : path;
}

function renderShell(pageTitle) {
  const page = currentPage();

  const navLinks = MENU_ITEMS.map(item => `
    <a href="${item.href}" class="nav-link ${page === item.href ? "active" : ""}">
      <i class="bi ${item.icon}"></i> <span>${item.label}</span>
    </a>
  `).join("");

  const shellHtml = `
    <div class="sidebar-backdrop no-print" id="sidebarBackdrop"></div>
    <aside class="sidebar no-print" id="sidebar">
      <div class="sidebar-brand">
        <div class="logo-badge"><img src="assets/logo-sekolah.png" alt="Logo SLBN Tompokersan Lumajang"></div>
        <div class="brand-text">
          <strong>Perpustakaan SLBN Tompokersan</strong>
          <span>Lumajang</span>
        </div>
      </div>
      <nav class="sidebar-nav">${navLinks}</nav>
      <div class="sidebar-footer">
        <button class="btn btn-outline-secondary w-100 mb-2" id="darkModeToggle">
          <i class="bi bi-moon-stars"></i> <span id="darkModeLabel">Mode Gelap</span>
        </button>
        <button class="btn btn-outline-danger w-100" id="logoutBtn">
          <i class="bi bi-box-arrow-left"></i> Keluar
        </button>
      </div>
    </aside>
    <div class="main-area">
      <header class="topbar no-print">
        <button class="sidebar-toggle-btn" id="sidebarToggleBtn"><i class="bi bi-list"></i></button>
        <h1 class="page-title">${pageTitle}</h1>
        <div class="ms-auto d-none d-md-block text-muted-soft small" id="userEmailLabel"></div>
      </header>
      <main class="content" id="pageContent"></main>
    </div>
  `;

  document.getElementById("app-shell").innerHTML = shellHtml;

  // Sidebar toggle (mobile)
  const sidebar = document.getElementById("sidebar");
  const backdrop = document.getElementById("sidebarBackdrop");
  document.getElementById("sidebarToggleBtn").addEventListener("click", () => {
    sidebar.classList.toggle("show");
    backdrop.classList.toggle("show");
  });
  backdrop.addEventListener("click", () => {
    sidebar.classList.remove("show");
    backdrop.classList.remove("show");
  });

  // Dark mode
  initDarkModeToggle();

  // Logout
  document.getElementById("logoutBtn").addEventListener("click", (e) => {
    e.preventDefault();
    auth.signOut().then(() => window.location.href = "index.html");
  });
}

function initDarkModeToggle() {
  const saved = localStorage.getItem("theme") || "light";
  document.documentElement.setAttribute("data-theme", saved);
  updateDarkModeLabel(saved);

  document.getElementById("darkModeToggle").addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", cur);
    localStorage.setItem("theme", cur);
    updateDarkModeLabel(cur);
  });
}

function updateDarkModeLabel(theme) {
  const label = document.getElementById("darkModeLabel");
  if (label) label.textContent = theme === "dark" ? "Mode Terang" : "Mode Gelap";
}

// Terapkan tema tersimpan sesegera mungkin (mengurangi kedipan) sebelum shell dirender
(function applyEarlyTheme() {
  const saved = localStorage.getItem("theme") || "light";
  document.documentElement.setAttribute("data-theme", saved);
})();

/** Proteksi halaman: harus login. Panggil di setiap halaman selain index.html */
function requireAuth(callback) {
  auth.onAuthStateChanged((user) => {
    if (!user) {
      window.location.href = "index.html";
    } else {
      const label = document.getElementById("userEmailLabel");
      if (label) label.textContent = user.email;
      callback(user);
    }
  });
}

/** Format Firestore Timestamp / Date / string ke format tanggal Indonesia */
function formatTanggal(value) {
  if (!value) return "-";
  let d;
  if (value.toDate) d = value.toDate();
  else d = new Date(value);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }) +
         " " + d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

/** Toast notifikasi sederhana menggunakan Bootstrap Toast */
function showToast(message, type = "success") {
  let container = document.getElementById("toastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";
    container.className = "toast-container position-fixed bottom-0 end-0 p-3";
    container.style.zIndex = 1080;
    document.body.appendChild(container);
  }
  const colors = { success: "text-bg-success", danger: "text-bg-danger", warning: "text-bg-warning", info: "text-bg-info" };
  const toastEl = document.createElement("div");
  toastEl.className = `toast align-items-center ${colors[type] || colors.success} border-0`;
  toastEl.setAttribute("role", "alert");
  toastEl.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">${message}</div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
    </div>`;
  container.appendChild(toastEl);
  const toast = new bootstrap.Toast(toastEl, { delay: 3500 });
  toast.show();
  toastEl.addEventListener("hidden.bs.toast", () => toastEl.remove());
}

/** Ambil inisial nama untuk avatar bulat */
function inisialNama(nama) {
  if (!nama) return "?";
  const parts = nama.trim().split(" ");
  return (parts[0][0] + (parts[1] ? parts[1][0] : "")).toUpperCase();
}

/** Badge status buku/transaksi */
function badgeStatus(status) {
  const map = {
    "Tersedia": "badge-status-tersedia",
    "Dipinjam": "badge-status-dipinjam",
    "Terlambat": "badge-status-terlambat",
    "Dikembalikan": "badge-status-dikembalikan"
  };
  return `<span class="badge ${map[status] || "bg-secondary"}">${status}</span>`;
}

/** Export array of objects ke file Excel (.xlsx) menggunakan SheetJS */
function exportToExcel(data, filename = "data.xlsx", sheetName = "Sheet1") {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}

/* =========================================================
   Unduh elemen (kartu anggota / label buku) sebagai gambar PNG/JPG
   Membutuhkan library html2canvas (dimuat lewat CDN di halaman terkait).
   Hanya elemen yang ditangkap (bukan seluruh layar).
   ========================================================= */
async function unduhElemenSebagaiGambar(elemen, namaFile, format = "png") {
  if (!elemen) return;
  try {
    const canvas = await html2canvas(elemen, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true
    });
    const mime = format === "jpg" ? "image/jpeg" : "image/png";
    const dataUrl = canvas.toDataURL(mime, 0.95);
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = namaFile;
    a.click();
  } catch (err) {
    console.error(err);
    showToast("Gagal membuat gambar: " + err.message, "danger");
  }
}
