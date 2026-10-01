# Sistem Absensi Asrama UNAND

Repository ini berisi kode sumber **Sistem Absensi Asrama Universitas Andalas**, yang terbagi ke dalam dua direktori utama: **Backend (REST API)** dan **Frontend (React UI)**.

---

## 📁 Struktur Direktori

```text
Absensi-asrama/
├── backend/            # Aplikasi CodeIgniter 4 (REST API & Server)
│   ├── app/            # Controllers (API), Models, Views, Config, Seeds
│   ├── public/         # Public webroot & static assets
│   ├── spark           # CLI Runner CodeIgniter 4
│   └── .env            # Konfigurasi Database & Environment
├── frontend/           # Aplikasi React 19 + TypeScript + Vite (UI)
│   ├── src/            # Components, Pages, API Integrations
│   └── package.json
└── README.md
```

---

## 🚀 Cara Menjalankan

### 1. Menjalankan Backend (CodeIgniter 4 API)

1. Masuk ke folder `backend`:
   ```bash
   cd backend
   ```
2. Pastikan file `.env` sudah dikonfigurasi untuk koneksi database MySQL Anda.
3. (Opsional) Jalankan seeder database untuk data awal:
   ```bash
   php spark db:seed AsramaSeeder
   ```
4. Jalankan server lokal:
   ```bash
   php spark serve
   ```
   Server backend akan berjalan di **`http://localhost:8080`**.

---

### 2. Menjalankan Frontend (React UI)

1. Masuk ke folder `frontend`:
   ```bash
   cd frontend
   ```
2. Install dependensi (jika belum):
   ```bash
   npm install
   ```
3. Jalankan server development:
   ```bash
   npm run dev
   ```
   Server UI akan berjalan di **`http://localhost:5173`**.

---

## 🔐 Akun Login Default (Seeder)
- **Admin**: NIM `ADMIN01` / Password `password`
- **Fasilitator**: NIM `FASIL01` / Password `password`
- **Penghuni**: NIM `2211522001` / Password `password`
