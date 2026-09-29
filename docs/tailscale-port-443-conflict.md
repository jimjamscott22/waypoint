# Tailscale and Pi-hole port 443 conflict

- Status: Open follow-up
- First observed: 2026-09-29
- Environment: Raspberry Pi 5 after backup restoration and migration to Raspberry Pi OS/Debian Trixie

## Summary

Waypoint is healthy on its loopback listener, and Tailscale Serve still records an HTTPS reverse-proxy configuration for the app. However, requests to the Pi's Tailscale hostname on TCP port 443 receive Pi-hole's self-signed certificate instead of the certificate and Waypoint response expected from Tailscale Serve.

The likely context is that Pi-hole or Tailscale networking state changed or was restored inconsistently during the recent Raspberry Pi backup restoration and Trixie migration. That is a working hypothesis, not a confirmed root cause. Do not overwrite either service's configuration from an old backup until the current and archived configurations have been compared.

## Confirmed state

The following was verified during the 2026-09-29 Waypoint deployment:

- Waypoint release `/opt/waypoint/releases/20260929T210922Z-20970cb-updates` was active.
- `waypoint.service` was running from that release.
- `http://127.0.0.1:3000/api/health` returned `status: ok` with both provider and location resolution configured.
- `http://127.0.0.1:3000/api/bootstrap` returned HTTP 200.
- Tailscale Serve reported HTTPS port 443 proxying `/` to `http://127.0.0.1:3000` for `desktop-pi.tail837b53.ts.net`.
- `pihole-FTL` was listening on wildcard addresses `0.0.0.0:443` and `[::]:443`.
- A TLS connection to `desktop-pi.tail837b53.ts.net:443` returned a certificate with `CN=pi.hole`, issued by Pi-hole's self-signed CA, rather than a Tailscale certificate for the `*.ts.net` hostname.
- A normal `curl` request therefore failed certificate validation with `self-signed certificate in certificate chain`.

This isolates the problem to HTTPS routing/listener ownership on port 443. It is not a Waypoint process, database, build, or loopback-health failure.

## Expected architecture

Waypoint binds only to `127.0.0.1:3000`. Tailscale Serve should terminate private tailnet HTTPS and proxy the request to that loopback address:

```text
Authorized tailnet client
        |
        | HTTPS to desktop-pi.tail837b53.ts.net:443
        v
Tailscale Serve TLS termination
        |
        | HTTP to 127.0.0.1:3000
        v
Waypoint
```

The repository currently configures this mapping with:

```bash
tailscale serve --bg --https=443 http://127.0.0.1:3000
```

Current Tailscale documentation describes `tailscale serve --https=<port> <target>` as an HTTPS endpoint where the Tailscale daemon terminates TLS using an automatically provisioned certificate.

## Reproduce and inspect

These commands are read-only unless noted otherwise. They do not expose Waypoint or database credentials.

```bash
# Confirm Waypoint itself is healthy.
curl --fail --silent --show-error http://127.0.0.1:3000/api/health

# Inspect the stored Serve mapping.
tailscale serve status --json

# Identify the process that owns the host's HTTPS listeners.
sudo ss -ltnp '( sport = :443 )'

# Inspect the certificate actually returned for the Tailscale hostname.
openssl s_client \
  -connect desktop-pi.tail837b53.ts.net:443 \
  -servername desktop-pi.tail837b53.ts.net \
  -showcerts </dev/null

# Compare current service configuration with any verified pre-Trixie backup.
sudo systemctl cat pihole-FTL.service
sudo systemctl cat tailscaled.service
```

Also inspect Pi-hole's current webserver/listener configuration and compare it with the verified backup copy. Do not print files that contain passwords, API tokens, or other secrets into an issue or commit message.

## Questions to answer before changing configuration

1. Did the pre-Trixie Pi-hole configuration listen on all interfaces and port 443, or was that introduced during restoration or package reconfiguration?
2. Did the previous OS use a different Pi-hole web stack or listener layout?
3. Is Tailscale Serve expected to coexist with Pi-hole on the node's port 443 in the current networking mode, or did a restored firewall/network setting previously separate their traffic paths?
4. Does an authorized remote tailnet device reproduce the Pi-hole certificate, or is the behavior different only for connections originating on the Pi itself?
5. Which stable URL should be preserved for Waypoint before choosing a remediation?

## Remediation options for later

Do not apply these options without first recording the current Pi-hole and Tailscale configurations and confirming rollback steps.

### Option A: Restrict Pi-hole's HTTPS listener

Adjust Pi-hole so its web interface does not claim the Tailscale address or otherwise conflict with Waypoint's tailnet HTTPS endpoint. This best preserves Waypoint's existing URL, but it must not break Pi-hole administration or DNS service. The exact change depends on the Pi-hole version and the restored configuration.

### Option B: Move Waypoint Serve to another HTTPS port

Tailscale Serve supports `--https=<port>`. Moving Waypoint to a free port avoids the local 443 collision, but users must include that port in the URL. If selected, update `deploy/scripts/configure-tailscale.sh`, this runbook, any bookmarks, and the verification procedure together.

### Option C: Define a Tailscale Service

A Tailscale Service can provide a distinct service name and virtual IP instead of sharing the node's identity and listener space. This may provide the cleanest long-term separation, but it requires tailnet administration, service approval, and access-control review. It is a larger operational change than restoring the previous node-level behavior.

## Resolution checklist

- [ ] Capture current Pi-hole, Tailscale, firewall, and interface-listener state without exposing secrets.
- [ ] Locate and checksum-verify the relevant pre-Trixie configuration backup.
- [ ] Compare current and backed-up listener/network configuration.
- [ ] Reproduce the failure from both the Pi and an authorized remote tailnet device.
- [ ] Choose a remediation that preserves private-only access; do not enable Funnel or public port forwarding.
- [ ] Record rollback commands before applying the change.
- [ ] Verify Pi-hole DNS and administrative access after the change.
- [ ] Verify `curl --fail http://127.0.0.1:3000/api/health` still succeeds.
- [ ] Verify the Waypoint tailnet URL presents the expected `*.ts.net` certificate and returns Waypoint.
- [ ] Verify access is allowed only for intended tailnet identities/devices.
- [ ] Update `deploy/scripts/configure-tailscale.sh` and deployment documentation if the permanent endpoint changes.

## References

- [Tailscale Serve overview](https://tailscale.com/docs/features/tailscale-serve)
- [Tailscale `serve` CLI reference](https://tailscale.com/docs/reference/tailscale-cli/serve)
- [Tailscale Services](https://tailscale.com/docs/features/tailscale-services)
- [`deploy/scripts/configure-tailscale.sh`](../deploy/scripts/configure-tailscale.sh)
- [`docs/deployment-raspberry-pi.md`](deployment-raspberry-pi.md)
