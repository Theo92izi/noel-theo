import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Gift, Plus, LogOut, Heart, LockKeyhole, Check, ShoppingBag, Undo2, ExternalLink, Pencil, Trash2, Sparkles, X, LoaderCircle, AlertCircle, RefreshCcw, Snowflake, PartyPopper } from 'lucide-react';
import './styles.css';
import Magic,{magicEnabled} from './Magic.jsx';

const PROFILES = [
  {id:'theo',name:'Théo',avatar:'/favicon.png',locked:true},
  {id:'laurine',name:'Laurine',avatar:'/avatars/laurine.png'},
  {id:'maman',name:'Christelle',avatar:'/avatars/maman.png'},
  {id:'dino',name:'Dino',avatar:'/avatars/dino.png'},
];
const priorityOptions = [{value:'coup_de_coeur',label:'Coup de cœur'},{value:'envie',label:'Très envie'},{value:'idee',label:'Une idée'}];
const emptyGift={title:'',description:'',product_url:'',image_url:'',price_eur:'',priority:'envie'};
const PEOPLE_EMAILS={theo:'theoarnal82@gmail.com',laurine:'laurine.delage531@gmail.com',maman:'mchristellemarty82@gmail.com',dino:'lionel.delage531@orange.fr'};
const SMALL_ICONS=['🎉','✨','🎊','🎁','⭐','❄️'];

