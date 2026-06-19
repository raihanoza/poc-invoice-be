# n8n — Automated Payment Reminder Workflow

`workflow-export.json` is the exported n8n workflow that drives the daily reminder run.
n8n is purely the scheduler here: it asks the backend which invoices are due and then
tells the backend to send each one. All the real work — picking the tone, drafting the
message (Groq, with a template fallback), sending over email/WhatsApp, and writing the
reminder log — happens inside the **backend**, the same code path used by the "Remind"
button and the immediate on-create reminder. That keeps one source of truth instead of
re-implementing it in n8n nodes.

## Flow

```
Daily 08:00 schedule
   └─ GET /internal/invoices/due-for-reminder           (x-internal-key)
        └─ Split invoices         (array → one item per invoice)
             └─ POST /internal/invoices/{id}/dispatch-reminder   (x-internal-key)
                  backend drafts (Groq → template fallback), sends over the
                  client's channel(s), and upserts the reminder_log.
```

The dispatch node uses **On Error → Continue** (so one invoice failing doesn't abort the run)
and **retries up to 3×** on transient errors. Retrying is safe because the backend is
idempotent: logs are upserted on `(invoiceId, sentDate)`, so an invoice is never reminded
twice on the same day, and the `due-for-reminder` query already excludes anything reminded
today — re-running the whole workflow is safe too. Note that send failures don't even surface
as errors: the backend still returns 200 and records a `failed` reminder_log for that invoice.

## Required environment variables (in n8n)

The workflow reads these via `{{ $env.* }}` so no secrets are stored in the JSON:

| Variable | Purpose |
|---|---|
| `API_BASE_URL` | Base URL of the NestJS API, e.g. `http://localhost:3001` (use `http://host.docker.internal:3001` if n8n runs in Docker) |
| `INTERNAL_API_KEY` | Must match the API's `INTERNAL_API_KEY` (sent as `x-internal-key`) |

That's it — the Groq key, SMTP/email credentials and WhatsApp settings now live only in
the **backend** env, since the backend does the sending. See the API's `.env.example`.

In a self-hosted n8n, set these in n8n's own environment (e.g. the container/service env).

## Import

1. n8n → **Workflows** → **Import from File** → choose `workflow-export.json`.
2. Set `API_BASE_URL` and `INTERNAL_API_KEY` for the n8n instance.
3. Confirm the schedule (default daily 08:00) and **activate** the workflow.

## Notes / POC scope

- No retry/backoff: a failed send is just logged as `failed` in `reminder_log` for manual
  review.
- Want to change tone, wording, channels, or the email/WhatsApp provider? Edit the backend
  (`ReminderDispatchService` / `MessagingService`) — n8n doesn't need to change.
- Earlier versions of this workflow drafted and sent inside n8n (Groq node, channel
  Switch, Resend/WhatsApp nodes, separate log calls). That logic moved into the backend so
  it isn't duplicated; the workflow is now just schedule → fetch due → dispatch.
