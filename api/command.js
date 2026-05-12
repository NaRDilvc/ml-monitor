export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).end()

  const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN } = process.env
  const { command } = req.body

  if (!['stop', 'restart', 'clear'].includes(command))
    return res.status(400).json({ error: 'Invalid command' })

  const endpoint = command === 'clear'
    ? `${UPSTASH_REDIS_REST_URL}/del/training_command`
    : `${UPSTASH_REDIS_REST_URL}/set/training_command`

  await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: command !== 'clear' ? JSON.stringify(command) : undefined,
  })

  res.json({ ok: true })
}
