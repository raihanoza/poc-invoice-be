# n8n — Automated Payment Reminder Workflow

`workflow-export.json` is the exported n8n workflow that drives the daily reminder run.
All "which invoice / already sent today?" logic lives in the **backend** (`/internal/*`
endpoints) — n8n is only the orchestrator (per Section 6.1 of the brief).

## Flow

```
Daily 08:00 schedule
   └─ GET /internal/invoices/due-for-reminder      (x-internal-key)
        └─ Split invoices        (array → one item per invoice)
             └─ Compute tone & days
                  tone = "firm" if dueDate < today (overdue), else "friendly"
                  daysOverdue / daysUntilDue computed for the prompt
                  └─ Draft message (Groq /openai/v1/chat/completions)  → AI reminder text
                       └─ Build message context   (consolidate invoice + AI text)
                            └─ Route by channel  (Switch on client.reminderChannel)
                                 ├ email    → Send Email (Resend) ──┐
                                 ├ whatsapp → Send WhatsApp ─────────┤
                                 └ both     → Send Email → Send WA ──┤
                                                                     ▼
                              success → POST /internal/reminder-logs (status "sent")
                              error   → POST /internal/reminder-logs (status "failed")
```

Each send node uses **On Error → Continue (error output)**, so a failed send still records
a `failed` log instead of aborting the run. The backend upserts logs on
`(invoiceId, sentDate)`, so an invoice is never reminded twice on the same day.

## Required environment variables (in n8n)

The workflow reads these via `{{ $env.* }}` so no secrets are stored in the JSON:

| Variable | Purpose |
|---|---|
| `API_BASE_URL` | Base URL of the NestJS API, e.g. `http://localhost:3001` (use `http://host.docker.internal:3001` if n8n runs in Docker) |
| `INTERNAL_API_KEY` | Must match the API's `INTERNAL_API_KEY` (sent as `x-internal-key`) |
| `GROQ_API_KEY` | Groq API key for message drafting (OpenAI-compatible API) |
| `RESEND_API_KEY` | Resend API key (email channel) |
| `EMAIL_FROM` | Verified Resend sender address |
| `WHATSAPP_SERVICE_URL` | Endpoint of your WhatsApp service (Baileys/Cloud API proxy) |
| `WHATSAPP_SERVICE_TOKEN` | Bearer token for the WhatsApp service |
| `WEB_PUBLIC_URL` | Frontend base URL, used to build the `/invoice/{token}` share link |

In a self-hosted n8n, set these in n8n's own environment (e.g. the container/service env).

## Import

1. n8n → **Workflows** → **Import from File** → choose `workflow-export.json`.
2. Set the environment variables above for the n8n instance.
3. Open `Draft message (Groq)` and adjust the `model` if desired
   (default `llama-3.3-70b-versatile`).
4. Confirm the schedule (default daily 08:00) and **activate** the workflow.

## Notes / POC scope

- The `Route by channel` node uses **Switch (expression mode)** mapping
  `email→0, whatsapp→1, both→2`. If your n8n version differs, you can recreate it as a
  3-output Switch in rules mode.
- No retry/backoff (Section 9): a failed send is just logged as `failed` for manual review.
- The WhatsApp node posts `{ to, message }` — adapt the body to match your WhatsApp service.
