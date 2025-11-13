require("dotenv").config();

const config = {
  port: process.env.PORT || 3000,
  mongoUrl: process.env.MONGO_URL || "mongodb://localhost:27017/devspace",
  nodeEnv: process.env.NODE_ENV || "development"
};

module.exports = config;
