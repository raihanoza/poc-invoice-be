# Setup n8n dari Awal (Step by Step)

Panduan menjalankan workflow reminder (`workflow-export.json`) dari nol.

Di build ini **n8n yang mengirim langsung**: ambil invoice yang due → draft pesan (Groq) →
unduh PDF invoice dari backend → kirim **email** (PDF dilampirkan) dan/atau **WhatsApp**
(PDF dikirim ke endpoint `/send-message-image`, `multipart/form-data`) → catat reminder log
ke backend. Karena itu kredensial pengiriman harus tersedia untuk n8n (bukan hanya backend).

---

## 0. Prasyarat

Sebelum n8n, pastikan:

1. **Backend API jalan** di `http://localhost:3001` (lihat README backend) dan DB sudah di-migrate.
2. **Ada data uji**: minimal 1 invoice berstatus `unpaid` dengan `dueDate` dalam rentang
   reminder (≤ hari ini + `REMINDER_DAYS_BEFORE_DUE`, mis. jatuh tempo hari ini / besok / lewat).
   Buat lewat frontend (`/invoices/new`). Tanpa ini, `due-for-reminder` kosong dan workflow
   tidak mengirim apa-apa.
3. **Kredensial pengiriman tersedia untuk n8n** (langkah 3 & 5): `GROQ_API_KEY`,
   `WHATSAPP_SERVICE_*`, alamat pengirim email, dan satu **credential SMTP** di n8n.

---

## 1. Jalankan n8n (pilih salah satu)

### Opsi A — npx (paling cepat, tanpa instalasi)

```bash
npx n8n
```

### Opsi B — install global

```bash
npm install -g n8n
n8n
```

### Opsi C — Docker

```bash
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

Workflow membaca semua rahasia lewat `{{ $env.* }}`, jadi tidak ada secret tersimpan di JSON.
Variabel harus ada di **environment proses n8n**. Karena n8n yang mengirim langsung, perlu
set semua berikut:

| Variable                           | Isi                                                                                                                       |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `API_BASE_URL`                     | `http://localhost:3001` (atau `http://host.docker.internal:3001` bila Docker)                                             |
| `INTERNAL_API_KEY`                 | **harus sama persis** dengan `INTERNAL_API_KEY` di `.env` backend                                                         |
| `GROQ_API_KEY`                     | API key Groq (untuk draft pesan)                                                                                          |
| `WEB_PUBLIC_URL`                   | `http://localhost:3000` (untuk link share di pesan)                                                                       |
| `EMAIL_FROM` _(atau `EMAIL_USER`)_ | alamat pengirim email yang tampil di "From"                                                                               |
| `WHATSAPP_SERVICE_TOKEN`           | apiKey WhatsApp                                                                                                           |
| `WHATSAPP_SERVICE_URL`             | `https://waapi.transporindo.com/whatsapp/send-message` — URL image (`…/send-message-image`) diturunkan otomatis dari sini |
| `WHATSAPP_SERVICE_IMAGE_URL`       | _(opsional)_ isi kalau mau override URL image secara eksplisit                                                            |

> **Login SMTP bukan env var.** Username/password SMTP disimpan sebagai **credential** n8n
> (lihat langkah 5). Env `EMAIL_FROM`/`EMAIL_USER` hanya menentukan alamat pengirim.

### Cara set — macOS / Linux (Terminal: bash / zsh)

Set di shell yang sama **sebelum** menjalankan n8n:

```bash
export API_BASE_URL="http://localhost:3001"
export INTERNAL_API_KEY="dev-internal-key-change-me"
export GROQ_API_KEY="gsk_xxx"
export WEB_PUBLIC_URL="http://localhost:3000"
export EMAIL_FROM="kamu@gmail.com"
export WHATSAPP_SERVICE_TOKEN="xxxx"
export WHATSAPP_SERVICE_URL="https://waapi.transporindo.com/whatsapp/send-message"
npx n8n
```

Variabel ini hanya berlaku untuk sesi terminal tsb. Mau permanen? taruh baris `export ...`
di `~/.zshrc` (zsh, default macOS modern) atau `~/.bashrc`, lalu `source ~/.zshrc`.

### Cara set — Windows (PowerShell)

Set di shell yang sama **sebelum** menjalankan n8n:

