# Helper menjalankan n8n + env (Windows PowerShell).
# Cara pakai:
#   1) Copy file ini jadi  start-n8n.ps1
#   2) Isi nilai-nilainya (terutama GROQ_API_KEY & INTERNAL_API_KEY)
#   3) Jalankan:  .\start-n8n.ps1
# Catatan: start-n8n.ps1 sudah di-gitignore agar key asli tidak ikut ter-commit.

$env:API_BASE_URL     = "http://localhost:3001"        # http://host.docker.internal:3001 jika n8n di Docker
$env:INTERNAL_API_KEY = "dev-internal-key-change-me"   # HARUS sama dengan .env backend
$env:GROQ_API_KEY     = "gsk_isi_key_groq_kamu"
$env:WEB_PUBLIC_URL   = "http://localhost:3000"

# Opsional — hanya jika ingin benar-benar mengirim email/WhatsApp:
$env:RESEND_API_KEY        = ""
$env:EMAIL_FROM            = ""
$env:WHATSAPP_SERVICE_URL  = ""
$env:WHATSAPP_SERVICE_TOKEN = ""

npx n8n
