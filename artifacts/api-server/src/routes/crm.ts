import { Router, type IRouter } from "express";

const CRM_TARGET_URL =
  process.env["CRM_API_URL"] ??
  "https://webhook.site/b5b0e2d9-6248-4af8-a4b5-810f25691f6e";

const router: IRouter = Router();

router.post("/crm-proxy", async (req, res) => {
  const payload = req.body as Record<string, unknown>;

  req.log.info({ payload }, "CRM proxy: received lead, forwarding to CRM");

  try {
    const crmRes = await fetch(CRM_TARGET_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const rawText = await crmRes.text();
    req.log.info(
      { status: crmRes.status, body: rawText },
      "CRM proxy: received response from CRM",
    );

    if (!crmRes.ok) {
      let message = `CRM API error: ${crmRes.status} ${crmRes.statusText}`;
      try {
        const json: unknown = JSON.parse(rawText);
        if (
          json !== null &&
          typeof json === "object" &&
          "message" in json &&
          typeof (json as { message: unknown }).message === "string"
        ) {
          message = (json as { message: string }).message;
        } else if (
          json !== null &&
          typeof json === "object" &&
          "error" in json &&
          typeof (json as { error: unknown }).error === "string"
        ) {
          message = (json as { error: string }).error;
        }
      } catch {
      }
      res.status(502).json({ message });
      return;
    }

    res.status(200).json({ message: "Lead forwarded successfully" });
  } catch (err) {
    req.log.error({ err }, "CRM proxy: fetch to CRM failed");
    res.status(502).json({ message: "Unable to reach CRM server. Please try again." });
  }
});

export default router;
