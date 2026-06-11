const BIN_ID = "6a2a1856da38895dfeaa9f99";
const API_KEY = "$2a$10$t81gd4Zkypsbz.Ai8oS8GOfqVCph6c0X84Sr1OoFuSIkkTS7wI4SW";
const BASE = `https://api.jsonbin.io/v3/b/${BIN_ID}`;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, PUT, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const url = req.method === "GET" ? `${BASE}/latest` : BASE;
    const options = {
      method: req.method,
      headers: { "Content-Type": "application/json", "X-Master-Key": API_KEY, "X-Bin-Versioning": "false" }
    };
    if (req.method === "PUT") options.body = JSON.stringify(req.body);
    const response = await fetch(url, options);
    const data = await response.json();
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
