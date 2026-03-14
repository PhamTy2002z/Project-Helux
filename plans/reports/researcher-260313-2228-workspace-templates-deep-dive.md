# Workspace Templates Feature Research — Deep Dive Report

**Date:** 2026-03-13
**Scope:** OpenClaw workspace structure, template composition, provisioning patterns, and technical feasibility for Project Helux
**Status:** Comprehensive research complete with evidence-based findings and unresolved questions

---

## Executive Summary

OpenClaw workspaces ARE template-friendly and programmatically provisionalable. The system uses a **file-based configuration model** without a REST provisioning API, requiring Helux to write workspace files directly to the managed gateway filesystem. Key findings:

- ✅ **Workspace structure is documented and standardizable** — fixed set of bootstrap files + skills folder
- ✅ **Hot reload is partial** — openclaw.json reloads without restart, but workspace files require session restart
- ✅ **Templates exist in community** — starter kits, multi-agent configs, pre-built agent personality sets available
- ⚠️ **Isolation on shared gateway is NOT hostile-secure** — multiple agents can coexist but are not cryptographically isolated
- ❌ **No REST API for workspace provisioning** — Helux must SSH/Docker COPY files or write via container mounts
- ✅ **Skills installation is file-copy based** — copy SKILL.md files to workspace, then restart for discovery

---

## 1. OpenClaw Workspace Structure (EXACT Details)

### 1.1 Directory Layout

**Location:** `~/.openclaw/workspace` (configurable via `agents.defaults.workspace` in openclaw.json)

```
~/.openclaw/workspace/
├── AGENTS.md                  # Operating instructions + memory guidance
├── SOUL.md                    # Agent personality, tone, boundaries
├── IDENTITY.md                # Agent name, emoji, vibe (auto-generated during bootstrap)
├── USER.md                    # User identity and communication preferences
├── TOOLS.md                   # Tool guidance and conventions
├── HEARTBEAT.md               # (optional) Lightweight checklist for heartbeat runs
├── BOOT.md                    # (optional) Startup ritual executed on gateway restart
├── BOOTSTRAP.md               # (optional) One-time first-run ritual — DELETED after completion
├── MEMORY.md                  # (optional) Curated long-term memory for private sessions only
├── memory/                    # Daily session logs
│   ├── 2026-03-13.md
│   ├── 2026-03-12.md
│   └── ...
├── skills/                    # Workspace-specific skills override bundled ones
│   └── <skill-name>/
│       └── SKILL.md
└── canvas/                    # (optional) UI files for node displays
```

### 1.2 Bootstrap File Specifications

| File | Size Limit | Auto-Delete | Purpose | Required |
|------|-----------|-----------|---------|----------|
| AGENTS.md | 20K chars | No | Operating instructions, memory guidance | ✅ Yes |
| SOUL.md | 20K chars | No | Persona, tone, boundaries | ✅ Yes |
| IDENTITY.md | 20K chars | No | Agent name, emoji, vibe | ✅ Yes |
| USER.md | 20K chars | No | User profile preferences | Optional |
| TOOLS.md | 20K chars | No | Tool guidance | Optional |
| HEARTBEAT.md | 20K chars | No | Heartbeat checklist | Optional |
| BOOT.md | 20K chars | No | Startup ritual (runs on gateway restart) | Optional |
| BOOTSTRAP.md | 20K chars | **YES** | First-run ritual; auto-deleted after completion | Optional |
| MEMORY.md | 20K chars | No | Curated long-term memory | Optional |

**Total constraint:** 150K characters across all files combined.

**Missing file behavior:** Missing files trigger markers in logs but DO NOT halt operations. Agent continues normally.

### 1.3 File Formats

**AGENTS.md Format** — Structured markdown with emoji markers:
```markdown
# Operating Instructions

## First Run
[Reference to BOOTSTRAP.md for initial setup]

## Session Startup
- Checklist of files to read: SOUL.md, USER.md, memory files

## Memory
- Daily notes saved to memory/YYYY-MM-DD.md
- Long-term notes go to MEMORY.md (private sessions only)

## Red Lines
[Boundaries and safety rules]

## External vs Internal
- What requires permission
- What is safe to do autonomously

## Group Chats
[Rules for shared channels]

## Tools
[References to skills and local configuration]

## Heartbeats
[Guidelines for periodic check-ins]

## Make It Yours
[Encouragement to customize]
```

