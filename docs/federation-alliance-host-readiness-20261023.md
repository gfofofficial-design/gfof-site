# Closed member host: integration readiness

This is a source review checklist, not a deployment manifest or activation
approval. No hosted resources, permissions, subscriptions or credentials are
created by this document. The member application remains default-off.

## Compose the correct protocols

Use the member authority transport for startup decisions and deletion witnesses.
The account-history checkpoint service is a different protocol and cannot supply
either response. Pin the member authority to a separate numeric Lambda version,
the exact regional API/stage/resource, caller public descriptor, scope and two
purpose-specific verification keys. Do not use `$LATEST` or an alias as identity.

Construct the actual anchored control and journal issuers. Injected callbacks
are capabilities, not evidence of their backing stores, permissions or custody.
Retain independently reviewed current minima; do not infer a new minimum from
the live table or reset a checkpoint to make startup pass.

## Coordinate deadlines before deploying

Current source bounds are:

| Component | Current bound | Composition implication |
| --- | --- | --- |
| Member transport client | Up to 6000 ms | Must allow the complete remote exchange and response validation. |
| Member authority handler | Up to 5500 ms | Lambda must report at least the configured handler budget plus 500 ms. |
| Durable member nonce store | Default 1500 ms, maximum 2000 ms | Admission completes before issuer dispatch; it is part of the handler budget. |
| Control issuer | Default 3000 ms, maximum 3500 ms | Includes its dependent reads and signing work. |
| Journal witness issuer | Default/maximum 8000 ms | Its default exceeds the handler budget; select an explicit shorter budget. |
| Restricted journal reader | Up to 1500 ms | Account for all sequential reads, not just one query. |
| KMS signer | Up to 1200 ms | Includes public-key checking, signing and local verification. |

These are ceilings, not measured latency or recommended production settings.
Do not add a nested signer's deadline twice to an issuer deadline that already
contains it. Conversely, sequential nonce admission and issuer work share the
outer deadline. Reserve time for serialization, network transit and verification.
Read each chosen factory's actual sequencing before setting the final budgets.

Select explicit budgets for the complete call graph, then measure the closed
host under normal and slow dependencies. Verify cancellation, late results,
unknown nonce writes and instance closure at the boundaries. The outer timer
does not prove remote work was canceled. Do not increase deadlines as a
substitute for finding a slow dependency or add retries after uncertain writes.

## Bind actual resources and least privilege

- Identify the existing keys and recovery records before any provisioning.
  The KMS proposal is not proof that keys were created, imported or accepted.
  Review actual costs and access before any new paid resource or key operation.
- Bind member replay admission to its own `alliance-member-nonce-*` resource,
  exact account/region/table UUID and caller key. The account gateway's nonce
  capability is not interchangeable. Confirm atomic conditional admission,
  strongly consistent readback, TTL behavior and replay rejection across hosts.
- Use a separately reviewed journal reader for history reads. The existing
  journal executor can write/admit and is not a read-only signing credential.
  Apply the reader proposal only after matching the actual catalogue and state;
  do not reinstall or repair automatically on a mismatch.
- Keep database passwords separate from signing capabilities. Validate exact
  database/role identity, TLS/CA/channel binding, function rights and isolation.
- Review exact execution IAM, ingress/resource policy, immutable package
  provenance, signing purposes, log redaction/retention and fleet shutdown.
  Source context checks alone are not independent AWS identity attestation.
- Two signers in one process/operator domain do not establish independent
  administration. Document the actual boundary and existing recovery copies.

## Closed acceptance before a release decision

1. Read actual hosted state and retained evidence; reconcile first installation
   versus recovery without overwriting existing roots, records or data.
2. Verify package/version/resource bindings and restricted startup while member
   serving remains off. Unknown or mismatched evidence must remain unavailable.
3. In the protected trial, use explicitly authorized test accounts to exercise
   profile creation/revision, listing/unlisting and image-access ownership.
4. Exercise two-peer invitations, consent, contributions, acknowledgements,
   replay rejection and hide/unhide. Check revoked sessions and service closure.
5. Exercise profile removal and unknown-outcome reconciliation. Verify retained
   deletion evidence continues withholding records after an isolated restore.
6. Check physical phone and keyboard/assistive flows, unavailable messages and
   help outside sign-in. Disposable fixtures do not establish these outcomes.
7. Reconcile production email delivery evidence before any new email attempt.
   A settings save alone is not successful sign-in. Do not repeatedly resend.
8. Record exact artifacts and results, then review the merge/deploy scope.
   Public admission, live competitions and financial features are separate
   decisions; passing this checklist does not silently enable them.

Related source: member-authority transport, member KMS and journal authority
reader documents dated 2026-10-22. Those documents retain the protocol details
and remaining limitations. This checklist introduces no user-facing steps or
timed owner input.
