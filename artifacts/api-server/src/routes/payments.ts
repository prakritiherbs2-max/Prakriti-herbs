import { Router, type IRouter } from "express";
import crypto from "crypto";
import { db, ordersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getSetting } from "./settings";

const router: IRouter = Router();

router.post("/payments/razorpay/create-order", async (req, res) => {
  try {
    const { amount, orderId } = req.body as { amount?: number; orderId?: string };
    if (!amount || !orderId) { res.status(400).json({ error: "amount and orderId required" }); return; }

    const keyId = process.env["RAZORPAY_KEY_ID"] ?? await getSetting("razorpay_key_id");
    const keySecret = process.env["RAZORPAY_KEY_SECRET"] ?? await getSetting("razorpay_key_secret");

    if (!keyId || !keySecret) {
      res.status(503).json({ error: "Razorpay not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in Settings." });
      return;
    }

    const razorpayRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
      },
      body: JSON.stringify({
        amount: amount * 100,
        currency: "INR",
        receipt: orderId,
        notes: { orderId },
      }),
    });

    if (!razorpayRes.ok) {
      const err = await razorpayRes.text();
      res.status(razorpayRes.status).json({ error: `Razorpay error: ${err}` });
      return;
    }

    const data = (await razorpayRes.json()) as { id: string };
    res.json({ razorpayOrderId: data.id, keyId });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Payment failed" });
  }
});

router.post("/payments/razorpay/verify", async (req, res) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature, localOrderId } = req.body as {
      razorpayOrderId?: string; razorpayPaymentId?: string;
      razorpaySignature?: string; localOrderId?: number;
    };

    const keySecret = process.env["RAZORPAY_KEY_SECRET"] ?? await getSetting("razorpay_key_secret");
    if (!keySecret) { res.status(503).json({ error: "Razorpay not configured" }); return; }
    if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
      res.status(400).json({ error: "Missing payment verification fields" });
      return;
    }

    const expectedSig = crypto.createHmac("sha256", keySecret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex");

    if (expectedSig !== razorpaySignature) {
      res.status(400).json({ error: "Invalid payment signature", verified: false });
      return;
    }

    if (localOrderId) {
      await db.update(ordersTable).set({
        paymentId: razorpayPaymentId,
        paymentStatus: "success",
        paymentMethod: "Razorpay",
        status: "Confirmed - Paid",
      }).where(eq(ordersTable.id, localOrderId));
    }

    res.json({ verified: true, paymentId: razorpayPaymentId });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Verification failed" });
  }
});

router.post("/payments/cashfree/create-order", async (req, res) => {
  try {
    const { amount, orderId, customerName, customerPhone } = req.body as {
      amount?: number; orderId?: string; customerName?: string; customerPhone?: string;
    };
    if (!amount || !orderId) { res.status(400).json({ error: "amount and orderId required" }); return; }

    const appId = process.env["CASHFREE_APP_ID"] ?? await getSetting("cashfree_app_id");
    const secretKey = process.env["CASHFREE_SECRET_KEY"] ?? await getSetting("cashfree_secret_key");

    if (!appId || !secretKey) {
      res.status(503).json({ error: "Cashfree not configured. Add CASHFREE_APP_ID and CASHFREE_SECRET_KEY in Settings." });
      return;
    }

    const cfRes = await fetch("https://sandbox.cashfree.com/pg/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-client-id": appId,
        "x-client-secret": secretKey,
        "x-api-version": "2023-08-01",
      },
      body: JSON.stringify({
        order_id: orderId,
        order_amount: amount,
        order_currency: "INR",
        customer_details: {
          customer_id: customerPhone ?? orderId,
          customer_name: customerName ?? "Customer",
          customer_phone: customerPhone ?? "9999999999",
        },
        order_meta: {
          return_url: `${process.env["BASE_URL"] ?? ""}/api/payments/cashfree/return?orderId=${orderId}`,
        },
      }),
    });

    const data = await cfRes.json() as { payment_session_id?: string; message?: string };
    if (!cfRes.ok) { res.status(cfRes.status).json({ error: data.message ?? "Cashfree error" }); return; }
    res.json({ sessionId: data.payment_session_id, appId });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Cashfree failed" });
  }
});

export default router;
