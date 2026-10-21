# Netlify signing adapter and finite preview preparation

October 19, 2026. This increment implements a server-only secret-store adapter;
it does not install a key, expose a function, change permissions or open joining.
The existing closed AWS packages and their hosted settings remain unchanged.

## Implemented component

`createNetlifyGatewaySigningRuntime` wraps the existing finite public-key policy
and signing provider with a request-scoped Netlify Function context. It returns
`run`, `signingKey` and `close`, and defaults off. The future trusted handler
passes its actual second `Context` argument to `run`; it must never substitute
a body, header, URL or client-supplied object. The independently retained
expected installation still contains exactly site ID, deploy ID and context.

Only `context.site.id`, `context.deploy.id` and `context.deploy.context` are read.
They are checked before admitting the callback and before/after private lookup.
AsyncLocalStorage confines lookup to the current invocation; asynchronous work
retained from an ended invocation cannot borrow the next invocation's scope.
One invocation is admitted at a time. The whole local scope has a maximum
6000 ms deadline, while private-key loading retains the existing maximum
1500 ms bound. Closing/cancelling retires admission; it cannot revoke a key
already returned to trusted code or prove remote work stopped.

The default store adapter reads only
`process.env.FEDERATION_ACCOUNT_GATEWAY_ED25519_PKCS8`, using the documented
Serverless Functions environment interface. There is no Edge global, file,
metadata, AWS credential, alternate name, enumeration or fallback. The reader
is injectable solely for trusted composition/tests, not from request input.
Import and default-off construction read no environment value.

The private-store contract is canonical base64 of exactly48 bytes of Ed25519
PKCS8 DER. No trimming, PEM conversion, passphrase or private export occurs.
The existing public SPKI fingerprint and finite validity window must match.
The temporary DER Buffer is overwritten after parsing. Strings, OpenSSL memory
and garbage collection are not securely zeroized by this step. A store/parse/
fingerprint/deadline failure faults the signing provider with sanitized errors;
it does not try another key, cache a previous one or generate a replacement.

These context checks establish application wiring, not platform attestation,
member identity, branch attestation, effective secret scope or a compromised
application's inability to read its own environment. A trusted caller can
fabricate context or retain a returned KeyObject. No secret is stored by this
source increment, and no mounted route uses the adapter yet.

## Proposed installation, still pending separate review

1. Capture only public site/deploy/context metadata into an independently
   reviewed server manifest. Do not derive the expected values from the same
   runtime context being tested. Do not embed a private key in build output.
2. Create a distinct preview-only signing key through an approved custody
   procedure. Store it as a secret with Functions scope on the exact reviewed
   branch/context. Check actual metadata without revealing the value. Use no
   production/dev/all-context value and no Builds/Post-processing scope.
   Context matching alone does not isolate a branch or other site functions.
3. Deploy the reviewed server composition and record its exact immutable deploy
   ID. Netlify snapshots environment values per deployment, so changing the
   stored value does not exclude old deployments. Restrict/retire their access
   and check old-key refusal before reopening; expiry is not instant revocation.
4. Assemble the AWS installation from independently reviewed numeric function
   versions, API ID/stage, separate table ARN/TableId pairs, nonce epoch, root
   key/custody, three actual account-project references, account epoch, control
   verification key, minimum checkpoint receipt and public caller descriptor.
   A closed `$LATEST` deployment is not an enabled numeric-version binding.
   Do not fill missing fields with examples, table reads or fixture roots.
5. Generate the existing exact gateway/authority identity policies and matching
   boundaries only after every binding is present. Gateway rights remain
   limited to its own nonce prefix and one authority version; authority rights
   remain limited to its own exact root key. Validate with AWS tooling and
   separately approve any replacement of deny-all boundaries and ingress grants.

## Proposed finite trial envelope

This is a review proposal, not authorization or an executable trial command.
Start only once the key/root/manifest/logging and allowed/denied test inventory
have independent evidence. Use no real member profile, wallet, price/RPC call,
admission or erasure operation. Public registration stays closed.

- One owner-controlled test principal, one reviewed branch/deploy, one exact
  API stage/path, one synthetic test case per listed outcome. No background
  runner, automatic renewal, fan-out, polling loop or business retry.
- A15-minute public caller-key authorization window; choose absolute UTC start
  and end immediately before the separately approved trial. A maximum of24
  gateway requests total, with at most12 requests admitted far enough to claim
  a nonce or dispatch the authority. Stop on uncertainty, unexpected access,
  data mismatch, unredacted output or budget overrun.
- Reserved concurrency1 on each function only for the approved trial, retaining
  the existing256MiB and10s/6s AWS timeouts. Return both to0 when the test ends
  or any stop condition occurs. These settings and DynamoDB throughput targets
  limit work; they do not provide a monetary spending cap or prevent unsolicited
  edge traffic. Actual current pricing and observed usage require separate review.
- Record only case IDs, public version/binding digests, sanitized outcomes and
  independent checkpoint receipts. Suppress request/response body and signature
  logging at the application/API/platform layers; no key, credential, member
  identifier or raw payload in reports. The exact logging configuration and
  finite retention remain prerequisites, not completed controls.
- Divide acceptance into allowed receipt, wrong caller/fingerprint/expiry,
  replay and wrong scope/version/route cases. Real wrong-role/table/key/admin
  denials require separately scoped test-principal permissions and their own
  approved call inventory. Mocks are not evidence of installed AWS denials.
- Teardown means close ingress, set both concurrency limits0, retire old
  integrations/grants/key acceptance, and preserve consumed nonces through the
  replay/in-flight window. Keep deletion protection; no table or custody-record
  deletion/reset is proposed by this trial envelope.

## Verification and remaining release work

The focused tests use newly generated synthetic keys only in test processes.
They cover default-off/import isolation, the actual single-field process-env
reader in an isolated child, matching signing, no private export, context
mismatch/mutation, malformed/foreign values, provider quarantine, expiry,
cancellation/busy/close/deadline and retained asynchronous work. The child
inherits no parent credential environment and emits no key material.

The source has no deploy handler, public manifest injection or installation
switch. Actual key custody, initial/current root custody, IAM, API/rate/log
controls, old-fleet exclusion, real sign-in/phone and member privacy/abuse/
recovery/assistive acceptance remain required before public joining.

Primary sources reviewed October19:
[Functions Context](https://docs.netlify.com/build/functions/api/),
[Serverless Functions environment](https://docs.netlify.com/build/functions/environment-variables/),
[variable scopes](https://docs.netlify.com/build/environment-variables/overview/),
and [Secrets Controller](https://docs.netlify.com/build/environment-variables/secrets-controller/).
