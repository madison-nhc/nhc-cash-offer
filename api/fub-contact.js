// Vercel serverless function — runs server-side only. The Follow Up Boss API
// key lives in the FUB_API_KEY environment variable (set in Vercel project
// settings), never in client-side code. The browser sends a person ID
// (extracted from the deal's stored fub_link); this function is the only
// thing that ever talks to the Follow Up Boss API.
//
// Auth: Basic Auth, API key as username, blank password.
// Optional: FUB "system" registration headers (X-System / X-System-Key) —
// FUB asks integrations to register at https://apps.followupboss.com/system-registration.
// Not strictly required for a single account's own API key, so these are
// only sent if both env vars are set.

const FUB_BASE = 'https://api.followupboss.com/v1'

function authHeaders() {
  const apiKey = process.env.FUB_API_KEY
  const headers = {
    Authorization: 'Basic ' + Buffer.from(`${apiKey}:`).toString('base64'),
    Accept: 'application/json',
  }
  if (process.env.FUB_SYSTEM_NAME && process.env.FUB_SYSTEM_KEY) {
    headers['X-System'] = process.env.FUB_SYSTEM_NAME
    headers['X-System-Key'] = process.env.FUB_SYSTEM_KEY
  }
  return headers
}

async function fubGet(path) {
  const res = await fetch(`${FUB_BASE}${path}`, { headers: authHeaders() })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`FUB ${path} -> ${res.status} ${body.slice(0, 200)}`)
  }
  return res.json()
}

// FUB field names vary a bit by endpoint/account config — read defensively
// with fallbacks rather than assuming one exact shape.
function firstOf(obj, keys) {
  for (const k of keys) {
    if (obj && obj[k] != null && obj[k] !== '') return obj[k]
  }
  return null
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  if (!process.env.FUB_API_KEY) {
    res.status(500).json({ error: 'Server is not configured with a Follow Up Boss API key yet. Add FUB_API_KEY in Vercel project settings.' })
    return
  }

  const id = parseInt(req.query.id, 10)
  if (!id || isNaN(id)) {
    res.status(400).json({ error: 'Missing or invalid person id' })
    return
  }

  const result = { person: null, activity: [], errors: [] }

  // Contact basics
  try {
    const data = await fubGet(`/people/${id}`)
    const p = data?.person || data
    result.person = {
      name: firstOf(p, ['name']) || [p?.firstName, p?.lastName].filter(Boolean).join(' ') || null,
      phone: firstOf(p?.phones?.[0] || {}, ['value']) || firstOf(p, ['phone']),
      email: firstOf(p?.emails?.[0] || {}, ['value']) || firstOf(p, ['email']),
      source: firstOf(p, ['source']),
      stage: firstOf(p, ['stage']),
      tags: Array.isArray(p?.tags) ? p.tags : [],
      assignedTo: firstOf(p, ['assignedTo', 'assignedUserName']),
      lastActivity: firstOf(p, ['lastActivity', 'lastActivityDate']),
    }
  } catch (e) {
    result.errors.push(`person: ${e.message}`)
  }

  // Recent activity — notes, calls, text messages, merged and sorted newest-first.
  const activityFetches = [
    { type: 'note', path: `/notes?personId=${id}&limit=10&sort=-created` , textKeys: ['body', 'subject'] },
    { type: 'call', path: `/calls?personId=${id}&limit=10&sort=-created`, textKeys: ['note', 'outcome', 'duration'] },
    { type: 'text', path: `/textMessages?personId=${id}&limit=10&sort=-created`, textKeys: ['message', 'body'] },
  ]

  const merged = []
  for (const f of activityFetches) {
    try {
      const data = await fubGet(f.path)
      const items = data?.notes || data?.calls || data?.textmessages || data?.textMessages || data?.items || []
      for (const item of items) {
        merged.push({
          type: f.type,
          date: firstOf(item, ['created', 'dateCreated', 'date', 'sentAt']),
          text: firstOf(item, f.textKeys) || null,
          by: firstOf(item, ['createdBy', 'userName', 'from']),
        })
      }
    } catch (e) {
      result.errors.push(`${f.type}: ${e.message}`)
    }
  }
  result.activity = merged
    .filter(a => a.date)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 15)

  res.status(200).json(result)
}
