import express from "express";
import authRoutes from "../controllers/auth.js";

const router = express.Router();

router.use("/auth", authRoutes);

export default router;
