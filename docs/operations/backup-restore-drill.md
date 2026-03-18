# Backup and restore drill

This runbook defines the repeatable backup and restore drill for Mission
Control. Use it to verify that operators can recover within beta targets.

## Scope

This drill validates:
- Logical Postgres backup generation
- Backup retention cleanup
- Encrypted artifact handling
- Restore into a temporary database
- Core table integrity after restore

## Prerequisites

Before you run the drill, ensure:

1. You have shell access to a host with `pg_dump`, `pg_restore`, and `psql`.
2. You have valid database credentials.
3. You have enough disk space for at least one full backup.

## Create backup artifact

Run the backup script with retention and encryption enabled.

```bash
export POSTGRES_HOST=127.0.0.1
export POSTGRES_PORT=5432
export POSTGRES_DB=visgniteai
export POSTGRES_USER=postgres
export POSTGRES_PASSWORD='replace-me'
export BACKUP_DIR=./backups
export BACKUP_RETENTION_DAYS=30
export BACKUP_ENCRYPTION_PASSWORD='replace-with-strong-secret'

./scripts/ops/backup.sh
```

Record the generated backup filename in your incident log.

## Run restore validation

Restore the generated artifact into a temporary database and validate core
schema presence.

```bash
export BACKUP_FILE=./backups/<artifact>.dump.enc
export BACKUP_ENCRYPTION_PASSWORD='replace-with-strong-secret'
export POSTGRES_HOST=127.0.0.1
export POSTGRES_PORT=5432
export POSTGRES_USER=postgres
export POSTGRES_PASSWORD='replace-me'

./scripts/ops/restore-check.sh
```

A successful run prints `Restore drill validation passed`.

## Validation checklist

After the script succeeds, complete this checklist:

- [ ] Backup artifact stored in expected location
- [ ] Retention policy removed old artifacts
- [ ] Restore check passed with no manual intervention
- [ ] Drill duration recorded in ops notes

## Failure handling

If the drill fails:

1. Capture script output and failing command.
2. Check database credentials and network connectivity.
3. Validate backup artifact integrity and decryption secret.
4. Re-run drill after fix and attach evidence to ops notes.

## Cadence

Use this cadence for beta:

- Staging: every 7 days
- Production: every 30 days

## Targets

Use these operational targets during beta:

- RPO: 24 hours
- RTO: 2 hours
