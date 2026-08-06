# Spenza Financial Invariants

## Purpose and authority

This document defines the financial rules that every API, mobile preview, database write, balance projection, activity record, and analytics query must obey. The API implementation is authoritative; clients may reproduce calculations for previews but must reconcile to the server result.

## Canonical representation

- A monetary amount is a signed integer count of the currency's minor unit. For INR, `₹100.00` is `10000` paise.
- Persistent monetary columns use an integer type large enough for the supported domain, normally PostgreSQL `BIGINT`. TypeScript financial arithmetic must use `bigint` or another reviewed exact-integer representation.
- JSON transmits minor-unit values as base-10 strings, for example `{ "currency": "INR", "amountMinor": "10000" }`, so values cannot lose precision in JavaScript.
- Every monetary record carries or inherits one ISO 4217 currency. An operation must reject mixed currencies; MVP performs no currency conversion.
- Display formatting occurs only at presentation boundaries using the currency's reviewed exponent. Formatted decimal text is never the stored source of truth.
- Negative expense totals, negative payer contributions, negative split allocations, zero-value expenses, and zero-value settlements are invalid unless a future, separately reviewed domain rule explicitly permits them.

## Terms and balance direction

- `totalMinor`: the expense's positive total in minor units.
- `contributionMinor`: how much a payer paid toward the expense.
- `allocationMinor`: how much of the expense a participant owes.
- `netMinor`: the member's position. A positive value means the group owes the member; a negative value means the member owes the group.
- `settlementPaidMinor`: money the member paid to another member to reduce a debt.
- `settlementReceivedMinor`: money the member received from another member.

For a member within one group and currency:

```text
netMinor = contributions - allocations + settlementsPaid - settlementsReceived
```

For every valid expense:

```text
sum(contributionMinor) = totalMinor
sum(allocationMinor)   = totalMinor
```

For a group after expenses and settlements:

```text
sum(member netMinor) = 0
```

Balances are derived financial projections, not independently editable values. Cached or materialized balances must be reproducible from active financial records and must be reconciled after every applicable deployment or backfill.

## Split inputs

- Equal: the request contains the distinct participant IDs and a stable participant order.
- Exact: each participant has an `amountMinor`; exact allocations must sum to `totalMinor`.
- Percentage: each participant has integer basis points `percentageBps`; values must be non-negative and total exactly `10000`.
- Shares: each participant has a positive integer `shares`; the sum of shares must be positive and within documented limits.
- Payers: each distinct payer has a positive `amountMinor`; contributions must sum exactly to `totalMinor`.
- Every payer and participant must be an authorized, eligible member according to the group's historical-membership rules.
- Duplicate payer or participant IDs are rejected rather than silently merged.

## Deterministic allocation and rounding

Equal, percentage, and shares calculations use the largest-remainder method with integer arithmetic:

1. Compute each allocation's exact rational numerator and common denominator.
2. Assign the integer floor of each rational allocation.
3. Compute `remainderMinor = totalMinor - sum(floors)`.
4. Rank allocations by fractional remainder descending.
5. Break equal fractional remainders by the stable allocation order stored with the expense.
6. Add one minor unit to the first `remainderMinor` ranked allocations.

The server stores the resulting integer allocations and their stable order. Re-reading an expense must not recalculate allocations from a database's incidental row order. Changing participant order alone must not silently alter an existing expense; an explicit edit creates a new financial revision.

## Required worked examples

### Equal split: ₹100 among three members

`₹100.00 = 10000` paise. For stable order A, B, C:

| Member | Allocation |
| --- | ---: |
| A | 3334 paise (`₹33.34`) |
| B | 3333 paise (`₹33.33`) |
| C | 3333 paise (`₹33.33`) |

The one-paise remainder goes to A because all fractional remainders are equal and A is first in the stored stable order.

### Exact split

For `₹120.00`, A owes `₹50.00`, B owes `₹40.00`, and C owes `₹30.00`. The API accepts allocations `5000`, `4000`, and `3000` only because they sum exactly to `12000` minor units. A sum of `11999` or `12001` is rejected; it is not auto-corrected.

### Percentage split

For `₹100.00`, percentages A `50%`, B `30%`, C `20%` are transmitted as `5000`, `3000`, and `2000` basis points and allocate `5000`, `3000`, and `2000` paise.

