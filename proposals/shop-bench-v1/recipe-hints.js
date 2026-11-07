/* Погоджені підказки: контур посудини й коротка крейдяна стрілка всередині кімнати. */
const ShopRecipeHints = (() => {
  const colors={Infusion:'#c9dc25',Powder:'#bc73e5',Cream:'#f1d6ae',Gel:'#86df38',Lotion:'#eee1d6',Scrub:'#c79a75'};
  const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
  function collision(items,frames,bounds,canvasFactory){
    const c=canvasFactory(Math.ceil(bounds.w),Math.ceil(bounds.h)),ctx=c.getContext('2d');
    ctx.translate(-bounds.x,-bounds.y);
    for(const item of items){
      const b=item.box;ctx.save();ctx.translate(b.x+b.w/2,b.y+b.h);ctx.rotate(item.angle*Math.PI/180);
      ctx.drawImage(item.sprite,-b.w/2,-b.h,b.w,b.h);ctx.restore();
    }
    for(const f of frames)ctx.fillRect(f.box.x,f.box.y,f.box.w,f.box.h);
    const pixels=ctx.getImageData(0,0,c.width,c.height).data,stride=c.width+1,sum=new Uint32Array(stride*(c.height+1));
    for(let y=0;y<c.height;y++){let row=0;for(let x=0;x<c.width;x++){
      row+=pixels[(y*c.width+x)*4+3]>24?1:0;sum[(y+1)*stride+x+1]=sum[y*stride+x+1]+row;
    }}
    return b=>{
      const x=Math.max(0,Math.floor(b.x-bounds.x-2)),y=Math.max(0,Math.floor(b.y-bounds.y-2));
      const r=Math.min(c.width,Math.ceil(b.x+b.w-bounds.x+2)),d=Math.min(c.height,Math.ceil(b.y+b.h-bounds.y+2));
      return sum[d*stride+r]-sum[y*stride+r]-sum[d*stride+x]+sum[y*stride+x]>0;
    };
  }
  function arrowStrokes(dx,dy){
    const p=(u,v)=>({x:dx*u-dy*v,y:dy*u+dx*v});
    return [[p(-12.6,0),p(12.6,0)],[p(2.8,-9.8),p(12.6,0),p(2.8,9.8)]];
  }
  function arrowBlocked(blocked,box,dx,dy){
    if(!blocked(box))return false;
    for(const stroke of arrowStrokes(dx,dy))for(let i=1;i<stroke.length;i++){
      const a=stroke[i-1],b=stroke[i],steps=Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/2);
      for(let j=0;j<=steps;j++){
        const x=box.x+20+a.x+(b.x-a.x)*j/steps,y=box.y+20+a.y+(b.y-a.y)*j/steps;
        if(blocked({x:x-2.8,y:y-2.8,w:5.6,h:5.6}))return true;
      }
    }
    return false;
  }
  function plan(items,frames,bounds,canvasFactory){
    const hints=[];
    const blocked={};
    for(const room of Object.keys(bounds))blocked[room]=collision(items.filter(i=>i.room===room),frames.filter(f=>f.room===room),bounds[room],canvasFactory);
    for(const item of items){
      const source=frames.find(f=>f.product===item.kind);
      if(!colors[item.kind]||!source||source.room===item.room)continue;
      // Room-to-room direction; a gentle right lean for the approved upward cue.
      const ids=['UL','UR','LL','LR'],from=ids.indexOf(item.room),to=ids.indexOf(source.room);
      let dx=to%2-from%2,dy=Math.floor(to/2)-Math.floor(from/2);
      const length=Math.hypot(dx,dy);dx/=length;dy/=length;
      if(dx===0){dx=-dy*Math.sin(.18);dy*=Math.cos(.18);}
      const gap=item.hintStyle?.gap??14;
      const b=bounds[item.room],below=item.hintStyle?.side==='bottom';
      const desired={x:below?item.box.x+item.box.w/2:item.hintStyle?.side==='left'?item.box.x-gap:item.box.x+item.box.w+gap,y:below?item.box.y+item.box.h+gap+10:item.box.y+item.box.h*.78};
      const obstacles=hints.filter(h=>h.room===item.room).map(h=>h.arrow);
      let arrow=null,best=Infinity;
      for(let y=b.y+21;y<=b.y+b.h-21;y+=3)for(let x=b.x+21;x<=b.x+b.w-21;x+=3){
        const box={x:x-20,y:y-20,w:40,h:40};
        if(arrowBlocked(blocked[item.room],box,dx,dy)||obstacles.some(o=>overlap(box,{x:o.x-2,y:o.y-2,w:o.w+4,h:o.h+4})))continue;
        const score=(x-desired.x)**2+(y-desired.y)**2;
        if(score<best){best=score;arrow=box;}
      }
      if(!arrow)throw Error('Немає місця для стрілки: '+item.room+' '+item.kind);
      hints.push({...item,color:colors[item.kind],arrowColor:item.hintStyle?.color||'#245137',arrow,dx,dy,source:source.room,bounds:b});
    }
    return hints;
  }
  function chalk(ctx,h,canvasFactory){
    const c=canvasFactory(160,160),x=c.getContext('2d');x.translate(80,80);x.scale(4,4);
    const strokes=arrowStrokes(h.dx,h.dy);
    x.strokeStyle=x.fillStyle=h.arrowColor;x.lineCap='round';x.lineJoin='round';x.lineWidth=5.6;x.globalAlpha=.84;
    for(const points of strokes){x.beginPath();points.forEach((p,i)=>i?x.lineTo(p.x,p.y):x.moveTo(p.x,p.y));x.stroke();}
    // Sparse rubbed-out grains retain the clean rounded silhouette of approved variant 2.
    let seed=37;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
    x.globalCompositeOperation='destination-out';
    for(let i=0;i<160;i++){
      x.globalAlpha=.25+random()*.55;x.beginPath();x.arc((random()-.5)*33.6,(random()-.5)*40.6,.168+random()*.308,0,Math.PI*2);x.fill();
    }
    ctx.drawImage(c,h.arrow.x,h.arrow.y,40,40);
  }
  function draw(ctx,hints,canvasFactory){
    for(const h of hints){
      const pad=6,w=Math.ceil(h.box.w)+pad*2,hh=Math.ceil(h.box.h)+pad*2;
      const mask=canvasFactory(w,hh),m=mask.getContext('2d');
      m.drawImage(h.sprite,pad,pad,h.box.w,h.box.h);
      const pixels=m.getImageData(0,0,w,hh).data;m.clearRect(0,0,w,hh);m.fillStyle=h.color;
      // A solid outer silhouette avoids recoloring translucent glass or its internal highlights.
      for(let y=0;y<hh;y++){
        let left=w,right=-1;for(let x=0;x<w;x++)if(pixels[(y*w+x)*4+3]>24){left=Math.min(left,x);right=x;}
        if(right>=left)m.fillRect(left,y,right-left+1,1);
      }
      const edge=canvasFactory(w,hh),e=edge.getContext('2d');
      for(let a=0;a<Math.PI*2;a+=Math.PI/24)e.drawImage(mask,Math.cos(a)*3,Math.sin(a)*3);
      e.globalCompositeOperation='destination-out';e.drawImage(mask,0,0);
      ctx.save();ctx.translate(h.box.x+h.box.w/2,h.box.y+h.box.h);ctx.rotate(h.angle*Math.PI/180);
      ctx.drawImage(edge,-h.box.w/2-pad,-h.box.h-pad);ctx.restore();chalk(ctx,h,canvasFactory);
    }
  }
  return {colors,plan,draw};
})();
if(typeof module!=='undefined')module.exports=ShopRecipeHints;
