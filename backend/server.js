const axios = require("axios");
const mongoose = require("mongoose");
const express = require("express");

const PORT = 3000;
const POLLING_INTERVAL = 1000;

let pollingActive = null;

async function clearDatabase() {
  const collections = await mongoose.connection.db.collections();

  for (const key in collections) {
    const collection = collections[key];
    await collection.drop();
  }
}

async function connectAndClearDatabase() {
  try {
    await mongoose.connect(
      "mongodb+srv://ayush:DX5Hzm0DNNKMXz2c@fomofactory.53xiagd.mongodb.net/?retryWrites=true&w=majority&appName=FomoFactory",
      {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        dbName: "fomofactory",
      }
    );

    console.log("Connected to MongoDB");

    await clearDatabase();
    console.log("All collections have been cleared");

    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Database connection or clearing error:", error);
  }
}

const dataSchema = new mongoose.Schema(
  {
    symbol: String,
    price: Number,
    version: Number,
  },
  { collection: "currencies" }
);

let versionNumber = 1;

const Currency = mongoose.model("Currency", dataSchema);

const symbols = ["USD", "GBP", "EUR"];

async function fetchData(symbol, version) {
  try {
    const response = await axios.get(
      `https://api.frankfurter.app/latest?from=${symbol}&to=INR`
    );

    return {
      symbol: symbol,
      price: response.data.rates.INR,
      version: version,
    };
  } catch (error) {
    console.error(`Error fetching data`, error.message);
    return null;
  }
}

async function pollAndStoreData() {
  for (const symbol of symbols) {
    const data = await fetchData(symbol, versionNumber);
    if (data) {
      const newData = new Currency(data);
      await newData.save();
    }
  }
  console.log(`polled data version: ${versionNumber}`);
  versionNumber++;
}

function startPolling() {
  if (!pollingActive) {
    console.log("Starting polling");
    pollingActive = setInterval(pollAndStoreData, POLLING_INTERVAL);
  } else {
    console.log("Polling is already active");
  }
}

function stopPolling() {
  if (pollingActive) {
    console.log("Stopping polling");
    clearInterval(pollingActive);
    pollingActive = null;
  } else {
    console.log("No active polling to stop");
  }
}

const app = express();

app.get("/currencies", async (req, res) => {
  try {
    const latestData = await Currency.aggregate([
      { $sort: { version: -1 } },
      {
        $group: {
          _id: "$symbol",
          documents: { $push: "$$ROOT" },
        },
      },
    ]);
    res.json(latestData);
  } catch (error) {
    res.status(500).json({ error: `error: ${error}` });
  }
});

app.get("/start_polling", (req, res) => {
  startPolling();
  res.json({ message: "Polling started" });
});

app.get("/stop_polling", (req, res) => {
  stopPolling();
  res.json({ message: "Polling stopped" });
});

connectAndClearDatabase();
