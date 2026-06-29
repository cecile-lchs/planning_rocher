"use client"
import { useState, useEffect, useCallback } from "react"

const POLES_DIM = ["Diapo","Camera fixe","Camera mobile","Regie","Sono"]
const POLES_MER = ["Diapo"]
const PD = { "Diapo":"Diapo","Camera fixe":"Caméra fixe","Camera mobile":"Caméra mobile","Regie":"Régie","Sono":"Sono" }
const MONTHS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"]
const NIVEAUX = { debutant:"Débutant", intermediaire:"Intermédiaire", experimente:"Expérimenté" }
// pole_niveaux: { "Diapo": "experimente", "Regie": "debutant", ... }
// Si non défini pour un pôle -> "intermediaire" par défaut
const NAV_ICONS = { membres:"👥", indispos:"📅", externe:"🔗", planning:"📋", settings:"⚙️" }

// Jours autorisés par pôle : { poleKey: { dim: bool, mer: bool } }
// Stocké dans membre.pole_jours ex: { "Diapo": "mer", "Regie": "dim", "Sono": "both" }

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

// Retourne les pôles qu'un membre peut faire un jour donné
function getPolesForDay(membre, day) {
  const pj = membre.pole_jours || {}
  return (membre.poles||[]).filter(pole => {
    const j = pj[pole] || "dim" // par défaut dimanche seulement
    if(day==="Dimanche") return j==="dim"||j==="both"
    if(day==="Mercredi") return j==="mer"||j==="both"
    return false
  })
}

function generateAuto(membres, indispos, liens, extP, autreSD, dates) {
  const result={}, count={}, lastDim={}
  membres.forEach(m=>{count[m.id]=0;lastDim[m.id]=null})

  const priorites={}
  dates.filter(d=>d.day==="Dimanche").forEach(d=>{
    const nomsExt=extP[d.date]||[]
    liens.forEach(l=>{
      if(nomsExt.some(n=>n.toLowerCase().includes(l.ext_nom.toLowerCase()))){
        if(!priorites[d.date])priorites[d.date]=[]
        priorites[d.date].push(l.membre_id)
      }
    })
  })

  const indEff={}
  membres.forEach(m=>{
    const base=indispos[m.id]||[], autreS=autreSD[m.id]||[]
    indEff[m.id]=[...new Set([...base,...autreS])]
  })

  function niveauPour(m, pole){ return (m.niveaux_poles||{})[pole]||m.niveau||"intermediaire" }
  function estReferent(m, pole){ return (Array.isArray(m.est_referent_poles)?m.est_referent_poles:[]).includes(pole) }

  const dimDates=dates.filter(d=>d.day==="Dimanche")

  dates.forEach(d=>{
    const usedToday=new Set()
    const polesThisDay=d.day==="Dimanche"
      ? POLES_DIM.filter(pole=>membres.some(m=>getPolesForDay(m,d.day).includes(pole)))
      : POLES_MER

    // Affecter chaque pôle normalement
    polesThisDay.forEach(pole=>{
      const key=d.date+"__"+pole
      let eligible=membres.filter(m=>
        getPolesForDay(m,d.day).includes(pole)&&
        !(indEff[m.id]||[]).includes(d.date)&&
        !usedToday.has(m.id)
      )
      if(eligible.length===0){result[key]="X";return}

      const prio=eligible.filter(m=>(priorites[d.date]||[]).includes(m.id))
      let pool=prio.length>0?prio:eligible

      if(d.day==="Dimanche"){
        const avecRepos=pool.filter(m=>{
          if(!lastDim[m.id])return true
          const last=dimDates.findIndex(x=>x.date===lastDim[m.id])
          const curr=dimDates.findIndex(x=>x.date===d.date)
          return curr-last>1
        })
        if(avecRepos.length>0)pool=avecRepos
      }

      pool.sort((a,b)=>count[a.id]-count[b.id])
      let chosen=pool[0]

      // Si débutant et pas de référent dispo ce jour -> prendre non-débutant si possible
      if(niveauPour(chosen,pole)==="debutant"){
        const refDispo=membres.find(m=>
          estReferent(m,pole)&&
          !(indEff[m.id]||[]).includes(d.date)&&
          m.id!==chosen.id
        )
        if(!refDispo){
          const nonDeb=pool.find(m=>niveauPour(m,pole)!=="debutant")
          if(nonDeb)chosen=nonDeb
        }
      }

      result[key]=chosen.id
      count[chosen.id]++
      usedToday.add(chosen.id)
      if(d.day==="Dimanche")lastDim[chosen.id]=d.date
    })
  })
  return result||{}
}

async function api(path, method, body) {
  try {
    const res=await fetch("/api/"+path,{method:method||"GET",headers:body?{"Content-Type":"application/json"}:{},body:body?JSON.stringify(body):undefined})
    if(!res.ok){console.error("API",res.status,path);return null}
    const text=await res.text()
    return text?JSON.parse(text):null
  } catch(e){console.error(e);return null}
}

// ── Composants hors du render principal pour éviter le bug de focus ──
function TagGroup({items, selected=[], onToggle, display}) {
  const sel = Array.isArray(selected)?selected:[]
  return (
    <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:12}}>
      {items.map(p=>(
        <button key={p} type="button"
          style={{padding:"5px 11px",borderRadius:4,border:"1px solid "+(sel.includes(p)?"#2563eb":"#dde1e7"),background:sel.includes(p)?"#2563eb":"transparent",color:sel.includes(p)?"white":"#6b7280",cursor:"pointer",fontSize:12,fontWeight:500}}
          onClick={()=>onToggle(p)}>
          {display?display[p]:p}
        </button>
      ))}
    </div>
  )
}

