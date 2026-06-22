# Deploy ke DigitalOcean Droplet (Docker Compose)

Satu Droplet menjalankan **Postgres + backend (NestJS) + n8n**. Frontend tetap di
**Vercel**. Stack ini always-on, jadi schedule reminder n8n jalan tepat waktu (tidak
ada cold-start seperti free tier).

## 0. Prasyarat
- Droplet sudah dibuat (Premium AMD, 2 GB RAM, Singapore) dengan Docker terpasang.
- Sudah bisa SSH: `ssh root@DROPLET_IP`.
- Port `80`, `443`, `22` terbuka (`ufw allow 80 && ufw allow 443 && ufw allow OpenSSH`).
- **DuckDNS `pocinvoice` diarahkan ke IP Droplet**: buka [duckdns.org](https://www.duckdns.org),
  pada domain `pocinvoice` isi kolom **current ip** dengan IP Droplet → **update ip**.
  Cek: `ping pocinvoice.duckdns.org` harus mengarah ke IP itu. Caddy butuh ini untuk
  menerbitkan sertifikat HTTPS.

## 1. Ambil kode ke server
```bash
# di dalam server
apt-get update && apt-get install -y git
git clone <URL_REPO_BACKEND_KAMU> app
cd app
```
> Repo `.env` asli ter-gitignore, jadi tidak ikut. Itu memang yang kita mau.

## 2. Isi environment
```bash
cp .env.deploy.example .env
nano .env        # isi semua nilai (password DB, INTERNAL_API_KEY, EMAIL_*, GROQ, N8N_HOST=IP droplet, dst.)
```
Generate secret acak untuk `INTERNAL_API_KEY` dan `N8N_ENCRYPTION_KEY`:
```bash
openssl rand -hex 24
```

## 3. Nyalakan
```bash
docker compose up -d --build
docker compose ps           # keempat service harus "running"
docker compose logs -f backend   # cek migrasi Prisma jalan & "API listening"
docker compose logs -f caddy     # cek "certificate obtained successfully"
```
- Backend (HTTPS): `https://pocinvoice.duckdns.org`  ← dipakai frontend
- n8n UI (admin):  `http://DROPLET_IP:5678`

> Sertifikat HTTPS pertama butuh ~10–30 detik. Kalau gagal, hampir selalu karena
> DuckDNS belum mengarah ke IP, atau port 80/443 belum dibuka.

## 4. Setup n8n (sekali saja)
1. Buka `http://DROPLET_IP:5678` → buat **owner account** (login pertama).
2. **Workflows → Import from File** → upload `n8n/workflow-export.json`.
3. Buat **SMTP credential** untuk 2 node email (host/user/pass dari Gmail App Password).
4. **Activate** workflow. Schedule Trigger akan jalan harian otomatis.

> Env yang dibaca workflow (`API_BASE_URL`, `INTERNAL_API_KEY`, `GROQ_API_KEY`,
> `WHATSAPP_*`, `EMAIL_FROM`, `WEB_PUBLIC_URL`) sudah di-inject dari `.env` lewat
> compose — tidak perlu set ulang di UI. `API_BASE_URL` otomatis `http://backend:3001`.

## 5. Frontend di Vercel
Di project Vercel, set environment variable:
```
NEXT_PUBLIC_API_BASE_URL = https://pocinvoice.duckdns.org
```
Lalu redeploy. Karena backend sekarang HTTPS, tidak ada lagi masalah mixed-content.

## Operasional
```bash
docker compose logs -f <service>     # lihat log (backend | n8n | postgres)
docker compose restart backend       # restart satu service
git pull && docker compose up -d --build   # deploy versi baru
docker compose down                  # stop semua (data Postgres & n8n tetap aman di volume)
```

## Catatan keamanan
- Backend sudah HTTPS lewat Caddy (`https://pocinvoice.duckdns.org`) → mixed-content beres.
- **n8n masih `http://IP:5678`** (akses admin saja, frontend tak memanggilnya). Mau HTTPS
  juga? Buat subdomain DuckDNS kedua (mis. `pocinvoice-n8n.duckdns.org`), arahkan ke IP
  yang sama, lalu tambahkan blok berikut di `Caddyfile` dan hapus publish port 5678 di n8n:
  ```
  pocinvoice-n8n.duckdns.org {
      reverse_proxy n8n:5678
  }
  ```
- Postgres (`5432`) tidak di-publish keluar — sudah benar, jangan dibuka.
- Ganti semua password/secret default sebelum dipakai beneran.
