import { getDb } from '../../../lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const sql = getDb()
  const rows = await sql`SELECT * FROM autre_service_dates`
  return NextResponse.json(rows)
}

export async function POST(req) {
  const sql = getDb()
  const { membre_id, date } = await req.json()
  await sql`INSERT INTO autre_service_dates (membre_id, date) VALUES (${membre_id}, ${date}) ON CONFLICT DO NOTHING`
  return NextResponse.json({ ok: true })
}

export async function DELETE(req) {
  const sql = getDb()
  const { membre_id, date } = await req.json()
  await sql`DELETE FROM autre_service_dates WHERE membre_id = ${membre_id} AND date = ${date}`
  return NextResponse.json({ ok: true })
}
