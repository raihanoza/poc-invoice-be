# Setup n8n dari Awal (Step by Step)

Panduan menjalankan workflow reminder (`workflow-export.json`) dari nol.

---

## 0. Prasyarat

Sebelum n8n, pastikan:

1. **Backend API jalan** di `http://localhost:3001` (lihat README backend) dan DB sudah di-migrate.
2. **Ada data uji**: minimal 1 invoice berstatus `unpaid` dengan `dueDate` dalam rentang
   reminder (≤ hari ini + `REMINDER_DAYS_BEFORE_DUE`, mis. jatuh tempo hari ini / besok / lewat).
   Buat lewat frontend (`/invoices/new`). Tanpa ini, `due-for-reminder` kosong dan workflow
   tidak mengirim apa-apa.
3. **API key** yang relevan: `ANTHROPIC_API_KEY` (wajib untuk draft pesan). `RESEND_API_KEY` +
   `EMAIL_FROM` dan/atau `WHATSAPP_SERVICE_URL` (+token) bila ingin benar-benar terkirim.

---

## 1. Jalankan n8n (pilih salah satu)

### Opsi A — npx (paling cepat, tanpa instalasi)
```powershell
npx n8n
```

### Opsi B — install global
```powershell
npm install -g n8n
n8n
```

### Opsi C — Docker
```powershell
docker run -it --rm --name n8n -p 5678:5678 -v n8n_data:/home/node/.n8n docker.n8n.io/n8nio/n8n
```

n8n akan jalan di **http://localhost:5678**.

> **Penting (networking):** kalau n8n jalan via **Docker**, `localhost` di dalam container
> BUKAN host kamu. Untuk memanggil backend di host, pakai `http://host.docker.internal:3001`
> (Windows/Mac) sebagai `API_BASE_URL`. Kalau n8n via npx/npm di mesin yang sama dengan backend,
> `http://localhost:3001` sudah benar.

---

## 2. Buat akun owner (saat pertama buka)

Buka http://localhost:5678 → isi form **Set up owner account** (email + password). Ini akun
lokal n8n kamu sendiri, bukan terkait aplikasi invoice.

---

## 3. Set environment variables n8n

Workflow membaca rahasia lewat `{{ $env.* }}`, jadi tidak ada secret tersimpan di JSON.
Variabel harus ada di **environment proses n8n**.

Variabel yang dipakai:

| Variable | Isi |
|---|---|
| `API_BASE_URL` | `http://localhost:3001` (atau `http://host.docker.internal:3001` bila Docker) |
| `INTERNAL_API_KEY` | **harus sama persis** dengan `INTERNAL_API_KEY` di `.env` backend |
| `ANTHROPIC_API_KEY` | API key Anthropic |
| `RESEND_API_KEY` | API key Resend (channel email) |
| `EMAIL_FROM` | alamat pengirim terverifikasi di Resend |
| `WHATSAPP_SERVICE_URL` | endpoint service WhatsApp kamu |
| `WHATSAPP_SERVICE_TOKEN` | token service WhatsApp |
| `WEB_PUBLIC_URL` | `http://localhost:3000` (untuk link share `/invoice/{token}`) |

### Cara set — npx/npm (PowerShell)
Set di shell yang sama **sebelum** menjalankan n8n:
```powershell
$env:API_BASE_URL = "http://localhost:3001"
$env:INTERNAL_API_KEY = "dev-internal-key-change-me"
$env:ANTHROPIC_API_KEY = "sk-ant-..."
$env:RESEND_API_KEY = "re_..."
$env:EMAIL_FROM = "invoice@domainmu.com"
$env:WHATSAPP_SERVICE_URL = "https://wa-service/send"
$env:WHATSAPP_SERVICE_TOKEN = "xxx"
$env:WEB_PUBLIC_URL = "http://localhost:3000"
npx n8n
```
(Variabel ini hanya berlaku untuk sesi shell tsb — jalankan n8n dari shell yang sama.)

