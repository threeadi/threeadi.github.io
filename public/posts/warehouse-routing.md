# Geolocation-Based Warehouse Routing: A Deep Dive

When you have stock spread across multiple warehouses, the question "which warehouse ships this order?" sounds simple. It isn't. Here's how we built a system that reduced order processing time by 30% at PT Suitmedia using PHP and Laravel.

## The Challenge

Our client operated 5 warehouses across different cities in Indonesia. Before our system, orders were manually routed — a process that took 10–15 minutes per order and frequently picked a suboptimal warehouse, inflating shipping costs.

The requirements:

1. Find warehouses that have **sufficient stock** for all items in the order
2. Among those, pick the **closest** to the delivery address
3. Handle **partial fulfillment** — split across warehouses if no single warehouse can fulfill

## Haversine Distance

We calculate great-circle distance between two coordinates using the Haversine formula, implemented as a plain PHP helper:

```php
function haversine(float $lat1, float $lon1, float $lat2, float $lon2): float
{
    const R = 6371; // Earth radius in km
    $dLat = deg2rad($lat2 - $lat1);
    $dLon = deg2rad($lon2 - $lon1);
    $a = sin($dLat / 2) ** 2
       + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLon / 2) ** 2;
    return R * 2 * atan2(sqrt($a), sqrt(1 - $a));
}
```

We wrap this into a reusable service so it can be injected anywhere:

```php
class HaversineService
{
    public function distanceKm(float $lat1, float $lon1, float $lat2, float $lon2): float
    {
        $dLat = deg2rad($lat2 - $lat1);
        $dLon = deg2rad($lon2 - $lon1);
        $a = sin($dLat / 2) ** 2
           + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLon / 2) ** 2;
        return 6371 * 2 * atan2(sqrt($a), sqrt(1 - $a));
    }
}
```

## Stock Availability Check

We query available stock across all warehouses in a **single JOIN** rather than N separate queries:

```php
$skuIds   = collect($order->items)->pluck('sku_id')->all();
$skuCount = count($skuIds);

$candidates = DB::table('warehouses as w')
    ->join('warehouse_stock as ws', 'ws.warehouse_id', '=', 'w.id')
    ->whereIn('ws.sku_id', $skuIds)
    ->where('ws.quantity', '>', 0)
    ->groupBy('w.id', 'w.name', 'w.lat', 'w.lon')
    ->havingRaw('COUNT(DISTINCT ws.sku_id) = ?', [$skuCount])
    ->select('w.id', 'w.name', 'w.lat', 'w.lon')
    ->get();
```

The `havingRaw` ensures we only get warehouses that carry **all** requested SKUs, not just some of them.

## Routing Algorithm

With candidate warehouses in hand, we sort by distance and greedily allocate stock:

```php
class WarehouseRouter
{
    public function __construct(private HaversineService $geo) {}

    public function route(Order $order, float $deliveryLat, float $deliveryLon): array
    {
        // 1. Attach distance to each candidate
        $candidates = $this->getCandidates($order)
            ->map(function ($wh) use ($deliveryLat, $deliveryLon) {
                $wh->distance = $this->geo->distanceKm(
                    $wh->lat, $wh->lon,
                    $deliveryLat, $deliveryLon,
                );
                return $wh;
            })
            ->sortBy('distance')
            ->values();

        // 2. Greedily fulfill remaining items from closest warehouse first
        $remaining   = collect($order->items)->mapWithKeys(fn($i) => [$i['sku_id'] => $i['qty']]);
        $allocations = [];

        foreach ($candidates as $wh) {
            if ($remaining->isEmpty()) break;

            $stock = $this->getStock($wh->id, $remaining->keys()->all());
            $alloc = [];

            foreach ($remaining as $skuId => $qty) {
                $available = $stock[$skuId] ?? 0;
                $take      = min($available, $qty);
                if ($take > 0) {
                    $alloc[$skuId]      = $take;
                    $remaining[$skuId] -= $take;
                    if ($remaining[$skuId] === 0) {
                        $remaining->forget($skuId);
                    }
                }
            }

            if (!empty($alloc)) {
                $allocations[] = ['warehouse_id' => $wh->id, 'items' => $alloc];
            }
        }

        return $allocations;
    }

    private function getStock(int $warehouseId, array $skuIds): array
    {
        return DB::table('warehouse_stock')
            ->where('warehouse_id', $warehouseId)
            ->whereIn('sku_id', $skuIds)
            ->pluck('quantity', 'sku_id')
            ->all();
    }
}
```

## Caching Warehouse Coordinates

Warehouse coordinates change rarely. We cache the full list in Redis using Laravel's Cache facade with tagged cache so it can be invalidated precisely when a warehouse is updated:

```php
class WarehouseRepository
{
    private const CACHE_KEY = 'warehouses:all';
    private const TTL       = 86400; // 24 hours

    public function all(): Collection
    {
        return Cache::tags(['warehouses'])->remember(
            self::CACHE_KEY,
            self::TTL,
            fn () => Warehouse::select('id', 'name', 'lat', 'lon')->get(),
        );
    }

    public function invalidate(): void
    {
        Cache::tags(['warehouses'])->flush();
    }
}
```

Tie the invalidation to the Eloquent model observer so the cache flushes automatically whenever a warehouse record changes:

```php
class WarehouseObserver
{
    public function __construct(private WarehouseRepository $repo) {}

    public function saved(Warehouse $warehouse): void
    {
        $this->repo->invalidate();
    }

    public function deleted(Warehouse $warehouse): void
    {
        $this->repo->invalidate();
    }
}
```

Register it in `AppServiceProvider::boot()`:

```php
Warehouse::observe(WarehouseObserver::class);
```

## Wiring It Together

```php
class CheckoutService
{
    public function __construct(
        private WarehouseRouter     $router,
        private WarehouseRepository $warehouseRepo,
    ) {}

    public function allocate(Order $order, Address $deliveryAddress): array
    {
        return $this->router->route(
            $order,
            $deliveryAddress->lat,
            $deliveryAddress->lon,
        );
    }
}
```

## Results

| Metric                     | Before          | After |
| -------------------------- | --------------- | ----- |
| Avg routing time           | 12 min (manual) | 380ms |
| Suboptimal warehouse picks | ~35%            | <5%   |
| Split-shipment rate        | N/A             | 8%    |

The 30% processing time reduction came primarily from eliminating the manual routing step entirely, not just from optimizing the algorithm.

## Lessons

- A single well-crafted `JOIN` + `havingRaw` beats N separate stock checks every time.
- Wrap distance logic in an injectable service — makes unit testing trivial.
- Use tagged cache (`Cache::tags`) so warehouse invalidation is surgical, not a blanket flush.
- Partial fulfillment (split orders) is worth implementing — it significantly increases fulfillment rate during low-stock periods.
