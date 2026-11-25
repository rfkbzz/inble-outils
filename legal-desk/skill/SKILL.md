---
name: legal-desk
description: Send a request to the in-house legal team and triage it with the Legal Desk app for Jira, through the Atlassian MCP server. Use when someone needs legal to review a contract, an NDA, a data-sharing or privacy question, a dispute, an IP or an employment matter; wants to know how risky a request is and how fast legal should handle it; asks what is waiting at legal, what is overdue or high-risk; or asks for the status of a legal request (for example "where is LEG-12?"). Legal Desk triages and routes requests. It never gives legal advice.
license: MIT
---

# Legal Desk

Legal Desk is an Atlassian Forge app for Jira, by InBle. It turns a colleague's legal question into a complete, risk-scored Jira ticket for the legal team, so the lawyer never has to ask the same questions twice.

Through the Atlassian MCP server, any MCP-compatible agent can call Legal Desk's tools: score a request, file it in Jira, read the legal queue and look up a request. This skill tells you when to call each tool, in which order, and what you must never do.

## Before you start

1. Legal Desk is installed on the user's Atlassian site (Jira).
2. A site admin has enabled MCP access once: admin.atlassian.com → Apps → Sites → *your site* → Connected apps → Legal Desk → View app details → Details → Tools → **Enable tools** ("Expose tools to MCP-compatible apps").
3. Your MCP client is connected to `https://mcp.atlassian.com/forge/57922510-a15e-4ff2-b93b-e69ea12ff147` and the user has signed in with their Atlassian account (OAuth).

If no Legal Desk tool is available, tell the user which of these three steps is missing. Do not try to reach Jira another way.

## Tools

Tool names can carry an environment suffix, for example `assess-legal-risk_development` on a development install. Always use the tool whose name **starts with** the base name below.

| Tool | What it does | Inputs |
|---|---|---|
| `assess-legal-risk` | Scores a request: risk level and score, suggested turnaround in days, the reasons behind the score, the lawyer's checklist. Read-only: nothing is created. | `requestType` (required) · `amount` · `urgent` · `personalData` · `outsideEu` · `counterparty` |
| `create-legal-request` | Creates the Jira legal ticket with the structured facts, risk labels and due date. Returns the issue key and the due date. | `summary`, `requestType`, `details` (required) · `counterparty` · `amount` · `urgent` · `personalData` · `outsideEu` |
| `list-legal-requests` | Lists Legal Desk requests with risk level, due date and status, overdue and high-risk first. Read-only. | `view`: `open` (default) · `overdue` · `high_risk` · `all` — `maxResults`: 1 to 50 (default 20) |
| `get-legal-request` | Returns one request: status, due date, the intake facts, and the risk as recorded on the ticket (the same level `list-legal-requests` shows), with reasons and checklist. If today's rules would rate it differently, `computedLevel` and `levelSource` say so. Read-only. | `issueKey` (required), for example `LEG-12` |

Input formats: `amount` is a plain number in the company currency (no currency sign, no thousands separator). `urgent`, `personalData` and `outsideEu` are booleans. Everything else is a string.

## Request types

| `requestType` | Use it for | Example |
|---|---|---|
| `contract_review` | A contract to review, sign, renew or terminate | "The supplier wants us to sign their 3-year services agreement." |
| `nda` | NDAs and confidentiality agreements | "A prospect sent their mutual NDA before the demo." |
| `gdpr` | Personal data, privacy, data sharing or transfers | "Marketing wants to share our customer list with a US partner." |
| `dispute` | Claims, formal notices, litigation | "A client refuses to pay and threatens to sue." |
| `ip` | Trademarks, copyright, patents, licences | "Can we use this font in our new logo?" |
| `employment` | Employment contracts, dismissals, HR legal questions | "A manager wants to end an employee's contract during probation." |
| `other` | Any other legal question | "Do we need anything special to run a prize draw?" |

When a request fits two types, pick the one with the higher stake (personal data → `gdpr`; a threatened claim → `dispute`) and mention the other aspect in `details`.

## How the score works

The score is transparent, so you can explain it without guessing:

- Base points by type: `nda` 1, `other` 1, `contract_review` 2, `gdpr` 3, `ip` 3, `employment` 3, `dispute` 4.
- Amount at stake: +1 (any amount), +2 (≥ 10k), +3 (≥ 100k), +4 (≥ 1M).
- Personal data +2 · counterparty or data transfer outside the EU +2 · urgent +1 · counterparty unknown +1.
- Level: low (up to 2), medium (3–5), high (6–8), critical (9 and above).
- Suggested turnaround: a base number of days per type, halved when urgent and halved again when critical.

