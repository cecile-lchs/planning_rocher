import { getDb } from '../../../lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const sql = getDb()
  const rows = await sql`SELECT * FROM liens`
  return NextResponse.json(rows)
}

export async function POST(req) {
  const sql = getDb()
  const { membre_id, ext_nom } = await req.json()
  const existing = await sql`SELECT id FROM liens WHERE membre_id = ${membre_id}`
  if (existing.length > 0) {
    await sql`UPDATE liens SET ext_nom = ${ext_nom} WHERE membre_id = ${membre_id}`
    const updated = await sql`SELECT * FROM liens WHERE membre_id = ${membre_id}`
    return NextResponse.json(updated[0])
  }
  const rows = await sql`INSERT INTO liens (membre_id, ext_nom) VALUES (${membre_id}, ${ext_nom}) RETURNING *`
  return NextResponse.json(rows[0])
}

export async function DELETE(req) {
  const sql = getDb()
  const { id } = await req.json()
  await sql`DELETE FROM liens WHERE id = ${id}`
  return NextResponse.json({ ok: true })
}
