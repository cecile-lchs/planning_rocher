import { getDb } from '../../../lib/db'
import { NextResponse } from 'next/server'

export async function GET(req) {
  const sql = getDb()
  const { searchParams } = new URL(req.url)
  const periode = searchParams.get('periode')
  const rows = await sql`SELECT * FROM planning WHERE periode = ${periode}`
  return NextResponse.json(rows)
}

export async function POST(req) {
  const sql = getDb()
  const { periode, date, pole, valeur } = await req.json()
  if (!valeur) {
    await sql`DELETE FROM planning WHERE periode = ${periode} AND date = ${date} AND pole = ${pole}`
  } else {
    await sql`INSERT INTO planning (periode, date, pole, valeur) VALUES (${periode}, ${date}, ${pole}, ${valeur}) ON CONFLICT (periode, date, pole) DO UPDATE SET valeur = ${valeur}`
  }
  return NextResponse.json({ ok: true })
}

export async function DELETE(req) {
  const sql = getDb()
  const { periode } = await req.json()
  await sql`DELETE FROM planning WHERE periode = ${periode}`
  return NextResponse.json({ ok: true })
}