async function api(action, data) {
  const ctrl=new AbortController();
  const timer=setTimeout(()=>ctrl.abort(),15000);
  try {
    const response=await fetch(`/api/index?action=${encodeURIComponent(action)}`,{
      method:data===undefined?'GET':'POST',credentials:'same-origin',
      headers:data===undefined?{}:{'Content-Type':'application/json'},
      body:data===undefined?undefined:JSON.stringify(data),signal:ctrl.signal,cache:'no-store'
    });
    const payload=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(payload.error||`Erreur HTTP ${response.status}`);
    return payload;
  } catch(e){
    if(e?.name==='AbortError') throw new Error('Connexion trop longue. Vérifie Internet puis réessaie.');
    throw e;
  } finally {clearTimeout(timer);}
}
function Avatar({person,size='normal'}) {
  const [bad,setBad]=useState(false);
  useEffect(()=>setBad(false),[person?.avatar_url,person?.avatar]);
  const url=person?.avatar_url||person?.avatar;
  return <div className={`avatar avatar-${size}`}>
    {url&&!bad?<img src={url} alt={person?.display_name||person?.name||'Avatar'} onError={()=>setBad(true)}/>:<span>{(person?.display_name||person?.name||'?')[0]}</span>}
  </div>;
}
function Confetti({show}){
  const bits=useMemo(()=>Array.from({length:55},(_,i)=>({x:(i*37+11)%100,delay:(i*41)%800,dur:1900+(i*31)%1400,icon:SMALL_ICONS[i%SMALL_ICONS.length]})),[]);
  if(!show)return null;
  return <div className="confetti-layer" aria-hidden="true">{bits.map((b,i)=><span key={i} style={{left:`${b.x}%`,animationDelay:`${b.delay}ms`,animationDuration:`${b.dur}ms`}}>{b.icon}</span>)}</div>;
}
function App(){
  const [magicEvent,setMagicEvent]=useState(null);
  const [profileId,setProfileId]=useState(null),[loaded,setLoaded]=useState(false);
  const [chosen,setChosen]=useState(null),[pin,setPin]=useState('');
  const [busy,setBusy]=useState(false),[pending,setPending]=useState(''),[notice,setNotice]=useState('');
  const [gifts,setGifts]=useState([]),[claims,setClaims]=useState([]),[members,setMembers]=useState([]);
  const [modal,setModal]=useState(false),[editing,setEditing]=useState(null),[form,setForm]=useState(emptyGift);
  const [search,setSearch]=useState(''),[filter,setFilter]=useState('all'),[summary,setSummary]=useState(false),[summarySeen,setSummarySeen]=useState(false),[confetti,setConfetti]=useState(false);
  const owner=profileId==='theo', person=PROFILES.find(p=>p.id===profileId), myEmail=PEOPLE_EMAILS[profileId];
  const claimMap=useMemo(()=>Object.fromEntries(claims.map(x=>[x.gift_id,x])),[claims]);
  const peopleMap=useMemo(()=>Object.fromEntries(members.map(m=>[m.email,m])),[members]);
  const mine=claims.filter(x=>x.buyer_email===myEmail),purchased=claims.filter(x=>x.status==='purchased');
  const toast=x=>setNotice(x);
  useEffect(()=>{let active=true; api('session').then(x=>{if(active)setProfileId(x.profile||null)}).catch(e=>{if(active)toast(e.message)}).finally(()=>{if(active)setLoaded(true)});return ()=>{active=false}},[]);
  useEffect(()=>{if(!notice)return;const t=setTimeout(()=>setNotice(''),5500);return ()=>clearTimeout(t)},[notice]);
  async function refresh(silent=false){
    try{const data=await api('data');setGifts(data.gifts||[]);setMembers(data.members||[]);setClaims(data.claims||[]);return data}
    catch(e){if(!silent)toast(e.message)}
  }
  useEffect(()=>{
    if(!profileId){setGifts([]);setClaims([]);setMembers([]);setSummarySeen(false);return;}
    let active=true;
    const load=async()=>{if(active)await refresh(true)};
    load();const interval=setInterval(load,7000);
    const onFocus=()=>load();document.addEventListener('visibilitychange',onFocus);
    return ()=>{active=false;clearInterval(interval);document.removeEventListener('visibilitychange',onFocus)};
  },[profileId]);
  useEffect(()=>{
    if(!profileId||owner||summarySeen||!members.length)return;
    setSummarySeen(true);
    // Show purchased gifts upon returning, but not for a new empty list.
    if(purchased.length) setSummary(true);
  },[profileId,owner,summarySeen,members.length,purchased.length]);
  async function login(id){
    if(id==='theo'){setChosen(id);setPin('');return;}
    setBusy(true);
    try{await api('login',{profile:id});setProfileId(id);setChosen(null);setSummarySeen(false)}
    catch(e){toast(e.message)}finally{setBusy(false)}
  }
  async function loginOwner(e){
    e.preventDefault();setBusy(true);
    try{await api('login',{profile:'theo',pin});setProfileId('theo');setPin('');setChosen(null)}
    catch(e){toast(e.message)}finally{setBusy(false)}
  }
  async function logout(){
    setBusy(true);try{await api('logout', {});setProfileId(null);setMagicEvent(null);setSummary(false);setSummarySeen(false)}catch(e){toast(e.message)}finally{setBusy(false)}
  }
  function openAdd(item){setEditing(item?.id||null);setForm(item?{...item,price_eur:item.price_eur??''}:{...emptyGift});setModal(true)}
  async function saveGift(e){
    e.preventDefault();if(busy)return;setBusy(true);
    try{await api('gift',{kind:editing?'edit':'add',id:editing,gift:form});setModal(false);toast(editing?'Cadeau mis à jour !':'Cadeau ajouté !');await refresh()}
    catch(e){toast(e.message)}finally{setBusy(false)}
  }
  async function removeGift(g){
    if(!window.confirm(`Supprimer « ${g.title} » ?`))return;
    setPending(g.id);try{await api('gift',{kind:'delete',id:g.id});toast('Cadeau supprimé.');await refresh()}
    catch(e){toast(e.message)}finally{setPending('')}
  }
  async function act(g,kind){
    if(pending)return;setPending(g.id);
    try{
      await api('claim',{kind,id:g.id});
      const refreshed=await refresh();
      if(kind==='buy'){
        if(magicEnabled(profileId)&&refreshed){const count=(refreshed.claims||[]).filter(c=>c.buyer_email===myEmail&&c.status==='purchased').length;if(count>0)setMagicEvent({level:Math.min(count,4),profile:profileId});}
        else {setConfetti(true);setTimeout(()=>setConfetti(false),3400);}
        toast('🎉 Achat confirmé ! Merci, lutin de Noël !');
      }else toast(kind==='reserve'?'Cadeau réservé pour toi !':'Réservation annulée.');
    }catch(e){toast(e.message);await refresh(true)}finally{setPending('')}
  }
  const visibleGifts=gifts.filter(g=>{
    const q=search.trim().toLowerCase();if(q&&!`${g.title} ${g.description||''}`.toLowerCase().includes(q))return false;
    if(owner)return true;const c=claimMap[g.id];
    if(filter==='available')return !c;
    if(filter==='mine')return c?.buyer_email===myEmail;
    if(filter==='purchased')return c?.status==='purchased';
    return true;
  });
  const loading=<div className="setup"><LoaderCircle className="spin" size={34}/> Chargement de Noël…</div>;
  if(!loaded)return loading;
  if(!profileId)return <div className="login-page"><div className="login-card avatar-login">
    <span className="eyebrow">✦ LE CLUB SECRET DU PÈRE NOËL ✦</span><div className="big-tree">🎄</div>
    <h1>La liste de Noël<br/><em>de Théo</em></h1><p>Qui vient préparer les surprises ?</p>
    <div className="profile-picker">{PROFILES.map(p=><button type="button" className="profile-choice" key={p.id} onClick={()=>login(p.id)} disabled={busy}>
      <Avatar person={p} size="picker"/><strong>{p.name}</strong>{p.locked?<small>🔒 Code requis</small>:<small>Entrer dans la liste</small>}
    </button>)}</div>
    <small>Le profil sélectionné reste enregistré sur cet appareil.</small>
    {chosen==='theo'&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setChosen(null)}}><div className="modal pin-modal" role="dialog" aria-modal="true"><div className="modal-head"><h2>🔒 Espace Théo</h2><button type="button" className="icon-button" onClick={()=>setChosen(null)} aria-label="Fermer"><X size={20}/></button></div><form onSubmit={loginOwner}><label htmlFor="pin">Ton code personnel</label><input id="pin" autoFocus required type="password" inputMode="numeric" autoComplete="off" minLength={4} maxLength={8} value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,''))} placeholder="••••"/><button className="button button-primary wide" type="submit" disabled={busy}>{busy?'Vérification…':'Ouvrir ma liste'}</button></form></div></div>}
    {notice&&<div className="toast"><AlertCircle size={16}/>{notice}<button onClick={()=>setNotice('')} aria-label="Fermer"><X size={14}/></button></div>}
  </div></div>;
  return <div className="app-shell"><Confetti show={confetti}/><div className="snow snow1">✳</div><div className="snow snow2">✳</div>
    <header className="topbar"><div className="brand"><span className="brand-icon">✳</span>LE NOËL DE <b>THÉO</b></div><div className="userbar"><Avatar person={person}/><div className="usertext"><strong>{person?.name}</strong><span>{owner?'Créateur de la liste':'Lutin officiel'}</span></div><button className="icon-button" onClick={logout} title="Changer de profil" aria-label="Changer de profil"><LogOut size={19}/></button></div></header>
    <main className="main"><section className="hero"><div className="hero-deco">✶ ✧ ✦</div><span className="eyebrow">NOTRE PETIT COIN DE MAGIE</span><h1>La wishlist <em>de Noël</em> 🎁</h1><p>{owner?'Ajoute tes envies à tout moment. Les achats et réservations ne figurent pas dans ton espace.':'Réserve un cadeau pour toi, puis confirme son achat. Les autres lutins verront immédiatement son statut.'}</p><div className="divider-ornament">✧ ─────────── ✧</div><div className="family"><span>{owner?'Mon espace':'Le comité des lutins'}</span><div className="family-avatars">{(owner?PROFILES.filter(p=>p.id==='theo'):PROFILES.filter(p=>p.id!=='theo')).map(p=><div className="family-person" key={p.id}><Avatar person={p} size="large"/><small>{p.name}</small></div>)}</div></div></section>
    <section className="content">{magicEnabled(profileId)&&<Magic key={profileId} id={profileId} count={mine.filter(c=>c.status==='purchased').length} event={magicEvent?.profile===profileId?magicEvent:null}/>}<div className="section-head"><div><span className="eyebrow dark">LA HOTTE DU PÈRE NOËL</span><h2>{owner?'Mes envies':'Choisissez avec le cœur'} ✧</h2><p>{gifts.length} cadeau{gifts.length===1?'':'x'} dans la liste</p></div>
      {owner?<button className="button button-primary" onClick={()=>openAdd()}><Plus size={18}/> Ajouter un cadeau</button>:<div className="mini-stats"><button type="button" onClick={()=>setFilter('mine')}><b>{mine.length}</b><span>Mes choix</span></button><button type="button" onClick={()=>setSummary(true)}><b>{purchased.length}</b><span>Déjà achetés</span></button></div>}</div>
    <div className="toolbar"><input className="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher un cadeau…" aria-label="Rechercher un cadeau"/>{!owner&&<div className="tabs">{[['all','Tous'],['available','Disponibles'],['mine','Mes choix'],['purchased','Achetés']].map(([key,label])=><button key={key} className={filter===key?'active':''} onClick={()=>setFilter(key)}>{label}</button>)}</div>}<button className="refresh" title="Actualiser" onClick={()=>refresh()}><RefreshCcw size={16}/></button></div>
    {visibleGifts.length===0?<div className="empty"><Gift size={42}/><h3>{gifts.length?'Aucun cadeau trouvé':'La hotte est encore vide'}</h3><p>{owner?'Ajoute ton prochain cadeau !':'Regarde un autre filtre ou reviens plus tard.'}</p></div>:<div className="gift-grid">{visibleGifts.map(g=>{const c=claimMap[g.id],isMine=c?.buyer_email===myEmail,who=peopleMap[c?.buyer_email],bought=!owner&&c?.status==='purchased';return <article key={g.id} className={`gift-card ${bought?'purchased-card':''}`}><div className="gift-image">{g.image_url?<img src={g.image_url} alt={g.title} loading="lazy" onError={e=>{e.currentTarget.style.visibility='hidden'}}/>:<div className="image-placeholder">🎁</div>}<span className="priority">{g.priority==='coup_de_coeur'?'♥ Coup de cœur':g.priority==='idee'?'✧ Une idée':'✦ Très envie'}</span>{!owner&&c&&<span className={`claim-chip ${bought?'bought':''}`}>{bought?'✓ Acheté':'🔒 Réservé'}</span>}</div><div className="gift-body"><div className="gift-title-row"><h3>{g.title}</h3>{g.price_eur!==null&&g.price_eur!==undefined&&<span className="price">{Number(g.price_eur).toLocaleString('fr-FR',{style:'currency',currency:'EUR'})}</span>}</div>{g.description&&<p className="description">{g.description}</p>}{g.product_url&&<a className="product-link" href={g.product_url} target="_blank" rel="noreferrer">Voir le cadeau <ExternalLink size={14}/></a>}
    {!owner&&c&&<div className="claim-info"><Avatar person={who||{name:'Un lutin'}}/><div><strong>{isMine?'Ton cadeau':`${who?.display_name||'Un lutin'} s’en occupe`}</strong><span>{bought?'Cadeau acheté':'Réservation exclusive'}</span></div></div>}
    <div className="card-actions">{owner?<><button className="button button-light" onClick={()=>openAdd(g)}><Pencil size={16}/> Modifier</button><button className="button button-icon-danger" onClick={()=>removeGift(g)} disabled={pending===g.id} aria-label="Supprimer"><Trash2 size={16}/></button></>:!c?<button className="button button-primary wide" onClick={()=>act(g,'reserve')} disabled={pending===g.id}><Heart size={17}/> Réserver ce cadeau</button>:bought?<button className="button button-done wide" disabled><Check size={17}/> Acheté par {who?.display_name||'un lutin'}</button>:isMine?<><button className="button button-primary wide" onClick={()=>act(g,'buy')} disabled={pending===g.id}><ShoppingBag size={17}/> Je l’ai acheté</button><button className="button button-light" onClick={()=>act(g,'release')} disabled={pending===g.id} title="Annuler la réservation"><Undo2 size={16}/></button></>:<button className="button button-disabled wide" disabled><LockKeyhole size={16}/> Réservé par {who?.display_name||'un lutin'}</button>}</div></div></article>})}</div>}
    <div className="footer-note"><Sparkles size={17}/>{owner?'Tu peux compléter ta liste même après avoir envoyé le lien.':'La réservation est exclusive et les achats sont visibles par tous les lutins.'}</div></section></main><footer>Fait avec ♥ pour Noël · Édition 2026</footer>
    {modal&&owner&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setModal(false)}}><div className="modal" role="dialog" aria-modal="true"><div className="modal-head"><h2>{editing?'Modifier un cadeau':'Une nouvelle envie ✨'}</h2><button className="icon-button" onClick={()=>setModal(false)} aria-label="Fermer"><X size={20}/></button></div><form onSubmit={saveGift}><label>Nom du cadeau *</label><input required maxLength={140} value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Une montre Garmin"/><label>Une petite description</label><textarea rows={3} value={form.description||''} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Taille, couleur, détails…"/><label>Lien vers le produit</label><input type="url" value={form.product_url||''} onChange={e=>setForm({...form,product_url:e.target.value})} placeholder="https://…"/><label>URL d’une photo</label><input value={form.image_url||''} onChange={e=>setForm({...form,image_url:e.target.value})} placeholder="/gifts/photo.webp"/><div className="form-split"><div><label>Prix indicatif (€)</label><input type="number" min="0" step="0.01" value={form.price_eur??''} onChange={e=>setForm({...form,price_eur:e.target.value})}/></div><div><label>Priorité</label><select value={form.priority} onChange={e=>setForm({...form,priority:e.target.value})}>{priorityOptions.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select></div></div><button type="submit" className="button button-primary wide" disabled={busy}>{busy?'Enregistrement…':editing?'Sauvegarder':'Ajouter à la liste'}</button></form></div></div>}
    {summary&&!owner&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setSummary(false)}}><div className="modal summary-modal" role="dialog" aria-modal="true" aria-label="Cadeaux achetés"><div className="modal-head"><h2>🎁 Déjà sous le sapin !</h2><button className="icon-button" onClick={()=>setSummary(false)} aria-label="Fermer"><X size={20}/></button></div><p>Les achats déjà confirmés par les lutins.</p>{purchased.length===0?<p>Aucun achat confirmé pour le moment.</p>:purchased.map(c=>{const g=gifts.find(x=>x.id===c.gift_id),who=peopleMap[c.buyer_email];return <div className="summary-item" key={c.gift_id}>{g?.image_url?<img src={g.image_url} alt=""/>:<div className="summary-emoji">🎁</div>}<div><strong>{g?.title||'Cadeau'}</strong><small>Acheté par {who?.display_name||'un lutin'}</small></div><Check size={18}/></div>})}<button className="button button-primary wide" onClick={()=>setSummary(false)}>Voir toute la liste ✨</button></div></div>}
    {notice&&<div className="toast" role="status"><AlertCircle size={17}/>{notice}<button onClick={()=>setNotice('')} aria-label="Fermer"><X size={15}/></button></div>}
  </div>;
}
createRoot(document.getElementById('root')).render(<App/>);
