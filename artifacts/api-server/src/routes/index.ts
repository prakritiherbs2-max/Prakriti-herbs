import { Router, type IRouter } from "express";
import healthRouter from "./health";
import ordersRouter from "./orders";
import crmRouter from "./crm";
import adminRouter from "./admin";
import analyticsRouter from "./analytics";
import reviewsRouter from "./reviews";
import settingsRouter from "./settings";
import paymentsRouter from "./payments";
import liveRouter from "./live";
import authRouter from "./auth";
import agenciesRouter from "./agencies";
import exportsRouter from "./exports";
import leadTrackingRouter from "./leadTracking";

const router: IRouter = Router();

router.use(healthRouter);
router.use(liveRouter);
router.use(ordersRouter);
router.use(crmRouter);
router.use(authRouter);
router.use(adminRouter);
router.use(analyticsRouter);
router.use(reviewsRouter);
router.use(settingsRouter);
router.use(paymentsRouter);
router.use(agenciesRouter);
router.use(exportsRouter);
router.use(leadTrackingRouter);

export default router;
