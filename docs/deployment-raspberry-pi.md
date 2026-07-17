# Raspberry Pi deployment and operations

This runbook deploys Waypoint privately on Raspberry Pi OS Lite 64-bit. Fastify listens only on `127.0.0.1:3000`; Tailscale Serve is the only client entry point. MariaDB remains local to the Pi and is never exposed to browser clients.

## 1. Prerequisites

- Raspberry Pi 5 running Raspberry Pi OS Lite 64-bit, preferably from SSD/NVMe.
- MariaDB 10.6 or newer already running locally.
- Node.js 24 ARM64 installed at `/usr/bin/node`.
- Tailscale installed, connected to the intended tailnet, and authenticated.
- An Adzuna application ID and key.

Do not change MariaDB's bind address, existing users, schemas, or remote-access configuration. For a native service use `/run/mysqld/mysqld.sock`. For a container, publish MariaDB only to `127.0.0.1` and use `DB_HOST=127.0.0.1` plus `DB_PORT`.

## 2. Provision MariaDB

Choose three strong, distinct passwords. Run the following as a local MariaDB administrator, substituting the passwords before execution:

```sql
SELECT VERSION();

CREATE DATABASE IF NOT EXISTS waypoint
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'waypoint_app'@'localhost'
  IDENTIFIED BY 'RUNTIME_PASSWORD';
GRANT SELECT, INSERT, UPDATE, DELETE ON waypoint.*
  TO 'waypoint_app'@'localhost';

CREATE USER IF NOT EXISTS 'waypoint_migrate'@'localhost'
  IDENTIFIED BY 'MIGRATION_PASSWORD';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, DROP, INDEX, REFERENCES
  ON waypoint.* TO 'waypoint_migrate'@'localhost';

CREATE USER IF NOT EXISTS 'waypoint_backup'@'localhost'
  IDENTIFIED BY 'BACKUP_PASSWORD';
GRANT SELECT, SHOW VIEW, TRIGGER ON waypoint.*
  TO 'waypoint_backup'@'localhost';

FLUSH PRIVILEGES;
SHOW GRANTS FOR 'waypoint_app'@'localhost';
SHOW GRANTS FOR 'waypoint_migrate'@'localhost';
SHOW GRANTS FOR 'waypoint_backup'@'localhost';
```

For loopback TCP, create equivalent accounts for host `127.0.0.1` instead of `localhost`. Do not grant global privileges or `GRANT OPTION`.

## 3. Install a release

Build on the Pi or another Node 24 ARM64-compatible environment:

```bash
npm ci
npm test
npm run build
RELEASE_ID="$(date -u +%Y%m%dT%H%M%SZ)"
RELEASE_DIR="/opt/waypoint/releases/$RELEASE_ID"
sudo install -d -o root -g root /opt/waypoint/releases
sudo install -d -o root -g root "$RELEASE_DIR"
sudo cp -a dist server deploy docs package.json package-lock.json "$RELEASE_DIR/"
sudo npm ci --omit=dev --prefix "$RELEASE_DIR"
sudo useradd --system --home /nonexistent --shell /usr/sbin/nologin waypoint 2>/dev/null || true
```

This explicit artifact excludes `.env`, `.git`, source-only files, caches, and unrelated workspace contents. Keep the `RELEASE_DIR` value for the activation step. Keep at least one previous release directory for rollback. The release is read-only to the service user.

## 4. Configure secrets

```bash
sudo install -d -m 0700 -o root -g root /etc/waypoint
sudo install -m 0600 -o root -g root /opt/waypoint/releases/RELEASE_ID/deploy/waypoint.env.example /etc/waypoint/waypoint.env
sudo install -m 0600 -o root -g root /opt/waypoint/releases/RELEASE_ID/deploy/migration.env.example /etc/waypoint/migration.env
sudo install -m 0600 -o root -g root /opt/waypoint/releases/RELEASE_ID/deploy/backup.env.example /etc/waypoint/backup.env
sudoedit /etc/waypoint/waypoint.env
sudoedit /etc/waypoint/migration.env
sudoedit /etc/waypoint/backup.env
```

The runtime and scraper units read only `waypoint.env`; they never receive migration or backup credentials. Quote password values in `migration.env` so the root-run migration helper can safely source it. Never log or paste the environment file contents.

## 5. Migrate and install systemd units

The migration command verifies MariaDB 10.6+, sets UTC sessions, obtains `GET_LOCK('waypoint:migrate', 30)`, and records checksums in `schema_migrations`.