For a percentage result that contains fractional minor units, use the deterministic largest-remainder algorithm; do not round each row independently with floating point.

### Shares split

For `₹100.00` with shares A:B:C = 3:2:1:

| Member | Rational amount | Allocation |
| --- | ---: | ---: |
| A | 5000 | 5000 paise |
| B | 3333⅓ | 3333 paise |
| C | 1666⅔ | 1667 paise |

C receives the remaining paise because C has the largest fractional remainder.

### Multiple payers

For a `₹100.00` expense, A pays `₹60.00` and B pays `₹40.00`. A, B, and C split equally in stable order. Before settlements:

| Member | Contribution | Allocation | Net position |
| --- | ---: | ---: | ---: |
| A | 6000 | 3334 | +2666 paise |
| B | 4000 | 3333 | +667 paise |
| C | 0 | 3333 | -3333 paise |

The positions sum to zero.

### One-minor-unit remainder

For `1` paise shared equally by A and B, stable order A then B produces A `1`, B `0`. The zero allocation is valid as the result of a split even though a zero-value expense is not.

## Expense lifecycle

### Create

The expense, payers, allocations, idempotency result, and activity record must commit in one transaction. Any validation, authorization, concurrency, or database failure leaves none of them committed.

### Edit

- An edit uses an expected version. A stale version fails with a conflict and does not overwrite newer work.
- Financial components are replaced atomically as a new revision or equivalent auditable representation.
- The old and new states remain attributable in immutable activity data.
- Reapplying the same idempotent command produces the original result, not a second revision.
- Recomputed payers and allocations must independently reconcile to the edited total.

Example: editing a `₹100.00` equal split to `₹90.00` creates a new validated allocation set totaling `9000`; it must not apply a `-1000` floating-point adjustment across existing rows.

### Deletion/void

- A financial expense is voided, not silently hard-deleted.
- The expense, prior revisions, payers, allocations, and activity remain available for authorized audit.
- Active balance projections exclude the voided expense and therefore reverse its exact stored contributions and allocations.
- Voiding an already-void expense is idempotent or returns a documented state conflict; it must never reverse balances twice.

### Settlement and reversal

- A settlement records payer, receiver, positive amount, currency, effective date, and immutable activity in one transaction.
- Payer and receiver must be different eligible group members.
- A reversal is a new record linked to the original settlement. It applies the exact opposite balance effects and does not mutate or delete the original.
- A settlement may be reversed at most once unless an explicit, modeled reversal-of-reversal policy is later approved.

Example: A owes B and records a `₹20.00` settlement. A's net increases by `2000`; B's net decreases by `2000`. Reversal decreases A by `2000` and increases B by `2000`, returning both to their prior positions.

## Concurrency, idempotency, and history

- All financial commands are authorized and validated before write, then re-check any state-dependent rule inside the transaction.
- Create, settlement, reversal, and upload-finalization commands require an idempotency key according to `docs/API_CONVENTIONS.md`.
- Edits and voids require optimistic concurrency through a version or equivalent compare-and-set value.
- Activity is append-only. Corrections append a new event; ordinary application paths do not update or delete historical events.
- Event timestamps, actor IDs, target IDs, financial-record versions, and request IDs are captured. Sensitive payloads and secret values are not.
- Reports and analytics state whether they use effective date or creation date and never mix unlike currencies into one amount.

## Required test properties

Every financial engine implementation must test examples above and these general properties:

- contributions and allocations each equal the expense total;
- all generated allocations are integers and non-negative;
- result order and rounding are deterministic across repeated executions;
- group net positions sum to zero after any sequence of valid operations;
- edit replaces effects exactly once, void removes effects exactly once, and reversal negates its settlement exactly once;
- retrying an idempotent request does not duplicate money, activity, or notifications;
- stale concurrent edits cannot both succeed;
- unauthorized actors cannot learn or change financial records by guessing IDs;
- boundary amounts, maximum participants, one-minor-unit totals, zero remainders, and large safe-domain values behave correctly;
- database transaction failure at any write point leaves no partial financial state.

Property-based tests should supplement fixed examples for allocation sums, determinism, and conservation of value.
