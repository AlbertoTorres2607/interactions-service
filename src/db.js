const mongoose = require("mongoose");
const { mongoUrl } = require("./config");

mongoose.set("strictQuery", true);

async function connectDB() {
  await mongoose.connect(mongoUrl, {
    autoIndex: true,
    serverSelectionTimeoutMS: 10000
  });
  console.log("[db] connected:", mongoUrl);
}

module.exports = { connectDB };
