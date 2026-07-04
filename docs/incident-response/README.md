# Incident Response Runbooks

This directory contains runbooks for known failure modes in the production
game server. Each runbook is a self-contained document covering symptoms,
detection, immediate mitigation, long-term fix, and a postmortem template.

## When to use a runbook

A runbook is the right place to look when:

- An alert has fired (see "Detection" in each runbook)
- Operators see symptoms reported in a runbook's "Symptoms" section
- A recurring failure mode has been identified and documented

If the failure mode is not documented here, treat it as a new incident —
see the "Postmortem" section of the closest existing runbook for the
template, and add a new runbook once the root cause is understood.

## Runbooks

| Failure mode | Runbook | Severity |
|--------------|---------|----------|
| Redis presence connection lost | [redis-presence-lost.md](./redis-presence-lost.md) | High |
| _(more runbooks to be added as failure modes are identified)_ | | |

## How to use a runbook

1. **Confirm the symptoms.** Read the "Symptoms" section. If they match,
   proceed. If not, this isn't the right runbook.
2. **Verify the detection signal.** Check that the alert or log signature
   described in "Detection" is actually present. False positives waste
   mitigation effort.
3. **Apply immediate mitigation.** This is the fastest path to a stable
   state. The goal is to stop the bleeding, not fix the root cause.
4. **Investigate the long-term fix.** Root-cause analysis happens after
   the immediate impact is contained. The "Long-term fix" section
   describes what to look for.
5. **Write a postmortem.** Use the template at the bottom of the runbook.
   File the postmortem as a doc in this directory and link it from the
   runbook's "Postmortems" section.

## General principles

- **Single-process degradation is acceptable short-term.** If Redis is
  down, the game server should still work for players who happen to
  connect to the same process. Cross-process matchmaking will be
  broken, but that's recoverable.
- **Restart is a valid mitigation.** Most Colyseus presence issues
  resolve on a server restart. Don't be afraid to restart as the first
  mitigation step.
- **Check the metrics first.** `GET /metrics` (Prometheus format) is the
  authoritative source of truth for what's actually happening. Logs
  may be misleading if Redis is buffering writes.
- **Communicate with the team.** Use the on-call channel. Even a quick
  "I'm investigating X" prevents duplicate work.
