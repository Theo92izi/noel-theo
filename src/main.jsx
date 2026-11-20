import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import { Gift, Plus, LogOut, Heart, LockKeyhole, Check, ShoppingBag, Undo2, ExternalLink, Pencil, Trash2, Sparkles, X, Mail, LoaderCircle, AlertCircle, RefreshCcw, Snowflake } from 'lucide-react';
import './styles.css';

const URL = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const ready = !!(URL && KEY && !URL.includes('VOTRE-'));
const db = ready ? createClient(URL, KEY) : null;
const priorities = [{ value: 'coup_de_coeur', label: 'Coup de cœur' }, { value: 'envie', label: 'Très envie' }, { value: 'idee', label: 'Une idée' }];
const emptyGift = { title:'',description:'',product_url:'',image_url:'',price_eur:'',priority:'envie' };
const getError = (e) => e?.message || 'Une erreur est survenue.';
const norm = (x) => (x || '').toLowerCase();
function Avatar({ member, size='normal' }) {
  const [broken,setBroken] = useState(false);
  useEffect(()=>setBroken(false),[member?.avatar_url]);
  return <div className={`avatar avatar-${size}`} title={member?.display_name || ''}>{member?.avatar_url && !broken ? <img src={member.avatar_url} onError={()=>setBroken(true)} alt={member.display_name || 'Avatar'}/> : <span>{(member?.display_name || '?').slice(0,1).toUpperCase()}</span>}</div>;
}
function App() {
  const [session,setSession] = useState(null), [loaded,setLoaded] = useState(false);
  const [email,setEmail] = useState(''), [sent,setSent] = useState(false), [busy,setBusy] = useState(false);
  const [profile,setProfile] = useState(null), [members,setMembers] = useState([]);
  const [gifts,setGifts] = useState([]), [claims,setClaims] = useState([]);
  const [notice,setNotice] = useState(''), [modal,setModal] = useState(false), [editing,setEditing] = useState(null);
  const [form,setForm] = useState(emptyGift), [search,setSearch] = useState('');
  const [filter,setFilter] = useState('all'), [pending,setPending] = useState('');
  const owner = profile?.role === 'owner';
  const myEmail = norm(session?.user?.email);
  const claimMap = useMemo(()=>Object.fromEntries(claims.map(c=>[c.gift_id,c])),[claims]);
  const peopleMap = useMemo(()=>Object.fromEntries(members.map(m=>[m.email,m])),[members]);
  const toast = (msg)=>setNotice(msg);

  useEffect(()=>{
    if (!db) {setLoaded(true);return;}
    db.auth.getSession().then(({data})=>{setSession(data.session);setLoaded(true);});
    const {data:{subscription}}=db.auth.onAuthStateChange((_event,newSession)=>{setSession(newSession);});
    return ()=>subscription.unsubscribe();
  },[]);
  useEffect(()=>{
    if(!notice)return;
    const id=setTimeout(()=>setNotice(''),5500); return ()=>clearTimeout(id);
  },[notice]);

  async function refresh(emailArg=myEmail, quiet=false){
    if(!emailArg||!db)return;
    const {data:roleData,error:roleError}=await db.rpc('my_christmas_role');
    if(roleError){if(!quiet)toast(getError(roleError));return;}
    if(!roleData){setProfile(null);setGifts([]);setClaims([]);return;}
    const [{data:me},{data:people},{data:items,error:giftErr}] = await Promise.all([
      db.from('family_members').select('*').eq('email',emailArg).maybeSingle(),
      db.from('family_members').select('*').order('display_name'),
      db.from('gifts').select('*').order('created_at',{ascending:false})
    ]);
    if(giftErr){if(!quiet)toast(getError(giftErr));return;}
    setProfile(me || {email:emailArg, role:roleData, display_name:emailArg.split('@')[0]});
    setMembers(people||[]);setGifts(items||[]);
    if(roleData==='participant'){
      const {data, error}=await db.from('gift_claims').select('*');
      if(error && !quiet)toast(getError(error));
      if(!error)setClaims(data||[]);
    } else setClaims([]);
  }
  useEffect(()=>{
    if(!session?.user?.email){setProfile(null);setGifts([]);setClaims([]);return;}
    refresh(norm(session.user.email));
    const id=setInterval(()=>refresh(norm(session.user.email),true),5000);
    const onFocus=()=>refresh(norm(session.user.email),true);
    window.addEventListener('focus',onFocus);
    return ()=>{clearInterval(id);window.removeEventListener('focus',onFocus);};
  },[session?.user?.email]);

  async function sendLogin(e){
    e.preventDefault();setBusy(true);
    const {error}=await db.auth.signInWithOtp({email:email.trim().toLowerCase(),options:{emailRedirectTo:window.location.origin}});
    setBusy(false); if(error)toast(getError(error));else setSent(true);
  }
  async function logout(){await db.auth.signOut();setSent(false);setEmail('');}
  function openAdd(item=null){setEditing(item?.id||null);setForm(item ? {...item,price_eur:item.price_eur??''} : emptyGift);setModal(true);}
  async function saveGift(e){
    e.preventDefault();if(!owner)return;
    setBusy(true);
    const payload={title:form.title.trim(),description:form.description.trim(),product_url:form.product_url.trim()||null,image_url:form.image_url.trim()||null,price_eur:form.price_eur===''?null:Number(form.price_eur),priority:form.priority};
    const {error}=editing?await db.from('gifts').update(payload).eq('id',editing):await db.from('gifts').insert(payload);
    setBusy(false);
    if(error)toast(getError(error));else{setModal(false);toast(editing?'Cadeau modifié !':'Cadeau ajouté à ta liste !');await refresh();}
  }
  async function removeGift(g){
    if(!owner||!window.confirm(`Supprimer « ${g.title} » ?`))return;
    setPending(g.id);const {error}=await db.from('gifts').delete().eq('id',g.id);setPending('');
    if(error)toast(getError(error));else{toast('Cadeau supprimé.');await refresh();}
  }
  async function act(g,kind){
    if(owner)return;
    setPending(g.id);
    let result;
    const existing=claimMap[g.id];
    if(kind==='reserve'&&!existing) result=await db.from('gift_claims').insert({gift_id:g.id,buyer_email:myEmail,status:'reserved'});
    else if(kind==='buy'&&existing?.buyer_email===myEmail&&existing.status==='reserved') result=await db.from('gift_claims').update({status:'purchased',purchased_at:new Date().toISOString()}).eq('gift_id',g.id).eq('buyer_email',myEmail).eq('status','reserved');
    else if(kind==='release'&&existing?.buyer_email===myEmail) result=await db.from('gift_claims').delete().eq('gift_id',g.id).eq('buyer_email',myEmail);
    setPending('');
    if(result?.error)toast(kind==='reserve'?'Impossible de réserver : quelqu’un a peut-être été plus rapide. Actualisation…':getError(result.error));
    else toast(kind==='reserve'?'Cadeau réservé pour toi !':kind==='buy'?'Achat confirmé !':'Cadeau libéré !');
    await refresh();
  }
  const visibleGifts = gifts.filter(g=>{
    const q=search.toLowerCase().trim();
    if(q&&!`${g.title} ${g.description}`.toLowerCase().includes(q))return false;
    if(owner)return true;
    const c=claimMap[g.id];
    if(filter==='available')return !c;
    if(filter==='mine')return c?.buyer_email===myEmail;
    if(filter==='purchased')return c?.status==='purchased';
    return true;
  });
  const mine=claims.filter(c=>c.buyer_email===myEmail);
  const purchased=claims.filter(c=>c.status==='purchased');

  if(!ready)return <div className="setup"><Gift size={48}/><h1>Le Noël de Théo</h1><p>Le projet est prêt. Il reste à relier Supabase.</p><p>Ajoute <code>VITE_SUPABASE_URL</code> et <code>VITE_SUPABASE_ANON_KEY</code> dans les variables d’environnement puis suis le README.</p></div>;
  if(!loaded)return <div className="setup"><LoaderCircle className="spin" size={32}/>Connexion…</div>;
  if(!session)return <div className="login-page"><div className="login-card"><span className="eyebrow">✦ Le club secret du Père Noël ✦</span><div className="big-tree">🎄</div><h1>La liste de Noël<br/><em>de Théo</em></h1><p>Une petite liste rien que pour les proches. Choisis un cadeau et garde la surprise jusqu’au 25 décembre !</p>{!sent?<form onSubmit={sendLogin}><label htmlFor="email">Ton adresse e-mail personnelle</label><div className="input-icon"><Mail size={18}/><input id="email" type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="ton@email.fr"/></div><button className="button button-primary wide" disabled={busy}>{busy?'Envoi…':'Recevoir mon lien privé →'}</button></form>:<div className="sent"><Check size={24}/><strong>Vérifie ta boîte mail !</strong><p>Un lien de connexion vient d’être envoyé à {email}. Ouvre-le sur cet appareil.</p><button className="text-button" onClick={()=>setSent(false)}>Changer d’adresse</button></div>}<small>Aucun mot de passe à retenir. Accès réservé à la famille.</small></div></div>;
  if(!profile)return <div className="setup"><LockKeyhole size={36}/><h2>Accès non autorisé</h2><p>Cette adresse n’est pas dans la liste privée, ou son e-mail n’est pas encore vérifié.</p><p>Si ton adresse doit être autorisée, vérifie la table <code>family_members</code> dans Supabase.</p><button className="button" onClick={logout}>Changer de compte</button></div>;

  return <div className="app-shell"><div className="snow snow1">✳</div><div className="snow snow2">✳</div><header className="topbar"><div className="brand"><span className="brand-icon">✳</span><span>LE NOËL DE <b>THÉO</b></span></div><div className="userbar"><Avatar member={profile}/><div className="usertext"><strong>{profile.display_name}</strong><span>{owner?'Créateur de la liste':'Lutin officiel'}</span></div><button className="icon-button" title="Déconnexion" onClick={logout}><LogOut size={19}/></button></div></header>
  <main className="main"><section className="hero"><div className="hero-deco">✶ ✧ ✦</div><span className="eyebrow">NOTRE PETIT COIN DE MAGIE</span><h1>La wishlist <em>de Noël</em> <span>🎁</span></h1><p>{owner?'Ajoute toutes tes envies. Les réservations et achats des autres te restent cachés pour préserver la surprise.':'Bienvenue dans la mission cadeaux ! Choisis tes favoris, réserve-les pour toi et indique quand ils sont achetés.'}</p><div className="divider-ornament">✧ ─────────── ✧</div>
  <div className="family"><span>{owner?'Ma liste privée':'Le comité des lutins'}</span><div className="family-avatars">{(owner?members.filter(m=>m.role==='owner'):members.filter(m=>m.role==='participant')).map(m=><div className="family-person" key={m.email}><Avatar member={m} size="large"/><small>{m.display_name}</small></div>)}</div></div></section>
  <section className="content"><div className="section-head"><div><span className="eyebrow dark">LA HOTTE DU PÈRE NOËL</span><h2>{owner?'Mes envies':'Choisissez avec le cœur'} <span>✧</span></h2><p>{gifts.length} idée{gifts.length!==1?'s':''} de cadeaux {owner?'à partager':'à découvrir'}</p></div>{owner?<button className="button button-primary" onClick={()=>openAdd()}><Plus size={18}/> Ajouter un cadeau</button>:<div className="mini-stats"><div><b>{mine.length}</b><span>Mes choix</span></div><div><b>{purchased.length}</b><span>Déjà achetés</span></div></div>}</div>
  <div className="toolbar"><input className="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Rechercher un cadeau…" aria-label="Rechercher un cadeau"/>{!owner&&<div className="tabs">{[['all','Tous'],['available','Disponibles'],['mine','Mes choix'],['purchased','Achetés']].map(([id,label])=><button key={id} className={filter===id?'active':''} onClick={()=>setFilter(id)}>{label}</button>)}</div>}<button className="refresh" onClick={()=>refresh()} title="Actualiser"><RefreshCcw size={16}/></button></div>
  {gifts.length===0?<div className="empty"><Gift size={42}/><h3>La hotte est encore vide</h3><p>{owner?'Ajoute le premier cadeau pour démarrer la liste !':'Théo n’a pas encore ajouté de cadeau.'}</p>{owner&&<button className="button button-primary" onClick={()=>openAdd()}>Ajouter mon premier cadeau</button>}</div>:visibleGifts.length===0?<div className="empty"><Snowflake size={38}/><h3>Aucun cadeau trouvé</h3><p>Essaie une autre recherche ou un autre filtre.</p></div>:<div className="gift-grid">{visibleGifts.map(g=>{const c=claimMap[g.id],mineClaim=c?.buyer_email===myEmail,person=peopleMap[c?.buyer_email];return <article className={`gift-card ${!owner&&c?'claimed':''}`} key={g.id}><div className="gift-image">{g.image_url?<img src={g.image_url} alt={g.title} loading="lazy" onError={e=>{e.currentTarget.style.display='none';}}/>:<div className="image-placeholder">🎁</div>}<span className="priority">{g.priority==='coup_de_coeur'?'♥ Coup de cœur':g.priority==='idee'?'✧ Une idée':'✦ Très envie'}</span>{!owner&&c&&<div className={`claim-chip ${c.status==='purchased'?'bought':''}`}>{c.status==='purchased'?<Check size={13}/>:<LockKeyhole size={13}/>} {c.status==='purchased'?'Acheté':'Réservé'}</div>}</div><div className="gift-body"><div className="gift-title-row"><h3>{g.title}</h3>{g.price_eur!=null&&<span className="price">{Number(g.price_eur).toLocaleString('fr-FR',{style:'currency',currency:'EUR',maximumFractionDigits:2})}</span>}</div>{g.description&&<p className="description">{g.description}</p>}{g.product_url&&<a className="product-link" href={g.product_url} target="_blank" rel="noreferrer">Voir ce cadeau <ExternalLink size={14}/></a>}
  {!owner&&c&&<div className="claim-info"><Avatar member={person||{display_name:c.buyer_email}}/><div><strong>{mineClaim?'C’est ton choix !':`${person?.display_name||'Un lutin'} s’en occupe`}</strong><span>{c.status==='purchased'?'Cadeau déjà acheté':'Cadeau réservé exclusivement'}</span></div></div>}
  <div className="card-actions">{owner?<><button className="button button-light" onClick={()=>openAdd(g)}><Pencil size={16}/> Modifier</button><button className="button button-icon-danger" disabled={pending===g.id} title="Supprimer" onClick={()=>removeGift(g)}><Trash2 size={16}/></button></>:!c?<button className="button button-primary wide" disabled={pending===g.id} onClick={()=>act(g,'reserve')}><Heart size={17}/> Réserver ce cadeau</button>:mineClaim?<><button className={`button wide ${c.status==='purchased'?'button-done':'button-primary'}`} disabled={pending===g.id||c.status==='purchased'} onClick={()=>act(g,'buy')}>{c.status==='purchased'?<><Check size={17}/> Achat confirmé</>:<><ShoppingBag size={17}/> Je l’ai acheté</>}</button><button className="button button-light" disabled={pending===g.id} onClick={()=>act(g,'release')} title="Libérer ce cadeau"><Undo2 size={16}/></button></>:<button className="button button-disabled wide" disabled><LockKeyhole size={16}/> Indisponible</button>}</div></div></article>;})}</div>}
  <div className="footer-note"><Sparkles size={17}/>{owner?'La magie reste intacte : les informations de réservation ne sont pas accessibles à ton compte.':'Une réservation bloque immédiatement le cadeau pour tout le monde. Tu peux la libérer à tout moment.'}</div></section></main><footer>Fait avec ♥ pour Noël · Édition 2026</footer>
  {notice&&<div className="toast" role="status"><AlertCircle size={17}/>{notice}<button onClick={()=>setNotice('')} aria-label="Fermer"><X size={15}/></button></div>}
  {modal&&owner&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setModal(false)}}><div className="modal" role="dialog" aria-modal="true" aria-label="Cadeau"><div className="modal-head"><h2>{editing?'Modifier le cadeau':'Une nouvelle envie ✨'}</h2><button className="icon-button" onClick={()=>setModal(false)}><X size={20}/></button></div><form onSubmit={saveGift}><label>Nom du cadeau *</label><input required maxLength={140} value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Ex. Une montre Garmin"/><label>Une petite description</label><textarea rows={3} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Taille, couleur, modèle, détails…"/><label>Lien vers le produit</label><input type="url" value={form.product_url||''} onChange={e=>setForm({...form,product_url:e.target.value})} placeholder="https://…"/><label>URL d’une photo</label><input type="url" value={form.image_url||''} onChange={e=>setForm({...form,image_url:e.target.value})} placeholder="https://…/photo.jpg"/><div className="form-split"><div><label>Prix indicatif (€)</label><input type="number" min="0" step="0.01" value={form.price_eur??''} onChange={e=>setForm({...form,price_eur:e.target.value})} placeholder="45"/></div><div><label>Envie</label><select value={form.priority} onChange={e=>setForm({...form,priority:e.target.value})}>{priorities.map(p=><option key={p.value} value={p.value}>{p.label}</option>)}</select></div></div><button className="button button-primary wide" disabled={busy}>{busy?'Enregistrement…':editing?'Enregistrer les modifications':'Ajouter à ma liste'}</button></form></div></div>}
  </div>;
}

createRoot(document.getElementById('root')).render(<App/>);
