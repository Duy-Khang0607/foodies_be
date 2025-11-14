require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { connectDB } = require("./src/config/db");
const productRoutes = require("./src/routes/productRoutes");
const imageRoutes = require("./src/routes/imageRoutes");
const authRoutes = require("./src/routes/authRoutes");
const vnpayRoutes = require("./src/routes/vnpayRoutes");
const portfolioRoutes = require("./src/routes/portfolioRoutes");
const orderRoutes = require("./src/routes/orderRoutes");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: "50mb" })); // Tăng limit để xử lý base64 images
app.use(bodyParser.urlencoded({ extended: true, limit: "50mb" }));

// Ensure data directory exists for fallback
const fs = require("fs");
const path = require("path");
const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

const dataFile = path.join(__dirname, "data", "products.json");
if (!fs.existsSync(dataFile)) {
  const initialData = [];
  fs.writeFileSync(dataFile, JSON.stringify(initialData, null, 2));
}

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/images", imageRoutes);
app.use("/api/vnpay", vnpayRoutes);
app.use("/api/portfolio", portfolioRoutes);
app.use("/api/orders", orderRoutes);

// Health check endpoint
app.get("/api/health", (req, res) => {
  const mongoose = require("mongoose");
  const connectionStatus = mongoose.connection.readyState;
  const statusMap = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
  };

  res.status(200).json({
    success: true,
    message: "Server is running",
    timestamp: new Date().toISOString(),
    database: {
      status: statusMap[connectionStatus],
      readyState: connectionStatus,
      host: mongoose.connection.host || "Not connected",
      name: mongoose.connection.name || "Not connected",
      usingMongoDB: connectionStatus === 1,
    },
    storage: connectionStatus === 1 ? "MongoDB" : "JSON File",
    services: {
      auth: "/api/auth",
      products: "/api/products",
      images: "/api/images",
      vnpay: "/api/vnpay",
      portfolio: "/api/portfolio",
      orders: "/api/orders",
    },
  });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Endpoint not found",
  });
});

// Error handler
app.use((error, req, res, next) => {
  console.error("Server Error:", error);
  res.status(500).json({
    success: false,
    message: "Internal server error",
    error: error.message,
  });
});

connectDB();

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📡 API endpoints available at http://localhost:${PORT}/api`);
  console.log(`🏥 Health check: http://localhost:${PORT}/api/health`);
});

module.exports = app;
