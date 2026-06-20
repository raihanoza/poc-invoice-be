# POC Invoice — Backend (NestJS API)

Backend untuk POC Invoice & Payment Reminder. Berisi REST API (NestJS + Prisma + PostgreSQL),
generator PDF (Puppeteer), pengiriman manual email/WhatsApp, endpoint internal untuk n8n, dan
folder `n8n/` (workflow reminder otomatis).

Project ini **berdiri sendiri** (terpisah dari frontend). Frontend ada di folder
`poc-invoice-frontend` dan mengakses backend ini lewat HTTP.

---

## Prasyarat

- **Node.js 20+** dan npm — cek: `node -v`
- **PostgreSQL** — instal lokal, atau pakai cloud gratis (Neon / Supabase)

---

## Menjalankan dari 0 (step by step)

### 1. Siapkan database PostgreSQL
Pilih salah satu:

- **Lokal:** instal PostgreSQL, lalu buat database:
  ```sql
  CREATE DATABASE poc_invoice;
  ```
- **Cloud (Neon/Supabase):** buat project, salin connection string-nya.

### 2. Konfigurasi environment
Salin contoh env lalu isi `DATABASE_URL`:
```bash
cp .env.example .env
```
Edit `.env`:
```
DATABASE_URL=postgres://USER:PASSWORD@HOST:5432/poc_invoice
PORT=3001
INTERNAL_API_KEY=ganti-dengan-string-rahasia
REMINDER_DAYS_BEFORE_DUE=3
BUSINESS_NAME=Nama Bisnis Anda
WEB_PUBLIC_URL=http://localhost:3000
```
> Email/WhatsApp (`RESEND_API_KEY`, `WHATSAPP_SERVICE_URL`, dst.) opsional — fitur "Send"
> baru aktif kalau diisi. Tanpa itu, API tetap jalan dan akan memberi pesan error yang jelas.

### 3. Install dependency
```bash
npm install
```

### 4. Generate Prisma Client & buat tabel
```bash
npm run prisma:generate
npm run prisma:migrate      # = prisma migrate dev --name init
```
Perintah ke-2 membuat semua tabel (clients, invoices, invoice_items, reminder_logs).

### 5. Jalankan API
```bash
npm run dev                 # mode watch (auto-reload)
# atau produksi:
npm run build && npm start
```
API jalan di **http://localhost:3001**.

### 6. Tes cepat
```bash
# buat client
curl -X POST http://localhost:3001/clients -H "Content-Type: application/json" \
  -d '{"name":"Budi","email":"budi@example.com","reminderChannel":"email"}'

# list invoice
curl http://localhost:3001/invoices
```

---

## Daftar endpoint

Semua response JSON memakai envelope: `{ "success": true, "data": ... }` atau
`{ "success": false, "message": "...", "errors": [...] }`.

| Method | Endpoint | Keterangan |
|---|---|---|
| POST | `/clients` | buat client |
| GET | `/clients` | list client |
| GET | `/clients/:id` | detail |
| PATCH | `/clients/:id` | update |
| DELETE | `/clients/:id` | hapus (ditolak jika masih punya invoice) |
| POST | `/invoices` | buat invoice + items (client existing atau inline baru) |
| GET | `/invoices?status=unpaid\|paid` | list, filter status opsional |
| GET | `/invoices/:id` | detail + items |
| PATCH | `/invoices/:id` | update / ganti items (total dihitung ulang) |
| PATCH | `/invoices/:id/mark-as-paid` | tandai lunas |
| DELETE | `/invoices/:id` | hapus |
| GET | `/invoices/:id/pdf` | stream PDF |
| POST | `/invoices/:id/send` | kirim manual ke client (email/WA) |
| GET | `/public/invoices/:token` | **tanpa auth** — halaman share publik |

Internal (dipanggil n8n, butuh header `x-internal-key: $INTERNAL_API_KEY`):

| Method | Endpoint | Keterangan |
|---|---|---|
| GET | `/internal/invoices/due-for-reminder` | invoice unpaid yang due-soon/overdue & belum direminder hari ini |
| POST | `/internal/invoices/:id/dispatch-reminder` | draft + kirim + catat reminder untuk 1 invoice (idempoten per hari); balas `{ skipped: true }` kalau sudah dikirim hari ini |
| POST | `/internal/reminder-logs` | catat hasil kirim reminder secara manual (idempoten per hari) |

---

## n8n (reminder otomatis)

Workflow ada di `n8n/workflow-export.json`. Di build ini **n8n yang mengirim langsung**: ia
ambil daftar invoice yang due, lalu per invoice men-draft pesan (Groq), mengunduh PDF dari
backend (`GET /invoices/{id}/pdf`), dan mengirim email (PDF dilampirkan) dan/atau WhatsApp
(PDF via `/send-message-image`, multipart), lalu mencatat `reminder_logs` lewat endpoint
internal. Karena itu kredensial pengiriman (Groq, WhatsApp, alamat email + credential SMTP)
harus di-set di **n8n**, bukan hanya backend. Panduan lengkap — termasuk daftar env var dan
cara set-nya di macOS/Windows/Docker — ada di [`n8n/SETUP.md`](n8n/SETUP.md) dan
[`n8n/README.md`](n8n/README.md).

> Catatan: backend juga bisa melakukan semua ini sendiri lewat
> `POST /internal/invoices/{id}/dispatch-reminder` (jalur yang dipakai tombol "Remind" dan
> reminder saat input). Workflow n8n di repo ini sengaja menyimpan logika kirim di n8n.

**Reminder langsung saat input:** kalau sebuah invoice dibuat dan `dueDate`-nya sudah hari ini
(atau lewat) dengan status `unpaid`, backend langsung memproses reminder-nya saat itu juga
(tanpa menunggu jadwal n8n) — draft pesan via Groq bila `GROQ_API_KEY` di-set, kalau tidak
pakai template, lalu kirim sesuai channel client dan catat di `reminder_logs` (maksimal sekali
per hari, idempoten via unique `(invoiceId, sentDate)`).

---

## Catatan scope (POC)

Tanpa auth/login, tanpa multi-tenant, tanpa payment gateway, tanpa queue. "Mark as paid"
adalah toggle manual.