```bash
RELEASE_DIR="/opt/waypoint/releases/RELEASE_ID"
cd "$RELEASE_DIR"
sudo chmod 0755 deploy/scripts/*.sh
sudo WAYPOINT_RELEASE_DIR="$RELEASE_DIR" "$RELEASE_DIR/deploy/scripts/migrate-waypoint.sh"
sudo ln -sfn "$RELEASE_DIR" /opt/waypoint/current
sudo install -m 0644 deploy/systemd/*.service deploy/systemd/*.timer /etc/systemd/system/
sudo install -d -m 0700 -o root -g root /var/backups/waypoint
sudo systemctl daemon-reload
sudo systemd-analyze verify /etc/systemd/system/waypoint*.service /etc/systemd/system/waypoint*.timer
sudo systemctl enable --now waypoint.service waypoint-scraper.timer waypoint-db-backup.timer
```

If using the socket, confirm the `waypoint` user can traverse the socket directory and connect as `waypoint_app`. Do not add broad filesystem permissions.

## 6. Configure private HTTPS

Run once as a Tailscale administrator on the Pi:

```bash
sudo /opt/waypoint/current/deploy/scripts/configure-tailscale.sh
tailscale serve status --json
```

Restrict the Pi's Waypoint HTTPS service to the owner's identity/devices in the tailnet ACL or grants policy. Do not enable Funnel, router port forwarding, or a public DNS proxy. Verify access from an authorized tailnet device and denial from a device outside the allowed policy.

## 7. Verify operation

```bash
curl --fail http://127.0.0.1:3000/api/health
systemctl status waypoint.service waypoint-scraper.timer waypoint-db-backup.timer
systemctl list-timers waypoint-scraper.timer waypoint-db-backup.timer
journalctl -u waypoint.service -u waypoint-scraper.service --since today
sudo systemctl start waypoint-scraper.service
```

The scraper timer's next execution should be 06:00 America/New_York. The backup timer should be 02:30 in the same zone. `Persistent=true` catches a missed run after reboot. A manual in-app run is rejected during an active scrape and for 15 minutes after the previous manual run.

## 8. Backups and restore testing

The backup unit creates a gzip-compressed, transactionally consistent logical dump plus SHA-256 file under `/var/backups/waypoint`, retaining 14 daily copies.

```bash
sudo systemctl start waypoint-db-backup.service
sudo ls -l /var/backups/waypoint
cd /var/backups/waypoint
sudo sha256sum -c waypoint-*.sql.gz.sha256
```

Test restore into a separate database; never overwrite production for a drill:

```bash
sudo mariadb -e "CREATE DATABASE waypoint_restore_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
gzip -dc /var/backups/waypoint/waypoint-TIMESTAMP.sql.gz | sudo mariadb waypoint_restore_test
sudo mariadb waypoint_restore_test -e "SHOW TABLES; SELECT COUNT(*) FROM schema_migrations;"
sudo mariadb -e "DROP DATABASE waypoint_restore_test"
```

Copy backups off the Pi to another encrypted device or storage service. Local SSD/NVMe improves database reliability but is not a substitute for an off-device copy.

## 9. Upgrade and rollback

For an upgrade, build and stage a new immutable production artifact as in step 3. Run migrations against the staged release using only `migration.env`; activate it only after migration succeeds:

```bash
NEW_RELEASE="/opt/waypoint/releases/NEW_RELEASE_ID"
sudo chmod 0755 "$NEW_RELEASE"/deploy/scripts/*.sh
sudo WAYPOINT_RELEASE_DIR="$NEW_RELEASE" "$NEW_RELEASE/deploy/scripts/migrate-waypoint.sh"
sudo ln -sfn "$NEW_RELEASE" /opt/waypoint/current
sudo systemctl restart waypoint.service
curl --fail http://127.0.0.1:3000/api/health
```

To roll back application code, repoint `current` to the prior release and restart. SQL migrations are forward-only; restore a verified backup only when a release explicitly requires a database rollback.

## Troubleshooting

- `DATABASE_VERSION_UNSUPPORTED`: upgrade MariaDB; the detected version is included in the startup error.
- `Access denied`: verify the unit received the correct account file and that socket versus TCP account host matches.
- `RUN_IN_PROGRESS`: another web or timer-triggered run holds the MariaDB advisory lock.
- `RUN_COOLDOWN`: wait until 15 minutes after the last manual trigger; scheduled runs are unaffected.
- Partial or failed runs: inspect sanitized `scrape_run_queries` errors and `journalctl -u waypoint-scraper.service`. Credentials and keyed provider URLs are intentionally excluded from logs.
- No matches: check `/api/health` for `providerConfigured`, query enablement, Adzuna credentials, and each query's maximum age.
- Tailscale unavailable after reboot: check `tailscaled`, then `tailscale serve status --json`; background Serve configuration should persist.
