import { Router, type IRouter } from "express";
import { db, ordersTable, pageViewsTable, abandonedCartsTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAdmin } from "../middlewares/requireAdmin";

const router: IRouter = Router();

router.post("/analytics/pageview", async (req, res) => {
  try {
    const body = req.body as { path?: string; sessionId?: string; referrer?: string };
    await db.insert(pageViewsTable).values({
      path: body.path ?? "/",
      sessionId: body.sessionId ?? null,
      referrer: body.referrer ?? null,
      userAgent: req.headers["user-agent"] ?? null,
    });
    res.status(201).json({ ok: true });
  } catch {
    res.status(200).json({ ok: false });
  }
});

async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn(); } catch { return fallback; }
}

/* Map first-2-digits of Indian pincode to state name */
const STATE_CASE = sql.raw(`
  CASE SUBSTRING(pincode, 1, 2)
    WHEN '11' THEN 'Delhi'
    WHEN '12' THEN 'Haryana' WHEN '13' THEN 'Haryana'
    WHEN '14' THEN 'Punjab' WHEN '15' THEN 'Punjab' WHEN '16' THEN 'Punjab'
    WHEN '17' THEN 'Himachal Pradesh'
    WHEN '18' THEN 'J & K' WHEN '19' THEN 'J & K'
    WHEN '20' THEN 'Uttar Pradesh' WHEN '21' THEN 'Uttar Pradesh'
    WHEN '22' THEN 'Uttar Pradesh' WHEN '23' THEN 'Uttar Pradesh'
    WHEN '24' THEN 'Uttar Pradesh' WHEN '25' THEN 'Uttar Pradesh'
    WHEN '26' THEN 'Uttar Pradesh' WHEN '27' THEN 'Uttar Pradesh'
    WHEN '28' THEN 'Uttar Pradesh'
    WHEN '29' THEN 'Karnataka'
    WHEN '30' THEN 'Rajasthan' WHEN '31' THEN 'Rajasthan'
    WHEN '32' THEN 'Rajasthan' WHEN '33' THEN 'Rajasthan' WHEN '34' THEN 'Rajasthan'
    WHEN '35' THEN 'Andaman & Nicobar'
    WHEN '36' THEN 'Gujarat' WHEN '37' THEN 'Gujarat'
    WHEN '38' THEN 'Gujarat' WHEN '39' THEN 'Gujarat'
    WHEN '40' THEN 'Maharashtra' WHEN '41' THEN 'Maharashtra'
    WHEN '42' THEN 'Maharashtra' WHEN '43' THEN 'Maharashtra' WHEN '44' THEN 'Maharashtra'
    WHEN '45' THEN 'Madhya Pradesh' WHEN '46' THEN 'Madhya Pradesh'
    WHEN '47' THEN 'Madhya Pradesh' WHEN '48' THEN 'Madhya Pradesh'
    WHEN '49' THEN 'Chhattisgarh'
    WHEN '50' THEN 'Telangana' WHEN '51' THEN 'Telangana'
    WHEN '52' THEN 'Andhra Pradesh' WHEN '53' THEN 'Andhra Pradesh'
    WHEN '54' THEN 'Andhra Pradesh' WHEN '55' THEN 'Andhra Pradesh'
    WHEN '56' THEN 'Karnataka' WHEN '57' THEN 'Karnataka'
    WHEN '58' THEN 'Karnataka' WHEN '59' THEN 'Karnataka'
    WHEN '60' THEN 'Tamil Nadu' WHEN '61' THEN 'Tamil Nadu'
    WHEN '62' THEN 'Tamil Nadu' WHEN '63' THEN 'Tamil Nadu'
    WHEN '64' THEN 'Tamil Nadu' WHEN '65' THEN 'Tamil Nadu'
    WHEN '66' THEN 'Kerala' WHEN '67' THEN 'Kerala'
    WHEN '68' THEN 'Kerala' WHEN '69' THEN 'Kerala'
    WHEN '70' THEN 'West Bengal' WHEN '71' THEN 'West Bengal'
    WHEN '72' THEN 'West Bengal' WHEN '73' THEN 'West Bengal' WHEN '74' THEN 'West Bengal'
    WHEN '75' THEN 'Odisha' WHEN '76' THEN 'Odisha' WHEN '77' THEN 'Odisha'
    WHEN '78' THEN 'Assam'
    WHEN '79' THEN 'Northeast'
    WHEN '80' THEN 'Bihar' WHEN '81' THEN 'Bihar'
    WHEN '82' THEN 'Bihar' WHEN '83' THEN 'Jharkhand'
    WHEN '84' THEN 'Bihar' WHEN '85' THEN 'Bihar'
    ELSE 'Other'
  END
`);

