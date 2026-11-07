/* Візуальне навчання рівнів 1–5 прототипу: що показати, коли й куди поїде ресурс. Лише логіка, без малювання.
   Сценарій — tutorial/script.json (OpenAI, gpt-6.1-sol), відібрані обов'язкові удари. Спільний onboarding.js
   (рука й підписи, перенесені в Unity) не змінено: цей модуль додає маршрут-привид, рамки й лічильники поверх.
   Один удар одночасно; кожен показується раз за перше проходження рівня; час — ігровий (зупиняється з паузою). */
const ShopTutorial = (() => {
  const E = typeof module !== "undefined" ? require("../shop-bench-v1/engine.js") : { SYM, CAP, SHOP, HATCH, LABEL };
  const LAST = 4;                                   // рівні 1–5 (індекси 0–4)
  const LANDING = .55;                              // прибуття складника в силует, як у machine-motion.js
  const wrap = p => p - Math.floor(p), fwd = (a, b) => wrap(b - a);
  const ACC = { Water: "воду", Chamomile: "ромашку", Oil: "олійку", Lavender: "лаванду", Aloe: "алое", Wax: "віск", Honey: "мед", Salt: "сіль",
    Infusion: "настій", Powder: "пудру", Cream: "крем", Gel: "гель", Lotion: "лосьйон", Scrub: "скраб" };
  const cap = t => t[0].toUpperCase() + t.slice(1);

  // Яка машина першою забере ресурс `kind`, поданий у точку `start` кільця. Враховує ресурси того ж виду,
  // що вже їдуть кільцем і можуть зайняти силует раніше. Сировина без власника за коло повертається в чергу.
  function route(s, kind, start) {
    const free = new Map(s.machines.map(m => [m, m.open ? m.slots.filter(x => !x.filled && x.kind === kind).length : 0]));
    const me = { pos: start, limit: 1, id: Infinity };
    const balls = s.belt.filter(b => b.kind === kind).map(b => ({ pos: b.pos, limit: b.queue !== undefined ? 1 - (b.travel || 0) : 1, id: b.id }));
    balls.push(me);
    const ev = [];
    for (const b of balls) for (const m of s.machines) {
      if (!free.get(m)) continue;
      let d = fwd(b.pos, m.input); if (d < 1e-9) d = 1;
      if (d <= b.limit + 1e-9) ev.push({ d, b, m });
    }
    ev.sort((a, c) => a.d - c.d || a.b.id - c.b.id);
    const done = new Set(), claimed = new Map();
    for (const e of ev) {
      if (done.has(e.b) || !free.get(e.m)) continue;
      done.add(e.b); free.set(e.m, free.get(e.m) - 1);
      const n = claimed.get(e.m) || 0; claimed.set(e.m, n + 1);
      if (e.b === me) {
        const empty = e.m.slots.map((x, i) => i).filter(i => !e.m.slots[i].filled && e.m.slots[i].kind === kind);
        return { machine: e.m, slot: empty[n], kind, from: start, to: e.m.input };
      }
    }
    return null;
  }

  // Ланцюжки рівня в сирих даних levels.json: продукт однієї машини стоїть у рецепті іншої.
  const chainKinds = lv => lv.machines.flatMap(([, , need]) => need.map(c => E.SYM[c] || c))
    .filter((k, i, all) => lv.machines.some(o => (E.SYM[o[3]] || o[3]) === k) && all.indexOf(k) === i);

  // Підпис до руки на черзі: куди поїде ресурс. З рівня 2 («Спільна вода»), якщо ресурс потрібен кільком
  // машинам, — хто забере першим; на рівні 1 лише сам зв'язок «ресурс → силует».
  function launchText(s, r, level = 1) {
    if (!r) return "Торкніться — ресурс поїде на кільце";
    const wanted = s.machines.filter(m => m.need.includes(r.kind)).length;
    return level >= 1 && wanted > 1 ? `Першим на шляху ${ACC[r.kind]} забере ${E.LABEL[r.machine.id]}` : "Торкніться — ресурс поїде до свого силуету";
  }

  const landed = (s, b) => !b.seating || s.time + 1e-9 >= b.seating.time + b.seating.duration;
  const onShelf = (s, k) => s.vitrine.filter(b => b.kind === k).length
    + s.bench.filter((b, i) => b && b.kind === k && s.waiting[i]).length + (s.filler.item?.kind === k ? 1 : 0);

  class Director {
    // `levels` — сирі дані levels.json; `chainLevel` — рівень із затвердженим окремим навчанням ланцюжка.
    constructor(levels, chainLevel) {
      const known = new Set();
      // Новий ланцюжок рівнів 1–5, крім рівня з власним навчанням: на рівні 4 це пудра в гель.
      this.newChain = levels.map((lv, i) => {
        const fresh = chainKinds(lv).filter(k => !known.has(k));
        chainKinds(lv).forEach(k => known.add(k));
        return i <= LAST && i !== chainLevel ? fresh[0] || null : null;
      });
      this.reset();
    }
    reset() { this.seen = new Set(); this.active = null; this.used = false; this.decided = new Set(); }
    // Власна дія гравця над посудиною лавки: удар, що на неї вказує, гасне.
    act(type, ball) {
      if (ball) this.decided.add(ball.id);
      if (this.active?.ball !== undefined && ball && this.active.ball === ball.id) this.active = null;
    }
    valid(s, b) {
      if (s.time > b.until) return false;
      if (b.id === "ring-full") return s.belt.length >= E.CAP;
      if (b.id === "cook") return s.machines.find(m => m.room === b.room)?.processing;
      if (b.seat !== undefined) { const v = s.bench[b.seat]; return v && v.id === b.ball && !s.waiting[b.seat] && s.filler.item !== v && !this.decided.has(v.id); }
      return true;
    }
    show(s, b) { this.seen.add(b.id); this.active = b; return b; }
    // Активний удар (або новий) для стану `s` рівня `level`; null — навчання нічого не додає.
    update(s, level) {
      if (level > LAST || s.result !== "playing") { this.active = null; return null; }
      const kind = this.newChain[level];
      if (kind && s.machines.some(m => m.slots.some(x => x.kind === kind && x.filled))) this.used = true;
      if (this.active && this.valid(s, this.active)) return this.active;
      this.active = null;
      const t = s.time, fresh = id => !this.seen.has(id);
      if (fresh("ring-full") && s.belt.length >= E.CAP)
        return this.show(s, { id: "ring-full", until: t + 3, text: "Кільце повне — зачекайте вільного місця" });
      if (kind) {
        const seat = s.bench.findIndex((b, i) => b && b.kind === kind && landed(s, b) && !s.waiting[i] && s.filler.item !== b && !this.decided.has(b.id));
        if (seat >= 0) {
          const ball = s.bench[seat].id, need = s.quota[kind] || 0;
          const r = route(s, kind, E.SHOP);
          const consumer = s.machines.find(m => m.need.includes(kind));
          if (fresh("chain-consumer") && r && r.machine === consumer)
            return this.show(s, { id: "chain-consumer", seat, ball, route: r, until: t + 8,
              text: `Торкніться: ${E.LABEL[kind]} поїде в ${E.LABEL[consumer.product]}` });
          if (fresh("chain-quota") && this.used && need && onShelf(s, kind) < need)
            return this.show(s, { id: "chain-quota", seat, ball, kind, until: t + 8,
              text: `Розлийте ${ACC[kind]} — її чекає вітрина` });
        }
      }
      if (level !== 0) return null;
      if (fresh("vitrine") && s.vitrine.length) {
        const k = s.vitrine[0].kind;
        return this.show(s, { id: "vitrine", kind: k, until: t + 2.5, text: s.quota[k] ? `${cap(E.LABEL[k])} на вітрині: +1 до мінімуму` : `${cap(E.LABEL[k])} на вітрині: +${s.values[k]} цінності` });
      }
      const cooking = s.machines.find(m => m.processing);
      if (fresh("cook") && cooking)
        return this.show(s, { id: "cook", room: cooking.room, until: t + 3.2, text: "Рецепт зібрано — машина варить" });
      const filled = s.machines.find(m => m.slots.some(x => x.filled && x.arrival && t >= x.arrival.time + LANDING));
      if (fresh("recipe") && filled)
        return this.show(s, { id: "recipe", room: filled.room, until: t + 2.5, text: "Силуети в цеху — рецепт машини" });
      return null;
    }
  }
  return { Director, route, launchText, chainKinds, LAST, ACC };
})();
if (typeof module !== "undefined") module.exports = ShopTutorial;
