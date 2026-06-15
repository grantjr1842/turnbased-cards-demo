# Runbook: Redis Presence Connection Lost

## Overview

The Colyseus game server uses `@colyseus/redis-presence` to share matchmaker
state, room listings, and client-to-room mappings across multiple server
processes. When the Redis connection is lost, cross-process functionality
degrades while single-process functionality continues to work.

This runbook covers the case where the server **can no longer reach Redis**
at the configured `REDIS_URL` or `REDIS_HOST` / `REDIS_PORT`.

For background on why Redis presence is needed and how it's configured,
see [`docs/scaling.md`](../scaling.md).

## Symptoms

Player-facing:

- Clients see "room unavailable" or "disconnected" errors when attempting
  to join a room hosted on a different process
- Reconnection fails: a player who disconnects cannot rejoin a room they
  were in, even after retrying
- Matchmaking takes much longer than usual, or returns no results even
  when rooms are visible
- New room creation may silently fail — the client receives no error
  but the room never becomes joinable

Server-side:

- Server logs show Redis connection errors:
  - `ECONNREFUSED` on the Redis port
  - `Connection is closed.` from `ioredis` or `redis` clients
  - `ReconnectOnError` triggered repeatedly
- `GET /metrics` shows the Redis client status gauge as `down` (see
  Detection below)
- Pino log fields tagged with `ns: "Matchmaking"` or `ns: "Presence"`
  show failure patterns
- Server processes remain up and responsive — this is not a crash

## Detection

The `/metrics` Prometheus endpoint (added in Epic 3.2, commit `12292ba`)
exposes the Colyseus internal metrics. The relevant signals are:

| Metric | What to look for |
|--------|------------------|
| `colyseus_rooms_count` | Should remain stable. A sudden drop indicates room evictions. |
| `colyseus_clients_count` | May drop as cross-process clients fail to reconnect. |
| Process `nodejs_eventloop_lag_seconds` | Should remain low (< 1s). A spike suggests Redis is blocking. |
| Pino log stream | Filter for `error` level with `redis`, `presence`, or `matchmaker` in the message. |

Alerts that should be wired in production monitoring (not yet deployed —
see Long-term fix):

- `redis_connected_clients < 1` for more than 30 seconds
- Pino error log rate for `redis` namespace exceeds 5 per minute
- `colyseus_rooms_count` drops by more than 10% in 5 minutes

For ad-hoc verification during an incident:

```bash
# Confirm Redis is reachable from the server host
redis-cli -h $REDIS_HOST -p $REDIS_PORT ping
# Expected: PONG

# Check the server is configured to use Redis
grep -E "REDIS_URL|REDIS_HOST" /etc/uno-server.env
# Both should be set in multi-process deployments

# Watch server logs for Redis errors
journalctl -u uno-server -f | grep -i redis
```

## Immediate Mitigation

The goal is to restore service quickly, not to fix the root cause. Choose
the path that matches your deployment.

### Option A: Restart the server (fastest, 30 seconds)

