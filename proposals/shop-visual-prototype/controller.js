(async()=>{
  if(document.getElementById("board")?.dataset.mode==="recipes")return;
  const $=id=>document.getElementById(id);
  const cv=$("cv"),ctx=cv.getContext("2d"),controls=$("controls");
  const buttons=new Map(),overlay=$("overlay"),levelButtons=[];
  const demoMode=new URLSearchParams(location.search).get("demo")==="all";
  let autoplay=demoMode;
  let game,last=performance.now(),active=new Set(),screen="",focusBeforeDialog=null;
  try {
    const [levels]=await Promise.all([fetch("../shop-bench-v1/levels.json",{cache:"no-store"}).then(r=>{if(!r.ok)throw new Error("Не вдалося завантажити рівні");return r.json();}),ShopScene.load()]);
    let storage;try{storage=window.localStorage;}catch{/* In-memory progress remains playable. */}
    game=new ShopCampaign(levels,demoMode?null:storage);
    if(demoMode){
      game.completed=levels.length-1;game.load(levels.length-1);
      $("demo-tools").hidden=false;
      $("demo-control").onclick=()=>{autoplay=!autoplay;overlay.dataset.state="";draw();};
    }
    // Rooms follow the level's machines, so the cached scenery is rebuilt when they change.
    let background=null,sceneryKey="";
    function sceneryFor(s){
      const key=s.machines.map(m=>m.id+m.room).join();
      if(key!==sceneryKey){sceneryKey=key;background=ShopScene.scenery(s.machines);}
      return background;
    }
    function select(i){if(game.load(i)){screen="";last=performance.now();draw();}}
    function start(){game.start();screen="";last=performance.now();draw();}
    function restart(){game.restart();screen="";last=performance.now();draw();}
    function pause(){game.pause();screen="";draw();}
    function showMap(){game.pause();screen="map";draw();}
    // Tutorial hand and caption: first pass of levels 1–3 only.
    const coach=new ShopOnboarding.Coach(),rects=new Map();let coachSession=null;
    // Навчання процесу — на першому рівні, де рецепт однієї машини містить продукт іншої (рівень 3: настій у крем).
    const CHAIN_LEVEL=levels.findIndex(lv=>lv.machines.some(([,,need])=>need.some(k=>lv.machines.some(o=>o[3]===k))));
    const CORNER={UL:"лівий верхній",UR:"правий верхній",LL:"лівий нижній",LR:"правий нижній"};
    // Ланцюжок у сесії: машина-споживач, машина-виробник і продукт між ними.
    function chainOf(s){
      for(const c of s.machines)for(const k of c.need){const p=s.machines.find(o=>o!==c&&o.product===k);if(p)return {consumer:c,producer:p,kind:k};}
      return null;
    }
    let tourDone=false;
    // Візуальне навчання рівнів 1–5 (tutorial.js): маршрут ресурсу, рецепт, варіння, вітрина, повне кільце, новий ланцюжок.
    const tutor=new ShopTutorial.Director(levels,CHAIN_LEVEL);
    function command(action,index){
      if(game.phase==="playing"&&!demoMode){
        coach.act(action);
        const ball=game.session.bench[index],chain=chainOf(game.session);
        if((action==="return"||action==="pour")&&chain&&ball?.kind===chain.kind)tourDone=true;
        if(action==="return"||action==="pour")tutor.act(action,ball);
      }
      game.command(action,index);
    }
    function revive(){if(game.revive()){screen="";last=performance.now();draw();}}
    // Caption on a rounded plate, wrapped to the plate width; placed above or below the target.
    function drawCaption(text,r,fixedY){
      ctx.save();ctx.font="700 34px system-ui,sans-serif";ctx.textBaseline="middle";
      const maxW=640,words=text.split(" "),lines=[];let line="";
      for(const w of words){const t=line?line+" "+w:w;if(ctx.measureText(t).width>maxW&&line){lines.push(line);line=w;}else line=t;}
      lines.push(line);
      const w=Math.min(maxW,Math.max(...lines.map(l=>ctx.measureText(l).width)))+56,h=lines.length*44+32;
      const x=Math.max(20,Math.min(ShopScene.width-w-20,r?r.x+r.w/2-w/2:(ShopScene.width-w)/2));
      // Queue and note captions sit on the rail above the bench; bench targets get theirs just above them.
      const y=fixedY??(!r||r.y>1300?905:r.y-h-70);
      ctx.fillStyle="#fff6e4f2";ctx.strokeStyle="#593821";ctx.lineWidth=4;
      ctx.beginPath();ctx.roundRect(x,Math.max(20,Math.min(ShopScene.height-h-20,y)),w,h,26);ctx.fill();ctx.stroke();
      ctx.fillStyle="#593821";ctx.textAlign="center";
      const top=Math.max(20,Math.min(ShopScene.height-h-20,y));
      lines.forEach((l,j)=>ctx.fillText(l,x+w/2,top+16+22+j*44));
      ctx.restore();
    }
    // Пульсуюча рамка навколо цілі навчання з підписом-ярличком.
    function mark(r,label,pad=10,below=true){
      const t=performance.now()/1000,pulse=.5+.5*Math.sin(t*4);
      ctx.save();ctx.strokeStyle="#f2c318";ctx.lineWidth=6;ctx.globalAlpha=.65+.35*pulse;
      ctx.beginPath();ctx.roundRect(r.x-pad-pulse*4,r.y-pad-pulse*4,r.w+2*(pad+pulse*4),r.h+2*(pad+pulse*4),18);ctx.stroke();
      ctx.globalAlpha=1;
      if(label){
        ctx.font="800 24px system-ui,sans-serif";ctx.textAlign="center";ctx.textBaseline="middle";
        const w=ctx.measureText(label).width+28,cx=Math.max(20+w/2,Math.min(ShopScene.width-20-w/2,r.x+r.w/2));
        const y=below?r.y+r.h+pad+14:r.y-pad-14-38;
        ctx.fillStyle="#1d2838";ctx.beginPath();ctx.roundRect(cx-w/2,y,w,38,14);ctx.fill();
        ctx.fillStyle="#fff7e0";ctx.fillText(label,cx,y+20);
      }
      ctx.restore();
    }
    // Рівень з ланцюжком: коли проміжний продукт уперше стоїть на лавці, показуємо обидва шляхи,
    // його силует у рецепті споживача й стрілку до кута виробника. Зникає після першого рішення гравця.
    function drawChainTour(){
      if(tourDone||game.index!==CHAIN_LEVEL)return false;
      const s=game.session,chain=chainOf(s);if(!chain)return false;
      const seat=s.bench.findIndex((b,i)=>b&&b.kind===chain.kind&&!s.waiting[i]&&s.filler.item!==b&&rects.has("pour-"+i)&&active.has("pour-"+i));
      if(seat<0)return false;
      const hint=ShopScene.recipeHints(s).find(h=>h.room===chain.consumer.room&&h.kind===chain.kind);
      if(hint){mark(hint.box,null,8);mark(hint.arrow,`з кута: ${LABEL[chain.producer.id]}`,4,false);}
      mark(rects.get("return-"+seat),"на кільце",8,false);
      mark(rects.get("pour-"+seat),"на вітрину",6,true);
      // Плашка лягає на хвости черг: там нічого не натискається, а машини й лавка лишаються видимими.
      drawCaption(`${LABEL[chain.kind][0].toUpperCase()+LABEL[chain.kind].slice(1)} іде в рецепт «${LABEL[chain.consumer.product]}». Лійка — розлити на вітрину. Колба — назад на кільце, до машини «${LABEL[chain.consumer.id]}».`,{x:0,y:0,w:ShopScene.width,h:0},1410);
      return true;
    }
    // Підписи навчання лежать на хвостах черг: там нічого не натискається, лавка й лійка лишаються відкритими.
    const CAPTION_Y=1488,still=matchMedia("(prefers-reduced-motion: reduce)");
    const center=b=>({x:b.x+b.w/2,y:b.y+b.h/2});
    // Пунктир із «бігом» і стрілкою на кінці; темна підкладка, щоб жовтий читався на будь-якому тлі.
    function dashed(points,color="#f2c318"){
      if(points.length<2)return;
      ctx.save();ctx.lineCap="round";ctx.lineJoin="round";
      const line=()=>{ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();};
      ctx.strokeStyle="#1d2838";ctx.lineWidth=11;ctx.globalAlpha=.55;line();
      ctx.globalAlpha=1;ctx.strokeStyle=color;ctx.lineWidth=6;ctx.setLineDash([16,12]);
      ctx.lineDashOffset=still.matches?0:-performance.now()/40;line();ctx.setLineDash([]);
      const a=points[points.length-2],b=points[points.length-1],ang=Math.atan2(b.y-a.y,b.x-a.x);
      ctx.translate(b.x,b.y);ctx.rotate(ang);ctx.fillStyle=color;ctx.strokeStyle="#1d2838";ctx.lineWidth=3;
      ctx.beginPath();ctx.moveTo(4,0);ctx.lineTo(-16,-12);ctx.lineTo(-16,12);ctx.closePath();ctx.fill();ctx.stroke();
      ctx.restore();
    }
    // Шлях кільцем від точки входу до порту машини (за напрямком руху) і далі до силуету.
    function ringPoints(from,to){
      const d=((to-from)%1+1)%1||1,n=Math.max(2,Math.ceil(d*80)),pts=[];
      for(let k=0;k<=n;k++)pts.push(ShopScene.ring(from+d*k/n));
      return pts;
    }
    function drawRoute(s,rt,withGhost=true){
      const slot=ShopScene.slotBox(s,rt.machine,rt.slot),pts=ringPoints(rt.from,rt.to);
      const end=center(slot),last=pts[pts.length-1];
      // До силуету — коротка ланка, що зупиняється на його краю.
      const len=Math.hypot(end.x-last.x,end.y-last.y),stop=Math.max(0,len-slot.w*.55);
      pts.push({x:last.x+(end.x-last.x)*stop/len,y:last.y+(end.y-last.y)*stop/len});
      dashed(pts);mark(slot,null,6);
      if(!withGhost)return;
      // Напівпрозорий «привид» ресурсу проходить шлях; при зменшеному русі стоїть біля силуету.
      const u=still.matches?1:(performance.now()/1000/2.2)%1,i=Math.min(pts.length-1,Math.floor(u*(pts.length-1))),p=pts[i];
      const sprite=ShopScene.sprite(rt.kind),b=ShopScene.fit({x:p.x-26,y:p.y-26,w:52,h:52},sprite);
      ctx.save();ctx.globalAlpha=.6*(1-Math.max(0,u-.85)/.15);ctx.drawImage(sprite,b.x,b.y,b.w,b.h);ctx.restore();
    }
    // Від значка лійки до станції розливу й до лічильника вітрини: куди дівається баночка.
    function drawShelfPath(s,kind,from){
      const st=ShopScene.station,v=ShopScene.vitrineBox(s,kind);if(!v)return;
      // Від лійки — правим краєм поля поза кільцем, щоб лінія не перетинала цехи.
      const cx=st.x+st.w/2,edge=ShopScene.width-24,top=v.y+v.h+36;
      dashed([from,{x:cx,y:st.y+16},{x:edge,y:st.y+16},{x:edge,y:top},{x:v.x+v.w/2,y:top},{x:v.x+v.w/2,y:v.y+v.h+8}]);
      mark(v,null,4);
    }
    function pointer(r){
      const t=performance.now()/1000,tap=still.matches?0:Math.abs(Math.sin(t*3.2)),cx=r.x+r.w/2;
      ctx.save();ctx.translate(cx,r.y+r.h/2);
      ctx.beginPath();ctx.arc(0,0,r.w*.5+10+tap*8,0,Math.PI*2);ctx.strokeStyle="#ffffffcc";ctx.lineWidth=6;ctx.stroke();
      // Кінчик пальця торкається нижнього краю цілі: сама ціль (значок, ресурс) лишається видимою.
      ctx.translate(0,r.h/2-6+tap*14);ctx.lineJoin="round";
      ctx.strokeStyle="#593821";ctx.lineWidth=5;ctx.fillStyle="#fff6e4";
      ctx.beginPath();ctx.roundRect(-38,44,76,72,26);ctx.fill();ctx.stroke();   // palm
      ctx.beginPath();ctx.roundRect(-14,0,28,86,14);ctx.fill();ctx.stroke();    // index finger
      ctx.beginPath();ctx.roundRect(-33,48,66,64,22);ctx.fill();                 // hide the seam
      ctx.restore();
    }
    // Один удар навчання з tutorial.js: рамка й лінія показують причину й наслідок, підпис — коротко.
    function drawBeat(s,b){
      if(b.id==="ring-full"){
        const t=performance.now()/1000,pulse=still.matches?1:.5+.5*Math.sin(t*4);
        ctx.save();ctx.strokeStyle="#f5a410";ctx.lineWidth=8;ctx.globalAlpha=.55+.45*pulse;
        ctx.beginPath();ctx.roundRect(64-30,239-30,772+60,760+60,104);ctx.stroke();ctx.restore();
        // Погоджена шкала заповнення кільця (view.js, нижня рама) — підказка обводить саме її.
        mark({x:126,y:952,w:648,h:20},`${s.belt.length}/${CAP}`,6,false);
        for(let i=0;i<4;i++){const r=rects.get("queue-"+i);if(r&&active.has("queue-"+i))mark(r,null,6);}
      }else if(b.id==="recipe"){
        const m=s.machines.find(x=>x.room===b.room);if(m)mark(ShopScene.recipeBox(s,m),"рецепт",10);
      }else if(b.id==="cook"){
        const m=s.machines.find(x=>x.room===b.room);if(m){mark(ShopScene.recipeBox(s,m),null,10);mark(ShopScene.barBox(m),`${m.remaining.toFixed(1)} с`,6);}
      }else if(b.id==="vitrine"){
        const v=ShopScene.vitrineBox(s,b.kind);if(v)mark(v,"+1",6);
      }else if(b.id==="chain-consumer"){
        const r=rects.get("return-"+b.seat);if(r)mark(r,"на кільце",8,false);
        drawRoute(s,b.route);
      }else if(b.id==="chain-quota"){
        const r=rects.get("pour-"+b.seat);if(r){pointer(r);drawShelfPath(s,b.kind,center(r));}
      }
      drawCaption(b.text,null,CAPTION_Y);
    }
    function drawHand(){
      if(demoMode||game.phase!=="playing"||game.completed>game.index)return;
      const s=game.session,onboarding=ShopOnboarding.eligible(game.index,game.completed);
      if(onboarding&&drawChainTour())return;
      const beat=tutor.update(s,game.index);
      if(beat){drawBeat(s,beat);return;}
      if(!onboarding)return;
      const h=ShopOnboarding.hint(s,game.index);if(!h||!coach.visibleFor(h.type))return;
      if(h.type==="note"){
        // Перша баночка рівня 1: шлях від лавки через лійку на вітрину.
        const seat=s.bench.findIndex(Boolean);
        if(seat>=0)drawShelfPath(s,s.bench[seat].kind,{x:84+592*[.15,.38,.61,.84][seat],y:1090});
        drawCaption(h.text,null,CAPTION_Y);return;
      }
      const r=rects.get(({launch:"queue",return:"return",pour:"pour"})[h.type]+"-"+h.index);if(!r)return;
      let text=h.text;
      // Подача на рівнях 1–2: маршрут кільцем до силуету, який забере саме цей ресурс.
      if(h.type==="launch"&&game.index<=1){
        const kind=s.queues[h.index][0]?.kind,rt=kind&&ShopTutorial.route(s,kind,HATCH);
        if(rt)drawRoute(s,rt);
        text=ShopTutorial.launchText(s,rt,game.index);
      }
      if(h.type==="pour"&&s.bench[h.index])drawShelfPath(s,s.bench[h.index].kind,center(r));
      pointer(r);
      drawCaption(text,null,CAPTION_Y);
    }
    function hit(id,label,r,act,disabled){
      active.add(id);rects.set(id,r);let b=buttons.get(id);
      if(!b){b=document.createElement("button");b.className="hit";buttons.set(id,b);controls.append(b);}
      b.hidden=false;b.disabled=!!disabled||game.phase!=="playing";
      b.setAttribute("aria-label",label);b.onclick=act;
      b.style.left=`${r.x/9}%`;b.style.top=`${r.y/ShopScene.height*100}%`;b.style.width=`${r.w/9}%`;b.style.height=`${r.h/ShopScene.height*100}%`;
    }
    for(const parent of [$("levels"),$("dialog-levels")])levels.forEach((lv,i)=>{
      const b=document.createElement("button");b.onclick=()=>select(i);parent.append(b);levelButtons.push({b,i,lv});
    });
    function setAction(id,text,action,hidden=false){
      const b=$(id);b.textContent=text;b.onclick=action;b.hidden=hidden;
    }
    // Картка цілей: що зробити (продукти й кількість), за що зірки, а на рівні з першим ланцюжком — навчання процесу.
    function renderGoals(s,lv,i){
      const box=$("dialog-goals"),bonus=lv.bonus||[];box.textContent="";
      const add=(tag,cls,text,parent=box)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;parent.append(el);return el;};
      add("p","goals-title",`Ціль зміни: за ${s.shift} с зробіть`);
      const row=add("div","goal-row");
      for(const [kind,n] of Object.entries(s.quota)){
        const item=add("div","goal-item",undefined,row),img=document.createElement("img");
        img.src=`assets/${({Infusion:"infusion",Cream:"cream",Powder:"powder",Gel:"gel",Lotion:"lotion",Scrub:"scrub"})[kind]}.png`;img.alt=LABEL[kind];item.append(img);
        add("b","",`×${n}`,item);add("span","",LABEL[kind],item);
      }
      const stars=add("ul","goal-stars");
      add("li","",`★ виконати мінімум — рівень пройдено`,stars);
      if(bonus[0]!==undefined)add("li","",`★★ цінність вітрини ${bonus[0]}`,stars);
      if(bonus[1]!==undefined)add("li","",`★★★ цінність вітрини ${bonus[1]}`,stars);
      add("p","goal-values","Цінність: "+ShopScene.levelProducts(s).map(k=>`${LABEL[k]} ${s.values[k]}`).join(" · "));
      const chain=i===CHAIN_LEVEL&&chainOf(s);
      if(chain){
        const k=LABEL[chain.kind],c=LABEL[chain.consumer.product];
        add("p","goals-title",`Новий крок: ${k} у рецепті`);
        const how=add("ul","goal-how goal-steps");
        const step=(icon,text)=>{const li=add("li","",undefined,how);if(icon){const img=document.createElement("img");img.src=`assets/${icon}.png`;img.alt="";li.append(img);}else add("span","goal-icon","↺",li);add("span","",text,li);};
        const file={Infusion:"infusion",Cream:"cream",Powder:"powder",Gel:"gel",Lotion:"lotion",Scrub:"scrub"};
        step(file[chain.kind],`${k[0].toUpperCase()+k.slice(1)} тепер у рецепті «${c}»: його силует стоїть у машині «${LABEL[chain.consumer.id]}». Крейдяна стрілка біля силуету вказує кут, звідки він береться, — ${CORNER[chain.producer.room]}, машина «${LABEL[chain.producer.id]}».`);
        step("funnel",`Готовий ${k} стає на лавку. Перший шлях — значок лійки: розлити в баночку на вітрину.`);
        step(null,`Другий шлях — торкнутися самої колби: вона повернеться на кільце й поїде до машини «${LABEL[chain.consumer.id]}» на ${c}.`);
      }
    }
    function dialog(){
      const state=screen==="map"?"map":game.phase,s=game.session,i=game.index;
      const key=`${state}-${i}-${s.result}-${s.revivesLeft}`;
      if(overlay.dataset.state===key)return;
      const wasHidden=overlay.hidden;
      overlay.dataset.state=key;overlay.hidden=state==="playing";
      controls.inert=!overlay.hidden;document.querySelector(".header").inert=!overlay.hidden;
      document.querySelector(".help").inert=!overlay.hidden;
      if(overlay.hidden){if(focusBeforeDialog?.isConnected&&!focusBeforeDialog.disabled&&!focusBeforeDialog.hidden)focusBeforeDialog.focus();return;}
      if(wasHidden)focusBeforeDialog=document.activeElement;
      $("dialog-levels").hidden=state!=="map";
      $("dialog-goal").hidden=true;$("dialog-goals").hidden=state!=="ready";
      $("dialog-guide").hidden=state!=="paused";
      $("dialog-map").hidden=state==="map"||demoMode;
      $("dialog-kicker").textContent=`COSMETIC WORKSHOP · ${i+1} / ${levels.length}`;
      const bonus=levels[i].bonus||[];
      const quota=Object.entries(s.quota).map(([k,n])=>`${LABEL[k]} ${n}`).join(", ");
      $("dialog-goal").textContent=`Мінімум за ${s.shift} с: ${quota} — це перша зірка. Можна більше: за цінність ${bonus.join(" і ")} — друга й третя. ${ShopScene.levelProducts(s).map((k,j)=>{const t=`${LABEL[k]} ${s.values[k]}`;return j?t:t[0].toUpperCase()+t.slice(1);}).join(" · ")}.`;
      renderGoals(s,levels[i],i);
      $("dialog-guide").textContent=s.autoPour?"Ресурс у черзі → кільце. Готові баночки на лавці стають на вітрину самі. Час зміни почнеться з першого ресурсу.":"Ресурс у черзі → кільце. Посудина на лавці → назад на кільце, наприклад настій для крему. Значок лійки → баночка на вітрину. Час зміни почнеться з першого ресурсу.";
      if(state==="ready"){
        $("dialog-title").textContent=levels[i].title;
        $("dialog-copy").textContent=levels[i].hint;
        setAction("dialog-primary",demoMode&&autoplay?"Дивитися роботу":"Грати",start);
        setAction("dialog-secondary","",null,true);
      }else if(state==="paused"){
        $("dialog-title").textContent="Перепочинок";
        $("dialog-copy").textContent="Лавка на паузі. Час зміни не спливає.";
        setAction("dialog-primary","Продовжити",start);
        setAction("dialog-secondary","Почати заново",restart);
      }else if(state==="map"){
        $("dialog-title").textContent="Рівні лавки";
        $("dialog-copy").textContent=game.finished?"Усі рівні пройдено. Можна зіграти будь-який ще раз.":"Пройдіть рівень, щоб відкрити наступний. До відкритих можна повернутися.";
        setAction("dialog-primary","Повернутися",()=>{screen="";draw();});
        setAction("dialog-secondary","",null,true);
      }else{
        const final=i===levels.length-1,passed=game.passed,stars=s.stars;
        const counts=PRODUCTS.map(k=>[k,s.vitrine.filter(b=>b.kind===k).length]).filter(([,n])=>n);
        const lacking=Object.entries(s.missing).map(([k,n])=>`${LABEL[k]} ×${n}`).join(", ");
        const lost=s.lost;
        $("dialog-kicker").textContent=lost&&s.nearMiss?"МАЙЖЕ ВИЙШЛО!":$("dialog-kicker").textContent;
        $("dialog-title").textContent=passed?`Зміну закрито · ${"★".repeat(stars)}${"☆".repeat(3-stars)}`:"Зміна не вдалася";
        $("dialog-copy").textContent=passed?(final?"Усі зміни пройдено. Готові баночки чекають на клієнтів.":`Рівень «${levels[i].title}» пройдено. Наступний уже відкритий.`):`Не вистачило: ${lacking}.${s.nearMiss?" Зовсім трохи!":""} Раніше запускайте потрібні цехи; настій можна повернути на кільце для крему.`;
        $("dialog-goal").hidden=false;
        $("dialog-goal").textContent=`Цінність ${s.value} · баночок ${s.vitrine.length}${counts.length?": "+counts.map(([k,n])=>`${LABEL[k]} ×${n}`).join(", "):""} · найкраще ${game.best[i]}`;
        const toClients=()=>{$("dialog-copy").textContent="Розподіл баночок по клієнтах — наступний етап гри, він ще в розробці.";};
        if(demoMode){
          setAction("dialog-primary","Повторити показ",()=>{autoplay=true;restart();});
          setAction("dialog-secondary","Зіграти самостійно",()=>{autoplay=false;restart();});
        }else if(passed){
          setAction("dialog-primary",final?"Вибрати рівень":"Наступний рівень",final?showMap:()=>{if(game.next()){screen="";draw();}});
          setAction("dialog-secondary","До клієнтів",toClients);
        }else{
          // V1 placeholder: revive is free; a rewarded ad / IAP would be offered here later.
          if(s.canRevive){
            setAction("dialog-primary",`+${REVIVE_TIME} с`,revive);
            setAction("dialog-secondary","Ще раз",restart);
          }else{
            setAction("dialog-primary","Ще раз",restart);
            setAction("dialog-secondary","",null,true);
          }
        }
        $("dialog-map").hidden=final&&passed;
      }
      $("save-note").textContent=demoMode?"Пробний запуск · прогрес кампанії не змінюється":game.storageAvailable?`Прогрес збережено · відкрито ${game.unlocked} із ${levels.length}`:"Збереження недоступне. Прогрес тримається до закриття сторінки.";
      $("dialog-primary").focus();
    }
    function draw(){
      const s=game.session,i=game.index;
      if(demoMode){
        $("demo-status").textContent=autoplay?"Автопоказ · чотири цехи працюють разом":"Ви керуєте · чотири цехи";
        $("demo-control").textContent=autoplay?"Грати самостійно":"Увімкнути автопоказ";
      }
      if(coachSession!==s){coachSession=s;coach.reset();tutor.reset();tourDone=false;}
      // Guide: level 1 starts straight into action, no intro screen.
      ShopScene.drawBackground(ctx,sceneryFor(s));active=new Set();ShopScene.render(ctx,s,hit,command);drawHand();
      for(const [id,b]of buttons)if(!active.has(id))b.hidden=true;
      $("title").textContent=`${i+1}. ${levels[i].title}`;
      $("previous").disabled=i===0;$("next").disabled=i+1>=game.unlocked;
      $("pause").disabled=game.phase!=="playing";
      for(const {b,i:j,lv}of levelButtons){
        const locked=j>=game.unlocked,done=j<game.completed;
        b.disabled=locked;b.textContent=b.parentElement.id==="levels"?`${j+1}${done?" ✓":locked?" ·":""}`:`${j+1}. ${lv.title} ${done?"✓":locked?"· закрито":""}`;
        b.setAttribute("aria-label",`Рівень ${j+1}: ${lv.title}${locked?", закрито":done?", пройдено":""}`);
        b.setAttribute("aria-pressed",String(j===i));
      }
      const progress=`Рівень ${i+1} із ${levels.length} · вітрина ${s.vitrine.length} · цінність ${s.value} · кільце ${s.belt.length}/${CAP}`;
      if($("progress").textContent!==progress)$("progress").textContent=progress;
      let hint="Натискайте ресурси в чергах і вирішуйте, які продукти зробити за зміну.";
      if(s.filler.transferRemaining>0)hint="Каретка доставляє продукт до лійки. Наступну посудину можна поставити в чергу.";
      else if(s.filler.item)hint="Розливаємо на вітрину. Наступну посудину можна поставити в чергу до лійки.";
      else if(s.bench.some(Boolean)&&s.autoPour)hint="Навчальна зміна: готові баночки стають на вітрину самі.";
      else if(s.bench.some(Boolean))hint="Значок лійки — на вітрину. Натискання на посудину — повернути на кільце, наприклад настій для крему.";
      else if(s.belt.length>=CAP)hint="Кільце заповнене. Зачекайте, доки машина забере ресурс.";
      else if(s.machines.some(m=>m.processing))hint="Машина готує продукт. Після кола він зупиниться на лавці.";
      $("hint").textContent=hint;
      const status=`${game.phase==="paused"?"Пауза":s.result==="finished"?(s.lost?"Зміна не вдалася":"Зміну закрито"):game.phase==="ready"?"Готові до старту":"Граємо"}. Цінність ${s.value}, залишок ${Math.ceil(s.timeLeft)} с.`;
      if($("status").textContent!==status)$("status").textContent=status;
      dialog();
    }
    $("restart").onclick=restart;$("pause").onclick=pause;$("dialog-map").onclick=showMap;
    $("previous").onclick=()=>select(game.index-1);$("next").onclick=()=>select(game.index+1);
    window.addEventListener("keydown",e=>{
      if(e.repeat||e.ctrlKey||e.metaKey||e.altKey)return;
      if(e.key==="Tab"&&!overlay.hidden){
        const focusable=[...overlay.querySelectorAll("button:not([hidden]):not(:disabled)")].filter(b=>!b.closest("[hidden]"));
        const first=focusable[0],last=focusable[focusable.length-1];
        if(e.shiftKey&&document.activeElement===first){last.focus();e.preventDefault();}
        else if(!e.shiftKey&&document.activeElement===last){first.focus();e.preventDefault();}return;
      }
      if(e.key==="Escape"||e.code==="Space"){
        if(e.code==="Space"&&e.target.closest("button,summary"))return;
        e.preventDefault();if(screen==="map"){screen="";draw();}else if(game.phase==="playing")pause();else if(game.phase==="paused")start();return;
      }
      if(e.key.toLowerCase()==="r"&&overlay.hidden){e.preventDefault();restart();return;}
      if(e.key>="1"&&e.key<="4"&&overlay.hidden){command("launch",+e.key-1);e.preventDefault();}
    });
    document.addEventListener("visibilitychange",()=>{last=performance.now();if(document.hidden&&game.phase==="playing")pause();});
    window.addEventListener("blur",()=>{if(game.phase==="playing")pause();});
    draw();
    function frame(now){const dt=Math.max(0,Math.min(.05,(now-last)/1000));last=now;if(game.phase==="playing")coach.tick(dt);if(!document.hidden){if(demoMode&&autoplay)ShopDemo.advance(game,dt);else game.advance(dt);}draw();requestAnimationFrame(frame);}
    requestAnimationFrame(frame);
  }catch(error){$("title").textContent="Не вдалося відкрити лавку";overlay.hidden=true;const el=$("error");el.hidden=false;el.textContent=error.message;console.error(error);}
})();
