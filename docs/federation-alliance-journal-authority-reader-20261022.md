# Disabled journal reader for the member signing service

This is an unapplied access proposal. The existing journal executor can append
removal records and admit intents. Giving its password to the signing service
would give that service more authority than its tip/history reads need.

## Narrow capability

`managedJournalReaderExtensionSql()` prepares one new role:
`alliance_journal_reader`, NOLOGIN, password-free, NOINHERIT and without superuser,
database/role creation, replication or RLS-bypass powers. It gets only private
schema USAGE and EXECUTE on the existing exact `tip(text,uuid)` and
`records(text,uuid,integer,text)` entry points. These fixed security-definer
functions validate their configured member scope and read existing bounded
history; the reader gets no direct table/column/sequence authority, owner
membership, append/admission/recovery function, Auth or Storage access.

The existing administrator retains the provider's automatic management edge for
the new role. It can manage that role; it is not an independent security domain.
As with the already installed roles, the edge grants ADMIN OPTION without SET
or INHERIT. No administrator policy is broadened by the application.

## Installation and verification

The one-transaction installer requires the exact accepted extended journal
catalogue, existing locked roles, empty closed/unconfigured storage, empty
Auth/Storage/public domain and absence of the proposed reader. It temporarily
uses the existing journal owner only to issue the three grants, then removes
that installation access before commit. Source-generated exact catalogue/ACL
comparison permits only the named additions. Existing function bodies, table
shape, RLS, original grants and memberships remain pinned. A mismatch rolls back
the entire new role and grants; this is not an idempotent repair or reset tool.

`managedJournalReaderInspectionSql()` independently checks the final boundary,
closed storage, password-free/locked reader and no reader sessions in a read-only
transaction that rolls back. It grants no inspection access. An actual hosted
application still needs its own owner decision and fresh readback; local success
does not install anything.

The previous `extended` catalogue deliberately no longer matches after this
addition. Use the explicit `authority-reader` catalogue and its inspection for
that new approved state, preserving the original baseline for older installs.

## Runtime adapter

`createJournalAuthorityReader()` is disabled by default. It exposes only `tip`,
`records` and `close`, reusing the canonical full-history/scope checks without
exposing executor methods. The exact separate journal project/host is required;
the connection cannot substitute the member project, a foreign host or a URL.

It requires the restricted reader's actual login/session identity, TLS with
hostname/CA validation and channel binding, durability, isolated role membership
and the exact effective function-only rights. Unexpected table/column/function
authority or Auth/Storage schema access refuses before journal dispatch.
Transactions use BEGIN READ ONLY; at most two are active, no queue/retry, a
1500ms maximum overall read deadline, 750ms statement and 250ms lock budgets.
Timed-out/uncertain reads destroy their connection and cannot dispatch a later
commit. Neither installation nor this adapter loads a password or authority key.

## Validation and remaining release work

Local tests exercise default closure, exact identity/host/rights, complete history
and late-read disposal. The disposable managed PostgreSQL/TLS journey installs
the exact extension, checks rollback under write/column/LOGIN/membership faults,
independent inspection, repeated-install refusal, actual restricted reader reads
and SQL write denial. Adding an append or column permission makes runtime reads
refuse. The existing writer still completes its accepted admission/removal flow.

Real login/secret installation, new signing host and replay infrastructure,
independently retained current checkpoint, recovery and protected member journey
remain separate. No cloud operation, added subscription, public feature or mail
send follows automatically from this source. A narrower database role alone
does not establish private-key custody or make two co-located signers independent.

No user interface changes. Persistent unavailable states and help outside sign-in
remain. The owner decision describes access and closure in plain language and
needs no secret transcription for the locked installation. These server checks
are not phone, assistive-technology or WCAG acceptance.
