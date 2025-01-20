const express = require("express");

const app = express();

// Middleware
app.use(express.json({ limit: "10kb" }));

// Routes
app.use("/api/v1/users");

module.exports = app;
