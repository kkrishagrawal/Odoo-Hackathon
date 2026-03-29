require("dotenv").config();

const cookieParser = require("cookie-parser");
const cors = require("cors");
const express = require("express");
const helmet = require("helmet");

const apiRouter = require("./api");
const { errorHandler, notFoundHandler } = require("./middleware/error.middleware");
const { env } = require("./utils/env");

const app = express();

const isLocalDevOrigin = (origin) => {
  try {
    const url = new URL(origin);
    return ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  } catch {
    return false;
  }
};

app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (origin === env.FRONTEND_ORIGIN) {
        callback(null, true);
        return;
      }

      if (env.NODE_ENV !== "production" && isLocalDevOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

app.get("/", (_req, res) => {
  res.status(200).json({ message: "Backend server is running" });
});

app.use("/api/v1", apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`Backend API listening on http://localhost:${env.PORT}`);
});
