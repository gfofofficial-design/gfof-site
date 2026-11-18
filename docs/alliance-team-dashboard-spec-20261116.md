# Alliance Team Dashboard

**Version 0.1 · Proposed pilot**

Alliance is the public place to discover projects and see what their teams are building. The proposed Dashboard gives signed-in members a place to find their projects, contribute to a challenge, and respond to feedback. The public tools help visitors and teams check the evidence behind their work.

## Homepage

Lead with **Explore Alliance**. While the hosted Dashboard is closed, place **How membership works** beside it and explain the current access and enrollment status. Once hosted Dashboard access is verified, use **Open Dashboard** there for returning members.

Put **Read a wallet** and **Inspect a token** immediately below those actions. Each opens a page with its address field first. Visitors can use both tools signed out. Put the official GFOF mint copy control in the header. Place research, build status, and the public record below the tools. Put the Federation journey near the bottom.

## Project pages and the Dashboard

A public project page shows what the team is building, its reviewed official links, a current challenge when one is open, and work the team has approved for publication. The Alliance publishes external project pages through its existing review and mutual agreement process. When joining is available, the project page explains how to request a place on the team.

The Dashboard opens with **Your projects**, **What changed**, and **Next steps**. Give each member a short view of new project updates, feedback on their work, and the next action they can take. When a member has yet to join a project, offer **Explore Alliance**. Include a **Tools** section with direct links to the public wallet reader and token inspector.

| Role | Pilot workflow |
| --- | --- |
| Project lead | Set the team’s goal, manage requests to join that team, post a task, and select work to submit for publication review. |
| Team member | Pick up a task, attach evidence, submit a draft, and revise it after feedback. |
| Invited reviewer | Read the specific work shared for review and leave feedback against the published criteria. |
| Federation operator | Review project participation and public submissions, handle reports, and publish agreed rules and reviewed results. |

Keep profiles, team rosters, drafts, and review comments private by default. Give reviewers access only to the submission shared with them. Publish the agreed submission and any contributor names that members chose to share. The server checks each user’s project role before it returns private data or accepts a change. Leaving a team or losing a role ends that access.

## First shared challenge

**Proposed challenge · Explain your token in one page.**

Run one shared challenge at a time using the existing rules for two to four agreed project teams. Each team writes a plain-language explanation of its Solana token’s mint and freeze controls, with the mint address, observation details, and source links attached. A member of another participating team checks whether a reader can follow the evidence. The team can revise its work before the operator reviews it for the public showcase.

Publish the rules and review criteria before accepting entries. Review whether the explanation is readable, whether each claim has a source, and whether it marks gaps clearly. Use the existing numbered rules and results pages for the agreed event. Recognize completed contributions through the published work and the project’s milestone record. [Small-group challenge publication rules](./alliance-group-challenge-publication-20261023.md)

A returning member should be able to see what their team completed and where they can help next. Review the pilot using completed submissions, feedback that led to a revision, and teams that return for another challenge.

## Show evidence

Place a **Show evidence** control beside each figure and each published challenge result. It shows the source, when it was read or recorded, the inputs used, and a link for checking the source. For on-chain facts, include the address, Solana slot, and commitment used for the read, such as confirmed or finalized. For a dated result, offer the saved observation when available and label the explorer link as a view of current state.

| Result | Evidence to show |
| --- | --- |
| Wallet quantity | The wallet address and read details. When a token quantity combines accounts, include the contributing token accounts and their amounts so the total can be recomputed. |
| Reference price or estimated value | The provider, fetch time, price, and provider block reference when available. Show quantity and price as the inputs to the estimate. Identify which assets the priced subtotal includes. Keep quantities visible when the reference price is unavailable. |
| Token controls and ranked accounts | The mint or token account, the observed fields, and the slots for the mint, account ranking, and account details. Label the ranking as token accounts. Identify the supply used for percentages and mark ratios from separate slots as approximate. |
| Published challenge result | The rules version, reviewed submission, and published result. Add dated corrections to the public record and preserve the earlier entries and anchored evidence. |

Show wallet quantities or mint controls as the first useful results. Add reference prices and ranked accounts as their sources complete. Keep verified facts visible if another source times out or is unavailable. Mark the gap where the result would appear. Clear the previous result when the address changes.

[Command Deck wallet reader](https://galacticfederation.co/command-deck#wallet) · [Dossier Structure Lens](https://dossiertrack.co/token-structure) · [Jupiter reference price method](https://developers.jup.ag/docs/price)

## Interface and acceptance

Use the existing `logo.png` and `logo-circle.png` assets. Keep the dark mission-control identity in the framing and use conventional labels, navigation, and buttons. Use inline SVG for new icons. Voss is the chat persona. Product copy explains the action, what was observed, and what remains unknown.

- Verify the canonical homepage in a fresh browser session. Check that the public route reaches the intended homepage and both lookups open at their forms.
- On a real phone, measure from submit to the first useful result. The target is ten seconds. Check normal lookups, missing prices, slow ranking reads, and invalid addresses. Record the conditions and actual elapsed time.
- Verify WCAG AA contrast in the lookup, result, evidence, and error states. Test keyboard navigation, visible focus, status announcements, and narrow-screen reflow. [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- Before opening the pilot, verify hosted Alliance and Dashboard access. Walk through the project lead, member, and invited reviewer paths with separate accounts. Test that a person outside the project cannot access a draft, and that access ends when membership or the review invitation is withdrawn.
- Complete one pilot walkthrough from task to submission, feedback, revision, and publication review. Verify the public result displays the agreed material and the Dashboard shows the next action.

[Alliance guide](https://galacticfederation.co/alliance) · [Current build status](https://galacticfederation.co/building)
