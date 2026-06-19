#!/usr/bin/env bash
# Helper menjalankan n8n + env (macOS / Linux, zsh/bash).
# Cara pakai:
#   1) Copy jadi start-n8n.sh   ->  cp start-n8n.example.sh start-n8n.sh
#   2) Isi nilai aslinya (terutama INTERNAL_API_KEY & GROQ_API_KEY)
#   3) Buat executable sekali   ->  chmod +x start-n8n.sh
#   4) Jalankan                 ->  ./start-n8n.sh
# start-n8n.sh sudah di-gitignore agar key asli tidak ikut ter-commit.
#
# Catatan: bungkus nilai dengan tanda kutip tunggal '...' — token WhatsApp
# mengandung karakter spesial (* % @ &) yang bisa ditafsirkan shell.
#
# Email SMTP TIDAK diset di sini: host/user/password masuk ke n8n
# Credentials (SMTP) bernama "Gmail SMTP". Yang di bawah cuma alamat pengirim.

# Wajib: izinkan akses $env di dalam expression node
export N8N_BLOCK_ENV_ACCESS_IN_NODE=false

export API_BASE_URL='http://localhost:3001'        # http://host.docker.internal:3001 jika n8n di Docker
export INTERNAL_API_KEY='ganti-samakan-dengan-.env-backend'
export GROQ_API_KEY='gsk_isi_key_groq_kamu'
export WEB_PUBLIC_URL='http://localhost:3000'
export EMAIL_FROM='kamu@gmail.com'                 # alamat pengirim (Gmail)
export WHATSAPP_SERVICE_URL='https://waapi.transporindo.com/whatsapp/send-message'
export WHATSAPP_SERVICE_TOKEN='isi_token_whatsapp'

npx n8n