```powershell
$env:API_BASE_URL = "http://localhost:3001"
$env:INTERNAL_API_KEY = "dev-internal-key-change-me"
$env:GROQ_API_KEY = "gsk_xxx"
$env:WEB_PUBLIC_URL = "http://localhost:3000"
$env:EMAIL_FROM = "kamu@gmail.com"
$env:WHATSAPP_SERVICE_TOKEN = "xxxx"
$env:WHATSAPP_SERVICE_URL = "https://waapi.transporindo.com/whatsapp/send-message"
$env:N8N_BLOCK_ENV_ACCESS_IN_NODE="false"
npx n8n
```

Variabel `$env:` ini hanya berlaku untuk sesi PowerShell tsb. Mau permanen (berlaku di
terminal **baru**)? pakai `setx`:

```powershell
setx API_BASE_URL "http://localhost:3001"
setx INTERNAL_API_KEY "dev-internal-key-change-me"
# ...dst untuk tiap variabel, lalu buka PowerShell BARU sebelum menjalankan n8n
```

> `setx` tidak mengubah sesi yang sedang berjalan — buka jendela baru setelahnya.
> Pakai cmd.exe? gunakan `set NAMA=nilai` (tanpa tanda kutip) per baris, lalu `npx n8n`.

### Cara set — Docker (Mac & Windows)

Tambahkan `-e` untuk tiap variabel. **Perhatikan karakter sambung baris berbeda:**
backslash `\` di macOS/Linux, backtick `` ` `` di PowerShell.

macOS / Linux:

```bash
docker run -it --rm --name n8n -p 5678:5678 \
  -e API_BASE_URL=http://host.docker.internal:3001 \
  -e INTERNAL_API_KEY=dev-internal-key-change-me \
  -e GROQ_API_KEY=gsk_xxx \
  -e WEB_PUBLIC_URL=http://localhost:3000 \
  -e EMAIL_FROM=kamu@gmail.com \
  -e WHATSAPP_SERVICE_TOKEN=xxxx \
  -e WHATSAPP_SERVICE_URL=https://waapi.transporindo.com/whatsapp/send-message \
  -v n8n_data:/home/node/.n8n docker.n8n.io/n8nio/n8n
```

Windows (PowerShell):

```powershell
docker run -it --rm --name n8n -p 5678:5678 `
  -e API_BASE_URL=http://host.docker.internal:3001 `
  -e INTERNAL_API_KEY=dev-internal-key-change-me `
  -e GROQ_API_KEY=gsk_xxx `
  -e WEB_PUBLIC_URL=http://localhost:3000 `
  -e EMAIL_FROM=kamu@gmail.com `
  -e WHATSAPP_SERVICE_TOKEN=xxxx `
  -e WHATSAPP_SERVICE_URL=https://waapi.transporindo.com/whatsapp/send-message `
  -v n8n_data:/home/node/.n8n docker.n8n.io/n8nio/n8n
