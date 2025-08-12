// /api/tweets.js
import fetch from "node-fetch";

export default async function handler(req, res) {
  const { handle } = req.query;
  if (!handle) {
    return res.status(400).json({ error: "Twitter handle is required" });
  }

  try {
    const nitterInstance = "https://nitter.net"; // Change if you want another
    const response = await fetch(`${nitterInstance}/${handle}`);
    const html = await response.text();

    // Return raw HTML
    res.setHeader("Content-Type", "text/html");
    res.status(200).send(html);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch from Nitter" });
  }
}
