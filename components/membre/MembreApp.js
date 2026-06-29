"use client"
import { useState, useEffect } from "react"

const MONTHS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"]

function getCurrentPeriod() {
  const now = new Date()
  const month = now.getMonth(), year = now.getFullYear(), day = now.getDate()
  let start = Math.floor(month/2)*2
  if(month===start+1 && day>15){ start=(start+2)%12 }
  return { year, start }
}

function getDates(year, start) {
  const out = []
  for (let m = start; m < start + 2; m++) {
    const mo = m%12, y = year+Math.floor(m/12)
    const days = new Date(y, mo+1, 0).getDate()
    for (let d = 1; d <= days; d++) {
      const dt = new Date(y,mo,d), dow = dt.getDay()
      if(dow===0||dow===3) out.push({
        date: y+"-"+String(mo+1).padStart(2,"0")+"-"+String(d).padStart(2,"0"),
        day: dow===0?"Dimanche":"Mercredi",
        label: dt.toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"})
      })
    }
  }
  return out
}

async function api(path, method, body) {
  try {
    const res = await fetch("/api/"+path,{method:method||"GET",headers:body?{"Content-Type":"application/json"}:{},body:body?JSON.stringify(body):undefined})
    if(!res.ok)return null
    const text=await res.text()
    return text?JSON.parse(text):null
  } catch(e){return null}
}

