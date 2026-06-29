import { getDb } from '../../../lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const sql = getDb()
  const rows = await sql`SELECT * FROM ext_planning`
  return NextResponse.json(rows)
}

export async function POST(req) {
  const sql = getDb()
  const { date, noms } = await req.json()
  await sql`INSERT INTO ext_planning (date, noms) VALUES (${date}, ${noms}) ON CONFLICT (date) DO UPDATE SET noms = ${noms}`
  return NextResponse.json({ ok: true })
}
