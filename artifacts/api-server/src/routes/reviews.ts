import { Router, type IRouter } from "express";
import { db, reviewsTable } from "@workspace/db";
import { eq, desc, and, sql } from "drizzle-orm";
import { requireAdmin } from "../middlewares/requireAdmin";

const router: IRouter = Router();

router.get("/reviews", async (_req, res) => {
  try {
    const reviews = await db.select().from(reviewsTable)
      .where(eq(reviewsTable.status, "approved"))
      .orderBy(desc(reviewsTable.createdAt))
      .limit(30);
    res.json({ reviews });
  } catch {
    res.status(500).json({ error: "Failed to fetch reviews" });
  }
});

router.get("/admin/reviews", requireAdmin, async (req, res) => {
  try {
    const { status, page = "1", limit = "50" } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, parseInt(limit, 10));

    const where = status && status !== "all" ? eq(reviewsTable.status, status) : undefined;

    const [reviews, countResult] = await Promise.all([
      db.select().from(reviewsTable).where(where).orderBy(desc(reviewsTable.createdAt)).limit(limitNum).offset((pageNum - 1) * limitNum),
      db.select({ count: sql<number>`COUNT(*)` }).from(reviewsTable).where(where),
    ]);

    const [statsResult] = await db.select({
      total: sql<number>`COUNT(*)`,
      pending: sql<number>`COUNT(*) FILTER (WHERE status = 'pending')`,
      approved: sql<number>`COUNT(*) FILTER (WHERE status = 'approved')`,
      avgRating: sql<number>`ROUND(AVG(rating)::numeric, 1)`,
    }).from(reviewsTable);

    res.json({
      reviews,
      total: Number(countResult[0]?.count ?? 0),
      page: pageNum,
      stats: {
        total: Number(statsResult?.total ?? 0),
        pending: Number(statsResult?.pending ?? 0),
        approved: Number(statsResult?.approved ?? 0),
        avgRating: Number(statsResult?.avgRating ?? 0),
      },
    });
  } catch {
    res.status(500).json({ error: "Failed to fetch reviews" });
  }
});

router.post("/admin/reviews", requireAdmin, async (req, res) => {
  try {
    const { reviewerName, rating, reviewText, phone, city, status, verified } = req.body as {
      reviewerName?: string; rating?: number; reviewText?: string;
      phone?: string; city?: string; status?: string; verified?: boolean;
    };

    if (!reviewerName || !reviewText || !rating) {
      res.status(400).json({ error: "reviewerName, reviewText, and rating required" });
      return;
    }

    const [review] = await db.insert(reviewsTable).values({
      reviewerName: reviewerName.trim(),
      reviewText: reviewText.trim(),
      rating: Math.min(5, Math.max(1, rating)),
      phone: phone?.trim() ?? null,
      city: city?.trim() ?? null,
      status: status ?? "approved",
      source: "manual",
      verified: verified ?? true,
    }).returning();

    res.status(201).json({ review });
  } catch {
    res.status(500).json({ error: "Failed to add review" });
  }
});

router.patch("/admin/reviews/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { status, reviewerName, reviewText, rating, verified, city } = req.body as {
      status?: string; reviewerName?: string; reviewText?: string;
      rating?: number; verified?: boolean; city?: string;
    };

    const updates: Record<string, unknown> = {};
    if (status) updates["status"] = status;
    if (reviewerName) updates["reviewerName"] = reviewerName.trim();
    if (reviewText) updates["reviewText"] = reviewText.trim();
    if (rating !== undefined) updates["rating"] = Math.min(5, Math.max(1, rating));
    if (verified !== undefined) updates["verified"] = verified;
    if (city !== undefined) updates["city"] = city;

    const [updated] = await db.update(reviewsTable).set(updates).where(eq(reviewsTable.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "Review not found" }); return; }
    res.json({ review: updated });
  } catch {
    res.status(500).json({ error: "Failed to update review" });
  }
});

router.delete("/admin/reviews/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await db.delete(reviewsTable).where(eq(reviewsTable.id, id));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to delete review" });
  }
});

export default router;
