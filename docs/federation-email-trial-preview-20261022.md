# Isolated email sign-in preview

Review-only branch based on the live public site. Do not merge this trial adapter
into the production site. The account page identifies itself as an isolated test.
Existing account UI, handler, response bounds and cookie handling are reused.

The preview routes account requests through `federation-email-trial.cjs`. It is
disabled by default and ignores the production account configuration. It uses
only the existing isolated signup-acceptance project, disables OAuth and requests email with `create_user:false` by default. A separate
`FEDERATION_EMAIL_TRIAL_SIGNUP_ENABLED=true` flag permits only the exact designated
test address through the preview. Leave it unset until the isolated Auth hook
also enforces the exact recipient and a fixed twenty-minute deadline, and the
owner approves the temporary registration window. The preview flag alone does
not restrict direct Auth API requests.

Before enabling a bounded trial, configure only this exact Deploy Preview's
Function environment, never shared production or all-preview values:

- `FEDERATION_EMAIL_TRIAL_ENABLED=true`
- `FEDERATION_EMAIL_TRIAL_ORIGIN`: the exact HTTPS Deploy Preview origin
- `FEDERATION_EMAIL_TRIAL_PUBLISHABLE_KEY`: the isolated project's publishable key

Never use a secret/service-role key or production project's key. Keep Netlify's
team protection enabled. Check the saved configuration and the preview's config
response before any email request. A successful build is not an Auth test.

The first bounded trial is existing-owner email-code sign-in, reload and logout.
The earlier approved single SMTP email has already been consumed; no additional
email is authorized by preparing this branch. Arrange the exact recipient and
one-request limit before sending. The owner enters the code personally; do not
copy codes, tokens, cookies or email bodies into logs or review evidence.

Stop on a browser security warning, unexpected host/project, new account,
unexpected mail or provider failure. Do not retry automatically. Disable the
trial after acceptance and confirm signup remains closed. Aggregate counts and
non-sensitive outcomes are sufficient evidence; do not export Auth records.

This preview does not install or attach the candidate signup hook, test password
registration or recovery, resolve hook deadline acceptance, or release member
features. New-user admission needs a separate bounded plan after this step.