1. Restart all Colyseus processes: `systemctl restart uno-server` (or
   your process manager's restart command).
2. Clients will reconnect automatically (Colyseus supports reconnection
   with the same session ID).
3. In-flight games on a single process continue — those players should
   not be affected.
4. Verify with `curl http://<server>:2567/healthz` (the healthcheck
   endpoint added in commit `8ce8a9d`).
5. Watch `colyseus_rooms_count` for 1 minute to confirm rooms
   re-establish.

This works for most transient Redis outages (network blip, Redis
restart, brief OOM kill). The reconnect logic in
`@colyseus/redis-presence` will re-establish the connection.

### Option B: Fail over to a backup Redis (if configured)

If your deployment has a Redis replica (Sentinel or Cluster):

1. Verify the replica is healthy: `redis-cli -h <replica> ping`.
2. Update the `REDIS_URL` env var on all server processes to point at
   the replica.
3. Restart processes (or use a rolling restart to minimize player
   disruption).
4. Revert the `REDIS_URL` change once the primary Redis is back.

### Option C: Fall back to single-process mode (last resort)

If Redis is irrecoverable and no replica is available:

1. Stop all but one Colyseus process.
2. Verify the remaining process is reachable and accepting connections.
3. Players connecting to the surviving process will continue to play,
   but no cross-process matchmaking will work (irrelevant with a
   single process).
4. Communicate the degraded state to users — matchmaking for new games
   may be slower or unavailable.

This is the lowest-trust mitigation. Use only when Options A and B have
failed.

## Long-term Fix

The immediate mitigation restores service, but the root cause must be
addressed. Common root causes and their fixes:

### Network-level

- **Symptom:** `ECONNREFUSED` or `ETIMEDOUT` on the Redis port.
- **Investigation:** Check `traceroute $REDIS_HOST` from the server
  host. Look for network device failures, route changes, or firewall
  rule changes.
- **Fix:** Repair the network path. Consider a dedicated VPC peering
  or Direct Connect for the server-to-Redis link.

### Redis OOM or eviction

- **Symptom:** `redis-cli info memory` shows `used_memory` near
  `maxmemory`, or `evicted_keys` is increasing.
- **Investigation:** Check `redis-cli info stats` for `evicted_keys`
  and `keyspace_hits` / `keyspace_misses` ratios. Presence keys
  accumulating is a sign of clients not unregistering cleanly.
- **Fix:** Increase `maxmemory` (if host has RAM), or shorten the
  presence key TTL. Set `maxmemory-policy noeviction` so presence
  doesn't get evicted under pressure.

### Redis persistence not enabled

- **Symptom:** After a Redis restart, presence state is empty and all
  clients need to re-register.
- **Fix:** Enable AOF (`appendonly yes`) or RDB snapshots in
  `redis.conf`. For multi-node deployments, use Sentinel or Cluster
  for HA rather than relying on persistence.

### Server-side connection leak

- **Symptom:** Each reconnect attempt opens a new Redis connection
  rather than reusing the existing one. Connection count grows until
  Redis hits `maxclients`.
- **Investigation:** `redis-cli info clients` shows the server's
  connection count growing over time.
- **Fix:** Check the `@colyseus/redis-presence` version and upgrade
  if there's a known leak fixed upstream. As a workaround, restart
  server processes on a rolling schedule.

### Monitoring and prevention

The following are recommended for any production deployment:

1. **Health check the Redis connection from the server.** Add a periodic
   `redis-cli ping` (or use the existing `ioredis` client status) to a
   `/healthz` sub-endpoint or a Prometheus gauge.
2. **Alert on `redis_connected_clients < 1`** for any server process
   for more than 30 seconds. This catches the failure before players
   notice.
3. **Run Redis with persistence enabled** (AOF + RDB) so a Redis
   restart doesn't require a full server-side reconnect.
4. **Test the failover path.** Periodically kill Redis and verify the
   server recovers within the time budget. This validates the runbook
   itself.

## Postmortem Template

After the incident is resolved, write a postmortem. File it in this
directory as `redis-presence-lost-<YYYY-MM-DD>.md` and link it below.

```markdown
# Postmortem: Redis Presence Connection Lost

**Date:** YYYY-MM-DD
**Duration:** HH:MM (from first detection to mitigation)
**Severity:** [P0 | P1 | P2 | P3]
**Detection:** [How was this discovered? Alert, user report, internal?]
**Resolver:** [Name]

## Summary

[1-2 sentence summary of what happened and the user impact.]

## Timeline (UTC)

- HH:MM — [Event]
- HH:MM — [Event]
- ...

## Root cause

[What actually caused the Redis connection loss. Be specific — e.g.,
"OOM kill at HH:MM due to presence key accumulation from misbehaving
client in vN.N.N of @colyseus/redis-presence."]

## Impact

- Players affected: [N]
- Games interrupted: [N]
- Cross-process matchmaking downtime: [HH:MM]
- Single-process gameplay availability: [up | degraded | down]

## What went well

- [e.g., "Alert fired within 60 seconds of the failure."]
- [e.g., "Mitigation A worked first try, no need for B or C."]

## What went poorly

- [e.g., "Detection signal was log scraping, not a metric."]
- [e.g., "Took 10 minutes to identify the right runbook."]

## Action items

- [ ] [Action] — [Owner] — [Due date]
- [ ] [Action] — [Owner] — [Due date]
```

## Postmortems

_(Postmortems filed under this runbook will be linked here.)_
