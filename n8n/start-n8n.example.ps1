# Helper menjalankan n8n + env (Windows PowerShell).
# Cara pakai:
#   1) Copy file ini jadi  start-n8n.ps1
#   2) Isi INTERNAL_API_KEY agar sama dengan .env backend
#   3) Jalankan:  .\start-n8n.ps1
# Catatan: start-n8n.ps1 sudah di-gitignore agar key asli tidak ikut ter-commit.
#
# n8n cuma penjadwal: ia memanggil backend untuk men-dispatch reminder. Jadi
# kredensial Groq/email/WhatsApp TIDAK perlu di sini — semuanya di .env backend.

$env:API_BASE_URL     = "http://localhost:3001"        # http://host.docker.internal:3001 jika n8n di Docker
$env:INTERNAL_API_KEY = "dev-internal-key-change-me"   # HARUS sama dengan .env backend

npx n8n
