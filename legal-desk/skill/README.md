# Legal Desk skill for AI agents (MCP)

An open-source skill that teaches any AI agent to use **Legal Desk for Jira** through the Atlassian MCP server: score a legal request, file it as a complete Jira ticket, read the legal queue and follow up on a request, without ever giving legal advice.

| File | What it is |
|---|---|
| [`SKILL.md`](SKILL.md) | The skill, in the Agent Skills format (YAML front matter + instructions) |
| [`legal-desk-skill.zip`](legal-desk-skill.zip) | The same skill packaged as `legal-desk/SKILL.md`, ready to upload |
| [`LICENSE`](LICENSE) | MIT |

## 1. Connect the Legal Desk tools (once per site)

1. Install Legal Desk on your Atlassian site: <https://rfkbzz.github.io/inble-outils/legal-desk/install.html>
2. A site admin enables MCP access: admin.atlassian.com → Apps → Sites → *your site* → Connected apps → Legal Desk → View app details → Details → Tools → **Enable tools**.
3. Add this MCP server to your client, then sign in with your Atlassian account when prompted (OAuth):

```
https://mcp.atlassian.com/forge/57922510-a15e-4ff2-b93b-e69ea12ff147
```

Configuration examples (check your client's current documentation, as commands change):

**Claude Code**

```bash
claude mcp add --transport http legal-desk https://mcp.atlassian.com/forge/57922510-a15e-4ff2-b93b-e69ea12ff147
```

Then run `/mcp` inside Claude Code to sign in.

**Cursor and other clients that read an `mcpServers` JSON file**

```json
{
  "mcpServers": {
    "legal-desk": {
      "url": "https://mcp.atlassian.com/forge/57922510-a15e-4ff2-b93b-e69ea12ff147"
    }
  }
}
```

## 2. Add the skill to your agent

- **Claude Code**: copy `SKILL.md` to `~/.claude/skills/legal-desk/SKILL.md` (just for you) or to `.claude/skills/legal-desk/SKILL.md` in a repository (shared with your team).
- **Claude (claude.ai and Claude Desktop)**: open the Skills section of the settings and upload `legal-desk-skill.zip`.
- **Any other agent** (Cursor rules, Copilot instructions, a custom system prompt): paste the content of `SKILL.md` into the agent's instructions.

## Tools the skill uses

| Tool | Purpose |
|---|---|
| `assess-legal-risk` | Risk level and score, suggested turnaround, reasons, lawyer checklist (read-only) |
| `create-legal-request` | Files the structured, scored request as a Jira ticket with a due date |
| `list-legal-requests` | The legal queue: open, overdue, high-risk or all requests (read-only) |
| `get-legal-request` | One request by issue key: status, facts, risk, checklist (read-only) |

Tool names can carry an environment suffix (for example `_development`); the skill tells the agent to match on the base name.

## Tested

Verified end-to-end on 25 Nov 2026 with a standards-based MCP client (OAuth 2.1 dynamic client registration + PKCE): tools/list and tools/call.

## Privacy

Legal Desk is an Atlassian Forge app with no outbound network access: requests are stored as Jira issues on your own site. Privacy policy: <https://rfkbzz.github.io/inble-outils/legal-desk/privacy.html>. Support: In26Ble@outlook.fr.

## License

MIT © 2026 InBle. See [`LICENSE`](LICENSE).
