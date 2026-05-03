import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import passport from "./lib/auth/passport.js";
import authRouter from "./routes/route.js";

const app = express();
const PORT = process.env.PORT || 8001;

app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  }),
);

// Rate Limiting to be implemented later

app.use(cookieParser());
app.use(express.json());
app.use(passport.initialize());

app.get("/", (req, res) => {
  res.status(200).send("Hello from backend");
});
app.use("/api/v1", authRouter);

app.listen(PORT, () => {
  console.log("Server is listening to the port: ", PORT);
});

export default app;
