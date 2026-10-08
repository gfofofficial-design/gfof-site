# Google-only account control: isolated Auth acceptance — October 8, 2026

## Decision

The candidate rejects direct Email/password and Email OTP new-user creation
through a real self-hosted Supabase Auth service while preserving an existing
synthetic password login. Permission failures, a missing function, runtime errors
and the separately tested cancellation limits caused no account insertion or
mail delivery. This advances the review-only control; it does not authorize
public registration or establish the existing hosted owner's access.

## Exact evidence

- Review source: `9677fbf8e438410447c501445eb0d4588d0cebe4` on PR #99.
- [CI run 37767357892](https://github.com/gfofofficial-design/gfof-site/actions/runs/37767357892),
  job `signup-auth`, completed successfully on October 8, 2026.
- Auth image/version: `supabase/gotrue:v2.197.0`, checked via its health response.
- Database: `postgres:17.11-bookworm`, server version checked as 17.11.
- Mail sink: `axllent/mailpit:v1.31.4`.
- [Harness](../tests/federation-google-signup-auth.mjs) and
  [test configuration/boundaries](../tests/federation-google-signup-auth.md).
- The existing native SQL/ACL job and all 36 account handler/page tests passed
  in the same run; no production auth handler was changed by this test work.

The CI service started empty and had no hosted project connection, provider
credentials, real identities, owner password or copied Auth backup. Auth and
Mailpit published no host ports and joined only a new internal Docker network.
The runner derived private HTTP addresses from those exact containers; the
harness accepts no supplied hosted URL. Test addresses use the reserved
`.invalid` domain. All actual mail went to the local sink, without a relay.

Temporary database/password/JWT credentials stayed inside the fixture and
were not exported. Synthetic user references were held in memory for exact
admin confirmation and authenticated-user comparisons; public evidence records
aggregate counts and outcomes only. No raw Auth user, identity, password,
JWT or mail payload was published. The selected hook reused the existing
candidate's exact DDL and decision rule, with a separate database owner,
SECURITY INVOKER, empty search path and explicit Auth USAGE/EXECUTE grants.

## Verified behavior

| Check | Actual result |
| --- | --- |
| Signup enabled, Email enabled, hook absent: password signup and new-user OTP positive controls | Both HTTP 200; two synthetic users, two identities and two sink emails |
| Hook attached while signup closed | New password signup HTTP 422 signup_disabled; existing synthetic login and user read still succeeded |
| Signup enabled, Email enabled, exact candidate attached: direct password signup and OTP create_user=true | Both candidate-specific generic HTTP 403; zero new users/identities or sink mail |
| Spoofed user metadata, provider/app-metadata request fields and OTP metadata | All three candidate-specific HTTP 403; zero insertion or new sink mail |
| Existing confirmed synthetic password login with candidate active | HTTP 200 for the exact same account, authenticated user read HTTP 200 |
| Local logout after each tested existing-login phase | HTTP 204; old refresh request rejected with a 4xx response |
| Auth function EXECUTE revoked | New signup HTTP 500; zero insertion or new sink mail; existing synthetic login still worked |
| Auth schema USAGE revoked | New-user OTP HTTP 500; zero insertion or new sink mail |
| Selected function unavailable | New signup HTTP 500; zero insertion or new sink mail |
| Function raises a synthetic runtime error | New signup HTTP 500; zero insertion or new sink mail |
| Explicit fixture role statement_timeout=2s, new connection pool, function sleeps three seconds | OTP HTTP 500; database logged statement cancellation; zero insertion or new sink mail |
| Role deadline removed, new pool, default API request limit, function sleeps twelve seconds | OTP HTTP 504 after 10,180 ms including assertions; database logged request cancellation; zero insertion or new sink mail |
| Exact candidate function restored | New Email signup again HTTP 403; existing synthetic login/user read/logout/refresh rejection succeeded |
| Final closure and disposal | Signup HTTP 422 signup_disabled; only the original two synthetic users/identities and two sink emails; child Auth/mail containers and internal network removed |

GitHub stopped the disposable PostgreSQL service and completed the job. No
fixture data, account export or recovery artifact was saved for reuse. This
verifies that exact run and the stated service versions, not a permanent
monitoring or backup process.

## Shorter hook deadline finding — unresolved for hosted release

In earlier [run 37766456076](https://github.com/gfofofficial-design/gfof-site/actions/runs/37766456076),
a deliberately permissive replacement hook slept three seconds and returned
an allow response. The self-hosted Auth service completed OTP creation instead
of enforcing the assumed two-second Postgres-hook deadline. The fixture was
then destroyed; no hosted user was created. The actual candidate's five Email/
OTP/spoof rejection cases had already returned the required HTTP 403.

This matches the open upstream [Auth issue #2852](https://github.com/supabase/auth/issues/2852).
Review of v2.197.0's dispatcher and Before User Created call path is consistent
with SET LOCAL being used through a non-transactional connection; treat this
cause as a source-based finding, not a claim about the hosted pilot's build.
The default API limit separately interrupted the twelve-second test above.
It does not prove that the shorter hook deadline works.

The explicit two-second role setting was a **fixture-only** cancellation case.
It was reset before the default API-limit test. No hosted role setting, project
grant, hook selection, provider configuration, signup switch or owner account
was changed. Do not describe that fixture setting as a deployed repair or a
Supabase-managed configuration recommendation. Check the actual hosted Auth
build and effective cancellation/availability behavior before opening signup.

The first harness run also stopped at a Docker port-publishing assumption
before the route checks. Switching the runner to owned private container
addresses kept the network internal and enabled the subsequent acceptance
runs. Neither adjustment broadened hook access or changed the candidate rule.

## Remaining release requirements

- A real new Google identity through the intended provider round trip, with
  verified application session, reload and logout; no mocked Google pass.
- Existing owner's hosted Google and password paths, intended Google identity
  linking, exact user retention and no duplicate or unintended identity link.
- Actual isolated hosted hook selection, effective grants and exact build,
  direct Email/OTP denial and cancellation behavior. Preserve existing owner
  projects; do not open them as a temporary registration experiment.
- Real expired-session browser/logout, successful-code replay, cancellation
  and multi-tab refresh checks from the existing account acceptance plan.
- The remaining administrator-access, privacy/deletion, sustainable recovery,
  monitoring/response, operating limits and production release requirements.

Use the full [hosted acceptance matrix](federation-account-data-operations.md#isolated-acceptance-matrix)
and [security release gates](federation-security-release-gates.md). PR #99
remains draft, public registration stays closed, and financial products remain
unactivated. A passing isolated service job does not grant production approval.