### Cara set — Docker
Tambahkan `-e` untuk tiap variabel:
```powershell
docker run -it --rm --name n8n -p 5678:5678 `
  -e API_BASE_URL=http://host.docker.internal:3001 `
  -e INTERNAL_API_KEY=dev-internal-key-change-me `
  -e ANTHROPIC_API_KEY=sk-ant-... `
  -e RESEND_API_KEY=re_... `
  -e EMAIL_FROM=invoice@domainmu.com `
  -e WHATSAPP_SERVICE_URL=https://wa-service/send `
  -e WHATSAPP_SERVICE_TOKEN=xxx `
  -e WEB_PUBLIC_URL=http://localhost:3000 `
  -v n8n_data:/home/node/.n8n docker.n8n.io/n8nio/n8n
```

> Kalau `{{ $env.NAMA }}` mengembalikan kosong, pastikan `N8N_BLOCK_ENV_ACCESS_IN_NODE`
> tidak di-set `true` (default-nya `false` = akses diizinkan). Alternatif: ganti
> `{{ $env.X }}` di node dengan nilai langsung, atau pakai n8n Credentials.

---

## 4. Import workflow

1. Di n8n: menu kiri **Workflows** → tombol **Import from File** (atau ikon **⋮** → *Import from File*).
2. Pilih file `poc-invoice-backend/n8n/workflow-export.json`.
3. Workflow "Invoice Payment Reminder" akan terbuka di kanvas.

---

## 5. Cek & sesuaikan node

- **Draft message (Anthropic):** buka node, cek field `model` (default `claude-sonnet-4-6`).
  Ganti sesuai model yang kamu punya aksesnya.
- **Route by channel:** node Switch (mode expression) memetakan `email→0, whatsapp→1, both→2`.
  Kalau versi n8n-mu beda, buat ulang sebagai Switch 3 output.
- **Send WhatsApp:** body `{ to, message }` — sesuaikan dengan format service WA-mu bila perlu.
- **Daily 08:00 schedule:** atur jam jika ingin selain 08:00.

---

## 6. Tes manual (sekali jalan)

1. Pastikan backend jalan dan ada invoice unpaid yang due-soon/overdue.
2. Di kanvas workflow, klik tombol **Test workflow** (atau **Execute Workflow**) di bawah.
3. Telusuri tiap node:
   - **Get due-for-reminder** → harus mengembalikan array invoice (lewat `data`).
   - **Compute tone & days** → `tone` = `firm` (overdue) / `friendly` (belum jatuh tempo).
   - **Draft message (Anthropic)** → menghasilkan teks pesan.
   - **Send Email/WhatsApp** → terkirim, atau error (kalau key belum diisi).
   - **Log reminder** → memanggil `POST /internal/reminder-logs`.

> Kalau email/WA belum dikonfigurasi, node kirim akan error → otomatis ke
> **Log reminder (failed)**. Itu normal dan membuktikan branch error + logging bekerja.

---

## 7. Aktifkan (jadwal harian)

Geser toggle **Active** (kanan atas) ke ON. Setelah aktif, **Schedule Trigger** menjalankan
workflow otomatis tiap hari jam 08:00.

---

## 8. Verifikasi

- Cek tabel `reminder_logs` di DB (mis. `npm run prisma:studio` di backend) — harus ada baris
  baru untuk invoice yang diproses.
- Jalankan **Test workflow** lagi di hari yang sama → invoice yang sama **tidak** dikirim ulang,
  karena backend memfilter `reminderLogs none today` dan upsert unik `(invoiceId, sentDate)`.

---

## Troubleshooting

| Gejala | Penyebab / solusi |
|---|---|
| `ECONNREFUSED` / tak bisa konек ke API | Backend tidak jalan, atau di Docker pakai `localhost` (ganti ke `host.docker.internal`). |
| `401` di Get due-for-reminder / Log | `INTERNAL_API_KEY` n8n ≠ `.env` backend. |
| `due-for-reminder` kosong | Tidak ada invoice unpaid dalam rentang due. Buat invoice uji dengan due dekat. |
| Anthropic `401`/`400` | `ANTHROPIC_API_KEY` salah/kosong, atau `model` tidak tersedia. |
| `{{ $env.X }}` kosong | Env tidak ter-set di proses n8n (lihat langkah 3). |
| Email/WA gagal | `RESEND_*` / `WHATSAPP_*` belum diisi → tercatat sebagai `failed` (sesuai desain POC). |