Always show the reasons returned by the tool rather than recomputing them yourself.

## Workflow A: file a new legal request (intake)

1. Restate the request in one sentence and choose the `requestType`.
2. Collect the facts that change the risk. Ask only for what is missing, one short question at a time, in plain language:
   - Who is the counterparty?
   - What amount is at stake, if any?
   - Is there a real deadline?
   - Is personal data involved?
   - Is the counterparty, or the data transfer, outside the European Union?

   "I don't know" is a valid answer: leave the field out rather than guess.
3. Call `assess-legal-risk` **first**. Show the result as it is: level and score, suggested turnaround, every reason. Do not soften it.
4. Show a short recap (summary, type, facts) and ask for an explicit confirmation before creating anything.
5. Call `create-legal-request` with a one-sentence `summary`, the `details` a lawyer needs (in the user's own words) and the facts you collected.
6. Return the issue key and the due date. If the tool returns `ok: false`, show its error message and stop. Never retry with invented values.

## Workflow B: brief the legal team

1. Call `list-legal-requests` with `view: "overdue"`, then with `view: "high_risk"`. Use `view: "open"` for the whole queue.
2. For each request that needs attention, call `get-legal-request` to read its facts, reasons and checklist.
3. Summarise for the lawyer: what is overdue, what is critical or high-risk, and the checklist each one calls for. Always quote the issue keys so the lawyer can open them in Jira.

## Workflow C: follow up on a request

When the user asks "where is LEG-12?" or "what happened to my NDA request?":

- With an issue key: call `get-legal-request` and answer in two or three lines (status, due date, risk level).
- Without a key: call `list-legal-requests` with `view: "all"`, find the matching request by its summary, confirm it with the user, then call `get-legal-request`.

## Guardrails

- **Triage, never advice.** Legal Desk qualifies and routes requests. Never tell the user whether to sign, what a clause means for them or what the law requires: the legal team answers in the ticket.
- **No invented facts.** Never guess an amount, a counterparty, a date or a deadline. Use the user's words and leave unknowns out.
- **Confirm before writing.** Always get an explicit "yes" before calling `create-legal-request`. Scoring and reading need no confirmation.
- **Minimise personal data.** Describe data categories ("customer emails and order history"), never the data itself. Do not paste personal records, ID numbers or health information into a request.
- **Respect Jira permissions.** A permission or "not found" error means the user cannot see that ticket in Jira. Say so plainly and do not look for a workaround.
- **First read may need one consent.** Read tools run with the user's own Jira permissions. If one answers "Legal Desk cannot act with your Jira permissions yet", tell the user to open the **Legal register** page of the Legal Desk project in Jira once, choose **Allow access**, then retry the same call.- **Report faithfully.** Show the level, score and reasons exactly as returned, and never present the score as a legal opinion.

## Examples

**Intake**

> **User:** A customer wants us to sign their NDA before Friday's demo.
> **Agent:** Understood: an NDA to review before Friday. Who is the customer, and will any personal data be shared?
> **User:** Northwind Ltd, in the UK. No personal data.
> **Agent:** *(calls `assess-legal-risk`: requestType `nda`, counterparty `Northwind Ltd`, urgent `true`, outsideEu `true`, personalData `false`)* Risk: medium (score 4), suggested turnaround 1 day. Reasons: NDA base 1 point; counterparty outside the EU +2; urgent +1. Shall I file it with the legal team?
> **User:** Yes.
> **Agent:** *(calls `create-legal-request`)* Filed as LEG-42, due tomorrow. The legal team will reply in the ticket.

**Briefing**

> **User:** What's waiting at legal?
> **Agent:** *(calls `list-legal-requests` with `view: "overdue"`, then `view: "high_risk"`)* Two requests need attention: LEG-31, sharing customer data with a US partner, critical and overdue since Monday; LEG-35, an urgent supplier contract, high risk and due Thursday. Do you want the checklist for LEG-31?

**Follow-up**

> **User:** Where is LEG-12?
> **Agent:** *(calls `get-legal-request` with `issueKey: "LEG-12"`)* LEG-12, "Review reseller agreement with Acme": In Progress, due 28 November, high risk. The lawyer's checklist covers the counterparty, term and renewal, termination, liability cap and governing law.
