/* Visible-state strategies shared by the balance simulator and the autoplay demo. */
const ShopStrategy = (() => {
const BELT_CAP = typeof module !== "undefined" ? require("./engine.js").CAP : CAP;
// Order in which a ball launched from the hatch passes the rooms' machine inputs.
// Rooms, not machine kinds: the emulsifier takes a left room on some levels.
const ROUTE = ['LL','UL','UR','LR'];
// Єдиний вхід стратегії: видимі дані. Хвости черг після третьої кульки не передаються.
function observe(s) {
  return {
    autoPour:s.autoPour, time:s.time, timeLeft:s.started?s.timeLeft:s.shift, values:{...s.values}, missing:{...s.missing},
    queues:s.queues.map(q=>q.slice(0,3).map(b=>b.kind)),
    belt:s.belt.map(b=>({id:b.id,kind:b.kind})),
    bench:s.bench.map((b,i)=>b?{id:b.id,kind:b.kind,waiting:s.waiting[i],
      filling:s.filler.item===b,ready:!b.seating || s.time+1e-9>=b.seating.time+b.seating.duration}:null),
    machines:s.machines.map(m=>({id:m.id,room:m.room,product:m.product,need:[...m.need],
      wants:m.wants(),slots:m.slots.map(x=>({kind:x.kind,filled:x.filled})),
      processing:m.processing,output:!!m.out})),
  };
}

// Машина, до якої дійде подана з люка кулька: перша на шляху з порожнім силуетом.
const receiver = (v, kind) => ROUTE.map(room => v.machines.find(m => m.room === room && m.wants.includes(kind))).find(Boolean);
const missing = m => m.slots.filter(x => !x.filled).length;

// Наскільки корисна подача для машини: цінність продукту на кожен відсутній силует.
// Скільки ще бракує до мінімуму, з урахуванням того, що вже на лавці чи в роботі.
function shortfall(v, kind) {
  const coming = v.bench.filter(b => b && b.kind === kind).length +
    v.machines.filter(m => m.product === kind && (m.processing || m.output)).length;
  return Math.max(0, (v.missing?.[kind] || 0) - coming);
}

function worth(v, m) {
  if (!m) return -Infinity;
  let value = v.values[m.product] || 0;
  // Мінімум зміни важливіший за цінність: без нього немає першої зірки.
  if (shortfall(v, m.product)) value += 6;
  // Проміжний продукт (настій для крему, крем для лосьйону тощо) вартий частки кінцевого.
  for (const c of consumers(v, m.product)) value = Math.max(value, chainValue(v, c, m.product));
  return value / Math.max(1, missing(m));
}
// Машини, рецепт яких містить цей продукт.
const consumers = (v, kind) => v.machines.filter(c => c.need.includes(kind));
const chainValue = (v, c, kind) => ((v.values[c.product] || 0) + (shortfall(v, c.product) ? 12 : 0)) / c.need.filter(k => k === kind).length;

function choose(v, strategy = 'value') {
  // На навчальному рівні розлив автоматичний: лавка стратегії не потрібна.
  const seats = v.autoPour ? [] : v.bench.map((b,i)=>({b,i})).filter(({b})=>b&&b.ready&&!b.waiting&&!b.filling);
  const late = v.timeLeft < 14; // Повернутий продукт уже не встигне стати новим.
  // Лавка: проміжний продукт — машині, якій він потрібен, якщо так вигідніше; решта — на вітрину.
  const held = new Set();
  for (const {b,i} of seats) {
    if (strategy === 'pour' || late || v.belt.length >= BELT_CAP) continue;
    // Повернений продукт забирає перша на кільці машина, якій він зараз потрібен.
    const c = receiver(v, b.kind);
    // Інший споживач далі по кільцю потрібен для мінімуму, а найближчий — ні: посудина чекає на лавці.
    const later = c && consumers(v, b.kind).find(x => x !== c && shortfall(v, x.product) && !shortfall(v, c.product));
    if (later && !shortfall(v, b.kind)) { held.add(i); continue; }
    if (!c) continue;
    // Продукт, якого бракує до мінімуму, розливаємо, якщо його споживач уже не потрібен для мінімуму.
    const keep = shortfall(v, b.kind) > 0 && !shortfall(v, c.product);
    const better = chainValue(v, c, b.kind) > (v.values[b.kind] || 0) + (shortfall(v, b.kind) ? 6 : 0);
    const free = c.slots.filter(x => x.kind === b.kind && !x.filled).length;
    if (!keep && better && v.belt.filter(x => x.kind === b.kind).length < free) return {type:'return', index:i};
  }
  const pour = seats.find(({i}) => !held.has(i));
  if (pour) return {type:'pour', index:pour.i};
  if (v.belt.length >= BELT_CAP - 1) return null;
  const front = v.queues.map((q,index)=>({index,kind:q[0]})).filter(x=>x.kind);
  if (!front.length) return null;
  if (strategy === 'naive' || strategy === 'pour') {
    let q = front.find(x => receiver(v, x.kind));
    // Нічого спереду не приймають: прокрутити першу чергу, сировина повернеться в її кінець.
    if (!q && !v.belt.some(b => v.machines.some(m => m.wants.includes(b.kind))))
      q = front.find(x => v.queues[x.index].slice(1).some(k => receiver(v, k))) || front[0];
    return q ? {type:'launch', index:q.index} : null;
  }
  // value: найцінніша подача; не подаємо, якщо сировина дістанеться менш вартій машині,
  // ніж та, якій вона справді потрібна.
  // За рівних оцінок по черзі пробуємо різні черги, щоб не крутити одну й ту саму.
  const rot = Math.floor(v.time / 6) % 4, order = i => (i - rot + 4) % 4;
  const scored = front.map(x => {
    const m = receiver(v, x.kind);
    const best = Math.max(-Infinity, ...v.machines.filter(y => y.wants.includes(x.kind)).map(y => worth(v, y)));
    let score = worth(v, m);
    if (m && worth(v, m) + 1e-9 < best) score -= 2;
    // Розкопування: під непотрібною кулькою може лежати цінна.
    if (!m) score = -5 + Math.max(0, ...v.queues[x.index].slice(1).map(k => worth(v, receiver(v, k)) || 0)) / 2;
    return {...x, score};
  }).sort((a,b) => b.score - a.score || order(a.index) - order(b.index));
  const top = scored[0];
  if (top.score < -4.5 && v.belt.some(b => v.machines.some(m => m.wants.includes(b.kind)))) return null;
  return {type:'launch', index:top.index};
}

return { observe, choose, ROUTE };
})();
if (typeof module !== "undefined") module.exports = ShopStrategy;
