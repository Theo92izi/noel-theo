import { createHmac, createHash, timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const COOKIE = '__Host-noel_profile';
const MONTH = 30 * 24 * 60 * 60;
const EMAILS = {
  theo: 'theoarnal82@gmail.com',
  laurine: 'laurine.delage531@gmail.com',
  maman: 'mchristellemarty82@gmail.com',
  dino: 'lionel.delage531@orange.fr',
};
const AVATARS = {
  theo: '/favicon.png',
  laurine: '/avatars/laurine.png',
  maman: '/avatars/maman.png',
  dino: '/avatars/dino.png',
};
function fail(res, status, message) { return res.status(status).json({error: message}); }
function hash(input) { return createHmac('sha256', process.env.CHRISTMAS_SESSION_SECRET).update(input).digest('base64url'); }
function safeEqual(a,b) {
  const x = createHash('sha256').update(String(a)).digest();
  const y = createHash('sha256').update(String(b)).digest();
  return timingSafeEqual(x,y) && String(a).length === String(b).length;
}
function cookie(res, value, age) {
  res.setHeader('Set-Cookie', `${COOKIE}=${value}; Path=/; Max-Age=${age}; HttpOnly; Secure; SameSite=Lax`);
}
function readSession(req) {
  const raw = (req.headers.cookie || '').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
  if (!raw) return null;
  const parts = raw.split('.');
  if (parts.length !== 2 || !safeEqual(hash(parts[0]),parts[1])) return null;
  try {
    const value=JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8'));
    if (!EMAILS[value.profile] || value.exp <= Date.now()) return null;
    return value.profile;
  } catch { return null; }
}
function setSession(res, profile) {
  const payload=Buffer.from(JSON.stringify({profile,exp:Date.now()+MONTH*1000})).toString('base64url');
  cookie(res,`${payload}.${hash(payload)}`,MONTH);
}
function dbClient() {
  const url=process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !process.env.CHRISTMAS_SESSION_SECRET || !process.env.OWNER_PIN) throw new Error('Configuration serveur incomplète');
  return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
}
function cleanGift(v) {
  const title=String(v?.title||'').trim();
  const description=String(v?.description||'').trim();
  const url=String(v?.product_url||'').trim();
  const image=String(v?.image_url||'').trim();
  const priority=['coup_de_coeur','envie','idee'].includes(v?.priority)?v.priority:'envie';
  const price=v?.price_eur==='' || v?.price_eur===null || v?.price_eur===undefined ? null:Number(v.price_eur);
  if (!title || title.length>140 || description.length>2000 || (url && (!/^https?:\/\//i.test(url)||url.length>2000)) || (image && !/^(https?:\/\/|\/)/i.test(image)) || (image && image.length>2000) || (price!==null && (!Number.isFinite(price)||price<0))) throw new Error('Vérifie les champs du cadeau.');
  return {title,description,product_url:url||null,image_url:image||null,priority,price_eur:price};
}
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if (req.method==='OPTIONS') return res.status(204).end();
  const action=String(req.query.action||'');
  if (req.method!=='GET' && req.method!=='POST') return fail(res,405,'Méthode non autorisée');
  // Requests with a body originate from this site (prevents cross-site POST using cookies).
  if (req.method==='POST') {
    const origin=req.headers.origin;
    const host=req.headers['x-forwarded-host']||req.headers.host;
    if (!origin || !host || new URL(origin).host!==host) return fail(res,403,'Origine non autorisée');
  }

  // Autoriser le changement de profil sans dépendre de Supabase
  if (action === 'logout' && req.method === 'POST') {
    cookie(res, '', 0);
    return res.status(200).json({ ok: true });
  }

  let db;
  try {
    db = dbClient();
  } catch (e) {
    return fail(res, 503, e.message);
  }

  try {
    const profile = readSession(req);

    if (action==='profiles' && req.method==='GET') {
      return res.status(200).json({profiles:[
        {id:'theo',name:'Théo',avatar:AVATARS.theo,locked:true},
        {id:'laurine',name:'Laurine',avatar:AVATARS.laurine},
        {id:'maman',name:'Christelle',avatar:AVATARS.maman},
        {id:'dino',name:'Dino',avatar:AVATARS.dino},
      ]});
    }
    if (action==='session' && req.method==='GET') return res.json({profile});
    if (action==='logout' && req.method==='POST') {cookie(res,'',0); return res.json({ok:true});}
    if (action==='login' && req.method==='POST') {
      const id=String(req.body?.profile||'');
      if (!EMAILS[id]) return fail(res,400,'Profil inconnu');
      if (id==='theo') {
        const ip=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim();
        const fingerprint=createHash('sha256').update(ip + process.env.CHRISTMAS_SESSION_SECRET).digest('hex');
        // Supabase SQL migration provides an atomic 5-attempts/15-minutes limiter.
        const {data:allowed,error:rateErr}=await db.rpc('noel_allow_pin_attempt',{visitor:fingerprint});
        if (rateErr) {console.error('Rate limit:',rateErr.message);return fail(res,503,'Protection du code non configurée');}
        if (!allowed) return fail(res,429,'Trop de tentatives. Réessaie dans 15 minutes.');
        if (!safeEqual(req.body?.pin||'',process.env.OWNER_PIN)) return fail(res,401,'Code incorrect');
        await db.rpc('noel_clear_pin_attempts',{visitor:fingerprint});
      }
      setSession(res,id);
      return res.json({ok:true,profile:id});
    }
    if (!profile) return fail(res,401,'Choisis un avatar pour continuer');
    const email=EMAILS[profile], owner=profile==='theo';
    if (action==='data' && req.method==='GET') {
      const [giftResult,membersResult] = await Promise.all([
        db.from('gifts').select('*').order('created_at',{ascending:false}),
        db.from('family_members').select('email,display_name,avatar_url,role').order('display_name')
      ]);
      if (giftResult.error||membersResult.error) throw giftResult.error||membersResult.error;
      const members=(membersResult.data||[]).map(m=>({...m,display_name:m.email===EMAILS.maman?'Christelle':m.display_name,avatar_url:m.email===EMAILS.theo?AVATARS.theo:m.avatar_url}));
      if (owner) return res.json({gifts:giftResult.data,members,claims:[]});
      const claimsResult=await db.from('gift_claims').select('gift_id,buyer_email,status,reserved_at,purchased_at');
      if (claimsResult.error) throw claimsResult.error;
      return res.json({gifts:giftResult.data,members,claims:claimsResult.data||[]});
    }
    if (action==='gift' && req.method==='POST') {
      if (!owner) return fail(res,403,'Réservé à Théo');
      const kind=String(req.body?.kind||'');
      const id=String(req.body?.id||'');
      if (kind==='delete') {
        if (!/^[0-9a-f-]{36}$/i.test(id)) return fail(res,400,'Identifiant invalide');
        // Do not reveal reserved/purchased status to the owner, including through error wording.
        const {error}=await db.from('gifts').delete().eq('id',id);
        if (error) return fail(res,409,'Ce cadeau ne peut pas être supprimé actuellement.');
        return res.json({ok:true});
      }
      const payload=cleanGift(req.body?.gift);
      const result=kind==='add'?await db.from('gifts').insert(payload):kind==='edit'&&/^[0-9a-f-]{36}$/i.test(id)?await db.from('gifts').update(payload).eq('id',id):null;
      if (!result) return fail(res,400,'Action invalide');
      if (result.error) throw result.error;
      return res.json({ok:true});
    }
    if (action==='claim' && req.method==='POST') {
      if (owner) return fail(res,403,'Théo ne réserve pas ses cadeaux');
      const kind=String(req.body?.kind||''), id=String(req.body?.id||'');
      if (!/^[0-9a-f-]{36}$/i.test(id)) return fail(res,400,'Cadeau invalide');
      let result;
      if (kind==='reserve') {
        result=await db.from('gift_claims').insert({gift_id:id,buyer_email:email,status:'reserved'});
        if (result.error?.code==='23505') return fail(res,409,'Ce cadeau est déjà réservé.');
      } else if (kind==='release') {
        result=await db.from('gift_claims').delete().eq('gift_id',id).eq('buyer_email',email).eq('status','reserved').select('gift_id');
        if (!result.error && !result.data?.length) return fail(res,409,'Cette réservation ne peut plus être annulée.');
      } else if (kind==='buy') {
        result=await db.from('gift_claims').update({status:'purchased',purchased_at:new Date().toISOString()}).eq('gift_id',id).eq('buyer_email',email).eq('status','reserved').select('gift_id');
        if (!result.error && !result.data?.length) return fail(res,409,'Tu dois d’abord réserver ce cadeau.');
      } else return fail(res,400,'Action invalide');
      if (result.error) throw result.error;
      return res.json({ok:true});
    }
    return fail(res,404,'Page API introuvable');
  } catch(e) {
    console.error('Noel API error:',e);
    return fail(res,500,'Une erreur est survenue. Actualise et réessaie.');
  }
}
