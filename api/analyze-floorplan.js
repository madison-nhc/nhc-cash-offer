// Vercel serverless function — runs server-side only. The OpenAI key lives in the
// OPENAI_API_KEY environment variable (set in Vercel project settings), never in
// client-side code or localStorage. The browser sends an image; this function is
// the only thing that ever talks to OpenAI.

const PROMPT = `Analyze this real estate floor plan. Return ONLY valid JSON, no markdown:
{
  "totalSqft": 1850,
  "outdoorSqft": 320,
  "rooms": [
    { "name": "Primary Bedroom", "length": 18, "width": 14, "sqft": 220, "type": "living" },
    { "name": "Deck", "length": 20, "width": 10, "sqft": 180, "type": "outdoor" }
  ],
  "notes": "..."
}
Rules:
- "totalSqft" = finished/conditioned/heated living space ONLY (bedrooms, bathrooms, kitchen, living room, dining room, finished basement, etc.). MUST be a number (sum of all living room sqft values). Never return null.
- "outdoorSqft" = the sum of ALL outdoor/unenclosed spaces: decks, patios, balconies, porches, screened porches, covered patios. These do NOT count toward totalSqft. MUST be a number (0 if none shown). Never return null.
- Tag every room in "rooms" with "type": "living" or "type": "outdoor".
- If dimensions not shown, set length/width to null but still estimate sqft. Include all spaces: bedrooms, baths, kitchen, garage, deck, patio, laundry, etc.
- For every room, you MUST calculate and provide a numeric sqft value. If you can see dimensions like 13'x11', multiply them: 13x11=143. Never return null for sqft — estimate if needed. The totalSqft and outdoorSqft fields must also be numeric totals, never null.`

function postProcessRooms(rooms) {
  return (rooms || []).map(r => {
    if (!r.sqft && r.length != null && r.width != null) {
      const sq = parseFloat(r.length) * parseFloat(r.width)
      if (!isNaN(sq)) r.sqft = Math.round(sq)
    }
    if (!r.sqft && r.dimensions) {
      const m = r.dimensions.toString().match(/([\d.]+)\s*[x×'"\s]+\s*([\d.]+)/i)
      if (m) r.sqft = Math.round(parseFloat(m[1]) * parseFloat(m[2]))
    }
    return r
  })
}

function postProcess(result) {
  result.rooms = postProcessRooms(result.rooms)
  if (!result.totalSqft) {
    result.totalSqft = result.rooms.filter(r => r.type !== 'outdoor').reduce((s, r) => s + (r.sqft || 0), 0)
  }
  if (!result.outdoorSqft) {
    result.outdoorSqft = result.rooms.filter(r => r.type === 'outdoor').reduce((s, r) => s + (r.sqft || 0), 0)
  }
  return result
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    res.status(500).json({ error: 'Server is not configured with an OpenAI API key yet. Add OPENAI_API_KEY in Vercel project settings.' })
    return
  }

  const { imageDataUrl } = req.body || {}
  if (!imageDataUrl) {
    res.status(400).json({ error: 'Missing imageDataUrl' })
    return
  }

  try {
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: PROMPT },
            { type: 'image_url', image_url: { url: imageDataUrl, detail: 'high' } },
          ],
        }],
        max_tokens: 1500,
      }),
    })

    if (!openaiRes.ok) {
      const errBody = await openaiRes.json().catch(() => ({}))
      res.status(502).json({ error: errBody.error?.message || 'OpenAI request failed' })
      return
    }

    const data = await openaiRes.json()
    const content = data.choices[0].message.content.trim().replace(/^```json\n?/, '').replace(/\n?```$/, '')
    let parsed
    try {
      parsed = JSON.parse(content)
    } catch (e) {
      res.status(502).json({ error: 'Could not read the AI response. Try a clearer screenshot.' })
      return
    }

    res.status(200).json(postProcess(parsed))
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unexpected server error' })
  }
}
