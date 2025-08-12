// api/tweets.js

export default async function handler(req, res) {
  const { handle } = req.query;
  const count = parseInt(req.query.count) || 5; // Top N tweets

  if (!handle) {
    return res.status(400).json({ error: 'Missing handle parameter' });
  }

  try {
    // Use a stable Nitter instance
    const instance = 'https://nitter.privacydev.net';
    const response = await fetch(`${instance}/${handle}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch from Nitter: ${response.status}`);
    }

    const html = await response.text();

    // Naive HTML parsing
    const tweetMatches = [...html.matchAll(/<div class="tweet-content media-body">([\s\S]*?)<\/div>/g)];
    const tweets = tweetMatches.map(match =>
      match[1]
        .replace(/<[^>]+>/g, '') // Remove HTML tags
        .replace(/\s+/g, ' ')
        .trim()
    ).slice(0, count);

    res.status(200).json({ handle, tweets });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch tweets', details: error.message });
  }
}