export default function MembreApp() {
  const { year, start } = getCurrentPeriod()
  const dates = getDates(year, start)
  const nextMonthLabel = MONTHS[(start+1)%12]

  const [auth, setAuth] = useState(false)
  const [pw, setPw] = useState("")
  const [pwErr, setPwErr] = useState(false)
  const [membrePw, setMembrePw] = useState(null)
  const [membres, setMembres] = useState([])
  const [selectedId, setSelectedId] = useState("")
  const [indispos, setIndispos] = useState([])
  const [autreSD, setAutreSD] = useState([])
  const [activeTab, setActiveTab] = useState("indispos")
  const [hoveredBtn, setHoveredBtn] = useState(null)

  useEffect(() => {
    api("settings").then(s => setMembrePw(s?.membre_password || "technique2026"))
  }, [])

  useEffect(() => {
    if (!auth) return
    api("membres").then(data => setMembres(data || []))
  }, [auth])

  useEffect(() => {
    if (!selectedId) return
    api("indispos").then(data => {
      setIndispos((data||[]).filter(r=>r.membre_id===selectedId).map(r=>r.date))
    })
    api("autreservice").then(data => {
      setAutreSD((data||[]).filter(r=>r.membre_id===selectedId).map(r=>r.date))
    })
  }, [selectedId, membres])

  function login() {
    if (membrePw===null) return
    if (pw===membrePw) { setAuth(true); setPwErr(false) }
    else setPwErr(true)
  }

  async function toggleIndispo(date) {
    if (indispos.includes(date)) {
      await api("indispos","DELETE",{membre_id:selectedId,date})
      setIndispos(p=>p.filter(d=>d!==date))
    } else {
      await api("indispos","POST",{membre_id:selectedId,date})
      setIndispos(p=>[...p,date])
    }
  }

  async function toggleAutreSD(date) {
    if (autreSD.includes(date)) {
      await api("autreservice","DELETE",{membre_id:selectedId,date})
      setAutreSD(p=>p.filter(d=>d!==date))
    } else {
      await api("autreservice","POST",{membre_id:selectedId,date})
      setAutreSD(p=>[...p,date])
    }
  }

  const blue="#2563eb"
  const r=4
  const inp={padding:"10px 12px",border:"1px solid #dde1e7",borderRadius:r,fontSize:14,outline:"none",background:"white",color:"#111827",width:"100%",boxSizing:"border-box"}

  const selectedMembre = membres.find(m=>m.id===selectedId)
  const hasAutreService = selectedMembre?.autre_service

  // Dates visibles selon les pôles du membre
  function getVisibleDates(m) {
    if(!m) return []
    const pj = m.pole_jours || {}
    const hasMer = (m.poles||[]).some(p=>{const j=pj[p]||"dim";return j==="mer"||j==="both"})
    const hasDim = (m.poles||[]).some(p=>{const j=pj[p]||"dim";return j==="dim"||j==="both"})
    return dates.filter(d=>(d.day==="Dimanche"&&hasDim)||(d.day==="Mercredi"&&hasMer))
  }

  if (!auth) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#0f172a",fontFamily:"Inter,system-ui,sans-serif"}}>
      <style suppressHydrationWarning>{`*{box-sizing:border-box;margin:0;padding:0}`}</style>
      <div style={{background:"white",borderRadius:r,padding:"44px 40px",width:360,textAlign:"center",boxShadow:"0 8px 32px rgba(0,0,0,0.25)"}}>
        <div style={{width:28,height:3,background:blue,borderRadius:1,margin:"0 auto 24px"}}/>
        <h1 style={{fontSize:19,fontWeight:700,color:"#111827",marginBottom:3}}>Le Rocher</h1>
        <p style={{color:"#6b7280",fontSize:13,marginBottom:28}}>Mes disponibilités — Service Technique</p>
        <input style={{...inp,marginBottom:8,borderColor:pwErr?"#dc2626":"#dde1e7"}}
          type="password" placeholder="Mot de passe" value={pw}
          onChange={e=>{setPw(e.target.value);setPwErr(false)}}
          onKeyDown={e=>e.key==="Enter"&&login()} />
        {pwErr&&<p style={{color:"#dc2626",fontSize:12,marginBottom:8,textAlign:"left"}}>Mot de passe incorrect</p>}
        {membrePw===null&&<p style={{color:"#9ca3af",fontSize:12,marginBottom:8}}>Chargement...</p>}
        <button style={{padding:"10px",background:blue,color:"white",border:"none",borderRadius:r,fontWeight:600,cursor:"pointer",fontSize:14,width:"100%",marginBottom:16,opacity:membrePw===null?0.5:1}} onClick={login} disabled={membrePw===null}>
          Accéder
        </button>
        <a href="/" style={{fontSize:12,color:"#9ca3af",textDecoration:"none"}}>Administration</a>
      </div>
    </div>
  )

  return (
    <div style={{minHeight:"100vh",background:"#f4f5f7",fontFamily:"Inter,system-ui,sans-serif",color:"#111827"}}>
      <style suppressHydrationWarning>{`*{box-sizing:border-box;margin:0;padding:0}`}</style>

      <header style={{background:"white",borderBottom:"1px solid #dde1e7",padding:"14px 20px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div>
          <div style={{fontWeight:700,fontSize:14,color:"#111827"}}>Le Rocher — Technique</div>
          <div style={{fontSize:12,color:"#6b7280",marginTop:1}}>{MONTHS[start]} – {nextMonthLabel} {year}</div>
        </div>
        <button onClick={()=>setAuth(false)} style={{padding:"6px 12px",background:"transparent",color:"#6b7280",border:"1px solid #dde1e7",borderRadius:r,cursor:"pointer",fontSize:12}}>
          Déconnexion
        </button>
      </header>

      <main style={{maxWidth:600,margin:"0 auto",padding:"24px 16px",display:"flex",flexDirection:"column",gap:14}}>
        {!selectedId?(
          <div style={{background:"white",borderRadius:r,padding:"24px",boxShadow:"0 1px 3px rgba(0,0,0,0.08)",border:"1px solid #dde1e7"}}>
            <h2 style={{fontSize:16,fontWeight:700,marginBottom:4}}>Sélectionne ton nom</h2>
            <p style={{color:"#6b7280",fontSize:13,marginBottom:20}}>Pour gérer tes disponibilités — {MONTHS[start]} – {nextMonthLabel} {year}.</p>
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {membres.map(m=>(
                <button key={m.id} onClick={()=>setSelectedId(m.id)}
                  onMouseEnter={()=>setHoveredBtn(m.id)} onMouseLeave={()=>setHoveredBtn(null)}
                  style={{padding:"12px 16px",background:hoveredBtn===m.id?"#f1f5f9":"#f8f9fb",border:"1px solid #dde1e7",borderRadius:r,cursor:"pointer",textAlign:"left",fontWeight:500,fontSize:14,color:"#111827",display:"flex",alignItems:"center",justifyContent:"space-between",transition:"background 0.15s"}}>
                  <span>{m.prenom} {m.nom}</span>
                  <span style={{color:"#9ca3af",fontSize:12}}>Sélectionner →</span>
                </button>
              ))}
            </div>
          </div>
        ):(
          <>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <button onClick={()=>setSelectedId("")} style={{padding:"6px 12px",background:"white",border:"1px solid #dde1e7",borderRadius:r,cursor:"pointer",fontSize:12,color:"#6b7280"}}>← Retour</button>
              <span style={{fontSize:15,fontWeight:600,color:"#111827"}}>{selectedMembre?.prenom} {selectedMembre?.nom}</span>
            </div>

            {/* Tabs si autre service */}
            {hasAutreService&&(
              <div style={{display:"flex",gap:1,background:"white",borderRadius:r,padding:3,border:"1px solid #dde1e7"}}>
                {[{k:"indispos",l:"Mes indisponibilités"},{k:"autre",l:`Service ${hasAutreService}`}].map(({k,l})=>(
                  <button key={k} onClick={()=>setActiveTab(k)}
                    style={{flex:1,padding:"8px",border:"none",background:activeTab===k?blue:"transparent",color:activeTab===k?"white":"#6b7280",borderRadius:3,cursor:"pointer",fontWeight:activeTab===k?600:400,fontSize:13,transition:"all 0.15s"}}>
                    {l}
                  </button>
                ))}
              </div>
            )}

            {/* Indispos */}
            {(!hasAutreService||activeTab==="indispos")&&(
              <div style={{background:"white",borderRadius:r,padding:"20px",boxShadow:"0 1px 3px rgba(0,0,0,0.08)",border:"1px solid #dde1e7"}}>
                <p style={{color:"#6b7280",fontSize:13,marginBottom:4}}>Clique sur les dates où tu es <b style={{color:"#dc2626"}}>indisponible</b>.</p>
                <p style={{color:"#9ca3af",fontSize:12,marginBottom:18}}>Sauvegardé automatiquement à chaque clic.</p>
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {getVisibleDates(selectedMembre).map(d=>{
                    const off=indispos.includes(d.date)
                    return(
                      <button key={d.date} onClick={()=>toggleIndispo(d.date)}
                        onMouseEnter={()=>setHoveredBtn(d.date)} onMouseLeave={()=>setHoveredBtn(null)}
                        style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",borderRadius:r,border:"1px solid "+(off?"#fca5a5":"#86efac"),background:off?"#fee2e2":"#f0fdf4",cursor:"pointer",transition:"all 0.1s",opacity:hoveredBtn===d.date?0.85:1}}>
                        <div style={{textAlign:"left"}}>
                          <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",color:off?"#dc2626":"#16a34a",marginBottom:2}}>{d.day}</div>
                          <div style={{fontSize:14,fontWeight:500,color:"#111827",textTransform:"capitalize"}}>{d.label}</div>
                        </div>
                        <div style={{padding:"4px 10px",borderRadius:r,background:off?"#dc2626":"#16a34a",color:"white",fontSize:12,fontWeight:600,flexShrink:0}}>
                          {off?"Indisponible":"Disponible"}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Autre service */}
            {hasAutreService&&activeTab==="autre"&&(
              <div style={{background:"white",borderRadius:r,padding:"20px",boxShadow:"0 1px 3px rgba(0,0,0,0.08)",border:"1px solid #dde1e7"}}>
                <p style={{color:"#6b7280",fontSize:13,marginBottom:4}}>Indique les dimanches où tu es en service <b>{hasAutreService}</b>.</p>
                <p style={{color:"#9ca3af",fontSize:12,marginBottom:18}}>Ces dates génèrent un repos automatique dans le planning.</p>
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {dates.filter(d=>d.day==="Dimanche").map(d=>{
                    const here=autreSD.includes(d.date)
                    return(
                      <button key={d.date} onClick={()=>toggleAutreSD(d.date)}
                        onMouseEnter={()=>setHoveredBtn("a"+d.date)} onMouseLeave={()=>setHoveredBtn(null)}
                        style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 16px",borderRadius:r,border:"1px solid "+(here?blue:"#dde1e7"),background:here?"#eff6ff":"#f8f9fb",cursor:"pointer",transition:"all 0.1s",opacity:hoveredBtn==="a"+d.date?0.85:1}}>
                        <div style={{textAlign:"left"}}>
                          <div style={{fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em",color:here?blue:"#6b7280",marginBottom:2}}>Dimanche</div>
                          <div style={{fontSize:14,fontWeight:500,color:"#111827",textTransform:"capitalize"}}>{d.label}</div>
                        </div>
                        <div style={{padding:"4px 10px",borderRadius:r,background:here?blue:"#e5e7eb",color:here?"white":"#6b7280",fontSize:12,fontWeight:600,flexShrink:0}}>
                          {here?"En service":"Libre"}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <div style={{background:"#eff6ff",borderRadius:r,padding:"12px 16px",border:"1px solid #bfdbfe"}}>
              <p style={{margin:0,fontSize:12,color:"#1d4ed8"}}>Tes réponses sont enregistrées en temps réel et visibles immédiatement par l'administrateur.</p>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
