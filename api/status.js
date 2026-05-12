export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')

  const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = process.env
  if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
    return res.status(500).json({ error: 'Upstash env vars not set' })
  }

  try {
    const r = await fetch(`${UPSTASH_REDIS_REST_URL}/get/training_log`, {
      headers: { Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}` }
    })
    const { result } = await r.json()
    const data = result ? JSON.parse(result) : { status: 'not_started' }
    res.json(data)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
}
