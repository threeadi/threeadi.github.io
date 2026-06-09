# Building a Multi-Rule Promotion Engine: Lessons from Production

At PT Suitmedia, we were tasked with building a promotion system flexible enough to handle the full complexity of enterprise e-commerce campaigns — minimum purchase thresholds, user segment targeting, time-windows, product exclusions, and stacking rules. Here's what we learned.

## The Problem

Our client ran hundreds of campaigns simultaneously. Each campaign had its own eligibility rules:

- **Minimum purchase** — cart subtotal must exceed a threshold
- **User targeting** — new users only, loyalty tier, specific cohorts
- **Product scope** — specific SKUs, categories, or brand exclusions
- **Stacking** — which promotions can combine vs. mutually exclude

A naive implementation with `if/else` chains quickly became unmaintainable. We needed something more composable.

## The Rule Engine Pattern

We modeled each promotion rule as a **Strategy** — a class implementing a single interface:

```php
interface PromotionRule
{
    public function evaluate(Cart $cart, User $user): bool;
    public function describe(): string;
}
```

Concrete implementations:

```php
class MinimumPurchaseRule implements PromotionRule
{
    public function __construct(private readonly int $minAmount) {}

    public function evaluate(Cart $cart, User $user): bool
    {
        return $cart->subtotal() >= $this->minAmount;
    }
}

class UserSegmentRule implements PromotionRule
{
    public function __construct(private readonly array $allowedSegments) {}

    public function evaluate(Cart $cart, User $user): bool
    {
        return in_array($user->segment, $this->allowedSegments, true);
    }
}
```

Each `Promotion` holds a collection of rules evaluated as `AND` (all must pass) or `OR` (any passes):

```php
class Promotion
{
    /** @param PromotionRule[] $rules */
    public function __construct(
        private readonly array $rules,
        private readonly string $combinator = 'AND',
    ) {}

    public function isApplicable(Cart $cart, User $user): bool
    {
        return $this->combinator === 'AND'
            ? every($this->rules, fn($r) => $r->evaluate($cart, $user))
            : any($this->rules,  fn($r) => $r->evaluate($cart, $user));
    }
}
```

## Stacking Logic

Stacking was the hardest part. We introduced a **priority + exclusion group** model:

- Every promotion has a `priority` (higher = applied first)
- Every promotion optionally belongs to an `exclusion_group`
- Once a promotion from an exclusion group is applied, all others in that group are skipped

```php
$applied = [];
$usedGroups = [];

foreach ($eligiblePromotions as $promo) {
    if ($promo->exclusionGroup && in_array($promo->exclusionGroup, $usedGroups)) {
        continue;
    }
    $applied[] = $promo;
    if ($promo->exclusionGroup) {
        $usedGroups[] = $promo->exclusionGroup;
    }
}
```

## Performance

With hundreds of promotions per tenant, evaluating all of them on every cart load was expensive. We addressed this with:

1. **Eager-loading rules** — fetch all rules in one query with eager loading, no N+1
2. **Redis caching** — cache the serialized promotion list per tenant with a short TTL (5 min)
3. **Early exit** — sort by most-restrictive rule first so cheap checks (dates, user segment) disqualify promotions before expensive DB lookups (product scope)

This brought average checkout evaluation time from ~480ms to ~90ms.

## Key Takeaways

- Model rules as first-class objects. Don't encode logic in database flags.
- Separate *eligibility* (can this apply?) from *application* (what discount does it give?).
- Cache aggressively, but invalidate on promotion edits.
- Test rule combinations exhaustively — edge cases compound.

---

*This system now powers campaigns for multiple enterprise tenants. The Strategy pattern made adding new rule types a 30-minute task instead of a risky refactor.*
