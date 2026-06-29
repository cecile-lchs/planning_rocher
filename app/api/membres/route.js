import { getDb } from '../../../lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const sql = getDb()
  const rows = await sql`SELECT * FROM membres ORDER BY nom`
  return NextResponse.json(rows)
}

export async function POST(req) {
  const sql = getDb()
  const { id, prenom, nom, poles, fait_mercredi, niveau, niveaux_poles, est_referent_poles, est_occasionnel, autre_service, pole_jours } = await req.json()
  await sql`
    INSERT INTO membres (id, prenom, nom, poles, fait_mercredi, niveau, niveaux_poles, est_referent_poles, est_occasionnel, autre_service, pole_jours)
    VALUES (${id}, ${prenom}, ${nom}, ${poles}, ${fait_mercredi}, ${niveau}, ${JSON.stringify(niveaux_poles||{})}, ${est_referent_poles}, ${est_occasionnel||false}, ${autre_service}, ${JSON.stringify(pole_jours||{})})
  `
  return NextResponse.json({ ok: true })
}

export async function PUT(req) {
  const sql = getDb()
  const { id, prenom, nom, poles, fait_mercredi, niveau, niveaux_poles, est_referent_poles, est_occasionnel, autre_service, pole_jours } = await req.json()
  await sql`
    UPDATE membres SET
      prenom = ${prenom}, nom = ${nom}, poles = ${poles},
      fait_mercredi = ${fait_mercredi}, niveau = ${niveau},
      niveaux_poles = ${JSON.stringify(niveaux_poles||{})},
      est_referent_poles = ${est_referent_poles},
      est_occasionnel = ${est_occasionnel||false},
      autre_service = ${autre_service},
      pole_jours = ${JSON.stringify(pole_jours||{})}
    WHERE id = ${id}
  `
  return NextResponse.json({ ok: true })
}

export async function DELETE(req) {
  const sql = getDb()
  const { id } = await req.json()
  await sql`DELETE FROM membres WHERE id = ${id}`
  return NextResponse.json({ ok: true })
}
