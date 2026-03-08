# Incident triage

This playbook explains how to triage SaaS incidents by `request_id` and
`organization_id`. Use these steps for support escalations and on-call response.

## Inputs

Collect these values first:

- Reported time window in UTC
- `request_id` from client response headers or logs
- `organization_id` from support context
- Suspected endpoint path

## Step 1: Verify readiness state

Check service and dependency readiness before deeper debugging.

```bash
curl -sS http://localhost:8000/healthz
curl -sS http://localhost:8000/readyz | jq
```

If `/readyz` returns HTTP `503`, resolve dependency health first.

## Step 2: Pull correlated logs

Filter backend logs by `request_id` or `organization_id`.

```bash
docker compose -f compose.yml --env-file .env logs backend --since=30m | rg 'request_id=<id>'
docker compose -f compose.yml --env-file .env logs backend --since=30m | rg 'organization_id=<org-id>'
```

When JSON logging is enabled, parse fields with `jq`.

## Step 3: Inspect tenant SLO metrics

Check tenant-scoped SLO metrics for error rate, latency, queue lag, and quota
usage.

```bash
curl -sS \
  -H "Authorization: Bearer <admin-token>" \
  http://localhost:8000/api/v1/metrics/tenant-slo?range_key=24h | jq
```

## Step 4: Validate audit trail

For admin-sensitive mutations, inspect activity events with event type prefix
`admin.` and match by `organization_id`.

```sql
SELECT event_type, message, created_at
FROM activity_events
WHERE organization_id = '<org-id>'::uuid
  AND event_type LIKE 'admin.%'
ORDER BY created_at DESC
LIMIT 100;
```

## Step 5: Decide response path

Use this decision matrix:

- Dependency outage: stabilize DB or Redis, then retry failed requests.
- Tenant-isolated regression: halt rollout and execute rollback checklist.
- Abuse or quota breach: tune plan assignment or rate-limit policy.
- Unknown root cause: escalate with request samples, logs, and metrics payloads.

## Escalation package

Before handing off, include:

- Incident summary
- `request_id` sample set
- `organization_id`
- Relevant `/readyz` payload
- `tenant-slo` payload
- Recent `admin.*` audit events
