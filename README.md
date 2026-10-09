# Exness BDM + IB Telegram Bot

A 24/7 AI sales assistant on Telegram for a forex broker's Business Development and IB (Introducing Broker) team. It answers questions from a curated knowledge base with RAG, moves each client to their next step (register → verify → fund → trade → refer), and hands the chat to a human sales rep whenever it should. A live CRM dashboard shows every client's stage.

Built with n8n, Claude, Gemini embeddings and a small Vercel dashboard.

## How it works

```
Telegram (polled every 5s) → parse + register client in CRM
  → Build Context: CRM state, client vs IB track, 1-on-1 eligibility (validated in code, not by the LLM)
  → Route: /demo command │ chat paused for a human │ AI agent
  → Agent: Claude Sonnet 5.5 + per-client memory + RAG tool over the knowledge base
           (Gemini fallback model if Claude is unavailable)
  → escalation check → reply │ alert the live sales rep and pause the AI
Staff reply to the alert in Telegram → delivered to the client → AI resumes, aware of what staff said
```

**Design choices**

- **Grounded answers.** Any fact about the broker must come from the knowledge-base tool. `exness_knowledge_base.md` is chunked by section, embedded with `gemini-embedding-001` and retrieved per question.
- **Compliance built into the prompt.** The prompt rules out promised profits, personalised investment advice and trade signals, adds risk reminders when the client discusses leverage or strategy, and never asks for passwords or OTP codes.
- **Deterministic business rules.** Eligibility for the 1-on-1 strategy session and the routing between client and IB tracks are computed in code from CRM fields. The model only shares the booking link when the code says the client is eligible.
- **A clean human handoff.** The AI escalates when it should (it emits an `[[ESCALATE: reason]]` marker, and hard triggers in code act as a backstop). The sales rep gets an alert with full context, the AI stays quiet in that chat, and when the rep replies, the client receives the reply and the AI picks the conversation back up.
- **Demo mode.** `/demo register`, `/demo fund 500` and similar commands simulate CRM states live in a presentation.

## Repo layout

| Path | What it is |
|---|---|
| `n8n/telegram-agent.json` | The bot (30 nodes) |
| `n8n/kb-ingestion.json` | Loads the knowledge base into the vector store (runs on n8n start) |
| `n8n/crm-dashboard-api.json` | Read-only CRM JSON endpoint, protected by a shared dashboard key |
| `exness_knowledge_base.md` | The knowledge base the agent retrieves from (public broker information) |
| `crm-dashboard/` | Static dashboard + Vercel serverless proxy (`api/crm.js`) + local dev server |

## Setup

1. **n8n:** import the three workflows. Create credentials for **Anthropic** and **Google Gemini**, and a Data Table for the CRM.
2. **Telegram:** create a bot with @BotFather. Replace `YOUR_TELEGRAM_BOT_TOKEN` in the HTTP nodes and `YOUR_STAFF_CHAT_ID` with the Telegram chat that should receive escalations.
3. **Dashboard key:** pick a random string. Set it as `YOUR_DASHBOARD_KEY` in the CRM API workflow and as `DASHBOARD_KEY` in the dashboard environment.
4. **Dashboard locally:** `cd crm-dashboard && cp .env.example .env` (fill it in), then `npm start` and open http://localhost:3000.
5. **Dashboard on Vercel:** set `DASHBOARD_KEY` and `N8N_CRM_URL` as project environment variables. The browser only ever calls `/api/crm`, so the key and the n8n URL stay on the server.

## Security

No secrets are committed. The exported workflows contain placeholders and credential *names* only, the dashboard reads its key from the environment, and `.env` is gitignored.