**SOUL.md Format** — Free-form markdown defining personality:
```markdown
# Soul

You are [name]. You operate with these principles:
- [Principle 1]
- [Principle 2]

Your tone: [tone description]
Your boundaries: [boundary list]
```

**IDENTITY.md Format** — Minimal structured data:
```markdown
# Identity

- **Name:** Agent name
- **Emoji:** 🤖
- **Vibe:** Short descriptor
```

**TOOLS.md Format** — Markdown with tool descriptions and safety guidance:
```markdown
# Tools

## Available Tools
- exec: [description]
- read/write: [description]
- web_search: [description]

## Safety Guidelines
[Tool-specific constraints]
```

**SKILL.md Format** — YAML frontmatter + markdown:
```yaml
---
name: "Skill Name"
description: "What this skill does"
version: "1.0.0"
author: "Author Name"
tags: ["tag1", "tag2"]
---

# Skill Name

[Markdown description and usage instructions]
```

**MEMORY.md Format** — Markdown with date sections (for long-term memory):
```markdown
# Memory

## 2026-03-13
- Learned about user preferences
- Important decision: [decision]

## 2026-03-12
- Completed task X
```

### 1.4 Storage in Mission Control Context

For agents assigned to Helux-managed gateways:

```
~/.openclaw/
├── openclaw.json              # Global config + channel bindings
├── agents/
│   ├── main/                  # Default agent
│   │   ├── agent              # State + auth profiles
│   │   └── sessions/          # Chat history (JSONL)
│   ├── <agent-id>/            # Multi-agent routing
│   │   ├── agent
│   │   └── sessions/
│   └── ...
├── workspace/                 # Single shared workspace (if single-agent mode)
├── workspace-<agent-id>/      # Per-agent workspaces (if multi-agent)
└── .env                       # Environment variables for ${VAR} substitution
```

---

## 2. Hot Reload and Modification Behavior

### 2.1 Configuration Reload (openclaw.json)

✅ **Changes apply without gateway restart:**
- Gateway watches `~/.openclaw/openclaw.json` for changes
- Debounce: default 750ms
- Reload mode: `hybrid` (most config hot-applies, some require restart)
- Rate limit: 3 config requests per 60 seconds per deviceId+clientIp

**Hot-reload capable fields:**
- `agents.list` (multi-agent routing rules)
- `channels.*` (channel configurations)
- `session.*` (session policies)
- `tools.*` (tool access policies)
- Most model/provider settings

**Restart-required fields:** (documented but incomplete)
- Some sandbox settings may require restart
- Gateway binding changes may require restart

### 2.2 Workspace File Reload (AGENTS.md, SOUL.md, etc.)

❌ **NOT hot-reloaded. Requires session restart:**
- Workspace files are injected at session START
- Changes to AGENTS.md, SOUL.md, etc. are NOT picked up mid-session
- **User must start a new session** to see changes: `/new` or `/reset`

**Exception:** If you modify a workspace file BEFORE the first session starts, the changes will be loaded on first run.

**Implication for Helux:** When applying a workspace template, the changes take effect on:
1. The NEXT session (if already running)
2. Immediately on new session creation (if gateway is idle)

### 2.3 Skills Reload

❌ **Skills are NOT hot-reloaded:**
- OpenClaw scans `~/.openclaw/workspace/skills/` at gateway STARTUP
- Skills are snapshotted into memory at boot
- **Gateway restart is required** after copying new SKILL.md files

**Implication:** Skill installations must be followed by either:
- Explicit `openclaw gateway restart`, OR
- Wait for natural gateway restart

---

## 3. Existing Template & Starter Patterns in Community

### 3.1 Official Starting Templates

**OpenClaw Reference Templates** (from docs.openclaw.ai):
- `/docs/reference/templates/AGENTS.md` — official template with structured sections
- Normalized baseline configs for minimal setup

**Configuration Examples:**
- https://docs.openclaw.ai/gateway/configuration-examples

### 3.2 Community Starter Kits

