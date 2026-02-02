const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config({ path: "./config.env" });

const { scheduleUserAlerts } = require("./services/alertScheduler");

process.on("uncaughtException", (err) => {
  console.log("uncaughtException REJECTION! Shutting down...");
  console.log(`ERROR_NAME: ${err.name}, ERROR_MESSAGE: ${err.message}`);
  process.exit(1);
});

const app = require("./app");

const DB = process.env.DATABASE.replace(
  "<PASSWORD>",
  process.env.DATABASE_PASSWORD,
);

mongoose.connect(DB).then(() => {
  console.log("DB Connection SUCCESSFUL!");

  scheduleUserAlerts();
});

mongoose.set("strictQuery", false);

const port = process.env.PORT || 3000;
const server = app.listen(port, "0.0.0.0", () => {
  console.log(`App running on port ${port}...`);
});

// Async rejections and how do we start up the server/app again
process.on("unhandledRejection", (err) => {
  console.log("UNHANDLED REJECTION! Shutting down...");
  console.log(`ERROR_NAME: ${err.name}, ERROR_MESSAGE: ${err.message}`);
  server.close(() => {
    process.exit(1);
  });
});
