# Better Stack homepage checks — preparation and activation

## October 9 activation status

Three homepage monitors were observed active and Up, each checking every three
minutes. The provider account was still on the Free plan after activation.
Email-only routing and the intended responder were checked. The owner confirmed
receipt of ordinary test emails. Recipient identities, account identifiers and
private provider evidence are deliberately excluded from this public summary.

The saved settings differ between the owner's existing Federation monitor and
the two newly added monitors:

| Homepage | Alert condition | Request timeout | Failure confirmation | Recovery period | Follow redirects | TLS verification |
| --- | --- | --- | --- | --- | --- | --- |
| https://galacticfederation.co/ | URL becomes unavailable (vendor default) | 30 seconds | Immediate | 3 minutes | On | On |
| https://dossiertrack.co/ | Status other than HTTP 200 | 10 seconds | 60 seconds | 60 seconds | Off | On |
| https://fcc.galacticfederation.co/ | Status other than HTTP 200 | 10 seconds | 60 seconds | 60 seconds | Off | On |

All three use GET. Optional keyword monitors have not been activated. These are
saved configuration values, not promises of end-to-end alert timing or evidence
of long-term uptime.

The homepage monitors do not establish wallet, RPC, pricing, account login,
Lens, record storage or staking health. Service checks remain a separate scope.
The manual availability checker combines status, HTML content and title checks;
the activated vendor status monitors do not perform all of those assertions.

## Isolated failure and recovery drill

Status: a separate monitor draft is prepared, but it has not been created or
started. Its recurring check and failure/recovery notifications need explicit
owner approval before submission.

Proposed settings: name `DRILL ONLY - Federation alert and recovery`, public
target `https://galacticfederation.co/`, GET, three-minute interval, ten-second
timeout, TLS verification on, redirects/cookie carryover off, sixty-second
failure confirmation and recovery, email only to the existing intended owner.
The three operational homepage monitors remain in place.

1. Create the separate drill monitor with expected HTTP 503 while the target
   normally returns HTTP 200. The deliberately mismatched expectation simulates
   an incident without changing the website or an operational monitor.
2. Wait for an actual failed check and incident. Record the provider's observed
   failure time and delivery result; do not substitute a Send test alert receipt
   for a failure-triggered notification.
3. Open the isolated incident and acknowledge it. Record the acknowledgment
   method and resulting state. Notification dispatch is not proof of receipt.
4. Change only the drill monitor's expected status to HTTP 200. Wait for its
   healthy checks and automatic resolution after the configured recovery
   period. Do not manually resolve the incident to manufacture this result.
5. Verify the recovery notification and record whether the owner received it.
   Keep dispatch, receipt, acknowledgment and automatic resolution distinct.
6. Pause only the drill monitor when complete and preserve the dated evidence.
   Stop if the provider requests an upgrade, new paid feature or wider routing.

Overall time includes the polling interval, confirmation and recovery periods.
A configured sixty-second period is not an end-to-end sixty-second deadline.
Submit each notification or creation action once; inspect its result before
considering a retry when the page responds slowly.

The earlier ordinary email test and the active homepage checks are verified.
The isolated failure/acknowledgment/recovery cycle remains pending. This does
not complete the broader monitoring and response release gate.

## October 8 preparation record

`config/better-stack-public-monitors.json` remains a set of safe, paused create
templates with all notification channels disabled. It is not a current vendor
inventory, not a bulk API request, and was not replayed to activate these
monitors. Each `body` is a separate proposed create-monitor payload.

The template proposes three exact-200 checks plus three optional keyword checks.
Keyword checks search response content; they do not establish HTML title,
content type or exact status. Confirm plan allowance, routing and cost before
creating additional monitors. No vendor credentials are stored in this repository.

Reference: [official create-monitor parameters](https://betterstack.com/docs/uptime/api/create-a-new-monitor/).
