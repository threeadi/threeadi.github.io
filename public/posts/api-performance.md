# API Performance: From Bottleneck to 50% Faster Response Times

For the ITB Mobile academic platform, we supported 1,000+ daily users hitting the same endpoints repeatedly — especially during KRS (course registration) season when load spiked 10x. Here's the exact set of optimizations that cut response times by 50%.

## Baseline: Identifying the Bottlenecks

Before optimizing, we instrumented every endpoint with `DB::listen()` in Laravel to log query counts and execution time per request.

The findings were sobering:

- Course listing endpoint: **47 queries** per request (classic N+1)
- Schedule endpoint: **3.2 seconds** avg, mostly from unindexed JOINs
- Notification endpoint: re-computing unread counts from scratch every load

## Fix 1: Eliminate N+1 with Eager Loading

The course endpoint fetched a list of courses, then for each course lazy-loaded its department, lecturer, and prerequisites.

**Before:**

```php
$courses = Course::all(); // 1 query
foreach ($courses as $course) {
    $dept     = $course->department;    // N queries
    $lecturer = $course->lecturer;     // N queries
}
```

**After:**

```php
$courses = Course::with(['department', 'lecturer', 'prerequisites'])->get();
// Total: 4 queries regardless of N
```

Query count: **47 → 4**. Response time: **1,800ms → 210ms**.

## Fix 2: Composite Indexes for JOIN-heavy Queries

The schedule query joined `schedules`, `rooms`, `courses`, and `enrollments` with no indexes on the join columns.

```sql
-- Added composite index
CREATE INDEX idx_schedules_course_day
    ON schedules (course_id, day_of_week, time_start);

CREATE INDEX idx_enrollments_student_sem
    ON enrollments (student_id, semester_id);
```

EXPLAIN output went from `type: ALL` (full table scan, ~40k rows) to `type: ref` (index lookup, ~12 rows). Response time: **3,200ms → 380ms**.

## Fix 3: Cache Computed Values with Redis

Unread notification counts were recalculated on every page load with an aggregation query.

```php
// Before: runs COUNT query on every request
$unread = Notification::where('user_id', $userId)
    ->where('read_at', null)
    ->count();

// After: cached with tag-based invalidation
$unread = Cache::tags(["user:{$userId}:notifications"])
    ->remember("unread_count:{$userId}", 300, function () use ($userId) {
        return Notification::where('user_id', $userId)
            ->whereNull('read_at')
            ->count();
    });

// Invalidate when a new notification is dispatched or marked read
Cache::tags(["user:{$userId}:notifications"])->flush();
```

TTL of 5 minutes was acceptable — notification count being slightly stale is fine for most users.

## Fix 4: Select Only Needed Columns

We were doing `SELECT *` throughout. During KRS, the `courses` table had 40+ columns including large text fields (syllabus, learning outcomes). The listing endpoint only needed 8 of them.

```php
// Before
Course::with('lecturer')->get();

// After
Course::select('id', 'code', 'name', 'credits', 'lecturer_id')
    ->with(['lecturer:id,name,nidn'])
    ->get();
```

Payload size: **~180KB → ~22KB**. Measurable improvement on mobile networks.

## Fix 5: Pagination Over Full Loads

Several endpoints returned all records. We enforced cursor-based pagination:

```php
return Course::orderBy('id')
    ->cursorPaginate(perPage: 20);
```

Cursor pagination is more stable than offset under concurrent inserts (common during registration season).

## Summary of Results

| Endpoint           | Before       | After           | Improvement |
| ------------------ | ------------ | --------------- | ----------- |
| Course listing     | 1,800ms      | 210ms           | −88%        |
| Weekly schedule    | 3,200ms      | 380ms           | −88%        |
| Notification count | 240ms        | 8ms (cache hit) | −97%        |
| Search             | 1,100ms      | 95ms            | −91%        |
| **Average**        | **~1,600ms** | **~175ms**      | **−89%**    |

Overall system responsiveness improved by ~50% across all endpoints (weighted by traffic volume).

## Key Principles

1. **Measure first** — don't guess where the bottleneck is
2. **N+1 is usually the biggest win** — fix it first
3. **Index join columns** — `EXPLAIN` every slow query
4. **Cache aggressively, invalidate correctly** — wrong cache is worse than no cache
5. **Select only what you need** — bandwidth and serialization cost matter on mobile
