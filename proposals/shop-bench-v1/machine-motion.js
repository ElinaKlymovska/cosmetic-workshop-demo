/* Product preparation is a view of machine.progress, never a separate timer. */
const ShopMachineMotion = (() => {
  const clamp = n => Math.max(0, Math.min(1, n));
  const tau = Math.PI * 2;
  function oval(c,x,y,rx,ry,color){c.beginPath();c.ellipse(x,y,rx,ry,0,0,tau);c.fillStyle=color;c.fill();}
  function line(c,points,color,width){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.stroke();}
  const glassCache = new WeakMap();
  function powderGlass(sprite){
    if(glassCache.has(sprite))return glassCache.get(sprite);
    const canvas=document.createElement('canvas');canvas.width=sprite.width;canvas.height=sprite.height;
    const c=canvas.getContext('2d');c.drawImage(sprite,0,0);c.scale(canvas.width,canvas.height);
    c.globalCompositeOperation='destination-out';c.beginPath();c.moveTo(.2,.24);c.lineTo(.8,.24);c.lineTo(.8,.81);c.bezierCurveTo(.8,.98,.2,.98,.2,.81);c.closePath();c.fill();
    glassCache.set(sprite,canvas);return canvas;
  }
  // Each recipe machine always shows its product vessel. The glass stays crisp; only the
  // substance is translucent while idle and thickens with machine.progress.
  const SUBSTANCE=.6;
  function presence(m){
    if(!m)return 0;
    if(m.processing)return SUBSTANCE+(1-SUBSTANCE)*clamp(m.progress);
    return m.out?1:SUBSTANCE;
  }
  // Substance outlines in sprite units. Everything outside them is glass.
  // Keyed by product: a machine may stand in another room on later levels.
  const KIND={UL:'Gel',UR:'Infusion',LL:'Powder',LR:'Cream'};
  const kindOf=m=>m.product||KIND[m.room];
  const contentsPath={
    Infusion:c=>{c.moveTo(.27,.5);c.lineTo(.73,.5);c.bezierCurveTo(.82,.64,.93,.79,.93,.86);c.bezierCurveTo(.93,.95,.07,.95,.07,.86);c.bezierCurveTo(.07,.79,.18,.64,.27,.5);},
    Cream:c=>{c.moveTo(.05,.4);c.lineTo(.05,.3);c.bezierCurveTo(.15,.22,.3,.14,.45,.1);c.lineTo(.62,0);c.lineTo(.8,0);c.lineTo(.76,.1);c.bezierCurveTo(.85,.16,.95,.26,.95,.33);c.lineTo(.95,.78);c.bezierCurveTo(.8,.85,.2,.85,.05,.78);},
    Gel:c=>{c.moveTo(.05,.3);c.bezierCurveTo(.12,.22,.3,.16,.5,.2);c.bezierCurveTo(.7,.17,.88,.2,.95,.3);c.lineTo(.95,.82);c.bezierCurveTo(.8,.9,.2,.9,.05,.82);},
    // Round-bottom flask: the flat liquid surface at .49 and the inner bulb wall below it.
    Lotion:c=>{c.moveTo(.084,.49);c.bezierCurveTo(.3,.47,.7,.47,.916,.49);c.ellipse(.5,.645,.47,.335,0,-.481,Math.PI+.481);},
    // Apothecary jar: a heaped granular mound above straight walls.
    Scrub:c=>{c.moveTo(.08,.22);c.quadraticCurveTo(.5,.1,.92,.22);c.lineTo(.92,.84);c.bezierCurveTo(.92,.94,.08,.94,.08,.84);},
    Powder:c=>{c.moveTo(.2,.24);c.lineTo(.8,.24);c.lineTo(.8,.81);c.bezierCurveTo(.8,.98,.2,.98,.2,.81);}
  };
  const partsCache=new Map();
  function vesselParts(sprite,kind){
    const key=partsCache.get(sprite)||new Map();partsCache.set(sprite,key);
    if(key.has(kind))return key.get(kind);
    const make=mode=>{
      const canvas=document.createElement('canvas');canvas.width=sprite.width;canvas.height=sprite.height;
      const c=canvas.getContext('2d');c.drawImage(sprite,0,0);c.scale(canvas.width,canvas.height);
      c.globalCompositeOperation=mode;c.beginPath();contentsPath[kind](c);c.closePath();c.fill();return canvas;
    };
    const parts={glass:kind==='Powder'?powderGlass(sprite):make('destination-out'),contents:make('destination-in')};
    key.set(kind,parts);return parts;
  }
  const preparationLayers = new Map();
  function draw(c,sprite,b,m,head,reduced=false){
    const amount=presence(m);
    if(amount<=0)return;
    if(!m.processing&&m.out||!contentsPath[kindOf(m)]){c.drawImage(sprite,b.x,b.y,b.w,b.h);return;}
    const {glass,contents}=vesselParts(sprite,kindOf(m));
    c.save();c.globalAlpha*=SUBSTANCE;c.drawImage(contents,b.x,b.y,b.w,b.h);c.restore();
    if(m.processing){
      // Composite the entire preparation layer so particles and contents thicken together.
      // Keep the product's final size, position and glass proportions throughout.
      let layer=preparationLayers.get(m.room);
      if(!layer){layer=document.createElement('canvas');preparationLayers.set(m.room,layer);}
      const left=b.x-b.w*.18,top=Math.min(b.y-b.h*.33,head.y-2),w=b.w*1.36,h=b.y+b.h+2-top,density=2;
      const width=Math.ceil(w*density),height=Math.ceil(h*density);
      if(layer.width!==width||layer.height!==height){layer.width=width;layer.height=height;}
      const lc=layer.getContext('2d');lc.setTransform(1,0,0,1,0,0);lc.clearRect(0,0,width,height);
      lc.setTransform(density,0,0,density,-left*density,-top*density);
      drawPreparation(lc,contents,b,m,head,reduced);
      c.save();c.globalAlpha*=(amount-SUBSTANCE)/(1-SUBSTANCE);
      c.drawImage(layer,left,top,width/density,height/density);c.restore();
    }
    // Front glass stays fully opaque over the substance at every stage.
    c.drawImage(glass,b.x,b.y,b.w,b.h);
  }
  // `contents` is the substance only; the glass is drawn by draw() on top.
  function drawPreparation(c,contents,b,m,head,reduced=false){
    if(kindOf(m)!=='Powder'&&kindOf(m)!=='Scrub')c.drawImage(contents,b.x,b.y,b.w,b.h);
    const p=clamp(m.progress),t=p*3,fade=Math.min(1,p*10,(1-p)*10);
    c.save();c.translate(b.x,b.y);c.scale(b.w,b.h);
    if(kindOf(m)==='Infusion'){
      // Keep every reflection and the flask outline still; only the infusion moves.
      c.save();c.beginPath();c.moveTo(.25,.53);c.bezierCurveTo(.2,.63,.1,.79,.09,.85);c.bezierCurveTo(.1,1,.9,1,.91,.85);c.lineTo(.75,.53);c.closePath();c.clip();
      c.fillStyle=`rgba(255,174,30,${.14+.18*p})`;c.fillRect(0,.5,1,.5);
      if(!reduced){
        c.globalAlpha=fade;
        for(let i=0;i<9;i++){
          const rise=(t*(.65+i*.027)+i*.173)%1;
          const x=.24+(i%4)*.17+Math.sin(t*4+i)*.023,y=.91-rise*.35,r=.018+(i%3)*.007;
          c.beginPath();c.ellipse(x,y,r,r*b.w/b.h,0,0,tau);c.fillStyle='rgba(255,246,173,.55)';c.fill();c.strokeStyle='rgba(255,255,227,.85)';c.lineWidth=.009;c.stroke();
        }
        for(let i=0;i<2;i++){const phase=t*5+i*2;c.beginPath();c.ellipse(.5,.61+Math.sin(phase)*.012,.25+i*.05,.027,0,0,tau);c.strokeStyle='rgba(255,247,158,.6)';c.lineWidth=.012;c.stroke();}
      }
      c.restore();
      if(!reduced){
        c.globalAlpha=fade*.7;
        for(let i=0;i<3;i++){
          const rise=(t*.8+i/3)%1,x=.43+i*.07;
          c.beginPath();c.moveTo(x,.05-rise*.25);c.bezierCurveTo(x-.05,.01-rise*.25,x+.06,-.03-rise*.25,x,-.09-rise*.25);c.strokeStyle=`rgba(255,249,225,${(1-rise)*.8})`;c.lineWidth=.026;c.lineCap='round';c.stroke();
        }
      }
    }else if(kindOf(m)==='Cream'){
      // Heavy cream follows the whisk in broad folds. The glass never rotates.
      c.save();c.beginPath();c.ellipse(.5,.53,.41,.32,0,0,tau);c.clip();
      if(!reduced){
        c.globalAlpha=fade;
        for(let j=0;j<3;j++){
          c.beginPath();
          for(let i=0;i<=50;i++){
            const a=i/50*tau*1.4+t*7+j*2.1,r=.045+i/50*.33;
            const x=.5+Math.cos(a)*r,y=.5+Math.sin(a)*r*.53;
            if(i)c.lineTo(x,y);else c.moveTo(x,y);
          }
          c.strokeStyle=j%2?'rgba(230,170,111,.55)':'rgba(255,250,222,.9)';c.lineWidth=.025;c.lineCap='round';c.stroke();
        }
      }
      c.restore();
      // A working spindle reaches from the existing motor into the bowl.
      const hx=(head.x-b.x)/b.w,hy=(head.y-b.y)/b.h;
      const x=.5+(reduced?0:Math.sin(t*7)*.025),y=.36;
      line(c,[[hx,hy],[x,y]],'#6a7776',.036);
      line(c,[[hx-.012,hy],[x-.012,y]],'#e6f4e5',.014);
      if(!reduced){
        c.globalAlpha=fade;
        for(let i=0;i<3;i++){
          const rx=.07+Math.abs(Math.cos(t*12+i*Math.PI/3))*.12;
          c.beginPath();c.ellipse(x,y,rx,.13,0,0,tau);c.strokeStyle=i===1?'#f6ffef':'#8d9e99';c.lineWidth=.016;c.stroke();
        }
      }
    }else if(kindOf(m)==='Powder'){
      // Rebuild the interior only: dry powder gathers from the bottom of the tube.
      c.save();c.beginPath();c.moveTo(.2,.24);c.lineTo(.8,.24);c.lineTo(.8,.81);c.bezierCurveTo(.8,.98,.2,.98,.2,.81);c.closePath();c.clip();
      c.fillStyle='rgba(204,214,242,.2)';c.fillRect(.2,.24,.6,.72);
      const surface=.84-.46*(.12+.88*p);
      c.beginPath();c.moveTo(.18,surface+.055);c.quadraticCurveTo(.43,surface-.055,.53,surface-.025);c.quadraticCurveTo(.69,surface,.82,surface+.065);c.lineTo(.82,1);c.lineTo(.18,1);c.closePath();c.clip();
      c.drawImage(contents,0,0,1,1);
      // Granular highlights settle rather than flowing like a liquid.
      if(!reduced){c.globalAlpha=fade*.7;for(let i=0;i<28;i++){const x=.23+((i*37)%53)/100,y=surface+.04+((i*19)%49)/100;if(y<.91)oval(c,x,y,.008,.004,'#f1d7ff');}}
      c.restore();
      if(!reduced){
        const hx=(head.x-b.x)/b.w,hy=(head.y-b.y)/b.h;
        c.globalAlpha=fade;
        for(let i=0;i<19;i++){
          const phase=(t*1.4+i/19)%1;
          const x=.5+Math.sin(i*2.4+phase*2)*(.025+phase*.09),y=hy+(surface-hy)*phase;
          oval(c,x,y,.009+(i%3)*.003,.004+(i%2)*.002,i%2?'#d4a5f2':'#f0d4ff');
        }
        // Flecks at the mouth make the falling stream visible on a small phone.
        line(c,[[hx,hy],[.5,.2]],'rgba(211,161,239,.45)',.025);
      }
    }else if(kindOf(m)==='Lotion'){
      // Emulsifying: amber oil and blue water droplets shrink into one milky pearl swirl.
      c.save();c.beginPath();contentsPath.Lotion(c);c.closePath();c.clip();
      c.fillStyle=`rgba(236,224,246,${.12+p*.2})`;c.fillRect(0,.4,1,.6);
      if(!reduced){
        c.globalAlpha=fade;
        for(let j=0;j<2;j++){
          c.beginPath();
          for(let i=0;i<=40;i++){
            const a=i/40*tau*1.2+t*(5-2*p)+j*Math.PI,r=.05+i/40*.32;
            const x=.5+Math.cos(a)*r,y=.69+Math.sin(a)*r*.42;
            if(i)c.lineTo(x,y);else c.moveTo(x,y);
          }
          c.strokeStyle=j?'rgba(190,160,225,.85)':'rgba(255,252,255,.95)';c.lineWidth=.032;c.lineCap='round';c.stroke();
        }
        const drop=.055*(1-p)+.008;
        for(let i=0;i<10;i++){
          const a=i/10*tau+t*(3+i%3),r=.1+(i%4)*.07;
          oval(c,.5+Math.cos(a)*r,.7+Math.sin(a)*r*.4,drop,drop*.8,i%2?'rgba(240,150,20,.95)':'rgba(60,160,235,.92)');
        }
      }
      c.restore();
      if(!reduced){
        // Two feeds leave the nozzle and merge into one stream above the neck.
        const hx=(head.x-b.x)/b.w,hy=(head.y-b.y)/b.h;
        c.globalAlpha=fade*.8;
        line(c,[[hx-.07,hy],[.47,.02],[.5,.5]],'rgba(240,150,20,.85)',.035);
        line(c,[[hx+.07,hy],[.53,.02],[.5,.5]],'rgba(60,160,235,.8)',.035);
        line(c,[[.5,.1],[.5,.5]],'rgba(252,246,255,.95)',.03);
      }
    }else if(kindOf(m)==='Scrub'){
      // Ground salt drops in oily clumps; the granular mound rises from the bottom of the jar.
      const surface=.86-.68*(.12+.88*p);
      c.save();c.beginPath();contentsPath.Scrub(c);c.closePath();c.clip();
      c.beginPath();c.moveTo(.06,surface+.07);c.quadraticCurveTo(.3,surface-.01,.5,surface-.04);c.quadraticCurveTo(.72,surface-.01,.94,surface+.07);c.lineTo(.94,1);c.lineTo(.06,1);c.closePath();c.clip();
      c.drawImage(contents,0,0,1,1);
      // Freshly mixed scrub is wet with oil: a warmer, deeper tone below the crest.
      c.fillStyle='rgba(196,104,0,.38)';c.fillRect(0,0,1,1);
      c.restore();
      // A glossy oily crest marks the rising mound so the fill level reads on a phone.
      c.save();c.beginPath();contentsPath.Scrub(c);c.closePath();c.clip();
      c.beginPath();c.moveTo(.06,surface+.07);c.quadraticCurveTo(.3,surface-.01,.5,surface-.04);c.quadraticCurveTo(.72,surface-.01,.94,surface+.07);
      c.strokeStyle='rgba(150,72,0,.9)';c.lineWidth=.05;c.stroke();c.strokeStyle='rgba(255,250,225,1)';c.lineWidth=.02;c.stroke();
      c.restore();
      if(!reduced){
        const hx=(head.x-b.x)/b.w,hy=Math.min((head.y-b.y)/b.h,-.12);
        c.globalAlpha=fade;
        for(let i=0;i<10;i++){
          const phase=(t*1.1+i/10)%1,x=.5+Math.sin(i*2.1+phase)*(.04+phase*.16),y=hy+(surface-.03-hy)*phase,big=i%3===0;
          oval(c,x,y,big?.07:.045,big?.05:.032,i%2?'rgba(226,246,250,.97)':'rgba(236,160,30,.95)');
          oval(c,x-.012,y-.01,big?.022:.014,big?.015:.01,'rgba(255,255,255,.95)');
        }
      }
    }else if(kindOf(m)==='Gel'){
      // Fast ripples settle into a thicker gel as cooling progresses.
      c.save();c.beginPath();c.ellipse(.5,.51,.39,.31,0,0,tau);c.clip();
      c.fillStyle=`rgba(60,204,151,${.08+p*.18})`;c.fillRect(.08,.17,.84,.7);
      if(!reduced){
        c.globalAlpha=fade;
        for(let j=0;j<3;j++){
          c.beginPath();
          for(let i=0;i<=32;i++){
            const x=.1+i/32*.8,y=.34+j*.12+Math.sin(x*9-t*(9-6*p)+j)*(.045*(1-p)+.006);
            if(i)c.lineTo(x,y);else c.moveTo(x,y);
          }
          c.strokeStyle=j===1?'rgba(238,255,191,.8)':'rgba(62,174,66,.55)';c.lineWidth=.018+p*.018;c.lineCap='round';c.stroke();
        }
      }
      c.restore();
      c.globalAlpha=reduced?.5:fade*.75;
      for(let i=0;i<3;i++){
        const phase=reduced?.5:(t*.45+i/3)%1;
        const x=i%2?.93:.07,y=.13+phase*.6,r=.045;
        line(c,[[x-r,y],[x+r,y]],'#d1f9ff',.016);line(c,[[x,y-r*b.w/b.h],[x,y+r*b.w/b.h]],'#d1f9ff',.016);
      }
    }
    c.restore();
  }
  function departureDuration(departure,ports,loop){
    // Finish before the next interaction point, including displaced ring insertions.
    const nearest=Math.min(1,...ports.map(port=>{
      const d=((port.pos-departure.pos)%1+1)%1;
      return d<1e-9?1:d;
    }));
    return Math.min(.6,nearest*loop*.8);
  }
  function transferBox(from,to,elapsed,duration){
    const u=clamp(elapsed/duration);
    if(u===0)return {...from};
    if(u===1)return {...to};
    const ease=u*u*(3-2*u),mix=(a,b)=>a+(b-a)*ease;
    const lift=Math.sin(Math.PI*u)*Math.min(16,Math.hypot(to.x-from.x,to.y-from.y)*.12);
    return {x:mix(from.x,to.x),y:mix(from.y,to.y)-lift,w:mix(from.w,to.w),h:mix(from.h,to.h)};
  }
  function arrivalProgress(slot,time){
    if(!slot.filled||!slot.arrival)return 1;
    return clamp((time-slot.arrival.time)/.55);
  }
  function benchProgress(ball,time){
    if(!ball?.seating)return 1;
    return clamp((time-ball.seating.time)/ball.seating.duration);
  }
  function fillerProgress(filler){
    if(!filler?.item||!filler.transferDuration)return 1;
    return clamp(1-filler.transferRemaining/filler.transferDuration);
  }
  function funnelBox(from,mouth,progress){
    const p=clamp(progress);
    if(p<=.8)return transferBox(from,mouth,p,.8);
    const scale=(1-p)/.2;
    return {x:mouth.x+mouth.w*(1-scale)/2,y:mouth.y+mouth.h*(1-scale),w:mouth.w*scale,h:mouth.h*scale};
  }
  function carriageProductBox(from,held,mouth,motion){
    if(!motion.picked)return {...from};
    if(motion.lift<1){
      const u=motion.lift*motion.lift*(3-2*motion.lift),out={};
      for(const key of ['x','y','w','h'])out[key]=from[key]+(held[key]-from[key])*u;
      return out;
    }
    if(motion.release>0)return funnelBox(held,mouth,motion.release);
    return {...held};
  }
  return {SUBSTANCE,draw,presence,departureDuration,transferBox,arrivalProgress,benchProgress,fillerProgress,funnelBox,carriageProductBox,emptyPowderTube:powderGlass};
})();

if(typeof module!=="undefined")module.exports={ShopMachineMotion};