router.get("/admin/analytics", requireAdmin, async (req, res) => {
  try {
    const { from: fromParam, to: toParam, source: sourceFilter } = req.query as { from?: string; to?: string; source?: string };
    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const last7Start = new Date(todayStart); last7Start.setDate(last7Start.getDate() - 6);
    const last30Start = new Date(todayStart); last30Start.setDate(last30Start.getDate() - 29);

    const periodFrom = fromParam ? new Date(fromParam) : last30Start;
    const periodTo = toParam ? new Date(toParam) : now;

    const emptyRows = { rows: [] as Record<string, unknown>[] };

    /* Build optional source filter clause */
    const sourceWhereClause = sourceFilter && sourceFilter !== "all"
      ? sql.raw(`AND visitor_source = '${sourceFilter.replace(/'/g, "''")}'`)
      : sql.raw("");

    const [
      ordersByDay, ordersByHour, ordersBySource,
      visitorStats, conversionData, topCitiesRevenue,
      abandonedStats, repeatCustomers, paymentStats, periodOrderResult,
      topStatesResult, stateBySourceResult,
    ] = await Promise.all([
      safeQuery(() => db.execute(sql`
        SELECT TO_CHAR(created_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM-DD') as date, COUNT(*) as count
        FROM orders WHERE created_at >= ${last30Start}
        GROUP BY date ORDER BY date ASC
      `), emptyRows),
      safeQuery(() => db.execute(sql`
        SELECT EXTRACT(HOUR FROM created_at AT TIME ZONE 'Asia/Kolkata')::int as hour, COUNT(*) as count
        FROM orders GROUP BY hour ORDER BY hour ASC
      `), emptyRows),
      safeQuery(() => db.execute(sql`
        SELECT source, COUNT(*) as count FROM orders GROUP BY source ORDER BY count DESC
      `), emptyRows),
      safeQuery(() => db.execute(sql`
        SELECT
          COUNT(*) FILTER (WHERE created_at >= ${todayStart}) as today,
          COUNT(*) FILTER (WHERE created_at >= ${yesterdayStart} AND created_at < ${todayStart}) as yesterday,
          COUNT(*) FILTER (WHERE created_at >= ${last7Start}) as last7,
          COUNT(*) FILTER (WHERE created_at >= ${last30Start}) as last30,
          COUNT(*) as total
        FROM page_views
      `), { rows: [{ today: 0, yesterday: 0, last7: 0, last30: 0, total: 0 }] }),
      safeQuery(() => db.execute(sql`
        SELECT
          (SELECT COUNT(*) FROM page_views WHERE created_at >= ${last30Start}) as visitors_30d,
          (SELECT COUNT(*) FROM orders WHERE created_at >= ${last30Start}) as orders_30d,
          (SELECT COUNT(*) FROM page_views WHERE created_at >= ${last7Start}) as visitors_7d,
          (SELECT COUNT(*) FROM orders WHERE created_at >= ${last7Start}) as orders_7d,
          (SELECT COUNT(*) FROM page_views WHERE created_at >= ${todayStart}) as visitors_today,
          (SELECT COUNT(*) FROM orders WHERE created_at >= ${todayStart}) as orders_today
      `), { rows: [{ visitors_30d: 0, orders_30d: 0, visitors_7d: 0, orders_7d: 0, visitors_today: 0, orders_today: 0 }] }),
      safeQuery(() => db.execute(sql`
        SELECT
          COALESCE(
            NULLIF(TRIM(city), ''),
            NULLIF(TRIM(SPLIT_PART(REGEXP_REPLACE(address, '\\s+', ' ', 'g'), ',',
              ARRAY_LENGTH(STRING_TO_ARRAY(address, ','), 1) - 1)), '')
          ) as city,
          COUNT(*) as count,
          SUM(999 * quantity) as revenue
        FROM orders
        WHERE address IS NOT NULL AND address != ''
        GROUP BY city
        HAVING COALESCE(
          NULLIF(TRIM(city), ''),
          NULLIF(TRIM(SPLIT_PART(REGEXP_REPLACE(address, '\\s+', ' ', 'g'), ',', ARRAY_LENGTH(STRING_TO_ARRAY(address, ','), 1) - 1)), '')
        ) IS NOT NULL
        ORDER BY count DESC LIMIT 10
      `), emptyRows),
      safeQuery(() => db.execute(sql`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE recovery_status = 'New') as new_count,
          COUNT(*) FILTER (WHERE recovery_status = 'Called') as called,
          COUNT(*) FILTER (WHERE recovery_status = 'Recovered') as recovered
        FROM abandoned_carts
      `), { rows: [{ total: 0, new_count: 0, called: 0, recovered: 0 }] }),
      safeQuery(() => db.execute(sql`
        SELECT COUNT(DISTINCT phone) as repeat_count
        FROM orders
        WHERE phone IN (SELECT phone FROM orders GROUP BY phone HAVING COUNT(*) > 1)
      `), { rows: [{ repeat_count: 0 }] }),
      safeQuery(() => db.execute(sql`
        SELECT
          COUNT(*) FILTER (WHERE payment_method = 'COD') as cod,
          COUNT(*) FILTER (WHERE payment_method = 'Razorpay') as razorpay,
          COUNT(*) FILTER (WHERE payment_method = 'Cashfree') as cashfree,
          COUNT(*) FILTER (WHERE payment_status = 'success') as paid
        FROM orders
      `), { rows: [{ cod: 0, razorpay: 0, cashfree: 0, paid: 0 }] }),
      safeQuery(() => db.execute(sql`
        SELECT COUNT(*) as count, COALESCE(SUM(999 * quantity), 0) as revenue
        FROM orders WHERE created_at >= ${periodFrom} AND created_at <= ${periodTo}
      `), { rows: [{ count: 0, revenue: 0 }] }),

      /* Top states by orders — prefer stored state column, fallback to pincode prefix */
      safeQuery(() => db.execute(sql`
        SELECT
          COALESCE(NULLIF(TRIM(state), ''), ${STATE_CASE}) as state,
          COUNT(*) as count,
          COALESCE(SUM(999 * quantity), 0) as revenue
        FROM orders
        WHERE (state IS NOT NULL AND state != '') OR (pincode IS NOT NULL AND pincode != '' AND LENGTH(pincode) >= 2 AND pincode != '000000')
        GROUP BY state
        ORDER BY count DESC
        LIMIT 20
      `), emptyRows),

      /* State × Source breakdown for filter */
      safeQuery(() => db.execute(sql`
        SELECT
          COALESCE(NULLIF(TRIM(state), ''), ${STATE_CASE}) as state,
          COALESCE(visitor_source, source, 'Direct') as source,
          COUNT(*) as count
        FROM orders
        WHERE (state IS NOT NULL AND state != '') OR (pincode IS NOT NULL AND pincode != '' AND LENGTH(pincode) >= 2 AND pincode != '000000')
        GROUP BY state, source
        ORDER BY count DESC
      `), emptyRows),
    ]);

    const visRow = (visitorStats.rows[0] ?? {}) as Record<string, unknown>;
    const convRow = (conversionData.rows[0] ?? {}) as Record<string, unknown>;
    const aRow = (abandonedStats.rows[0] ?? {}) as Record<string, unknown>;
    const repRow = (repeatCustomers.rows[0] ?? {}) as Record<string, unknown>;
    const payRow = (paymentStats.rows[0] ?? {}) as Record<string, unknown>;
    const perRow = (periodOrderResult.rows[0] ?? {}) as Record<string, unknown>;

    const v30 = Number(convRow["visitors_30d"] ?? 0); const o30 = Number(convRow["orders_30d"] ?? 0);
    const v7 = Number(convRow["visitors_7d"] ?? 0); const o7 = Number(convRow["orders_7d"] ?? 0);
    const vT = Number(convRow["visitors_today"] ?? 0); const oT = Number(convRow["orders_today"] ?? 0);

    res.json({
      ordersByDay: ordersByDay.rows.map((r) => { const row = r as Record<string, unknown>; return { date: String(row["date"] ?? ""), count: Number(row["count"] ?? 0) }; }),
      ordersByHour: ordersByHour.rows.map((r) => { const row = r as Record<string, unknown>; return { hour: Number(row["hour"] ?? 0), count: Number(row["count"] ?? 0) }; }),
      ordersBySource: ordersBySource.rows.map((r) => { const row = r as Record<string, unknown>; return { source: String(row["source"] ?? "Unknown"), count: Number(row["count"] ?? 0) }; }),
      topCities: topCitiesRevenue.rows.map((r) => { const row = r as Record<string, unknown>; return { city: String(row["city"] ?? "").trim(), count: Number(row["count"] ?? 0), revenue: Number(row["revenue"] ?? 0) }; }).filter((c) => c.city.length > 1),
      /* Build topSource lookup from stateBySource before returning */
      ...(() => {
        const sbsRows = stateBySourceResult.rows.map((r) => {
          const row = r as Record<string, unknown>;
          return { state: String(row["state"] ?? "Other").trim(), source: String(row["source"] ?? "Direct"), count: Number(row["count"] ?? 0) };
        }).filter((s) => s.state !== "Other");

        /* For each state, find the source with the highest count */
        const topSourceMap: Record<string, string> = {};
        for (const r of sbsRows) {
          if (!topSourceMap[r.state] || r.count > (sbsRows.filter((x) => x.state === r.state && x.source === topSourceMap[r.state])[0]?.count ?? 0)) {
            topSourceMap[r.state] = r.source;
          }
        }

        return {
          topStates: topStatesResult.rows.map((r) => {
            const row = r as Record<string, unknown>;
            const state = String(row["state"] ?? "Other").trim();
            return { state, count: Number(row["count"] ?? 0), revenue: Number(row["revenue"] ?? 0), topSource: topSourceMap[state] ?? "Direct" };
          }).filter((s) => s.state !== "Other" && s.state.length > 1),
          stateBySource: sbsRows,
        };
      })(),
      visitors: { today: Number(visRow["today"] ?? 0), yesterday: Number(visRow["yesterday"] ?? 0), last7: Number(visRow["last7"] ?? 0), last30: Number(visRow["last30"] ?? 0), total: Number(visRow["total"] ?? 0) },
      conversion: {
        last30: { visitors: v30, orders: o30, rate: v30 > 0 ? +((o30 / v30) * 100).toFixed(2) : 0 },
        last7: { visitors: v7, orders: o7, rate: v7 > 0 ? +((o7 / v7) * 100).toFixed(2) : 0 },
        today: { visitors: vT, orders: oT, rate: vT > 0 ? +((oT / vT) * 100).toFixed(2) : 0 },
      },
      abandonedStats: { total: Number(aRow["total"] ?? 0), new: Number(aRow["new_count"] ?? 0), called: Number(aRow["called"] ?? 0), recovered: Number(aRow["recovered"] ?? 0) },
      repeatCustomers: Number(repRow["repeat_count"] ?? 0),
      paymentStats: { cod: Number(payRow["cod"] ?? 0), razorpay: Number(payRow["razorpay"] ?? 0), cashfree: Number(payRow["cashfree"] ?? 0), paid: Number(payRow["paid"] ?? 0) },
      periodOrderCount: Number(perRow["count"] ?? 0),
      periodRevenue: Number(perRow["revenue"] ?? 0),
    });
  } catch (err) {
    console.error("Analytics error:", err);
    res.status(500).json({ error: "Failed to load analytics" });
  }
});

export default router;