| Project | Link | What It Provides |
|---------|------|------------------|
| **openclaw-starter-kit** | https://github.com/jeffweisbein/openclaw-starter-kit | Personality, memory, autonomy. Workspace template with AGENTS.md, SOUL.md, MEMORY.md patterns |
| **openclaw-agents** | https://github.com/shenhao-stu/openclaw-agents | Multi-agent setup. 9 specialized AI agents with group routing. Safe config merge pattern. |
| **openclaw-multi-agent-kit** | https://github.com/raulvidis/openclaw-multi-agent-kit | Production-tested multi-agent templates. 10 agent personalities. Telegram supergroup integration. Bot-to-bot communication. |
| **awesome-openclaw-agents** | https://github.com/mergisi/awesome-openclaw-agents | Curated collection of 103 pre-built agent templates. Copy-paste-ready SOUL.md configs for productivity, dev, marketing, business personas. |
| **awesome-openclaw-skills** | https://github.com/VoltAgent/awesome-openclaw-skills | 5,400+ skills categorized. Useful for skill library in Helux. |
| **ClawTemplate** | https://clawtemplate.com/ | Template builder. Pre-built configs + skills + security + deployment. Exportable bundles. |

### 3.3 Template Composition Patterns

**Customer Support Bot Template:**
```
SOUL.md: Friendly, helpful, empathetic tone
AGENTS.md: Handling customer inquiries, escalation rules, knowledge base references
TOOLS.md: Message, read (KB docs), web_search
IDENTITY.md: "Support Bot 🤖"
Skills: ticket_management, knowledge_search, sentiment_analysis
```

**Code Review Agent Template:**
```
SOUL.md: Thorough, constructive feedback, code quality focused
AGENTS.md: PR review workflow, comment on specific lines, approval gates
TOOLS.md: read (code), web_search (frameworks), browser (Github)
IDENTITY.md: "Code Review 👀"
Skills: diff_analysis, lint_checking, vulnerability_scanner
```

**Content Writer Template:**
```
SOUL.md: Creative, engaging, brand-aware tone
AGENTS.md: Writing workflow, editing guidelines, SEO considerations
TOOLS.md: web_search (research), read (style guides), write (drafts)
IDENTITY.md: "Writer ✍️"
Skills: seo_analyzer, plagiarism_checker, grammar_checker
```

**Minimal Functional Workspace:**
```
AGENTS.md     ← Required (operating instructions)
SOUL.md       ← Required (personality)
IDENTITY.md   ← Required (name + emoji)
[No BOOTSTRAP.md, no MEMORY.md initially]
[No special skills]
```

---

## 4. Technical Feasibility for Programmatic Provisioning

### 4.1 Provisioning Methods

**Option A: SSH + File Write (if self-hosted gateway)**
```bash
# From Helux backend
ssh gateway@host.com << 'EOF'
mkdir -p ~/.openclaw/workspace
cat > ~/.openclaw/workspace/AGENTS.md << 'AGENT'
[file content]
AGENT
# Repeat for SOUL.md, IDENTITY.md, etc.
EOF
```

**Option B: Docker Volume Mount (managed gateway in container)**
```bash
# At container creation time:
docker run \
  -v /path/to/workspace-template:/root/.openclaw/workspace \
  openclaw:latest
```

**Option C: Docker COPY (baked into image)**
```dockerfile
FROM openclaw:latest
COPY workspace/AGENTS.md /root/.openclaw/workspace/AGENTS.md
COPY workspace/SOUL.md /root/.openclaw/workspace/SOUL.md
# ...
```

**Option D: Config Patching (for openclaw.json changes only)**
```bash
# RPC call to gateway:
openclaw gateway call config.patch --params '{
  "raw": "{ channels: { telegram: {...} } }",
  "baseHash": "<current-hash>"
}'
# Rate limit: 3 req/60s
```

### 4.2 Gateway State at Template Application

**Scenario 1: Gateway is idle (no active sessions)**
- ✅ Write workspace files
- ✅ Next session picks up changes immediately

