# Closed AWS preview packages

The account gateway and authority can now be packaged as separate Lambda ZIPs
with `index.handler` at the archive root and the existing pinned production
dependencies included. These packages are **closed staging artifacts**. Their
entry points construct only the existing default-off runtimes: the gateway
returns a generic 503 and the authority throws a generic unavailable error.
Requests, environment flags and configuration-shaped bodies cannot enable them.
There is no enabled installation manifest or root initialization in either ZIP.

This source increment adds no cloud apply command, enabled entry point, IAM
grant, function URL, API deployment, signing-key operation or registration change.
It is packaging and local verification, not a working hosted account service.

## Reproducible build

Use Node24 and a clean checkout of the exact reviewed source. In
`lib/alliance-avatar-server`, install the production dependencies from the lock:

```text
npm ci --ignore-scripts --no-audit --no-fund --omit=dev
```

Build each package with `node aws-lambda-package.mjs`, followed by four arguments:

1. `gateway` or `authority`.
2. The absolute path to the reviewed `lib/alliance-avatar-server` source.
3. The absolute path to that clean dependency install, containing the identical
   `package.json`, `package-lock.json` and installed `node_modules`.
4. A new absolute output ZIP path **outside the checkout and dependency tree**.

The `package:aws:closed` npm script runs the same builder. The output ZIP and
adjacent `.review.json` must not exist. Never put generated packages in a website
publish directory or commit dependencies/build outputs to the review branch.
`--offline` may be added to the install when the exact dependency cache exists;
it was used for this local preparation. Install scripts remain disabled.

The builder reads only 16 named runtime/entry source files, the two package
metadata files and files in the exact installed lockfile package paths. It
refuses symlinked directories/files, mismatched staging metadata, unpinned or
wrong-version package metadata, install-script packages and unexpected path
forms. Extra files outside those paths are not copied. The approved production
dependency set is retained intact, including `pg`; these closed AWS handlers do
not use PostgreSQL. No dependency is fetched or installed by the builder itself.

Entries are sorted, use fixed ZIP timestamps and regular 0644 modes, and contain
no source tests, SQL, documentation, environment files, operator records or
installation manifest. The builder records source/dependency file hashes and the
original lock inside the archive. The external review records ZIP/code hashes,
manifest hash, sizes and file/package counts. Identical inputs and Node/zlib build
versions produce identical bytes. Limits are 50MiB zipped and 250MiB unpacked,
with smaller input-read bounds.

The file inventory and hashes identify the bytes packaged. They do not attest
that those bytes are approved, uncompromised, installed in AWS or protected by
effective IAM. Preserve the exact source commit, clean-install evidence and
independent review alongside the package. A matching package version alone is
not a package-file integrity check.

## Initial hosted configuration to review

An initial upload would still be a separately reviewed, closed staging step:

| Setting | Gateway | Authority |
| --- | --- | --- |
| Runtime / architecture | Node24 / x86_64 | Node24 / x86_64 |
| Handler | `index.handler` | `index.handler` |
| Suggested initial memory / timeout | 256MiB / 10s | 256MiB / 6s |
| Initial reserved concurrency | 0 | 0 |
| Execution role | Dedicated gateway role | Dedicated authority role |
| Initial identity policy / boundary | `AWSDenyAll` / `AWSDenyAll` | `AWSDenyAll` / `AWSDenyAll` |
| Function URL / event source / API integration | Absent | Absent |
| Environment installation/key/credential values | None | None |

These settings are a proposal, not an applied configuration or performance
measurement. Concurrency zero initially prevents invocation. Before any hosted
trial, separately review finite traffic/time/cost limits and platform/application
log suppression, redaction and retention. Concurrency and throughput settings
are not a monetary spending cap. No trial or resource creation is authorized by
this document.

## Dedicated table preparation

The existing adapters require distinct, single-Region, on-demand tables, no
indexes/streams/replicas, and deletion protection:

| Property | Replay nonce table | Authority root table |
| --- | --- | --- |
| Name prefix | `alliance-account-nonce-` | `alliance-account-authority-` |
| Partition key / type | `nonceKey` / String | `rootKey` / String |
| Sort key | None | None |
| Capacity mode | `PAY_PER_REQUEST` | `PAY_PER_REQUEST` |
| TTL | Enabled on `expiresAt` | Disabled |
| Data initialization | None in this package | None in this package |

Record the real ARN and AWS-assigned TableId after any approved creation; do not
invent them or substitute an example. A newly created empty root table cannot
pass the authority's existing-record/current-root checks. Independent current
root custody and an explicitly reviewed initial-custody procedure remain needed.
Do not insert a convenient generation-one fixture to make startup succeed.

Optional DynamoDB on-demand maximum throughput can reduce usage exposure but is
best-effort and may be exceeded by burst capacity. It is not a guaranteed request
or spending ceiling. Initial empty-table preparation neither grants runtime
data access nor proves allowed/denied operation behavior.

## Verification and next activation work

Tests inspect all ZIP entries through the central directory, verify checksums,
inflate files and import each extracted root handler in a child with an explicit
environment and no inherited credentials. They check closed responses, no role
credential/runtime-field reads, stable hashes, wrong lock/version refusal,
symlink/junction refusal and no-overwrite behavior. A separate local Python
`zipfile` extraction provides an independent archive-format check.

Local import is not AWS runtime acceptance. An enabled runtime still requires a
new, separately reviewed entry/bundle, independently prepared real installation
manifest/current minimum, actual immutable function versions and hashes, finite
caller-key custody, exact IAM/boundaries and the hosted tests in the
[composition acceptance procedure](federation-alliance-aws-composition-20261019.md).
Uploading a closed package cannot be advertised as completing those gates.
Google clearance, real sign-in/phone, member-session/privacy/abuse/recovery and
assistive acceptance continue to precede public registration.

Primary references reviewed October19: [Lambda Node ZIP layout](https://docs.aws.amazon.com/lambda/latest/dg/nodejs-package.html),
[Lambda deployment limits](https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html),
and [DynamoDB maximum-throughput limitations](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/on-demand-capacity-mode-max-throughput.html).
