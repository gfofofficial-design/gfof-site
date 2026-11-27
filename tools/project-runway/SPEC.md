# Project Runway v1

November 25, 2026 · Public Command Deck tool

A founder, freelancer or community organizer can enter available operating cash, cash received each month and cash spent each month. Two optional inputs let the same person compare a one-time cost and a different ongoing spend against the current plan. USD is the first input format.

- The default view starts blank. A separate example fills fictional figures. Editing any example field labels the result as edited example figures until the amounts are cleared.
- Empty required amounts remain unknown. Zero is a valid answer. Blank optional costs mean no upfront cost and the same monthly spend. Currency input is limited to $999,999,999.99 per field, with exact cents.
- Subtract upfront costs from starting cash. Subtract monthly spending from monthly receipts. For negative net cash, divide remaining cash by the size of that monthly shortfall. Round the duration down to tenths of a month and use `less than 0.1 month` for a positive result below that threshold. A negative opening balance represents an immediate funding gap. At zero cash, surface the missing cushion. A nonnegative monthly net cannot establish a depletion date in this model.
- Show projected month-end cash at months 1, 3 and 6. A negative result shows the cumulative funding gap if the plan continues as entered. The same constant monthly receipts apply to both plans. The method and working example identify assumptions about timing, unexpected costs and access to cash.
- The workbench uses static, first-party assets. Calculation keeps the figures in the current tab. A person can explicitly download their validated inputs as a plain Project Runway JSON file. The site keeps no copy, and the file carries an example marker when applicable.
- A saved plan uses version 1, USD, integer cents and explicit nulls for blank optional amounts. A compatible file up to 4 KiB can be selected and reviewed before it replaces the current inputs. The calculator recomputes the estimate from those inputs. It shows the file as its source and identifies files marked as examples. An invalid file leaves the current calculation available.
- Show errors next to their fields and move focus to the first invalid input. Clear prior results when amounts change. Provide a readable method and worked example if the interactive script fails or is disabled.

Acceptance covers whole and fractional currency, zero, blanks, malformed inputs, exact arithmetic, a one-time cost greater than cash, different spending, negative projected balances, keyboard operation, small screens, and disabled JavaScript. A plan file round trip must preserve exact amounts, optional zeros and example provenance. Test malformed, oversized and incompatible files, recalculation after opening a plan, invalidation of a download after an edit, and the absence of outbound requests and browser storage. The calculator uses no providers or account services.

## Monthly spending limit

November 27, 2026 · Review candidate

After a valid calculation, a collapsed section answers how much a plan could spend per month over 3, 6 or 12 months. Default to six months. Show the modeled limit and how far the entered spending is above or below it for the current plan and any planned change. Both use the same monthly receipts. The [Stripe runway guide](https://stripe.com/resources/more/how-to-calculate-startup-runway) describes using runway to assess spending changes.

- Calculate the limit as monthly receipts plus the cash left after upfront costs divided by the selected months. Use integer cents and round down to the cent. The limit targets a zero ending balance. Timing within a month and an emergency reserve are outside this calculation.
- If the upfront cost exceeds cash on hand, state the immediate gap and withhold a monthly limit for that plan. An opening balance of zero stays valid and makes the limit equal to monthly receipts. Spending equal to the limit should read as such.
- Changing the horizon updates the results in place with a status announcement and preserves focus on the horizon control. Editing or clearing amounts removes the old calculation and limit. Compatible version 1 files recalculate with the currently selected horizon. The horizon is a view preference for this tab and does not change the saved file format.

Acceptance covers 3, 6 and 12 months, exact cent rounding, maximum amounts, zero opening cash and an upfront shortfall even when monthly receipts cover costs. With the fictional six-month example, the current plan reaches its $10,000 monthly limit and the planned change is $2,666.67 above its $9,333.33 limit. A change of horizon refreshes both plans without recalculation or a network request. Editing amounts removes the previous values. [W3C guidance on status updates](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html)