**Scenario 2: Gateway has active sessions**
- ⚠️ Write workspace files (they're readable)
- ⚠️ EXISTING sessions don't see changes (injected at session start)
- ✅ NEXT session will load new files
- ⚠️ Current session sees old context until `/new` or `/reset`

**Recommendation:** For predictable behavior, apply templates during maintenance windows or coordinate with users to reset sessions after template application.

### 4.3 Skills Installation Workflow

**Step 1: Copy SKILL.md files**
```bash
mkdir -p ~/.openclaw/workspace/skills/my-skill
cat > ~/.openclaw/workspace/skills/my-skill/SKILL.md << 'EOF'
[skill content]
EOF
```

**Step 2: Trigger gateway restart**
```bash
openclaw gateway restart
# OR let natural restart happen
```

**Step 3: Confirm skill loaded**
```bash
openclaw skills list
# OR check gateway logs: "Skill <name> loaded"
```

---

## 5. Configuration Programmatic Updates (RPC)

### 5.1 Available RPC Methods

| Method | Purpose | Rate Limit | Restart Required |
|--------|---------|-----------|-----------------|
| `config.get` | Read current config or path | 3/60s | No |
| `config.apply` | Full config replacement | 3/60s | Partial (hot-applies most) |
| `config.patch` | Partial JSON merge patch | 3/60s | Partial (hot-applies most) |

### 5.2 Example: Programmatic Agent Routing

```bash
# Get current config hash
HASH=$(openclaw gateway call config.get --params '{}' | jq -r '.payload.hash')

# Patch to add multi-agent routing
openclaw gateway call config.patch --params '{
  "raw": "{ bindings: [ { agentId: \"support\", match: { channel: \"whatsapp\", accountId: \"support\" } } ] }",
  "baseHash": "'$HASH'"
}'
```

### 5.3 Limitations

- **Rate limit:** 3 requests per 60 seconds per deviceId+clientIp
- **No workspace file modification via RPC:** Must use file I/O
- **Validation:** Invalid config is rejected; full config must be valid JSON5

---

## 6. Risks & Edge Cases

### 6.1 Conflicting Workspace Files on Shared Gateway

**Scenario:** Multiple users/organizations on same gateway trying to provision agents

**OpenClaw's answer:**
- NOT designed for hostile multi-tenant isolation
- Security model is "personal assistant" (one trusted operator, many agents)
- Multiple agents CAN coexist, but are NOT cryptographically isolated

**Recommended isolation:** Run separate gateway instances per trust boundary, not one gateway per agent.

**In Helux context:** If you provision multiple boards on one managed gateway, they WILL share:
- Same gateway config (channels, models, hooks)
- Same skills snapshot (restart affects all agents)
- Same cron jobs (shared scheduler)

**Mitigation:** Use agent-level sandboxing:
```json5
{
  agents: {
    list: [
      {
        id: "org1-agent",
        sandbox: { mode: "all", scope: "agent" },
        tools: { allow: ["read"], deny: ["exec", "write"] }
      }
    ]
  }
}
```

### 6.2 Template Versioning and Updates

**Problem:** Updating a template after initial deployment.

**Current OpenClaw approach:**
- No built-in versioning system
- Templates are point-in-time snapshots
- Updating AGENTS.md doesn't auto-propagate to existing sessions

**Helux approach:**
- Store template versions in Helux DB: `workspace_templates` table with `version` + `created_at`
- Track which template version was used for each agent: `agents.template_id` + `agents.template_version`
- On template update, provide UI option: "Apply latest template to this agent?"
- Document breaking changes in template changelog

### 6.3 Sensitive Fields in Workspace

**Security concern:** API keys, tokens, credentials in workspace files.

**OpenClaw's approach:** Use environment variables instead of hardcoding secrets.

**In AGENTS.md or other files, reference:**
```markdown
Use the GITHUB_TOKEN to authenticate:
${GITHUB_TOKEN}

In USER.md:
API_KEY: ${OPENAI_API_KEY}
```

**In .env file:**
```bash
GITHUB_TOKEN=ghp_xxxxx
OPENAI_API_KEY=sk-xxxxx
```

**Security implications:**
- Files in workspace/ should be version-controlled WITHOUT secrets
- `.env` file should be in `.gitignore` or kept in secure store (e.g., Helux secrets management)
- Permissions: 700 on directories, 600 on files

### 6.4 File Ownership and Permissions

**When Helux writes workspace files via SSH or Docker:**
- Ensure files are owned by the OpenClaw process user (e.g., `openclaw:openclaw` or `root`)
- Permissions: 755 for directories, 644 for files (readable by gateway)
- If gateway runs as different user, ensure permission compatibility

---

## 7. Multi-Workspace vs Multi-Agent Architecture

### 7.1 Single-Agent (Default)

```
agents.defaults.workspace = "~/.openclaw/workspace"
agents.list = [ { id: "main" } ]
```

All agents use one shared workspace. **Simplest for Helux.**

### 7.2 Multi-Agent (Advanced)

```
agents.defaults.workspace = "~/.openclaw"  # Parent directory
agents.list = [
  { id: "main" },
  { id: "support" },
  { id: "dev" }
]
```

Each agent gets its own workspace:
```
~/.openclaw/
├── workspace-main/
├── workspace-support/
├── workspace-dev/
```

**Implication:** For Helux to provision different agents with different templates, you must:
1. Set up multi-agent routing in openclaw.json
2. Create separate workspace directories for each agent
3. Apply different templates to each workspace

---

## 8. Integration Pattern Recommendation for Helux

### 8.1 Workflow for "Create Agent from Template"

```
User clicks "Create Agent" + selects template (e.g., "Customer Support Bot")
    ↓
Helux Backend:
  1. Validate organization has capacity (entitlements)
  2. Fetch template from Helux templates table
  3. Create new Agent record in DB
  4. Provision gateway:
     a. SSH to managed gateway host
     b. Write workspace files (AGENTS.md, SOUL.md, IDENTITY.md, etc.)
     c. Patch openclaw.json with agent routing (if multi-agent)
     d. Skip gateway restart (workspace files load on next session)
  5. Return agent ID to frontend
    ↓
User interacts with agent:
  - First session loads workspace files automatically
  - Existing sessions unaffected
```

### 8.2 Storage and Persistence

**In Helux DB:**
```sql
CREATE TABLE workspace_templates (
  id UUID PRIMARY KEY,
  name VARCHAR,           -- "Customer Support Bot"
  slug VARCHAR,          -- "customer-support-bot"
  description TEXT,
  category VARCHAR,      -- "customer-service"
  version INT,           -- Template version
  created_at TIMESTAMP,
  created_by UUID,
  is_public BOOLEAN,     -- Available to all orgs or specific ones
  file_contents JSONB    -- { "AGENTS.md": "...", "SOUL.md": "...", ... }
);

CREATE TABLE agents (
  id UUID PRIMARY KEY,
  board_id UUID,
  organization_id UUID,
  template_id UUID REFERENCES workspace_templates,
  template_version INT,  -- Track which template version was applied
  gateway_id UUID,
  workspace_path VARCHAR, -- ~/.openclaw/workspace (or workspace-{id})
  created_at TIMESTAMP,
  ...
);
```

### 8.3 Error Handling

**Template Application Failures:**
- SSH connection failure → Mark gateway degraded, retry queue
- File write permission denied → Logs + escalate to ops
- Invalid template format → Validation in Helux before applying

**User Experience:**
- "Template applied. Agent will be ready on first session."
- Show progress: "Writing workspace files..." → "Done"
- Link to test: "Start a conversation to activate agent"

---

## 9. Security Considerations

### 9.1 Secrets Management

**DO:**
- Store API keys in `~/.openclaw/.env`
- Reference via `${API_KEY}` in workspace files
- Keep .env in `.gitignore`
- Use Helux secrets manager to store env values

**DON'T:**
- Hardcode API keys in AGENTS.md
- Store keys in workspace files checked into git
- Expose .env file to agents (too easy to exfiltrate)

### 9.2 Template Injection Attacks

**Concern:** Malicious template files could execute commands.

**OpenClaw's design:** Workspace files are MARKDOWN, not executable.
- AGENTS.md is just prompt text
- BOOTSTRAP.md is instructions, not code
- Skills (SKILL.md) can execute but are code, not templates

**In Helux:**
- Validate template content before storing
- Sanitize markdown to prevent weird injection
- Only allow trusted template creators to publish

### 9.3 Cross-Organization Isolation

**Concern:** Org A's template leaking to Org B.

**In Helux:**
- Store templates with `organization_id` or `is_public` flag
- Query: `SELECT * FROM workspace_templates WHERE is_public OR organization_id = ?`
- Multi-tenant RBAC on template endpoints

---

## 10. Question Resolution Status

### Answered (Evidence-Based)

✅ **What files exist in ~/.openclaw/?**
- Documented: AGENTS.md, SOUL.md, IDENTITY.md, USER.md, TOOLS.md, HEARTBEAT.md, BOOT.md, BOOTSTRAP.md, MEMORY.md

✅ **What is the exact format of bootstrap files?**
- AGENTS.md: Markdown with emoji sections and guidance
- SOUL.md: Markdown personality definition
- IDENTITY.md: Key-value pairs (Name, Emoji, Vibe)
- TOOLS.md: Markdown with tool descriptions

✅ **How are skills stored?**
- Location: ~/.openclaw/workspace/skills/<skill-name>/SKILL.md
- Format: YAML frontmatter + markdown
- Discovery: Snapshot at gateway startup (requires restart)

✅ **How does OpenClaw load workspace config on startup?**
- Workspace files injected at SESSION start (not gateway start)
- Hot reload for openclaw.json only
- Workspace changes require /new or /reset to take effect

✅ **Can workspace files be modified mid-session?**
- Yes, physically writeable, but not visible to running session
- Next session will load changes

✅ **Do templates exist in the community?**
- YES: awesome-openclaw-agents (103 templates), openclaw-agents, multi-agent-kit, ClawTemplate builder

✅ **Can config be updated via RPC?**
- YES: config.patch (partial), config.apply (full)
- Rate limit: 3/60s

✅ **Is multi-tenant isolation hostile-secure?**
- NO: Multiple agents can coexist but are not cryptographically isolated
- Recommended: Separate gateway instances for hostile boundaries

---

## 11. Unresolved Questions

❓ **What is the exact timeout/deadline for workspace file injection at session start?**
- Not documented; assumed immediate
- Impact: Rare edge case (should not affect Helux implementation)

❓ **Does removing a file from workspace (e.g., deleting AGENTS.md) cause agent malfunction or graceful fallback?**
- Documentation says "missing files trigger markers but don't halt operations"
- Exact fallback behavior not specified

❓ **If two agents share same workspace directory in multi-agent mode, what happens if they modify MEMORY.md simultaneously?**
- Architecture suggests separate workspaces per agent
- No documentation of shared workspace behavior

❓ **What is the preferred method to detect "has template been applied successfully"?**
- Check workspace file existence?
- Query agent readiness?
- Not explicitly documented

❓ **In Helux multi-tenant, if one organization's template exceeds 150K character limit, what happens?**
- Gateway startup fails? Or just that agent?
- Injected into context or pre-validated?

❓ **Can ClawTemplate builder export be directly used by Helux or is it only for human-initiated setup?**
- Likely for human setup; unclear if API/programmatic use is supported

---

## 12. Recommendations for Helux Implementation

### Phase 1: MVP (Single-Agent per Gateway)

1. **Start simple:** Use single shared workspace per gateway
2. **Template storage:** Helux DB with JSON blob of file contents
3. **Provisioning:** SSH write to ~/.openclaw/workspace/ on managed gateway
4. **No multi-agent yet:** Keep one template active per gateway

### Phase 2: Enhanced (Template Library)

1. **Expand templates:** Seed with awesome-openclaw-agents collection
2. **UI for template creation:** Allow users to customize templates
3. **Versioning:** Track template versions; offer "apply update" flow

### Phase 3: Advanced (Multi-Agent)

1. **Multi-agent support:** Separate workspace per agent, routing in openclaw.json
2. **Per-agent templates:** Different agents on same gateway, different personas
3. **Skills library:** Integrate with awesome-openclaw-skills for discovery

---

## References

- [OpenClaw Agent Workspace](https://docs.openclaw.ai/concepts/agent-workspace)
- [OpenClaw Configuration](https://docs.openclaw.ai/configuration)
- [OpenClaw Gateway Configuration Reference](https://docs.openclaw.ai/gateway/configuration-reference)
- [Configuration Examples](https://docs.openclaw.ai/gateway/configuration-examples)
- [AGENTS.md Template](https://docs.openclaw.ai/reference/templates/AGENTS)
- [openclaw-starter-kit](https://github.com/jeffweisbein/openclaw-starter-kit)
- [openclaw-agents](https://github.com/shenhao-stu/openclaw-agents)
- [openclaw-multi-agent-kit](https://github.com/raulvidis/openclaw-multi-agent-kit)
- [awesome-openclaw-agents](https://github.com/mergisi/awesome-openclaw-agents)
- [awesome-openclaw-skills](https://github.com/VoltAgent/awesome-openclaw-skills)
- [ClawTemplate](https://clawtemplate.com/)
- [OpenClaw Security](https://docs.openclaw.ai/gateway/security)
- [OpenClaw Skills](https://docs.openclaw.ai/tools/skills)
- [Configuration RPC Methods](https://docs.openclaw.ai/gateway/configuration)
- [Multi-tenant OpenClaw Deployment](https://github.com/jomafilms/openclaw-multitenant)
- [OpenClaw Secrets Management](https://lumadock.com/tutorials/openclaw-secrets-management)

---

**Report Status:** COMPLETE
**Evidence Quality:** HIGH (community examples verified, official docs cited)
**Actionability:** READY FOR IMPLEMENTATION PLANNING
