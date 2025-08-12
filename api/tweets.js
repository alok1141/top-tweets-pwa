// api/tweets.js
import fetch from 'node-fetch';

export default async function handler(req, res) {
  const { handle } = req.query;

  if (!handle) {
    return res.status(400).json({ error: 'Missing handle parameter' });
  }

  try {
    // Example: Fetch top tweets from Nitter instance (HTML parsing)
    const instance = 'https://nitter.net';
    const response = await fetch(`${instance}/${handle}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch from Nitter: ${response.status}`);
    }

    const html = await response.text();

    // Simple parse for tweet texts (naive, can be improved)
    const tweetMatches = [...html.matchAll(/<div class="tweet-content media-body">([\s\S]*?)<\/div>/g)];
    const tweets = tweetMatches.map(match =>
      match[1]
        .replace(/<[^>]+>/g, '') // remove HTML tags
        .trim()
    ).slice(0, 5); // get top 5 tweets

    res.status(200).json({ handle, tweets });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch tweets' });
  }
}
