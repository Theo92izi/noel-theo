import React,{useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import './magic.css';
export const magicEnabled=id=>id==='laurine'||id==='maman';
export default function Magic({id,count,event}){
 const [scene,setScene]=useState(null),[sound,setSound]=useState(false);
 const last=useRef(null),canvas=useRef(null),audio=useRef(null);
 const level=Math.min(4,count);
 useEffect(()=>{if(event&&last.current!==event){last.current=event;setScene({level:event.level,nonce:Date.now()});setSound(false)}},[event]);
 useEffect(()=>{if(!scene)return;const close=e=>{if(e.key==='Escape')setScene(null)};window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close)},[scene]);
 useEffect(()=>{if(!scene||!canvas.current)return;
 const c=canvas.current,g=c.getContext('2d');if(!g)return;
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 let frame,w,h,particles=[],lastBurst=-1;const start=performance.now(),duration=scene.level===4?15:6;
 const rand=(a,b)=>a+Math.random()*(b-a);
 const snow=Array.from({length:100},()=>[Math.random(),Math.random(),rand(1,3),rand(.025,.075)]);
 function burst(x,y,n,heart=false){for(let i=0;i<n;i++){const a=rand(0,Math.PI*2),speed=rand(35,180);particles.push({x,y,vx:heart?16*Math.sin(a)**3*8:Math.cos(a)*speed,vy:heart?-(13*Math.cos(a)-5*Math.cos(2*a)-2*Math.cos(3*a)-Math.cos(4*a))*8:Math.sin(a)*speed,life:rand(1.2,2.7),age:0,color:['#ffd77b','#fff5d5','#ff7798','#86e6e1'][i%4]})}}
 let prev=start;
 function draw(now){const t=Math.min((now-start)/1000,duration),dt=Math.min(.04,(now-prev)/1000);prev=now;
 const d=Math.min(devicePixelRatio||1,2),nw=c.clientWidth,nh=c.clientHeight;if(!nw||!nh){frame=requestAnimationFrame(draw);return}if(w!==nw||h!==nh){w=nw;h=nh;c.width=w*d;c.height=h*d;g.setTransform(d,0,0,d,0,0)}
 g.clearRect(0,0,w,h);for(const [x,y,r,v] of snow){g.fillStyle='#ffffffaa';g.beginPath();g.arc(x*w,(y*h+t*v*h)%h,r,0,7);g.fill()}
 if(!reduced){const final=scene.level===4;const b=final?Math.floor((t-8.5)*2):Math.floor((t-1.3)*2);if(b>=0&&b!==lastBurst&&t<(final?12.4:3.5)){lastBurst=b;burst(rand(.16,.84)*w,rand(.15,.55)*h,final?105:45)}if(final&&t>=12.4&&lastBurst!==999){lastBurst=999;burst(w/2,h*.33,200,true)}
 for(const p of particles){p.age+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=30*dt;g.globalAlpha=Math.max(0,1-p.age/p.life);g.fillStyle=p.color;g.beginPath();g.arc(p.x,p.y,2.2,0,7);g.fill()}particles=particles.filter(p=>p.age<p.life);g.globalAlpha=1}
 if(t<duration)frame=requestAnimationFrame(draw);
 }frame=requestAnimationFrame(draw);return()=>cancelAnimationFrame(frame)
 },[scene]);
 useEffect(()=>{if(!scene||!sound)return;let ctx;try{ctx=new (window.AudioContext||window.webkitAudioContext)();audio.current=ctx;ctx.resume().catch(()=>{});const notes=[523.25,659.25,783.99,1046.5,880,783.99,659.25,1046.5];notes.forEach((f,i)=>{const o=ctx.createOscillator(),v=ctx.createGain(),t=ctx.currentTime+i*.38;o.type='sine';o.frequency.value=f;v.gain.setValueAtTime(0,t);v.gain.linearRampToValueAtTime(.07,t+.04);v.gain.exponentialRampToValueAtTime(.001,t+.7);o.connect(v);v.connect(ctx.destination);o.start(t);o.stop(t+.75)})}catch{}return()=>{ctx?.close().catch(()=>{});audio.current=null}},[scene,sound]);
 const open=n=>{setSound(false);setScene({level:n,nonce:Date.now()})};
 const name=id==='laurine'?'Laurine':'Christelle';
 return <><section className={'xm-card xm-level-'+level} aria-label="Ton village de Noël"><div className="xm-heading"><div><strong>Ton petit village de Noël</strong><small>Merci pour chaque attention, quelle qu’elle soit.</small></div>{count>0&&<span>{count} cadeau{count>1?'x':''} préparé{count>1?'s':''}</span>}</div><Village level={level}/><div className="xm-progress" aria-hidden="true"><div className="xm-track"><i style={{width:level*25+'%'}}/></div><span className="xm-cursor" style={{left:level*25+'%'}}>🛷<b>✦</b></span></div>{level>0&&<button type="button" className="xm-replay" onClick={()=>open(level)}>Revoir la magie ✨</button>}</section>{scene&&createPortal(<div className={'xm-overlay xm-play-'+scene.level} key={scene.nonce} role="dialog" aria-modal="true" aria-label="Surprise de Noël"><div className="xm-controls"><button type="button" autoFocus onClick={()=>setScene(null)}>Fermer ×</button><button type="button" onClick={()=>setSound(v=>!v)}>{sound?'Couper le son':'Activer le son'}</button></div><div className="xm-moon"/><div className="xm-aurora"/><div className="xm-land"><Village level={scene.level}/></div><div className="xm-comet"/><div className="xm-sleigh">🦌 🦌 🛷</div><div className="xm-present"><div className="xm-lid"/><div className="xm-box"/></div><canvas ref={canvas} className="xm-canvas" aria-hidden="true"/><div className="xm-finale"><div className="xm-heart">♥</div><h2>{scene.level===4?'Joyeux Noël, '+name+' !':['','Une jolie attention','Le village s’illumine','La magie de Noël'][scene.level]}</h2><p>{scene.level===4?(id==='laurine'?'Merci mon amour. Le plus beau cadeau de Noël, c’est toi.':'Merci Christelle, de rendre Noël encore plus magique.'):'Merci pour cette belle attention.'}</p><button type="button" onClick={()=>setScene(null)}>Retour au village</button></div></div>,document.body)}</>;
}
function Village({level}){return <div className={'xm-village xm-lit-'+level} aria-hidden="true"><div className="xm-hills"/>{[0,1,2,3,4,5].map(i=><div key={i} className={'xm-house '+(level>=Math.ceil((i+1)*4/6)?'xm-on':'')} style={{left:(4+i*16)+'%',bottom:(12+(i%2)*8)+'%', '--house':i%2?'#8b4b50':'#475c75'}}><i/><b/><span/></div>)}<div className="xm-tree"><i/><i/><i/><b>✦</b></div></div>}