function PoleJoursSelector({poles, poleJours, onChange}) {
  const options = [
    {v:"dim", l:"Dimanche"},
    {v:"mer", l:"Mercredi"},
    {v:"both", l:"Dim + Mer"},
  ]
  return (
    <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:12}}>
      {poles.map(pole=>(
        <div key={pole} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",background:"#f8f9fb",borderRadius:4,border:"1px solid #dde1e7"}}>
          <span style={{fontSize:12,fontWeight:600,color:"#374151",minWidth:90}}>{PD[pole]}</span>
          <div style={{display:"flex",gap:4}}>
            {options.map(opt=>(
              <button key={opt.v} type="button"
                style={{padding:"3px 9px",borderRadius:4,border:"1px solid "+((poleJours[pole]||"dim")===opt.v?"#2563eb":"#dde1e7"),background:(poleJours[pole]||"dim")===opt.v?"#2563eb":"white",color:(poleJours[pole]||"dim")===opt.v?"white":"#6b7280",cursor:"pointer",fontSize:11,fontWeight:500}}
                onClick={()=>onChange(pole,opt.v)}>
                {opt.l}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function MemberForm({
  prenom,setPrenom,nom,setNom,poles,setPoles,niveau,setNiveau,
  poleJours,setPoleJours,niveauxPoles,setNiveauxPoles,referents,setReferents,autre,setAutre,
  onSubmit,submitLabel,dark,bd,ts,tp,blue,blueLight
}) {
  const tagSt=(on)=>({padding:"5px 11px",borderRadius:4,border:"1px solid "+(on?blue:bd),background:on?blue:"transparent",color:on?"white":ts,cursor:"pointer",fontSize:12,fontWeight:500})
  const inp2={padding:"8px 11px",border:"1px solid "+bd,borderRadius:4,fontSize:13,background:dark?"#1a2235":"white",color:tp,outline:"none",boxSizing:"border-box"}
  const Label=({children})=><p style={{fontSize:11,fontWeight:600,color:ts,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:6,marginTop:0}}>{children}</p>

  function togglePole(p) {
    if(poles.includes(p)){
      setPoles(poles.filter(x=>x!==p))
      const nj={...poleJours};delete nj[p];setPoleJours(nj)
    } else {
      setPoles([...poles,p])
      setPoleJours({...poleJours,[p]:"dim"})
    }
  }
  function toggleRef(p){ const r=Array.isArray(referents)?referents:[]; setReferents(r.includes(p)?r.filter(x=>x!==p):[...r,p]) }

  return (
    <div>
      <div className="form-row" style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
        <input style={{...inp2,flex:1,minWidth:110}} placeholder="Prénom" value={prenom} onChange={e=>setPrenom(e.target.value)}/>
        <input style={{...inp2,flex:1,minWidth:110}} placeholder="Nom" value={nom} onChange={e=>setNom(e.target.value)}/>
      </div>
      <Label>Pôles</Label>
      <TagGroup items={POLES_DIM} selected={poles} onToggle={togglePole} display={PD}/>
      {poles.length>0&&<>
        <Label>Jours par pôle</Label>
        <PoleJoursSelector poles={poles} poleJours={poleJours} onChange={(pole,val)=>setPoleJours(pj=>({...pj,[pole]:val}))}/>
      </>}
      <div style={{flex:1,minWidth:130,marginBottom:12}}>
        <Label>Autre service</Label>
        <input style={{...inp2,width:"100%"}} placeholder="Ex: Louange" value={autre} onChange={e=>setAutre(e.target.value)}/>
      </div>
      {poles.length>0&&<>
        <Label>Niveau par pôle</Label>
        <div style={{display:"flex",flexDirection:"column",gap:5,marginBottom:12}}>
          {poles.map(p=>(
            <div key={p} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 10px",background:"#f8f9fb",borderRadius:4,border:"1px solid #dde1e7"}}>
              <span style={{fontSize:12,fontWeight:600,color:"#374151",minWidth:90}}>{PD[p]}</span>
              <div style={{display:"flex",gap:4}}>
                {[["debutant","Débutant"],["intermediaire","Intermédiaire"],["experimente","Expérimenté"]].map(([v,l])=>(
                  <button key={v} type="button"
                    style={{padding:"3px 8px",borderRadius:4,border:"1px solid "+((niveauxPoles[p]||"intermediaire")===v?blue:"#dde1e7"),background:(niveauxPoles[p]||"intermediaire")===v?blue:"white",color:(niveauxPoles[p]||"intermediaire")===v?"white":"#6b7280",cursor:"pointer",fontSize:11,fontWeight:500}}
                    onClick={()=>setNiveauxPoles(np=>({...np,[p]:v}))}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </>}
      <Label>Référent sur les pôles</Label>
      <TagGroup items={POLES_DIM} selected={referents||[]} onToggle={toggleRef} display={PD}/>

      <button type="button" style={{padding:"8px 16px",background:blue,color:"white",border:"none",borderRadius:4,fontWeight:600,cursor:"pointer",fontSize:13,opacity:(prenom&&nom&&poles.length)?1:0.4}} onClick={onSubmit}>{submitLabel}</button>
    </div>
  )
}

export default function AdminApp() {
  const {year:initYear,start:initStart}=getCurrentPeriod()
  const [dark,setDark]=useState(false)
  const [auth,setAuth]=useState(false)
  const [pw,setPw]=useState("")
  const [pwErr,setPwErr]=useState(false)
  const [adminPw,setAdminPw]=useState("rocher2026")
  const [tab,setTab]=useState("membres")
  const [loading,setLoading]=useState(false)
  const [membres,setMembres]=useState([])
  const [liens,setLiens]=useState([])
  const [indispos,setIndispos]=useState({})
  const [planning,setPlanning]=useState({})
  const [extP,setExtP]=useState({})
  const [autreSD,setAutreSD]=useState({})
  const [year,setYear]=useState(initYear)
  const [start,setStart]=useState(initStart)
  // Formulaire ajout
  const [fPrenom,setFPrenom]=useState("")
  const [fNom,setFNom]=useState("")
  const [fPoles,setFPoles]=useState([])
  const [fPoleJours,setFPoleJours]=useState({})
  const [fNiveauxPoles,setFNiveauxPoles]=useState({})
  const [fRef,setFRef]=useState([])
  const [fAutre,setFAutre]=useState("")
  // Formulaire édition
  const [editId,setEditId]=useState(null)
  const [ePrenom,setEPrenom]=useState("")
  const [eNom,setENom]=useState("")
  const [ePoles,setEPoles]=useState([])
  const [ePoleJours,setEPoleJours]=useState({})
  const [eNiveauxPoles,setENiveauxPoles]=useState({})
  const [eRef,setERef]=useState([])
  const [eAutre,setEAutre]=useState("")
  // Liens
  const [lMem,setLMem]=useState("")
  const [lExt,setLExt]=useState("")
  const [log,setLog]=useState("")
  const [newAdminPw,setNewAdminPw]=useState("")
  const [newMembrePw,setNewMembrePw]=useState("")
  const [pwMsg,setPwMsg]=useState("")
  const [hoveredNav,setHoveredNav]=useState(null)
  const [menuOpen,setMenuOpen]=useState(false)
  const [referentPresent,setReferentPresent]=useState({})

  const dates=getDates(year,start)
  const periode=year+"-"+start
  const biOpts=Array.from({length:6},(_,i)=>({v:i*2,l:MONTHS[i*2]+" – "+MONTHS[(i*2+1)%12]}))

  const loadAll=useCallback(async()=>{
    setLoading(true)
    try{
      const [mD,lD,iD,eD,pD,aD,sD]=await Promise.all([
        api("membres"),api("liens"),api("indispos"),api("extplanning"),
        api("planning?periode="+periode),api("autreservice"),api("settings")
      ])
      setMembres(mD||[])
      setLiens(lD||[])
      const ind={};(iD||[]).forEach(r=>{if(!ind[r.membre_id])ind[r.membre_id]=[];ind[r.membre_id].push(r.date)});setIndispos(ind)
      const ep={};(eD||[]).forEach(r=>{ep[r.date]=r.noms});setExtP(ep)
      const pl={};(pD||[]).forEach(r=>{pl[r.date+"__"+r.pole]=r.valeur});setPlanning(pl)
      const as={};(aD||[]).forEach(r=>{if(!as[r.membre_id])as[r.membre_id]=[];as[r.membre_id].push(r.date)});setAutreSD(as)
      if(sD&&sD.admin_password)setAdminPw(sD.admin_password)
    }catch(e){console.error(e)}
    setLoading(false)
  },[periode])

  useEffect(()=>{if(auth)loadAll()},[auth,loadAll])

  function login(){if(pw===adminPw){setAuth(true);setPwErr(false)}else setPwErr(true)}

  async function savePw(type){
    const val=type==="admin"?newAdminPw:newMembrePw
    if(!val.trim()){setPwMsg("Vide");return}
    await api("settings","POST",{key:type==="admin"?"admin_password":"membre_password",value:val.trim()})
    if(type==="admin")setAdminPw(val.trim())
    setPwMsg("Mis à jour")
    setTimeout(()=>setPwMsg(""),3000)
    type==="admin"?setNewAdminPw(""):setNewMembrePw("")
  }

  async function addMembre(){
    if(!fPrenom.trim()||!fNom.trim()||fPoles.length===0)return
    const id=Date.now().toString()
    const m={id,prenom:fPrenom.trim(),nom:fNom.trim(),poles:fPoles,pole_jours:fPoleJours,fait_mercredi:Object.values(fPoleJours).some(v=>v==="mer"||v==="both"),niveau:"intermediaire",niveaux_poles:fNiveauxPoles,est_referent_poles:fRef,est_occasionnel:false,autre_service:fAutre}
    const res=await api("membres","POST",m)
    if(res!==null){setMembres(p=>[...p,m])}
    setFPrenom("");setFNom("");setFPoles([]);setFPoleJours({});setFNiveauxPoles({});setFRef([]);setFAutre("")
  }

  function startEdit(m){
    setEditId(m.id);setEPrenom(m.prenom);setENom(m.nom)
    setEPoles(Array.isArray(m.poles)?m.poles:[])
    setEPoleJours(m.pole_jours||{})
    setENiveauxPoles(m.niveaux_poles||{})
    const safeRef = Array.isArray(m.est_referent_poles)?m.est_referent_poles:[]
    setERef(safeRef)
    setEAutre(m.autre_service||"")
  }

  async function saveEdit(){
    const m=membres.find(x=>x.id===editId)
    const updated={...m,prenom:ePrenom.trim(),nom:eNom.trim(),poles:ePoles,pole_jours:ePoleJours,fait_mercredi:Object.values(ePoleJours).some(v=>v==="mer"||v==="both"),niveau:"intermediaire",niveaux_poles:eNiveauxPoles,est_referent_poles:eRef,est_occasionnel:false,autre_service:eAutre}
    await api("membres","PUT",updated)
    setMembres(p=>p.map(x=>x.id===editId?updated:x))
    setEditId(null)
  }

  async function delMembre(id){await api("membres","DELETE",{id});setMembres(p=>p.filter(m=>m.id!==id))}

  async function toggleIndispo(mid,date){
    const cur=indispos[mid]||[]
    if(cur.includes(date)){await api("indispos","DELETE",{membre_id:mid,date});setIndispos(p=>({...p,[mid]:cur.filter(d=>d!==date)}))}
    else{await api("indispos","POST",{membre_id:mid,date});setIndispos(p=>({...p,[mid]:[...cur,date]}))}
  }

  async function toggleAutreSD(mid,date){
    const cur=autreSD[mid]||[]
    if(cur.includes(date)){await api("autreservice","DELETE",{membre_id:mid,date});setAutreSD(p=>({...p,[mid]:cur.filter(d=>d!==date)}))}
    else{await api("autreservice","POST",{membre_id:mid,date});setAutreSD(p=>({...p,[mid]:[...cur,date]}))}
  }

  async function addLien(){
    if(!lMem||!lExt.trim())return
    const data=await api("liens","POST",{membre_id:lMem,ext_nom:lExt.trim()})
    if(data)setLiens(p=>[...p.filter(l=>l.membre_id!==lMem),data])
    setLMem("");setLExt("")
  }

  async function setCell(date,pole,val){
    const np={...(planning||{})}
    if(val&&val!=="X"){POLES_DIM.forEach(p=>{const k=date+"__"+p;if(p!==pole&&np[k]===val){np[k]="";api("planning","POST",{periode,date,pole:p,valeur:""})}})}
    np[date+"__"+pole]=val;setPlanning(np)
    await api("planning","POST",{periode,date,pole,valeur:val})
  }

  async function generate(){
    const result=generateAuto(membres,indispos,liens,extP,autreSD,dates)
    setPlanning(result||{})
    setLog("Planning généré.")
    await api("planning","DELETE",{periode})
    for(const [key,valeur] of Object.entries(result||{})){
      const [date,pole]=key.split("__")
      await api("planning","POST",{periode,date,pole,valeur})
    }
  }

  // Thème
  const bg=dark?"#0f172a":"#f4f5f7"
  const bgCard=dark?"#1a2235":"#ffffff"
  const bgSide=dark?"#111827":"#ffffff"
  const tp=dark?"#e8eaf0":"#111827"
  const ts=dark?"#6b7a99":"#6b7280"
  const bd=dark?"#263045":"#dde1e7"
  const blue="#2563eb"
  const blueLight=dark?"#172554":"#eff6ff"
  const blueDark=dark?"#93c5fd":"#2563eb"
  const r=4

  const inp={padding:"8px 11px",border:"1px solid "+bd,borderRadius:r,fontSize:13,background:bgCard,color:tp,outline:"none",boxSizing:"border-box"}
  const card={background:bgCard,borderRadius:r,padding:"20px 22px",boxShadow:dark?"none":"0 1px 3px rgba(0,0,0,0.08)",border:"1px solid "+bd}
  const btnP={padding:"8px 16px",background:blue,color:"white",border:"none",borderRadius:r,fontWeight:600,cursor:"pointer",fontSize:13}
  const btnS={padding:"8px 14px",background:"transparent",color:ts,border:"1px solid "+bd,borderRadius:r,fontWeight:500,cursor:"pointer",fontSize:13}
  const btnD={padding:"4px 9px",background:"transparent",color:"#dc2626",border:"1px solid #fca5a5",borderRadius:r,cursor:"pointer",fontWeight:500,fontSize:12}
  const btnE={padding:"4px 9px",background:"transparent",color:blueDark,border:"1px solid "+(dark?"#3b5998":"#bfdbfe"),borderRadius:r,cursor:"pointer",fontWeight:500,fontSize:12}
  const nivColor=(n)=>n==="experimente"?"#16a34a":n==="debutant"?"#dc2626":"#b45309"
  const nivBg=(n)=>n==="experimente"?(dark?"#14532d":"#dcfce7"):n==="debutant"?(dark?"#450a0a":"#fee2e2"):(dark?"#451a03":"#fef3c7")

  const navItems=[{k:"membres",label:"Membres"},{k:"indispos",label:"Disponibilités"},{k:"externe",label:"Lien service"},{k:"planning",label:"Planning"},{k:"settings",label:"Paramètres"}]

  if(!auth)return(
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#0f172a",fontFamily:"Inter,system-ui,sans-serif"}}>
      <style suppressHydrationWarning>{`*{box-sizing:border-box;margin:0;padding:0}`}</style>
      <div style={{background:"white",borderRadius:r,padding:"44px 40px",width:340,textAlign:"center",boxShadow:"0 8px 32px rgba(0,0,0,0.25)"}}>
        <div style={{width:28,height:3,background:blue,borderRadius:1,margin:"0 auto 24px"}}/>
        <h1 style={{fontSize:19,fontWeight:700,color:"#111827",marginBottom:3,letterSpacing:"-0.01em"}}>Le Rocher</h1>
        <p style={{color:"#6b7280",fontSize:13,marginBottom:28}}>Service Technique — Administration</p>
        <input style={{...inp,marginBottom:8,width:"100%",borderColor:pwErr?"#dc2626":bd,background:"white",color:"#111827"}}
          type="password" placeholder="Mot de passe" value={pw}
          onChange={e=>{setPw(e.target.value);setPwErr(false)}}
          onKeyDown={e=>e.key==="Enter"&&login()}/>
        {pwErr&&<p style={{color:"#dc2626",fontSize:12,marginBottom:8,textAlign:"left"}}>Mot de passe incorrect</p>}
        <button style={{...btnP,width:"100%",padding:"10px",marginBottom:16,fontSize:14}} onClick={login}>Connexion</button>
        <a href="/membre" style={{fontSize:12,color:"#9ca3af",textDecoration:"none"}}>Accès membres</a>
      </div>
    </div>
  )

  return(
    <div style={{minHeight:"100vh",background:bg,color:tp,display:"flex",fontFamily:"Inter,system-ui,sans-serif"}}>
      <style suppressHydrationWarning>{`
        *{box-sizing:border-box;margin:0;padding:0}
        @media print{
          aside,.no-print{display:none!important}
          body{background:white!important}
          @page{size:A4 landscape;margin:8mm}
          .print-cell{display:block!important}
          .screen-cell{display:none!important}
          table{font-size:9px!important}
          th,td{padding:3px 2px!important}
        }
        .print-cell{display:none}
        .screen-cell{display:block}
        .sidebar-desktop{display:flex}
        .topbar-hamburger{display:none}
        .mobile-menu-overlay{display:none}
        @media(max-width:768px){
          .sidebar-desktop{display:none!important}
          .topbar-hamburger{display:flex!important}
          .main-content{padding:16px 12px!important}
          .mobile-menu-overlay{display:block}
          .form-row{flex-direction:column!important}
          .table-wrapper{overflow-x:auto;-webkit-overflow-scrolling:touch}
        }
      `}</style>

      {/* SIDEBAR */}
      <aside className="sidebar-desktop no-print" style={{width:200,background:bgSide,borderRight:"1px solid "+bd,display:"flex",flexDirection:"column",padding:"20px 12px",position:"sticky",top:0,height:"100vh",flexShrink:0,overflowY:"auto"}}>
        <div style={{paddingLeft:4,marginBottom:28}}>
          <div style={{width:28,height:3,background:blue,borderRadius:1,marginBottom:10}}/>
          <div style={{fontWeight:700,fontSize:14,color:tp,letterSpacing:"-0.01em"}}>Le Rocher</div>
          <div style={{fontSize:11,color:ts,marginTop:1}}>Technique</div>
        </div>
        <nav style={{flex:1,display:"flex",flexDirection:"column",gap:1}}>
          <p style={{fontSize:10,fontWeight:700,color:ts,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:6,paddingLeft:8}}>Navigation</p>
          {navItems.map(({k,label})=>{
            const isActive=tab===k
            const isHover=hoveredNav===k&&!isActive
            return(
              <button key={k} onClick={()=>setTab(k)}
                onMouseEnter={()=>setHoveredNav(k)}
                onMouseLeave={()=>setHoveredNav(null)}
                style={{display:"flex",alignItems:"center",gap:8,padding:"9px 10px",border:"none",background:isActive?blue:isHover?(dark?"#1e293b":"#f1f5f9"):"transparent",color:isActive?"white":isHover?tp:ts,borderRadius:r,cursor:"pointer",fontWeight:isActive?600:400,fontSize:13,textAlign:"left",width:"100%",transition:"background 0.15s,color 0.15s"}}>
                <span style={{fontSize:14}}>{NAV_ICONS[k]}</span>{label}
              </button>
            )
          })}
        </nav>
        <div style={{borderTop:"1px solid "+bd,paddingTop:12,display:"flex",flexDirection:"column",gap:6}}>
          <button onMouseEnter={()=>setHoveredNav("dark")} onMouseLeave={()=>setHoveredNav(null)}
            onClick={()=>setDark(d=>!d)}
            style={{...btnS,fontSize:12,textAlign:"left",background:hoveredNav==="dark"?(dark?"#1e293b":"#f1f5f9"):"transparent"}}>
            {dark?"☀️ Mode clair":"🌙 Mode sombre"}
          </button>
          <button onMouseEnter={()=>setHoveredNav("deco")} onMouseLeave={()=>setHoveredNav(null)}
            onClick={()=>setAuth(false)}
            style={{...btnS,fontSize:12,color:"#dc2626",borderColor:"#fca5a5",textAlign:"left",background:hoveredNav==="deco"?(dark?"#450a0a":"#fef2f2"):"transparent"}}>
            Déconnexion
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <div style={{flex:1,overflow:"auto"}}>
        <div style={{background:bgCard,borderBottom:"1px solid "+bd,padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:20}} className="no-print">
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            {/* Hamburger mobile */}
            <button className="topbar-hamburger" onClick={()=>setMenuOpen(o=>!o)}
              style={{display:"none",background:"transparent",border:"1px solid "+bd,borderRadius:r,padding:"6px 10px",cursor:"pointer",color:tp,fontSize:16,flexShrink:0}}>
              {menuOpen?"✕":"☰"}
            </button>
            <h1 style={{fontSize:16,fontWeight:600,color:tp,letterSpacing:"-0.01em"}}>
              {NAV_ICONS[tab]} {navItems.find(n=>n.k===tab)?.label}
            </h1>
          </div>
          {tab==="planning"&&<button style={{...btnP,fontSize:12,padding:"7px 12px"}} onClick={()=>window.print()}>PDF</button>}
        </div>

        {/* Menu mobile overlay */}
        {menuOpen&&<div className="mobile-menu-overlay" onClick={()=>setMenuOpen(false)}
          style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:30}}>
          <div onClick={e=>e.stopPropagation()}
            style={{width:220,height:"100%",background:bgSide,display:"flex",flexDirection:"column",padding:"20px 12px",overflowY:"auto"}}>
            <div style={{paddingLeft:4,marginBottom:24}}>
              <div style={{width:28,height:3,background:blue,borderRadius:1,marginBottom:10}}/>
              <div style={{fontWeight:700,fontSize:14,color:tp}}>Le Rocher</div>
              <div style={{fontSize:11,color:ts,marginTop:1}}>Technique</div>
            </div>
            <nav style={{flex:1,display:"flex",flexDirection:"column",gap:1}}>
              {navItems.map(({k,label})=>(
                <button key={k} onClick={()=>{setTab(k);setMenuOpen(false)}}
                  style={{display:"flex",alignItems:"center",gap:8,padding:"12px 10px",border:"none",background:tab===k?blue:"transparent",color:tab===k?"white":ts,borderRadius:r,cursor:"pointer",fontWeight:tab===k?600:400,fontSize:15,textAlign:"left",width:"100%"}}>
                  <span style={{fontSize:16}}>{NAV_ICONS[k]}</span>{label}
                </button>
              ))}
            </nav>
            <div style={{borderTop:"1px solid "+bd,paddingTop:12,display:"flex",flexDirection:"column",gap:6}}>
              <button onClick={()=>{setDark(d=>!d);setMenuOpen(false)}}
                style={{...btnS,fontSize:13,textAlign:"left",padding:"10px 10px"}}>
                {dark?"☀️ Mode clair":"🌙 Mode sombre"}
              </button>
              <button onClick={()=>{setAuth(false);setMenuOpen(false)}}
                style={{...btnS,fontSize:13,color:"#dc2626",borderColor:"#fca5a5",textAlign:"left",padding:"10px 10px"}}>
                Déconnexion
              </button>
            </div>
          </div>
        </div>}

        {loading&&<div style={{padding:60,textAlign:"center",color:ts,fontSize:14}}>Chargement...</div>}
        {!loading&&<main className="main-content" style={{padding:"24px",display:"flex",flexDirection:"column",gap:16}}>

          {/* ── MEMBRES ── */}
          {tab==="membres"&&<>
            <div style={card}>
              <h3 style={{fontSize:14,fontWeight:600,color:tp,marginBottom:16}}>Ajouter un membre</h3>
              <MemberForm
                prenom={fPrenom} setPrenom={setFPrenom} nom={fNom} setNom={setFNom}
                poles={fPoles} setPoles={setFPoles} poleJours={fPoleJours} setPoleJours={setFPoleJours}
                niveauxPoles={fNiveauxPoles} setNiveauxPoles={setFNiveauxPoles}
                referents={fRef} setReferents={setFRef} autre={fAutre} setAutre={setFAutre}
                onSubmit={addMembre} submitLabel="Ajouter"
                dark={dark} bd={bd} ts={ts} tp={tp} blue={blue} blueLight={blueLight}/>
            </div>

            <div style={card}>
              <h3 style={{fontSize:14,fontWeight:600,color:tp,marginBottom:14}}>Membres — {membres.length}</h3>
              {membres.length===0&&<p style={{color:ts,fontSize:13}}>Aucun membre.</p>}
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {membres.map(m=>(
                  <div key={m.id}>
                    {editId===m.id?(
                      <div style={{padding:"16px",background:dark?"#111827":"#f8fafc",borderRadius:r,border:"1px solid "+blue}}>
                        <p style={{fontSize:13,fontWeight:600,color:blueDark,marginBottom:12}}>Modifier — {m.prenom} {m.nom}</p>
                        <MemberForm
                          prenom={ePrenom} setPrenom={setEPrenom} nom={eNom} setNom={setENom}
                          poles={ePoles} setPoles={setEPoles} poleJours={ePoleJours} setPoleJours={setEPoleJours}
                          niveauxPoles={eNiveauxPoles} setNiveauxPoles={setENiveauxPoles}
                          referents={eRef} setReferents={setERef} autre={eAutre} setAutre={setEAutre}
                          onSubmit={saveEdit} submitLabel="Sauvegarder"
                          dark={dark} bd={bd} ts={ts} tp={tp} blue={blue} blueLight={blueLight}/>
                        <button type="button" style={{...btnS,marginTop:8,fontSize:12}} onClick={()=>setEditId(null)}>Annuler</button>
                      </div>
                    ):(
                      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",padding:"12px 14px",background:dark?"#111827":"#f8f9fb",borderRadius:r,border:"1px solid "+bd}}>
                        <div style={{flex:1}}>
                          <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap",marginBottom:5}}>
                            <span style={{fontWeight:600,fontSize:14,color:tp}}>{m.prenom} {m.nom}</span>
                            <span style={{fontSize:11,padding:"1px 7px",background:nivBg(m.niveau||"intermediaire"),color:nivColor(m.niveau||"intermediaire"),borderRadius:2,fontWeight:500}}>{NIVEAUX[m.niveau||"intermediaire"]}</span>
                          </div>
                          <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:3}}>
                            {(Array.isArray(m.poles)?m.poles:[]).map(p=>{
                              const j=(m.pole_jours||{})[p]||"dim"
                              return<span key={p} style={{padding:"1px 7px",background:blueLight,color:blueDark,borderRadius:2,fontSize:11,fontWeight:500}}>
                                {PD[p]} <span style={{opacity:0.7,fontSize:10}}>({j==="dim"?"Dim":j==="mer"?"Mer":"Dim+Mer"})</span>
                              </span>
                            })}
                          </div>
                          {m.est_referent_poles&&m.est_referent_poles.length>0&&<div style={{fontSize:11,color:ts}}>Référent : {(Array.isArray(m.est_referent_poles)?m.est_referent_poles:[]).map(p=>PD[p]).join(", ")}</div>}
                          {m.autre_service&&<div style={{fontSize:11,color:ts,marginTop:1}}>Autre service : {m.autre_service}</div>}
                        </div>
                        <div style={{display:"flex",gap:5,flexShrink:0,marginLeft:10}}>
                          <button type="button" style={btnE} onClick={()=>startEdit(m)}>Modifier</button>
                          <button type="button" style={btnD} onClick={()=>delMembre(m.id)}>Supprimer</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div style={card}>
              <h3 style={{fontSize:14,fontWeight:600,color:tp,marginBottom:6}}>Liens familiaux — Planning Louange</h3>
              <p style={{fontSize:12,color:ts,marginBottom:12}}>Si la personne liée est dans le planning Louange, le membre sera priorisé ce dimanche.</p>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
                <select style={{...inp,flex:1}} value={lMem} onChange={e=>setLMem(e.target.value)}>
                  <option value="">Sélectionner un membre</option>
                  {membres.map(m=><option key={m.id} value={m.id}>{m.prenom} {m.nom}</option>)}
                </select>
                <input style={{...inp,flex:1,minWidth:110}} placeholder="Nom dans planning Louange" value={lExt} onChange={e=>setLExt(e.target.value)}/>
              </div>
              <button type="button" style={btnP} onClick={addLien}>Enregistrer</button>
              {liens.length>0&&<div style={{marginTop:10,display:"flex",flexDirection:"column",gap:5}}>
                {liens.map(l=>{const m=membres.find(x=>x.id===l.membre_id);return(
                  <div key={l.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:blueLight,borderRadius:r,padding:"7px 11px",fontSize:12,color:tp,border:"1px solid "+(dark?"#1e3a6e":"#bfdbfe")}}>
                    <span><b>{m?m.prenom+" "+m.nom:"?"}</b> — {l.ext_nom}</span>
                    <button type="button" style={btnD} onClick={async()=>{await api("liens","DELETE",{id:l.id});setLiens(p=>p.filter(x=>x.id!==l.id))}}>Retirer</button>
                  </div>
                )})}
              </div>}
            </div>
          </>}

          {/* ── INDISPOS ── */}
          {tab==="indispos"&&<>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}} className="no-print">
              <select style={{...inp,width:"auto"}} value={start} onChange={e=>setStart(Number(e.target.value))}>{biOpts.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}</select>
              <select style={{...inp,width:"auto"}} value={year} onChange={e=>setYear(Number(e.target.value))}>{[2025,2026,2027].map(y=><option key={y} value={y}>{y}</option>)}</select>
            </div>
            {membres.map(m=>{
              const polesAvecMer=(m.poles||[]).filter(p=>{const j=(m.pole_jours||{})[p]||"dim";return j==="mer"||j==="both"})
              const polesAvecDim=(m.poles||[]).filter(p=>{const j=(m.pole_jours||{})[p]||"dim";return j==="dim"||j==="both"})
              return(
                <div key={m.id} style={card}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,flexWrap:"wrap",gap:8}}>
                    <div style={{display:"flex",alignItems:"center",gap:7}}>
                      <span style={{fontWeight:600,fontSize:14,color:tp}}>{m.prenom} {m.nom}</span>
                      <span style={{fontSize:11,padding:"1px 7px",background:nivBg(m.niveau||"intermediaire"),color:nivColor(m.niveau||"intermediaire"),borderRadius:2,fontWeight:500}}>{NIVEAUX[m.niveau||"intermediaire"]}</span>
                    </div>
                    <div style={{fontSize:11,color:ts}}>
                      Dim: {polesAvecDim.map(p=>PD[p]).join(", ")||"—"} · Mer: {polesAvecMer.map(p=>PD[p]).join(", ")||"—"}
                    </div>
                  </div>
                  <p style={{fontSize:11,fontWeight:600,color:ts,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:8}}>Indisponibilités</p>
                  <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:m.autre_service?14:0}}>
                    {dates.filter(d=>{
                      if(d.day==="Dimanche")return polesAvecDim.length>0
                      if(d.day==="Mercredi")return polesAvecMer.length>0
                      return false
                    }).map(d=>{
                      const off=(indispos[m.id]||[]).includes(d.date)
                      return<button key={d.date} type="button" onClick={()=>toggleIndispo(m.id,d.date)} style={{padding:"7px 9px",borderRadius:r,border:"1px solid "+(off?"#fca5a5":dark?"#1e4d2e":"#86efac"),cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:1,minWidth:48,background:off?(dark?"#450a0a":"#fee2e2"):(dark?"#0f2d1a":"#f0fdf4"),color:off?"#dc2626":"#16a34a"}}>
                        <span style={{fontSize:9,fontWeight:700,textTransform:"uppercase"}}>{d.day==="Dimanche"?"Dim":"Mer"}</span>
                        <span style={{fontSize:12,fontWeight:600}}>{d.date.slice(8)}/{d.date.slice(5,7)}</span>
                        <span style={{fontSize:10}}>{off?"Indispo":"Dispo"}</span>
                      </button>
                    })}
                  </div>
                  {m.autre_service&&<>
                    <p style={{fontSize:11,fontWeight:600,color:ts,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:8,marginTop:4}}>Service {m.autre_service} — dates</p>
                    <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                      {dates.filter(d=>d.day==="Dimanche").map(d=>{
                        const here=(autreSD[m.id]||[]).includes(d.date)
                        return<button key={d.date} type="button" onClick={()=>toggleAutreSD(m.id,d.date)} style={{padding:"7px 9px",borderRadius:r,border:"1px solid "+(here?blue:bd),cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:1,minWidth:48,background:here?blueLight:dark?"#0f172a":"#f8f9fb",color:here?blueDark:ts}}>
                          <span style={{fontSize:9,fontWeight:700,textTransform:"uppercase"}}>Dim</span>
                          <span style={{fontSize:12,fontWeight:600}}>{d.date.slice(8)}/{d.date.slice(5,7)}</span>
                          <span style={{fontSize:10}}>{here?"Service":"Libre"}</span>
                        </button>
                      })}
                    </div>
                    <p style={{fontSize:11,color:ts,marginTop:5}}>Les dates marquées "Service" génèrent un repos automatique dans le planning.</p>
                  </>}
                </div>
              )
            })}
          </>}

          {/* ── EXTERNE ── */}
          {tab==="externe"&&<>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <select style={{...inp,width:"auto"}} value={start} onChange={e=>setStart(Number(e.target.value))}>{biOpts.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}</select>
              <select style={{...inp,width:"auto"}} value={year} onChange={e=>setYear(Number(e.target.value))}>{[2025,2026,2027].map(y=><option key={y} value={y}>{y}</option>)}</select>
            </div>
            <p style={{fontSize:13,color:ts}}>Noms du planning Louange pour chaque dimanche, séparés par des virgules.</p>
            {dates.filter(d=>d.day==="Dimanche").map(d=>(
              <div key={d.date} style={card}>
                <h3 style={{fontSize:13,fontWeight:600,color:tp,marginBottom:8,textTransform:"capitalize"}}>{d.label}</h3>
                <input style={{...inp,width:"100%"}} placeholder="Ex : Léa D, Farès, Patrick"
                  defaultValue={(extP[d.date]||[]).join(", ")}
                  onBlur={e=>{const noms=e.target.value.split(",").map(s=>s.trim()).filter(Boolean);api("extplanning","POST",{date:d.date,noms});setExtP(p=>({...p,[d.date]:noms}))}}/>
                {liens.map(l=>{const m=membres.find(x=>x.id===l.membre_id);const here=(extP[d.date]||[]).some(n=>n.toLowerCase().includes(l.ext_nom.toLowerCase()));if(!here)return null;return<p key={l.id} style={{marginTop:7,padding:"5px 10px",background:dark?"#451a03":"#fef3c7",borderRadius:r,fontSize:12,color:"#92400e",border:"1px solid #fde68a"}}>{l.ext_nom} présent — {m?m.prenom+" "+m.nom:"?"} sera priorisé</p>})}
              </div>
            ))}
          </>}

          {/* ── PLANNING ── */}
          {tab==="planning"&&<>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}} className="no-print">
              <select style={{...inp,width:"auto"}} value={start} onChange={e=>{setStart(Number(e.target.value));setPlanning({})}}>{biOpts.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}</select>
              <select style={{...inp,width:"auto"}} value={year} onChange={e=>{setYear(Number(e.target.value));setPlanning({})}}>{[2025,2026,2027].map(y=><option key={y} value={y}>{y}</option>)}</select>
              <button type="button" style={btnP} onClick={generate}>Générer</button>
              <button type="button" style={btnS} onClick={async()=>{setPlanning({});setLog("");await api("planning","DELETE",{periode})}}>Effacer</button>
            </div>
            {log&&<div style={{background:blueLight,border:"1px solid "+(dark?"#1e3a6e":"#bfdbfe"),borderRadius:r,padding:"8px 12px",fontSize:12,color:blueDark}} className="no-print">{log}</div>}

            {[0,1].map(moisOffset=>{
              const moisIndex=(start+moisOffset)%12
              const moisYear=year+(start+moisOffset>=12?1:0)
              const datesMois=dates.filter(d=>d.date.startsWith(moisYear+"-"+String(moisIndex+1).padStart(2,"0")))
              if(datesMois.length===0)return null
              return <div key={moisOffset} style={{background:bgCard,borderRadius:r,border:"1px solid "+bd,overflowX:"auto",boxShadow:dark?"none":"0 1px 3px rgba(0,0,0,0.06)"}}>
              <div style={{padding:"16px 18px",borderBottom:"1px solid "+bd,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:8}}>
                <div>
                  <div style={{fontWeight:700,fontSize:16,color:tp,letterSpacing:"-0.01em"}}>{MONTHS[moisIndex]} {moisYear}</div>
                  <div style={{fontSize:11,color:ts,marginTop:1}}>Le Rocher — Service Technique</div>
                </div>
              </div>
              <div className="table-wrapper" style={{padding:"12px",overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,tableLayout:"fixed",minWidth:400}}>
                  <thead>
                    <tr>
                      <th style={{padding:"7px 8px",textAlign:"left",fontWeight:600,border:"1px solid "+bd,background:dark?"#111827":"#f8f9fb",width:"80px",color:ts,fontSize:10,textTransform:"uppercase",letterSpacing:"0.05em"}}>Pôle</th>
                      {datesMois.map(d=><th key={d.date} style={{padding:"7px 5px",textAlign:"center",fontWeight:600,border:"1px solid "+bd,background:d.day==="Dimanche"?(dark?"#172554":"#eff6ff"):(dark?"#1a2235":"#f8f9fb"),color:d.day==="Dimanche"?blueDark:ts,fontSize:10,minWidth:"62px"}}>
                        <div style={{fontSize:8,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.04em"}}>{d.day==="Dimanche"?"Dim":"Mer"}</div>
                        <div style={{fontSize:12,fontWeight:700}}>{d.date.slice(8)}/{d.date.slice(5,7)}</div>
                      </th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {POLES_DIM.map((pole,pi)=>(
                      <tr key={pole} style={{background:pi%2===0?bg:bgCard}}>
                        <td style={{padding:"4px 8px",border:"1px solid "+bd,fontWeight:600,background:dark?"#111827":"#f8f9fb",paddingLeft:8,color:tp,fontSize:11,whiteSpace:"nowrap"}}>{PD[pole]}</td>
                        {datesMois.map(d=>{
                          // Ce pôle est-il planifiable ce jour ?
                          const anyMemberCanDo = membres.some(m=>getPolesForDay(m,d.day).includes(pole))
                          if(!anyMemberCanDo&&d.day==="Mercredi") return<td key={d.date} style={{padding:"4px 3px",border:"1px solid "+bd,background:dark?"#111827":"#f4f5f7",textAlign:"center",color:ts}}>–</td>
                          const key=d.date+"__"+pole
                          const val=(planning||{})[key]||""
                          const usedThisDay=new Set(POLES_DIM.filter(p=>p!==pole).map(p=>(planning||{})[d.date+"__"+p]).filter(v=>v&&v!=="X"))
                          const avail=membres.filter(m=>getPolesForDay(m,d.day).includes(pole)&&!(indispos[m.id]||[]).includes(d.date)&&!usedThisDay.has(m.id))
                          const mem=membres.find(m=>m.id===val)
                          const col=val==="X"?"#dc2626":val?blueDark:ts
                          return(
                            <td key={d.date} style={{padding:"2px 2px",border:"1px solid "+bd,textAlign:"center"}}>
                              {/* Print */}
                              <div className="print-cell" style={{fontSize:10,fontWeight:600,color:col,padding:"2px 1px",lineHeight:1.3}}>
                                {(()=>{
                                  const niveauPole=(mem?.niveaux_poles||{})[pole]||mem?.niveau||"intermediaire"
                                  const refPrint=niveauPole==="debutant"?membres.find(m=>
                                    (Array.isArray(m.est_referent_poles)?m.est_referent_poles:[]).includes(pole)&&
                                    !(indispos[m.id]||[]).includes(d.date)&&m.id!==val
                                  ):null
                                  return(<>
                                    <div style={{fontWeight:600}}>{val==="X"?"X":mem?mem.prenom:"–"}</div>
                                    {refPrint&&<div style={{fontSize:8,color:"#16a34a"}}>Réf:{refPrint.prenom}</div>}
                                  </>)
                                })()}
                              </div>
                              {/* Screen */}
                              <div className="screen-cell">
                                {(()=>{
                                  const niveauPole=(mem?.niveaux_poles||{})[pole]||mem?.niveau||"intermediaire"
                                  const refScreen=niveauPole==="debutant"?membres.find(m=>
                                    (Array.isArray(m.est_referent_poles)?m.est_referent_poles:[]).includes(pole)&&
                                    !(indispos[m.id]||[]).includes(d.date)&&m.id!==val
                                  ):null
                                  return(<>
                                    {niveauPole==="debutant"&&mem&&<div style={{fontSize:8,color:"#dc2626",fontWeight:600,marginBottom:1}}>Débutant</div>}
                                    <select value={val} onChange={e=>setCell(d.date,pole,e.target.value)} style={{width:"100%",border:"1px solid "+bd,borderRadius:r,padding:"3px 2px",fontSize:10,background:bgCard,color:col,fontWeight:val?"600":"400",cursor:"pointer"}}>
                                      <option value="">–</option>
                                      <option value="X">X</option>
                                      {avail.map(m=><option key={m.id} value={m.id}>{m.prenom} {m.nom[0]}.</option>)}
                                      {val&&val!=="X"&&!avail.find(m=>m.id===val)&&mem&&<option value={val}>{mem.prenom} {mem.nom[0]}.</option>}
                                    </select>
                                    {niveauPole==="debutant"&&mem&&(refScreen
                                      ? <div style={{fontSize:8,color:"#16a34a",fontWeight:600,marginTop:1}}>Réf: {refScreen.prenom}</div>
                                      : <div style={{fontSize:8,color:"#b45309",fontWeight:600,marginTop:1}}>Sans référent</div>
                                    )}
                                  </>)
                                })()}
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            })}
          </>}

          {/* ── SETTINGS ── */}
          {tab==="settings"&&<>
            <div style={card}>
              <h3 style={{fontSize:14,fontWeight:600,color:tp,marginBottom:12}}>Mot de passe administration</h3>
              <div style={{display:"flex",gap:8,maxWidth:400,flexWrap:"wrap"}}>
                <input style={{...inp,flex:1}} type="password" placeholder="Nouveau mot de passe" value={newAdminPw} onChange={e=>setNewAdminPw(e.target.value)}/>
                <button type="button" style={btnP} onClick={()=>savePw("admin")}>Sauvegarder</button>
              </div>
            </div>
            <div style={card}>
              <h3 style={{fontSize:14,fontWeight:600,color:tp,marginBottom:5}}>Mot de passe membres</h3>
              <p style={{fontSize:12,color:ts,marginBottom:12}}>Utilisé sur <b>/membre</b></p>
              <div style={{display:"flex",gap:8,maxWidth:400,flexWrap:"wrap"}}>
                <input style={{...inp,flex:1}} type="password" placeholder="Nouveau mot de passe" value={newMembrePw} onChange={e=>setNewMembrePw(e.target.value)}/>
                <button type="button" style={btnP} onClick={()=>savePw("membre")}>Sauvegarder</button>
              </div>
            </div>
            {pwMsg&&<div style={{background:dark?"#14532d":"#f0fdf4",border:"1px solid #86efac",borderRadius:r,padding:"8px 12px",fontSize:12,color:"#15803d"}}>{pwMsg}</div>}
          </>}

        </main>}
      </div>
    </div>
  )
}
