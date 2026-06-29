import { getDb } from '../../../lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const sql = getDb()
  const rows = await sql`SELECT * FROM settings`
  const s = {}
  rows.forEach(r => { s[r.key] = r.value })
  return NextResponse.json(s)
}

export async function POST(req) {
  const sql = getDb()
  const { key, value } = await req.json()
  await sql`INSERT INTO settings (key, value) VALUES (${key}, ${value}) ON CONFLICT (key) DO UPDATE SET value = ${value}`
  return NextResponse.json({ ok: true })
}
