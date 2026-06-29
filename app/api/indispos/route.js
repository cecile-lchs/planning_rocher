import { getDb } from '../../../lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const sql = getDb()
  // Nettoyage auto des indispos > 4 mois
  await sql`DELETE FROM indispos WHERE date < (NOW() - INTERVAL '4 months')::date::text`
  const rows = await sql`SELECT * FROM indispos`
  return NextResponse.json(rows)
}

export async function POST(req) {
  const sql = getDb()
  const { membre_id, date } = await req.json()
  await sql`INSERT INTO indispos (membre_id, date) VALUES (${membre_id}, ${date}) ON CONFLICT DO NOTHING`
  return NextResponse.json({ ok: true })
}

export async function DELETE(req) {
  const sql = getDb()
  const { membre_id, date } = await req.json()
  await sql`DELETE FROM indispos WHERE membre_id = ${membre_id} AND date = ${date}`
  return NextResponse.json({ ok: true })
}
