# Operations

This guide covers day-2 operations for FlowGrid in SaaS beta mode.
Use this page as the entry point for readiness checks, backup and restore
workflows, and incident triage.

## Health checks

FlowGrid exposes both liveness and dependency-aware readiness probes.
Use `/healthz` for process-level liveness and `/readyz` for deploy gates.

```bash
curl -sS http://localhost:8000/healthz
curl -sS http://localhost:8000/readyz | jq
```

`/readyz` includes component statuses for:
- Database connectivity (`required=true`)
- Redis connectivity (`required=true`)
- Worker heartbeat freshness (`required=false` when configured)

If a required component fails, `/readyz` returns HTTP `503`.

## Worker heartbeat signal

To include worker liveness in readiness payloads, set these variables in your
runtime environment:

- `WORKER_HEARTBEAT_KEY`
- `READINESS_WORKER_HEARTBEAT_KEY`
- `READINESS_WORKER_HEARTBEAT_MAX_AGE_SECONDS`

In `compose.yml`, backend and `webhook-worker` use a shared key by default.

## Logs

Use correlated fields to triage incidents quickly.

- `request_id`
- `organization_id`
- `actor_id`
- `endpoint`

### Docker Compose examples

```bash
# Tail all services
docker compose -f compose.yml --env-file .env logs -f --tail=200

# Tail backend only
docker compose -f compose.yml --env-file .env logs -f --tail=200 backend
```

## Backups

Use `scripts/ops/backup.sh` to create logical Postgres backups with retention.
For production, encrypt backup artifacts at rest.

```bash
# Required env vars: POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD
BACKUP_DIR=./backups \
BACKUP_RETENTION_DAYS=30 \
BACKUP_ENCRYPTION_PASSWORD='replace-with-strong-secret' \
./scripts/ops/backup.sh
```

## Restore drills

Run restore drills with `scripts/ops/restore-check.sh`. This script restores
into a temporary database, validates core tables, then cleans up.

```bash
BACKUP_FILE=./backups/mission-control-20260308T040000Z.dump.enc \
BACKUP_ENCRYPTION_PASSWORD='replace-with-strong-secret' \
POSTGRES_USER=postgres \
POSTGRES_PASSWORD=postgres \
./scripts/ops/restore-check.sh
```

Drill cadence:
- Staging: weekly
- Production: monthly

RPO and RTO targets for beta:
- RPO: 24 hours
- RTO: 2 hours

## Runbooks

Use these focused runbooks for live operations:

- [Backup and restore drill](./backup-restore-drill.md)
- [Incident triage](./incident-triage.md)
- [Billing simulated incident playbook](./billing-simulated-incident-playbook.md)
- [Board overlay rollout playbook](./board-overlay-rollout-playbook.md)

## Rollback notes

If a release degrades tenant isolation, readiness, or quota enforcement:

1. Roll back application version first.
2. If schema changes are incompatible, restore from a validated backup.
3. Rotate affected tokens if incident scope includes authentication compromise.
