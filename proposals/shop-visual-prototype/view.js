/* Прототип нового вигляду лавки: плоский мальований стиль із shop-visual-design/concept.png.
   Правила, рецепти й рівні — ті самі (engine.js, levels.json із shop-bench-v1); тут змінено лише відображення.
   Усі спрайти згенеровані OpenAI Images API (generate-assets.py), поле, рейка, HUD і потоки — малює код. */
const ShopScene = (() => {
  const width = 900, height = 1680;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const sprites = {}, rooms = ["UL", "UR", "LL", "LR"];
  const materials = { Chamomile:"chamomile", Water:"water", Oil:"oil", Wax:"wax", Lavender:"lavender", Aloe:"aloe", Honey:"honey", Salt:"salt", Infusion:"infusion", Cream:"cream", Powder:"powder", Gel:"gel", Lotion:"lotion", Scrub:"scrub" };
  const frameOf = { Cooling:"machine-cooling", Heating:"machine-heating", Mill:"machine-mill", Mixer:"machine-mixer", Emulsifier:"machine-emulsifier" };
  const roomOf = { Cooling:"room-cooling", Heating:"room-heating", Mill:"room-mill", Mixer:"room-mixer", Emulsifier:"room-emulsifier" };
  const defaultMachine = { UL:"Cooling", UR:"Heating", LL:"Mill", LR:"Mixer" };
  // Де в спрайті машини стоїть посудина (частки прямокутника машини, виміряно по пікселях кадрів):
  // x — центр під насадкою, b — лінія дна на верхній грані плити, w/h — найбільший розмір посудини.
  // У Mill плити немає: посудина стоїть на основі під жолобом справа.
  const chamberOf = {
    Cooling:{x:.62,b:.87,w:.66,h:.52}, Heating:{x:.664,b:.75,w:.6,h:.5}, Mill:{x:.745,b:.875,w:.42,h:.34},
    Mixer:{x:.665,b:.85,w:.64,h:.5}, Emulsifier:{x:.63,b:.825,w:.56,h:.56}
  };
  const rim = { Water:"#27b4f5", Oil:"#f5a410", Chamomile:"#fff3a6", Wax:"#f3dfb0", Lavender:"#b36bf0", Aloe:"#6fd23c", Honey:"#d9780a", Salt:"#dfe8f2" };
  const colors = { Infusion:"#f2c318", Cream:"#f4e6c6", Powder:"#a25bd8", Gel:"#7fd957", Lotion:"#f6d6e2", Scrub:"#c9a06f" };
  const box = (x,y,w,h) => ({x,y,w,h});
  const project = (x,y) => ({x,y,scale:1});
  const room = id => { const i=rooms.indexOf(id); return box(109+i%2*346,284+Math.floor(i/2)*338,336,328); };
  const onLeft = id => id==="UL"||id==="LL";
  const machine = id => { const r=room(id); return onLeft(id)?box(r.x+12,r.y+26,190,262):box(r.x+134,r.y+26,190,262); };
  // Сировина — у вільній зоні навпроти машини. Однакові ресурси підряд (дві лаванди, дві олійки) стоять поруч
  // в одному ряду, щоб не зливалися; поодинокі — зигзагом ліво/право. Ряди рівномірно розкладені на висоту кімнати.
  // Запас у зоні для стрілки-підказки: продукт іншої кімнати в рецепті отримує місце з боку джерела.
  const rowOf=id=>Math.floor(rooms.indexOf(id)/2);
  function hintPad(s,m){
    const pad={top:0,bottom:0};
    for(const k of m.need){const src=s.machines.find(o=>o!==m&&o.product===k);if(!src)continue;
      const d=rowOf(src.room)-rowOf(m.room);if(d<0)pad.top=36;else if(d>0)pad.bottom=36;}
    return pad;
  }
  function recipeSlots(kinds,id,pad={top:0,bottom:0}){
    const count=kinds.length;
    const rows=[];for(let i=0;i<count;i++){if(kinds[i]===kinds[i+1]){rows.push([i,i+1]);i++;}else rows.push([i]);}
    const zone=box(onLeft(id)?212:8,24+pad.top,116,290-pad.top-pad.bottom),cx0=zone.x+zone.w/2;
    // Ряди не налазять один на одного: розмір силуету не більший за висоту ряду.
    const size=Math.min(count<=3?72:count<=5?64:count<=6?60:54,Math.floor(zone.h/rows.length));
    const step=rows.length>1?Math.min((zone.h-size)/(rows.length-1),112):0,span=step*(rows.length-1),first=zone.y+zone.h/2-span/2;
    const off=Math.min(30,(zone.w-size)/2-3),pair=size*.56;
    const dx=[-5,6,-3,5,-6,4,-4,6],dy=[4,-5,6,-4,5,-6,3,-5],ang=[-6,5,4,-5,6,-4,5,-6];
    const flip=onLeft(id)?-1:1,out=[];
    rows.forEach((row,r)=>row.forEach((i,j)=>{
      // Пара — ліворуч і праворуч від центру зони з протилежним нахилом; поодинокий — зигзаг за номером ряду.
      const side=row.length===2?(j?1:-1):(r%2?1:-1)*(rows.length===1?0:1)*flip;
      let cx=row.length===2?cx0+side*pair:Math.max(zone.x+size/2,Math.min(zone.x+zone.w-size/2,cx0+side*off+dx[r%8]*flip));
      let top=first+r*step+(row.length===2?(j?-3:3):dy[r%8])-size/2;
      const hw=size*.42+4,hh=size/2+4,tilt=row.length===2?(j?5:-5):ang[r%8]*flip;
      // Силует (з обідком і нахилом) не заходить на контур кімнати: у заокруглених кутах зсуваємо всередину.
      for(let n=0;n<90&&!insideRoom(cx,top+size/2,hw,hh);n++){
        cx+=cx<ROOM_W/2?1:-1;
        if(n%3===2)top+=top+size/2<ROOM_H/2?1:-1;
      }
      out[i]={x:cx-size/2,y:top,size,angle:tilt};
    }));
    return out;
  }
  // Внутрішня межа кімнати: контур підкладки ≈ 6 px, кути заокруглені (радіус ≈ 70), плюс запас у 6 px.
  const ROOM_W=336,ROOM_H=328,ROOM_PAD=12,ROOM_R=58;
  function insideRoom(cx,cy,hw,hh){
    const x0=ROOM_PAD,y0=ROOM_PAD,x1=ROOM_W-ROOM_PAD,y1=ROOM_H-ROOM_PAD;
    return [[cx-hw,cy-hh],[cx+hw,cy-hh],[cx-hw,cy+hh],[cx+hw,cy+hh]].every(([px,py])=>{
      if(px<x0||px>x1||py<y0||py>y1)return false;
      const kx=px<x0+ROOM_R?x0+ROOM_R:px>x1-ROOM_R?x1-ROOM_R:px,ky=py<y0+ROOM_R?y0+ROOM_R:py>y1-ROOM_R?y1-ROOM_R:py;
      return Math.hypot(px-kx,py-ky)<=ROOM_R;
    });
  }
  const queue = (i,d) => box(151+i*164,1263+d*104,106,96);
  // Положення місць лавки на згенерованому зображенні (частки ширини) і лінія підлоги слота.
  const BENCH = {x:84,y:1056,w:592,fx:[.15,.38,.61,.84],floor:.56,seatW:96};
  const benchBox = () => { const img=sprites.bench; return box(BENCH.x,BENCH.y,BENCH.w,BENCH.w*img.height/img.width); };
  const foot = i => { const b=benchBox(); return {x:b.x+BENCH.fx[i]*b.w,y:b.y+BENCH.floor*b.h}; };
  const FUNNEL=box(704,1040,104,100), JAR=box(722,1136,66,62), RAIL_Y=1043;
  const fit = (b,img,stand=false) => {
    const k=Math.min(b.w/img.width,b.h/img.height), w=img.width*k,h=img.height*k;
    return box(b.x+(b.w-w)/2,stand?b.y+b.h-h:b.y+(b.h-h)/2,w,h);
  };
  const uprightBox = (b,img) => fit(b,img,true);
  function ring(pos) {
    let d=wrap(pos)*LEN;
    const parts=[HOR,ARC,VER,ARC,HOR,ARC,VER,ARC];
    let seg=0;
    while(seg<7 && d>parts[seg]) d-=parts[seg++];
    const f=d/parts[seg], l=64,t=239,r=836,b=999,rad=74;
    const arc=(x,y,a)=>({x:x+rad*Math.cos(a),y:y+rad*Math.sin(a)});
    switch(seg){
      case 0:return {x:l+rad+f*(r-l-2*rad),y:t};
      case 1:return arc(r-rad,t+rad,-Math.PI/2+f*Math.PI/2);
      case 2:return {x:r,y:t+rad+f*(b-t-2*rad)};
      case 3:return arc(r-rad,b-rad,f*Math.PI/2);
      case 4:return {x:r-rad-f*(r-l-2*rad),y:b};
      case 5:return arc(l+rad,b-rad,Math.PI/2+f*Math.PI/2);
      case 6:return {x:l,y:b-rad-f*(b-t-2*rad)};
      default:return arc(l+rad,t+rad,Math.PI+f*Math.PI/2);
    }
  }
  const rr=(ctx,b,r)=>{ctx.beginPath();ctx.roundRect(b.x,b.y,b.w,b.h,r);};
  function image(ctx,name,b,alpha=1){ctx.save();ctx.globalAlpha=alpha;ctx.drawImage(sprites[name],b.x,b.y,b.w,b.h);ctx.restore();return b;}
  function stand(ctx,name,b,alpha=1,angle=0){
    const r=uprightBox(b,sprites[name]);ctx.save();ctx.translate(r.x+r.w/2,r.y+r.h);
    ctx.rotate(angle*Math.PI/180);ctx.globalAlpha=alpha;ctx.drawImage(sprites[name],-r.w/2,-r.h,r.w,r.h);ctx.restore();return r;
  }
  function strip(ctx,half,color){
    let prev;
    for(let i=0;i<=120;i++){
      const p=ring(i/120),q=ring(i/120+.0015),dx=q.x-p.x,dy=q.y-p.y,len=Math.hypot(dx,dy)||1;
      const a={x:p.x-dy/len*half,y:p.y+dx/len*half},b={x:p.x+dy/len*half,y:p.y-dx/len*half};
      if(prev){ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(prev.a.x,prev.a.y);ctx.lineTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.lineTo(prev.b.x,prev.b.y);ctx.closePath();ctx.fill();}
      prev={a,b};
    }
  }
  // Стрічка кільця за годинниковою стрілкою: темний контур, світлий борт, темне полотно й кремові стрілки.
  function track(ctx){
    strip(ctx,32,"#1d2838");strip(ctx,28,"#7e92b3");strip(ctx,21,"#3d4c68");
    const hatch=ring(HATCH);
    for(const [r,c] of [[19,"#1d2838"],[14,"#f2c318"],[9,"#1d2838"]]){ctx.fillStyle=c;ctx.beginPath();ctx.arc(hatch.x,hatch.y,r,0,Math.PI*2);ctx.fill();}
    const marks=[.045,.135,.235,.335,.435,.52,.62,.715,.82,.92];
    for(const t of marks){
      if(Math.abs(t-HATCH)<.03)continue;
      const p=ring(t),q=ring(t+.002),a=Math.atan2(q.y-p.y,q.x-p.x);
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(a);ctx.lineJoin="round";
      ctx.beginPath();ctx.moveTo(-13,-6);ctx.lineTo(2,-6);ctx.lineTo(2,-12);ctx.lineTo(15,0);ctx.lineTo(2,12);ctx.lineTo(2,6);ctx.lineTo(-13,6);ctx.closePath();
      ctx.fillStyle="#f3e3bd";ctx.strokeStyle="#1d2838";ctx.lineWidth=3;ctx.fill();ctx.stroke();ctx.restore();
    }
  }
  function drawBackground(ctx,background){
    const canvas=ctx.canvas,density=Math.min(window.devicePixelRatio||1,3);
    const pixels=Math.max(width,Math.ceil((canvas.clientWidth||width)*density));
    if(canvas.width!==pixels||canvas.height!==Math.round(pixels*height/width)){canvas.width=pixels;canvas.height=Math.round(pixels*height/width);}
    const scale=canvas.width/width;
    ctx.setTransform(scale,0,0,scale,0,0);
    ctx.imageSmoothingQuality="high";ctx.drawImage(background,0,0);
  }
  async function load(){
    const names=[...new Set([...Object.values(materials),...Object.values(frameOf),...Object.values(roomOf),"lane","bench","carriage","funnel","jar","clock","star"])];
    await Promise.all(names.map(name=>new Promise((resolve,reject)=>{
      const img=new Image();img.onload=()=>{sprites[name]=img;resolve();};img.onerror=()=>reject(new Error(`Не вдалося завантажити ${name}`));
      img.src=`assets/${name}.png`;
    })));
  }
  // Нерухома сцена: тло, стрічка, підкладки кімнат, лотки черг, лавка й рейка. Перебудовується при зміні машин.
  function scenery(machines){
    const canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;const ctx=canvas.getContext("2d");
    ctx.fillStyle="#90a67f";ctx.fillRect(0,0,width,height);
    const g=ctx.createRadialGradient(450,800,200,450,800,1100);g.addColorStop(0,"rgba(255,255,255,.10)");g.addColorStop(1,"rgba(40,60,40,.16)");ctx.fillStyle=g;ctx.fillRect(0,0,width,height);
    // Підкладка під кільцем: темніша рамка, у яку входять кімнати.
    ctx.fillStyle="#1d2838";rr(ctx,box(86,262,728,712),30);ctx.fill();
    track(ctx);
    for(const id of rooms){
      const kind=machines?.find(m=>m.room===id)?.id||defaultMachine[id],r=room(id);
      image(ctx,roomOf[kind],r);
    }
    for(let i=0;i<4;i++)image(ctx,"lane",box(139+i*164,1244,130,380));
    // Рейка каретки.
    ctx.lineCap="round";
    for(const [w,c] of [[16,"#1d2838"],[10,"#aeb9c4"],[4,"#e9eff3"]]){ctx.strokeStyle=c;ctx.lineWidth=w;ctx.beginPath();ctx.moveTo(150,RAIL_Y);ctx.lineTo(790,RAIL_Y);ctx.stroke();}
    for(const x of [150,790]){ctx.fillStyle="#1d2838";rr(ctx,box(x-18,RAIL_Y-22,36,44),8);ctx.fill();ctx.fillStyle="#f2c318";rr(ctx,box(x-13,RAIL_Y-17,26,34),6);ctx.fill();}
    image(ctx,"bench",benchBox());
    return canvas;
  }
  const hintCache=new Map();
  // Стрілка стоїть з того боку силуету, що дивиться на кімнату-джерело. Спільний recipe-hints.js (перенесений
  // у Unity) знає лише сторони right/left/bottom, тож бажану точку задаємо через side і gap:
  // вертикальний напрямок — side 'bottom' з gap, що виносить точку над/під силует; горизонтальний — right/left.
  function towardSource(s,m,kind,b){
    const src=s.machines.find(o=>o!==m&&o.product===kind);if(!src)return undefined;
    const from=rooms.indexOf(m.room),to=rooms.indexOf(src.room),dx=to%2-from%2,dy=rowOf(src.room)-rowOf(m.room);
    const reach=Math.max(b.w,b.h)/2+22;
    if(Math.abs(dy)>=Math.abs(dx))return {side:'bottom',gap:-b.h/2+(dy<0?-reach:reach)-10};   // y = b.y+b.h+gap+10 = центр ∓ reach
    return {side:dx<0?'left':undefined,gap:reach-b.w/2};
  }
  function recipeHintPlan(s){
    const frames=s.machines.map(m=>({room:m.room,product:m.product,box:machineRect(m)}));
    const items=[],bounds={};
    for(const m of s.machines){
      const r=room(m.room);
      bounds[m.room]=box(r.x+14,r.y+16,r.w-28,r.h-28);
      const layout=recipeSlots(m.slots.map(x=>x.kind),m.room,hintPad(s,m));
      m.slots.forEach((slot,i)=>{
        const at=layout[i],sprite=sprites[materials[slot.kind]];
        const b=uprightBox(box(r.x+at.x,r.y+at.y,at.size,at.size),sprite);
        items.push({room:m.room,index:i,kind:slot.kind,hintStyle:s.level.recipeHints?.[slot.kind]??towardSource(s,m,slot.kind,b),sprite,angle:at.angle,box:b});
      });
    }
    return ShopRecipeHints.plan(items,frames,bounds,(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;});
  }
  // План підказок (контур силуету й стрілка) кешується окремо: його читає і навчання рівня з ланцюжком.
  const planCache=new Map();
  const hintKey=s=>JSON.stringify([s.level.recipeHints,s.machines.map(m=>[m.id,m.room,m.product,m.need])]);
  function recipeHints(s){
    const key=hintKey(s);
    if(!planCache.has(key))planCache.set(key,recipeHintPlan(s));
    return planCache.get(key);
  }
  function recipeHintOverlay(s){
    const key=hintKey(s);
    if(!hintCache.has(key)){
      const hints=recipeHints(s);
      if(!hints.length){hintCache.set(key,null);return null;}
      const all=hints.flatMap(h=>[h.box,h.arrow]);
      const x=Math.floor(Math.min(...all.map(b=>b.x))-20),y=Math.floor(Math.min(...all.map(b=>b.y))-20);
      const bounds=box(x,y,Math.ceil(Math.max(...all.map(b=>b.x+b.w))-x+20),Math.ceil(Math.max(...all.map(b=>b.y+b.h))-y+20));
      const c=document.createElement('canvas');c.width=bounds.w*2;c.height=bounds.h*2;
      const ctx=c.getContext('2d');ctx.scale(2,2);ctx.translate(-x,-y);
      ShopRecipeHints.draw(ctx,hints,(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;});
      hintCache.set(key,{canvas:c,bounds});
    }
    return hintCache.get(key);
  }
  const machineRect = m => fit(machine(m.room),sprites[frameOf[m.id||defaultMachine[m.room]]],true);
  function chamberRect(m){
    const r=machineRect(m),c=chamberOf[m.id];
    return box(r.x+r.w*(c.x-c.w/2),r.y+r.h*(c.b-c.h),r.w*c.w,r.h*c.h);
  }
  function drawMachine(ctx,m){
    const r=machineRect(m);
    image(ctx,frameOf[m.id],r);
    // Посудина стоїть у машині постійно: скло чітке, речовина напівпрозора, під час варіння густішає.
    const vessel=fit(chamberRect(m),sprites[materials[m.product]],true);
    const density=m.out?1:.55+.45*(m.processing?Math.max(0,Math.min(1,m.progress)):0);
    image(ctx,materials[m.product],vessel,density);
    // Індикатор процесу під машиною.
    const bar=box(r.x+r.w*.1,r.y+r.h+4,r.w*.8,16);
    ctx.save();ctx.fillStyle="#1d2838";rr(ctx,bar,8);ctx.fill();
    const f=m.out?1:m.processing?m.progress:0;
    if(f>0){ctx.fillStyle=m.out?"#7fd957":"#b6e03a";rr(ctx,box(bar.x+3,bar.y+3,(bar.w-6)*f,bar.h-6),5);ctx.fill();}
    if(m.out){ctx.strokeStyle="#7fd957";ctx.lineWidth=5;ctx.lineJoin="round";ctx.beginPath();ctx.moveTo(bar.x+bar.w+10,bar.y+8);ctx.lineTo(bar.x+bar.w+18,bar.y+16);ctx.lineTo(bar.x+bar.w+32,bar.y-2);ctx.stroke();}
    ctx.restore();
    return vessel;
  }
  // Наповнення баночки: вміст росте знизу, зверху — горбик для густих та сипких продуктів.
  function jarContent(ctx,kind,jar,fill,time){
    if(fill<=0)return;
    const inner=box(jar.x+jar.w*.16,jar.y+jar.h*.2,jar.w*.68,jar.h*.56),h=inner.h*Math.min(1,fill),color=colors[kind];
    ctx.save();rr(ctx,inner,8);ctx.clip();
    ctx.fillStyle=color;
    const y=inner.y+inner.h-h;
    if(kind==="Infusion"||kind==="Lotion"){ctx.fillRect(inner.x,y,inner.w,h);ctx.fillStyle="rgba(255,255,255,.35)";ctx.fillRect(inner.x,y,inner.w,3);}
    else{
      ctx.fillRect(inner.x,y+6,inner.w,h);ctx.beginPath();ctx.ellipse(inner.x+inner.w/2,y+6,inner.w*.5,Math.min(12,h*.5+4),0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle="rgba(255,255,255,.28)";ctx.beginPath();ctx.ellipse(inner.x+inner.w*.4,y+3,inner.w*.2,3,0,0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
  }
  function stream(ctx,kind,from,to,time){
    const reduced=reducedMotion.matches,color=colors[kind];
    ctx.save();ctx.fillStyle=color;ctx.strokeStyle=color;ctx.lineCap="round";
    const len=to.y-from.y;
    if(kind==="Infusion"||kind==="Lotion"){
      ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(from.x,from.y);ctx.lineTo(from.x+(reduced?0:Math.sin(time*18)*1.2),to.y);ctx.stroke();
      ctx.strokeStyle="rgba(255,255,255,.5)";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(from.x-1.5,from.y);ctx.lineTo(from.x-1.5,to.y);ctx.stroke();
    }else if(kind==="Cream"||kind==="Gel"){
      const wob=reduced?0:Math.sin(time*5)*3;
      ctx.lineWidth=15+wob;ctx.beginPath();ctx.moveTo(from.x,from.y);ctx.lineTo(from.x,to.y-6);ctx.stroke();
      ctx.beginPath();ctx.arc(from.x,to.y-6,10+wob/2,0,Math.PI*2);ctx.fill();
    }else{
      const n=kind==="Powder"?16:6;
      for(let i=0;i<n;i++){
        const u=reduced?i/n:((time*(kind==="Powder"?1.6:1.1)+i/n)%1),x=from.x+Math.sin(i*7.1)*(kind==="Powder"?5:7),y=from.y+u*len;
        ctx.beginPath();ctx.arc(x,y,kind==="Powder"?2.6:4.5+(i%3),0,Math.PI*2);ctx.fill();
      }
    }
    ctx.restore();
  }
  function render(ctx,s,hit,command){
    const chambers=new Map(),arrivals=[];
    const heldKind=!s.filler.item&&s.lastFilled&&s.time-s.lastFilled.time<1.2?s.lastFilled.kind:null;
    for(const m of s.machines){
      const b=machine(m.room);void b;
      chambers.set(m.room,drawMachine(ctx,m));
    }
    for(const m of s.machines){
      const r=room(m.room);
      const layout=recipeSlots(m.slots.map(x=>x.kind),m.room,hintPad(s,m));
      m.slots.forEach((slot,i)=>{
        const at=layout[i],target=box(r.x+at.x,r.y+at.y,at.size,at.size);
        const progress=typeof ShopMachineMotion!=="undefined"&&!reducedMotion.matches?ShopMachineMotion.arrivalProgress(slot,s.time):1;
        const flying=progress<1,landed=slot.filled&&!flying;
        if(flying){
          const p=ring(slot.arrival.pos),sprite=sprites[materials[slot.kind]];
          const from=fit(box(p.x-23,p.y-23,46,46),sprite);
          const to=uprightBox(target,sprite);
          arrivals.push({name:materials[slot.kind],at:ShopMachineMotion.transferBox(from,to,progress,1),angle:at.angle*progress*progress*(3-2*progress)});
        }
        ctx.save();
        // Порожнє місце — графітовий силует, прийнятий складник — кольоровий.
        // Графітовий силует із тонким обідком кольору складника: вода й олійка не плутаються.
        if(!landed){const c=rim[slot.kind]||"#ffffff";ctx.filter=`grayscale(1) brightness(.4) contrast(1.1) drop-shadow(3px 0 0 ${c}) drop-shadow(-3px 0 0 ${c}) drop-shadow(0 3px 0 ${c}) drop-shadow(0 -3px 0 ${c})`;}
        stand(ctx,materials[slot.kind],target,landed?1:.9,at.angle);
        ctx.restore();
      });
    }
    // Станція фасування: баночка, лійка.
    const f=s.filler,jarBox=uprightBox(JAR,sprites.jar);
    const pouring=f.item&&f.transferRemaining<=0,fill=pouring?Math.max(0,Math.min(1,1-f.remaining/PACK)):1;
    image(ctx,"jar",jarBox);
    const funnel=uprightBox(FUNNEL,sprites.funnel);
    if(pouring||heldKind)jarContent(ctx,pouring?f.item.kind:heldKind,jarBox,fill,s.time);
    const hints=recipeHintOverlay(s);
    if(hints)ctx.drawImage(hints.canvas,hints.bounds.x,hints.bounds.y,hints.bounds.w,hints.bounds.h);
    for(const ball of s.belt){
      const p=ring(ball.pos),name=materials[ball.kind];
      let at=fit(box(p.x-25,p.y-25,50,50),sprites[name]);
      const departure=ball.departure,from=departure&&chambers.get(departure.room);
      if(from&&!reducedMotion.matches&&typeof ShopMachineMotion!=="undefined"){
        const duration=ShopMachineMotion.departureDuration(departure,s.ports,LOOP);
        at=ShopMachineMotion.transferBox(from,at,s.time-departure.time,duration);
      }
      image(ctx,name,at);
    }
    for(const flight of arrivals){
      const at=flight.at;
      ctx.save();ctx.translate(at.x+at.w/2,at.y+at.h);ctx.rotate(flight.angle*Math.PI/180);
      image(ctx,flight.name,box(-at.w/2,-at.h,at.w,at.h));ctx.restore();
    }
    s.queues.forEach((q,i)=>q.slice(0,3).forEach((ball,d)=>{
      const r=stand(ctx,materials[ball.kind],queue(i,d),d===0&&!s.canLaunch?.45:1);
      if(d===0){
        ctx.save();ctx.strokeStyle="#f2c318";ctx.lineWidth=5;ctx.globalAlpha=s.canLaunch?.95:.3;rr(ctx,box(r.x-8,r.y-8,r.w+16,r.h+16),18);ctx.stroke();ctx.restore();
        hit(`queue-${i}`,`Запустити: ${LABEL[ball.kind]}, черга ${i+1}`,r,()=>command("launch",i),!s.canLaunch);
      }
    }));
    s.bench.forEach((ball,i)=>{
      if(!ball||s.filler.item===ball)return;
      const p=foot(i),name=materials[ball.kind],sprite=sprites[name];
      const r=uprightBox(box(p.x-BENCH.seatW/2,p.y-100,BENCH.seatW,100),sprite);
      const progress=typeof ShopMachineMotion!=="undefined"&&!reducedMotion.matches?ShopMachineMotion.benchProgress(ball,s.time):1;
      let at=r;
      if(progress<1){
        const source=ring(ball.seating.pos ?? 0);
        const from=ball.seating.room ? chambers.get(ball.seating.room) : fit(box(source.x-23,source.y-23,46,46),sprite);
        at=ShopMachineMotion.transferBox(from,r,progress,1);
      }
      image(ctx,name,at,s.waiting[i]?.72:1);
      if(progress<1||s.autoPour)return;
      hit(`return-${i}`,`Повернути на кільце: ${LABEL[ball.kind]}, місце ${i+1}`,r,()=>command("return",i),s.waiting[i]||s.result!=="playing");
      // Дві значки під посудиною: повернення зліва (лише підказка, натискається сама посудина), розлив справа.
      const c={x:p.x+BENCH.seatW*.5-4,y:p.y+16},size=48,off=s.waiting[i]||s.result!=="playing";
      ctx.save();ctx.globalAlpha=off?.5:1;
      ctx.fillStyle="#1d2838";ctx.beginPath();ctx.arc(c.x,c.y,size/2+3,0,Math.PI*2);ctx.fill();
      ctx.fillStyle="#f2c318";ctx.beginPath();ctx.arc(c.x,c.y,size/2-1,0,Math.PI*2);ctx.fill();
      image(ctx,"funnel",fit(box(c.x-15,c.y-15,30,30),sprites.funnel));ctx.restore();
      hit(`pour-${i}`,`Розлити: ${LABEL[ball.kind]}, місце ${i+1}`,box(c.x-size/2,c.y-size/2,size,size),()=>command("pour",i),off);
    });
    const motion=f.item&&f.transferRemaining>0?carriageMotion(f):null;
    const cartPosition=reducedMotion.matches?(motion?(motion.picked?CART_FILL:f.from):CART_HOME):(s.carriage?.position??CART_HOME);
    const x0=foot(0).x,x3=foot(3).x;
    const cartX=cartPosition<=3?x0+(x3-x0)*cartPosition/3:x3+(754-x3)*(cartPosition-3)/(CART_FILL-3);
    const deck={x:cartX,y:RAIL_Y+30};
    let gripPoint={x:deck.x,y:deck.y+6},opening=1,payload=null,payloadName=null;
    if(motion){
      const name=materials[f.item.kind],sprite=sprites[name],p=foot(f.from);
      const from=uprightBox(box(p.x-BENCH.seatW/2,p.y-100,BENCH.seatW,100),sprite);
      const held=box(deck.x-from.w*.5,deck.y+46,from.w,from.h);
      const mouth=fit(box(funnel.x+funnel.w*.18,funnel.y-70,funnel.w*.64,70),sprite);
      mouth.y=funnel.y+funnel.h*.12-mouth.h;
      payload=reducedMotion.matches?(motion.picked?mouth:from):ShopMachineMotion.carriageProductBox(from,held,mouth,motion);
      payloadName=name;
      const retracted=deck.y+6,sourceGrip=from.y+from.h*.22;
      if(!motion.picked){gripPoint={x:deck.x,y:retracted+(sourceGrip-retracted)*motion.grip};opening=1-motion.grip;}
      else if(motion.release>0){gripPoint={x:held.x+held.w/2,y:held.y+held.h*.2};opening=motion.release;}
      else{gripPoint={x:payload.x+payload.w/2,y:payload.y+payload.h*.2};opening=0;}
    }
    // Телескопічна штанга тримає посудину; жорстко з'єднана з кареткою.
    ctx.save();ctx.lineCap="round";
    ctx.beginPath();ctx.moveTo(deck.x,deck.y);ctx.lineTo(gripPoint.x,gripPoint.y);
    ctx.strokeStyle="#1d2838";ctx.lineWidth=9;ctx.stroke();ctx.strokeStyle="#aeb9c4";ctx.lineWidth=4.5;ctx.stroke();ctx.restore();
    if(payload&&payload.w>0&&payload.h>0)image(ctx,payloadName,payload);
    image(ctx,"carriage",fit(box(cartX-34,RAIL_Y-30,68,84),sprites.carriage));
    ctx.save();ctx.lineWidth=4;ctx.strokeStyle="#f2c318";ctx.lineCap="round";
    const jaw=(payload?Math.min(payload.w*.3,16):8)+opening*6;
    for(const side of [-1,1]){ctx.beginPath();ctx.moveTo(gripPoint.x+side*jaw,gripPoint.y-8);ctx.lineTo(gripPoint.x+side*jaw,gripPoint.y+6);ctx.lineTo(gripPoint.x+side*(jaw-5),gripPoint.y+9);ctx.stroke();}
    ctx.restore();
    image(ctx,"funnel",funnel);
    if(pouring)stream(ctx,f.item.kind,{x:funnel.x+funnel.w*.5,y:funnel.y+funnel.h*.94},{x:jarBox.x+jarBox.w/2,y:jarBox.y+jarBox.h*(.76-.56*Math.min(1,fill))},s.time);
    hud(ctx,s);
  }
  const levelProducts = s => PRODUCTS.filter(k=>s.machines.some(m=>m.product===k));
  const mmss = t => { const n=Math.max(0,Math.ceil(t)); return `${String(Math.floor(n/60)).padStart(2,"0")}:${String(n%60).padStart(2,"0")}`; };
  // HUD за концептом: таймер, смуга зірок, вітрина з мінімумами.
  function hud(ctx,s){
    ctx.save();ctx.textBaseline="middle";
    // Таймер.
    ctx.fillStyle="#1d2838";rr(ctx,box(86,88,196,56),20);ctx.fill();
    ctx.fillStyle="#fff7e0";ctx.font="800 38px system-ui,sans-serif";ctx.textAlign="left";ctx.fillText(mmss(s.started?s.timeLeft:s.shift),132,117);
    image(ctx,"clock",fit(box(44,78,78,78),sprites.clock));
    // Смуга зірок: пороги 1-ї зірки (мінімум), 2-ї та 3-ї (цінність вітрини).
    const bonus=s.level.bonus||[],quotaValue=Object.entries(s.quota).reduce((n,[k,v])=>n+v*(s.values[k]||0),0);
    // Три рівні відстані: зірки стоять рівномірно, а наповнення смуги йде від порога до порогу.
    const stops=[quotaValue,bonus[0],bonus[1]].filter(t=>t!==undefined),bar=box(329,112,264,26);
    let stage=0;for(let k=0;k<stops.length;k++){
      const lo=k?stops[k-1]:0,span=Math.max(1,stops[k]-lo);
      stage+=Math.max(0,Math.min(1,(s.value-lo)/span));
    }
    const progress=Math.min(1,stage/Math.max(1,stops.length));
    ctx.fillStyle="#1d2838";rr(ctx,box(bar.x-4,bar.y-4,bar.w+8,bar.h+8),16);ctx.fill();
    ctx.fillStyle="#3d4c68";rr(ctx,bar,12);ctx.fill();
    ctx.fillStyle="#7fd957";rr(ctx,box(bar.x,bar.y,Math.max(10,bar.w*progress),bar.h),12);ctx.fill();
    stops.forEach((t,k)=>{
      // Зірка по центру свого відрізка: середня — точно над серединою смуги.
      const x=bar.x+bar.w*(k+.5)/stops.length,on=k<s.stars;
      if(k<stops.length-1){ctx.fillStyle="#1d2838";ctx.fillRect(bar.x+bar.w*(k+1)/stops.length-2,bar.y-2,4,bar.h+4);}
      image(ctx,"star",fit(box(x-18,bar.y-40,36,36),sprites.star),on?1:.35);
    });
    // Вітрина: баночки продуктів рівня з прогресом мінімуму.
    const kinds=levelProducts(s),counts=Object.fromEntries(kinds.map(k=>[k,0]));
    for(const b of s.vitrine)counts[b.kind]=(counts[b.kind]||0)+1;
    ctx.fillStyle="#8a5a2e";rr(ctx,box(640,84,218,72),14);ctx.fill();ctx.fillStyle="#b9824a";rr(ctx,box(644,88,210,64),11);ctx.fill();
    const slot=Math.min(70,200/kinds.length);
    kinds.forEach((kind,k)=>{
      const x=649+k*slot+(200-slot*kinds.length)/2,n=counts[kind],need=s.quota[kind]||0,done=need&&n>=need,name=materials[kind];
      image(ctx,name,fit(box(x+slot/2-19,90,38,40),sprites[name],true),n||need?1:.4);
      ctx.fillStyle=done?"#d9f0c4":"#fff4dc";ctx.strokeStyle="#1d2838";ctx.lineWidth=2.5;rr(ctx,box(x+2,130,slot-4,20),8);ctx.fill();ctx.stroke();
      ctx.fillStyle=done?"#2f7a2a":"#3a2a1c";ctx.font="800 14px system-ui,sans-serif";ctx.textAlign="center";
      ctx.fillText(need?`${n}/${need}`:`×${n}`,x+slot/2,141);
    });
    ctx.fillStyle="#fff7e0";ctx.font="700 20px system-ui,sans-serif";ctx.textAlign="left";
    ctx.restore();
  }
  return {width,height,load,scenery,drawBackground,render,levelProducts,project,ring,recipeHints};
})();
