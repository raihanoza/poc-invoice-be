# n8n — Automated Payment Reminder Workflow

`workflow-export.json` is the exported n8n workflow that drives the daily reminder run.
In this build **n8n does the sending itself**: it asks the backend which invoices are due,
then for each invoice it drafts the message (Groq), downloads the invoice PDF from the
backend, and sends it over the client's channel(s) — email (PDF attached) and/or WhatsApp
(PDF posted to the `/send-message-image` endpoint as `multipart/form-data`) — and finally
writes a reminder log back to the backend.

> The backend can also do all of this on its own (the "Remind" button and the immediate
> on-create reminder go through `MessagingService.sendReminder`, which attaches the PDF too).
> This workflow is a parallel implementation that sends from n8n directly, so it needs the
> sending credentials in n8n — see below.

## Flow

```
Daily 08:00 schedule
  └─ GET /internal/invoices/due-for-reminder              (x-internal-key)
       └─ Split invoices           (array → one item per invoice)
            └─ Compute tone & days  (friendly vs firm, days overdue)
                 └─ Draft message (Groq)
                      └─ Build message context  (shareUrl, channel, recipient, text)
                           └─ Download PDF       GET /invoices/{id}/pdf  → binary "data"
                                └─ Route by channel
                                     ├─ email    → Send Email (SMTP, PDF attached)
                                     ├─ whatsapp → Send WhatsApp (multipart /send-message-image)
                                     └─ both     → Send Email + Send WhatsApp (parallel)
                                          └─ POST /internal/reminder-logs   (sent | failed)
```

The send nodes use **On Error → Continue (error output)** so one failure doesn't abort the
run; failures route to a `failed` reminder log. Logs are upserted on `(invoiceId, sentDate)`,
so re-running on the same day is safe (and the `both` branch logging twice is harmless).
The `due-for-reminder` query also excludes anything already reminded today.

## Required environment variables (in n8n)

The workflow reads everything via `{{ $env.* }}`, so no secrets live in the JSON. Because
n8n sends directly, it needs the full set (not just the backend's two):

| Variable | Purpose |
|---|---|
| `API_BASE_URL` | NestJS API base URL, e.g. `http://localhost:3001` (`http://host.docker.internal:3001` if n8n is in Docker). Used for due-for-reminder, PDF download, and reminder-logs. |
| `INTERNAL_API_KEY` | Must match the API's `INTERNAL_API_KEY` (sent as `x-internal-key`). |
| `GROQ_API_KEY` | Groq key for drafting the message. |
| `WEB_PUBLIC_URL` | Public web base for the share link, e.g. `http://localhost:3000`. |
| `EMAIL_FROM` *(or `EMAIL_USER`)* | "From" address shown on the email (FROM falls back to USER). The SMTP **login** is an n8n credential, not an env var — see below. |
| `WHATSAPP_SERVICE_TOKEN` | WhatsApp apiKey. |
| `WHATSAPP_SESSION_ID` | Gateway session id — sent as the `sessionId` field on each WhatsApp request. |
| `WHATSAPP_SERVICE_URL` | WhatsApp base URL, e.g. `https://waapi.transporindo.com/whatsapp/send-message`. The image endpoint is derived automatically (`…/send-message-image`). |
| `WHATSAPP_SERVICE_IMAGE_URL` | *(optional)* set explicitly to override the derived image URL. |

You also need an **SMTP credential** in n8n for the two email nodes (the `EMAIL_*` env vars
only set the From address). How to set the env vars on **macOS / Windows / Docker** and how to
create the SMTP credential is in [`SETUP.md`](SETUP.md).

## Import

1. n8n → **Workflows** → **Import from File** → choose `workflow-export.json`.
2. Set the environment variables above for the n8n instance ([`SETUP.md`](SETUP.md) step 3).
3. Open both **Send Email** nodes and select your SMTP credential (replaces the
   `REPLACE_WITH_SMTP_CREDENTIAL_ID` placeholder).
4. Confirm the schedule (default daily 08:00) and **activate** the workflow.

## Notes / POC scope

- A failed send is logged as `failed` in `reminder_log` for manual review (no retry/backoff).
- The PDF is fetched per invoice from `GET /invoices/{id}/pdf` (that route has no auth).
- Email/WhatsApp wording, tone, and the PDF attachment are produced in two places (here, and
  in the backend's `MessagingService`). If you ever want a single source of truth, switch this
  workflow to call `POST /internal/invoices/{id}/dispatch-reminder` per invoice and let the
  backend draft+send+log — but this export intentionally keeps the send logic in n8n.
```