```

> Kalau `{{ $env.NAMA }}` mengembalikan kosong, pastikan `N8N_BLOCK_ENV_ACCESS_IN_NODE`
> tidak di-set `true` (default-nya `false` = akses diizinkan). Alternatif: ganti
> `{{ $env.X }}` di node dengan nilai langsung, atau pakai n8n Credentials.

---

## 4. Import workflow

1. Di n8n: menu kiri **Workflows** → tombol **Import from File** (atau ikon **⋮** → _Import from File_).
2. Pilih file `poc-invoice-backend/n8n/workflow-export.json`.
3. Workflow akan terbuka di kanvas.

---

## 5. Cek & sesuaikan node

Workflow ini punya **14 node** — n8n yang melakukan draft + kirim + log:

- **Daily 08:00 schedule** — atur jam jika ingin selain 08:00.
- **Get due-for-reminder** — `GET /internal/invoices/due-for-reminder` (header `x-internal-key`).
- **Split invoices** — memecah array invoice jadi satu item per invoice.
- **Compute tone & days** — tentukan tone friendly/firm + hari terlambat.
- **Draft message (Groq)** — `POST api.groq.com/.../chat/completions` (butuh `GROQ_API_KEY`).
- **Build message context** — rakit shareUrl, channel, penerima, dan teks pesan.
- **Download PDF** — `GET /invoices/{id}/pdf` → simpan sebagai binary `data` (PDF invoice).
- **Route by channel** — arahkan ke email / whatsapp / both.
- **Send Email (SMTP)** & **Send Email (both)** — kirim email dengan PDF dilampirkan
  (`attachments: data`). **Wajib pilih credential SMTP** (lihat di bawah).
- **Send WhatsApp** & **Send WhatsApp (both)** — `POST /send-message-image`,
  `multipart/form-data` berisi `numbers`, `apiKey`, `message`, dan file `files` (PDF).
- **Log reminder (sent / failed)** — `POST /internal/reminder-logs` (upsert unik per
  `(invoiceId, sentDate)`).

Node pengiriman di-set **On Error → Continue (error output)**, jadi satu invoice gagal tidak
menghentikan run dan tercatat sebagai `failed`.

### Set credential SMTP (wajib untuk email)

Kedua node email memakai placeholder `REPLACE_WITH_SMTP_CREDENTIAL_ID`. Setelah import:

1. Buka node **Send Email (SMTP)** → field **Credential to connect with** → **Create New**.
2. Isi **Host/Port/User/Password** SMTP. Untuk Gmail: host `smtp.gmail.com`, port `587`,
   user emailmu, password = **App Password** (bukan password login biasa).
3. Simpan, lalu buka node **Send Email (both)** dan pilih credential SMTP yang sama.

---

## 6. Tes manual (sekali jalan)

1. Pastikan backend jalan dan ada invoice unpaid yang due-soon/overdue.
2. Di kanvas workflow, klik **Test workflow** (atau **Execute Workflow**) di bawah.
3. Telusuri tiap node:
   - **Get due-for-reminder** → array invoice (lewat `data`).
   - **Download PDF** → output punya **binary** `data` (file PDF).
   - **Send Email / Send WhatsApp** → status 2xx; cek email masuk dengan **lampiran PDF**, dan
     pesan WhatsApp masuk **dengan file PDF**.
   - **Log reminder** → baris baru/terupdate di `reminder_logs`.

> Kalau Groq/SMTP/WhatsApp belum dikonfigurasi, node terkait akan error tapi run tetap lanjut
> (On Error → Continue) dan tercatat `failed` di `reminder_logs`.

---

## 7. Aktifkan (jadwal harian)

Geser toggle **Active** (kanan atas) ke ON. Setelah aktif, **Schedule Trigger** menjalankan
workflow otomatis tiap hari jam 08:00.

---

## 8. Verifikasi

- Cek tabel `reminder_logs` di DB (mis. `npm run prisma:studio` di backend) — harus ada baris
  baru untuk invoice yang diproses.
- Cek inbox email (lampiran PDF) dan WhatsApp (file PDF) penerima uji.
- Jalankan **Test workflow** lagi di hari yang sama → invoice yang sama **tidak** dikirim ulang,
  karena `due-for-reminder` mengecualikan yang sudah direminder hari ini dan log di-upsert unik
  `(invoiceId, sentDate)`.

---

## Troubleshooting

| Gejala                                        | Penyebab / solusi                                                                                                                 |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `ECONNREFUSED` / tak bisa konek ke API        | Backend tidak jalan, atau di Docker pakai `localhost` (ganti ke `host.docker.internal`).                                          |
| `401` di Get due-for-reminder / reminder-logs | `INTERNAL_API_KEY` n8n ≠ `.env` backend.                                                                                          |
| `due-for-reminder` kosong                     | Tidak ada invoice unpaid dalam rentang due. Buat invoice uji dengan due dekat.                                                    |
| `{{ $env.X }}` kosong                         | Env tidak ter-set di proses n8n (lihat langkah 3); pastikan n8n dijalankan dari shell yang sama dengan tempat env di-set.         |
| Email terkirim tapi **tanpa lampiran**        | Node **Download PDF** gagal/terlewati, atau `attachments` bukan `data`. Cek output Download PDF punya binary `data`.              |
| Email error "credential" / tidak terkirim     | Credential SMTP belum dipilih di node email (langkah 5).                                                                          |
| WhatsApp error / URL kosong                   | `WHATSAPP_SERVICE_TOKEN`/`WHATSAPP_SERVICE_URL` belum di-set, atau endpoint `/send-message-image` belum aktif di sisi WA service. |
| Draft pesan kosong / Groq error               | `GROQ_API_KEY` belum di-set atau kuota habis.                                                                                     |
