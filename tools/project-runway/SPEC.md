# Project Runway v1

November 25, 2026 · Public Command Deck tool

A founder, freelancer or community organizer can enter available operating cash, cash received each month and cash spent each month. Two optional inputs let the same person compare a one-time cost and a different ongoing spend against the current plan. USD is the first input format.

- The default view starts blank. A separate example fills fictional figures. Editing any example field labels the result as edited example figures until the amounts are cleared.
- Empty required amounts remain unknown. Zero is a valid answer. Blank optional costs mean no upfront cost and the same monthly spend. Currency input is limited to $999,999,999.99 per field, with exact cents.
- Subtract upfront costs from starting cash. Subtract monthly spending from monthly receipts. For negative net cash, divide remaining cash by the size of that monthly shortfall. Round the duration down to tenths of a month and use `less than 0.1 month` for a positive result below that threshold. A negative opening balance represents an immediate funding gap. At zero cash, surface the missing cushion. A nonnegative monthly net cannot establish a depletion date in this model.
- Show projected month-end cash at months 1, 3 and 6. A negative result shows the cumulative funding gap if the plan continues as entered. The same constant monthly receipts apply to both plans. The method and working example identify assumptions about timing, unexpected costs and access to cash.
- The workbench uses static, first-party assets. The page has no account prompt, outbound connections, persistent storage, form submission or sharing of inputs. Opening the tool only loads static assets. Links to other pages require an explicit click.
- Show errors next to their fields and move focus to the first invalid input. Clear prior results when amounts change. Provide a readable method and worked example if the interactive script fails or is disabled.

Acceptance covers whole and fractional currency, zero, blanks, malformed inputs, exact arithmetic, a one-time cost greater than cash, different spending, negative projected balances, keyboard operation, small screens, and disabled JavaScript. The calculator uses no providers or account services.
