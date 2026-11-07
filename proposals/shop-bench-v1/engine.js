/* Shop-bench prototype rules.
   05.11.2026 proposal: a timed production shift without customers. Every pour lands
   on the showcase (vitrine); the level is scored by the value of its jars.
   Ring, bench, carriage and tempo are the ones approved 02–04.11.2026. */
const RAD = 120, HOR = 608, VER = 816, ARC = Math.PI * RAD / 2, LEN = 2 * HOR + 2 * VER + 4 * ARC;
// Hatch on the left straight above the lower-left corner; shop on the bottom centre.
const HATCH = (HOR + 2 * ARC + VER + HOR + ARC * 0.15) / LEN;
const SHOP = (HOR + 2 * ARC + VER + HOR * 0.5) / LEN;
const RETURN = (HOR + 2 * ARC + VER + HOR * 0.65) / LEN;
const RP = y => (HOR + ARC + y - 324) / LEN;
const LP = y => (2 * HOR + 3 * ARC + VER + 1140 - y) / LEN;
const wrap = p => p - Math.floor(p);
const fwd = (a, b) => wrap(b - a);
const sep = (a, b) => Math.min(fwd(a, b), fwd(b, a));

function point(p) {
  let d = wrap(p) * LEN;
  if (d < HOR) return [236 + d, 204]; d -= HOR;
  if (d < ARC) { const a = -Math.PI / 2 + d / RAD; return [844 + RAD * Math.cos(a), 324 + RAD * Math.sin(a)]; } d -= ARC;
  if (d < VER) return [964, 324 + d]; d -= VER;
  if (d < ARC) { const a = d / RAD; return [844 + RAD * Math.cos(a), 1140 + RAD * Math.sin(a)]; } d -= ARC;
  if (d < HOR) return [844 - d, 1260]; d -= HOR;
  if (d < ARC) { const a = Math.PI / 2 + d / RAD; return [236 + RAD * Math.cos(a), 1140 + RAD * Math.sin(a)]; } d -= ARC;
  if (d < VER) return [116, 1140 - d]; d -= VER;
  const a = Math.PI + d / RAD; return [236 + RAD * Math.cos(a), 324 + RAD * Math.sin(a)];
}

// Approved shop tempo — see MECHANICS_UK.md and design/LEVELS_UK.md.
const STEP = 0.01, CAP = 6, POS = 12, LOOP = 6, WORK = 3, PACK = 1.5, FILL_MOVE = 3;
// Fair failure: one revive per attempt adds time; the field state is kept.
const REVIVE_TIME = 20, REVIVES = 1;
const CART_HOME = 1, CART_FILL = 4.25, CART_RETURN = 1.1;
const CART_PHASES = Object.freeze({ approach: .65, grip: .35, lift: .45, carry: 1.1, release: .45 });
function carriageMotion(filler) {
  const clamp = n => Math.max(0, Math.min(1, n)), ease = n => n*n*(3-2*n);
  const elapsed = Math.max(0, filler.transferDuration-filler.transferRemaining);
  const a=CART_PHASES.approach,b=a+CART_PHASES.grip,c=b+CART_PHASES.lift,d=c+CART_PHASES.carry;
  const approach=clamp(elapsed/a),grip=clamp((elapsed-a)/CART_PHASES.grip);
  const lift=clamp((elapsed-b)/CART_PHASES.lift),carry=clamp((elapsed-c)/CART_PHASES.carry),release=clamp((elapsed-d)/CART_PHASES.release);
  const source=filler.from,start=filler.carriageFrom??CART_HOME;
  const position=elapsed<a?start+(source-start)*ease(approach):source+(CART_FILL-source)*ease(carry);
  return {position,approach,grip,lift,carry,release,picked:elapsed+1e-9>=b};
}
const SYM = { "Р": "Chamomile", "В": "Water", "О": "Oil", "Т": "Wax", "Л": "Lavender", "А": "Aloe", "М": "Honey", "С": "Salt", "н": "Infusion", "к": "Cream", "п": "Powder", "г": "Gel", "л": "Lotion", "с": "Scrub" };
const JAR = { "н": "Infusion", "к": "Cream", "п": "Powder", "г": "Gel", "л": "Lotion", "с": "Scrub" };
const PRODUCTS = ["Infusion", "Cream", "Powder", "Gel", "Lotion", "Scrub"];
const LABEL = {
  Chamomile: "ромашка", Water: "вода", Oil: "олійка", Wax: "віск", Lavender: "лаванда", Aloe: "алое", Honey: "мед", Salt: "сіль",
  Infusion: "настій", Cream: "крем", Powder: "пудра", Gel: "гель", Lotion: "лосьйон", Scrub: "скраб",
  Heating: "нагрів", Mixer: "змішувач", Mill: "млин", Cooling: "охолодження", Emulsifier: "емульгатор"
};

const ROOM_PORTS = {
  UL: [LP(608), LP(386)],
  UR: [RP(386), RP(608)],
  LL: [LP(1072), LP(850)],
  LR: [RP(850), RP(1072)]
};
const portsFor = (id, room) => id === "Mill" && room === "LL" ? [LP(850), LP(1072)] : ROOM_PORTS[room];

// Value of one jar on the showcase; a level may override it with `values`.
const VALUES = Object.freeze({ Infusion: 1, Powder: 2, Gel: 2, Cream: 4, Lotion: 3, Scrub: 3 });

class Machine {
  constructor(id, room, silhouettes, product) {
    const [input, output] = portsFor(id, room);
    Object.assign(this, { id, room, product, input, output });
    this.need = silhouettes.map(s => SYM[s] || s);
    this.slots = this.need.map(kind => ({ kind, filled: false }));
    this.started = 0;
    this.out = null;
    this.remaining = 0;
  }
  get processing() { return this.remaining > 0; }
  get progress() { return this.processing ? 1 - this.remaining / WORK : 0; }
  get full() { return this.slots.every(s => s.filled); }
  // No batch limit: a machine keeps accepting while the shift lasts.
  get open() { return !this.processing && !this.out && !this.full; }
  wants() {
    if (!this.open) return [];
    const kinds = [];
    for (const s of this.slots) if (!s.filled && !kinds.includes(s.kind)) kinds.push(s.kind);
    return kinds;
  }
  accepts(kind) { return this.wants().includes(kind); }
  take(kind) {
    const slot = this.slots.find(s => !s.filled && s.kind === kind);
    if (!slot) return false;
    slot.filled = true;
    if (this.full) { this.remaining = WORK; this.started++; }
    return true;
  }
  complete(dt) {
    if (!this.processing) return null;
    this.remaining = Math.max(0, this.remaining - dt);
    if (this.remaining > 1e-9) return null;
    this.remaining = 0;
    for (const s of this.slots) { s.filled = false; delete s.arrival; }
    return this.product;
  }
}

class Session {
  constructor(level) {
    this.level = level;
    this.rows = level.queues.map(r => [...(r || "")].map(c => ({ kind: SYM[c] })));
    // Minimum the shift must deliver, by product; more is always allowed.
    this.quota = Object.fromEntries(Object.entries(level.quota || {}).map(([k, n]) => [JAR[k] || k, n]));
    this.values = { ...VALUES, ...Object.fromEntries(Object.entries(level.values || {}).map(([k, v]) => [JAR[k] || k, v])) };
    this.reset();
  }

  reset() {
    this.acc = 0;
    this.bonusTime = 0;
    this.revivesLeft = REVIVES;
    this.id = 0;
    this.time = 0;
    this.started = false;
    this.result = "playing";
    this.vitrine = [];
    this.lastFilled = null;
    this.belt = [];
    this.requests = [];
    this.returns = [];
    this.pours = [];
    this.queues = this.rows.map(r => r.map(b => this.ball(b.kind)));
    this.machines = this.level.machines.map(([id, room, sil, prod]) =>
      new Machine(id, room, sil, JAR[prod] || prod));
    this.bench = [null, null, null, null];
    this.waiting = [false, false, false, false];
    this.carriage = { position: CART_HOME, returnFrom: CART_HOME, returnRemaining: 0 };
    this.filler = { item: null, remaining: 0, from: -1, transferRemaining: 0, transferDuration: FILL_MOVE };
    this.ports = this.machines.map(m => ({ kind: "machine", machine: m, pos: m.input }))
      .concat([{ kind: "shop", pos: SHOP }]);
  }

  ball(kind) { return { id: ++this.id, kind, pos: 0 }; }
  get shift() { return (this.level.shift || 0) + this.bonusTime; }
  get timeLeft() { return Math.max(0, this.shift - this.time); }
  get value() { return this.vitrine.reduce((sum, b) => sum + (this.values[b.kind] || 0), 0); }
  count(kind) { return this.vitrine.filter(b => b.kind === kind).length; }
  // Jars still missing from the minimum, by product.
  get missing() {
    return Object.fromEntries(Object.entries(this.quota).map(([k, n]) => [k, Math.max(0, n - this.count(k))]).filter(([, n]) => n > 0));
  }
  get quotaMet() { return Object.keys(this.missing).length === 0; }
  // First star: the minimum. Further stars: total showcase value against `bonus` thresholds.
  get stars() { return this.quotaMet ? 1 + (this.level.bonus || []).filter(t => this.value >= t).length : 0; }
  // Honest failure: the shift is over and the minimum was not delivered.
  get lost() { return this.result === "finished" && !this.quotaMet; }
  get missingCount() { return Object.values(this.missing).reduce((a, n) => a + n, 0); }
  get nearMiss() { return this.lost && this.missingCount <= 1; }
  // Revive only after the timer ran out; an exhausted field cannot be helped by time.
  get canRevive() { return this.lost && this.revivesLeft > 0 && this.time >= this.shift - 1e-9; }
  // V1 placeholder: free. A rewarded ad / IAP hook would gate this call later.
  revive() {
    if (!this.canRevive) return false;
    this.bonusTime += REVIVE_TIME;
    this.revivesLeft--;
    this.result = "playing";
    return true;
  }
  // Nothing can change any more: every queue used up and the field is empty.
  get exhausted() {
    return this.queues.every(q => !q.length) && !this.filler.item && this.bench.every(b => !b) &&
      this.machines.every(m => !m.processing && !m.out) &&
      this.belt.length === 0;
  }
  // Tutorial level: a product that has landed on the bench is poured by itself; no return to the ring.
  get autoPour() { return !!this.level.autoPour; }
  get canLaunch() { return this.result === "playing" && this.belt.length < CAP; }

  request(q) { if (this.result === "playing") this.requests.push(q); }
  returnToBelt(i) { if (this.result === "playing" && !this.autoPour) this.returns.push(i); }
  pour(i) { if (this.result === "playing") this.pours.push(i); }

  canInsert(p) {
    if (this.belt.length >= CAP) return false;
    for (const b of this.belt) if (sep(b.pos, p) < 1 / POS - 1e-9) return false;
    return true;
  }

  insertPos(preferred) {
    if (!this.canLaunch) return null;
    if (this.canInsert(preferred)) return preferred;
    let best = null, near = Infinity;
    const s = 1 / POS;
    for (const b of this.belt) for (const side of [s, -s]) {
      const c = wrap(b.pos + side), d = sep(preferred, c);
      if (this.canInsert(c) && (d < near - 1e-9 || (Math.abs(d - near) <= 1e-9 && fwd(preferred, c) < fwd(preferred, best || preferred)))) {
        best = c; near = d;
      }
    }
    return best;
  }

  advance(sec) {
    this.acc += sec;
    while (this.acc + 1e-10 >= STEP) { this.acc -= STEP; this.tick(STEP); }
  }

  // finish cook/pour -> age patience -> move belt (machine then shop by path) -> launches/returns/pours -> emit -> win/left
  tick(dt) {
    if (this.result !== "playing") {
      this.requests.length = 0; this.returns.length = 0; this.pours.length = 0;
      return;
    }
    if (this.started) {
      this.time += dt;
      for (const m of this.machines) {
        const product = m.complete(dt);
        if (product) m.out = this.ball(product);
      }
      this.tickFiller(dt);
      this.move(dt / LOOP);
    }
    this.applyLaunches();
    this.applyReturns();
    this.applyPours();
    for (const m of this.machines) this.emit(m);
    // The shift ends on its timer; only jars already on the showcase count.
    if ((this.started && this.shift && this.time >= this.shift - 1e-9) || (this.started && this.exhausted)) this.result = "finished";
  }

  tickFiller(dt) {
    if (this.carriage.returnRemaining > 0) {
      this.carriage.returnRemaining = Math.max(0,this.carriage.returnRemaining-dt);
      const u = 1-this.carriage.returnRemaining/CART_RETURN, ease = u*u*(3-2*u);
      this.carriage.position = this.carriage.returnFrom+(CART_HOME-this.carriage.returnFrom)*ease;
    }
    const f = this.filler;
    if (!f.item) return;
    if (f.transferRemaining > 0) {
      const used = Math.min(dt, f.transferRemaining);
      f.transferRemaining = Math.max(0, f.transferRemaining - used);
      if (f.transferRemaining < 1e-9) f.transferRemaining = 0;
      const motion = carriageMotion(f);
      this.carriage.position = motion.position;
      if (motion.picked && this.bench[f.from] === f.item) this.bench[f.from] = null;
      if (f.transferRemaining === 0) {
        this.carriage.position = CART_FILL;
        this.carriage.returnFrom = CART_FILL;
        this.carriage.returnRemaining = CART_RETURN;
      }
      dt -= used;
      if (dt < 1e-9) return;
    }
    f.remaining = Math.max(0, f.remaining - dt);
    if (f.remaining > 1e-9) return;
    // Every pour lands on the showcase.
    f.item.shelved = this.time;
    this.vitrine.push(f.item);
    this.lastFilled = { kind: f.item.kind, time: this.time };
    f.item = null; f.from = -1; f.transferRemaining = 0;
    this.startNextPour();
  }

  move(dist) {
    const ev = [];
    for (const b of this.belt) {
      this.ports.forEach((port, i) => {
        let d = fwd(b.pos, port.pos);
        if (d < 1e-9) d = 1;
        if (d <= dist + 1e-9) ev.push({ d, b, i });
      });
      b.pos = wrap(b.pos + dist);
      if (b.queue !== undefined) b.travel = (b.travel || 0) + dist;
    }
    ev.sort((a, c) => a.d !== c.d ? a.d - c.d : a.b.id - c.b.id);
    for (const e of ev) {
      if (!this.belt.includes(e.b)) continue;
      const port = this.ports[e.i];
      if (port.kind === "machine") this.intake(port.machine, e.b);
      else this.seat(e.b);
    }
    // Raw nobody took during a full loop goes back to the end of its own queue,
    // so surplus never jams the ring.
    for (const b of this.belt.slice()) if (b.queue !== undefined && b.travel >= 1 - 1e-9) {
      this.belt.splice(this.belt.indexOf(b), 1);
      delete b.travel; delete b.queue;
      this.queues[b.from].push(b);
      b.recycled = (b.recycled || 0) + 1;
    }
  }

  intake(m, b) {
    if (!m.accepts(b.kind)) return;
    const slot = m.slots.find(s => !s.filled && s.kind === b.kind);
    this.belt.splice(this.belt.indexOf(b), 1);
    m.take(b.kind);
    // Record the exact claimed slot; repeated ingredients have independent arrivals.
    slot.arrival = { id: b.id, time: this.time, pos: m.input };
  }

  seat(b) {
    if (!PRODUCTS.includes(b.kind)) return;
    const i = this.bench.findIndex(x => !x);
    if (i < 0) return;
    this.belt.splice(this.belt.indexOf(b), 1);
    this.bench[i] = b;
    b.seating = { seat: i, time: this.time, pos: SHOP, duration: .65 };
    this.waiting[i] = false;
  }

  emit(m) {
    if (!m.out) return;
    const seat = this.bench.findIndex(item => !item);
    if (seat < 0) return;
    const b = m.out;
    m.out = null;
    delete b.departure;
    b.seating = { seat, time: this.time, room: m.room, duration: .65 };
    this.bench[seat] = b;
    this.waiting[seat] = false;
  }

  applyLaunches() {
    while (this.requests.length) {
      const index = this.requests.shift(), q = this.queues[index];
      const b = q && q[0];
      const p = b ? this.insertPos(HATCH) : null;
      if (b && p !== null) {
        q.shift();
        b.pos = p; b.queue = index; b.from = index; b.travel = 0;
        this.belt.push(b);
        this.started = true;
      }
    }
  }

  applyReturns() {
    while (this.returns.length) {
      const i = this.returns.shift();
      const b = this.bench[i];
      if (!b || this.waiting[i] || this.filler.item === b) continue;
      const p = this.insertPos(SHOP);
      if (p === null) continue;
      this.bench[i] = null;
      this.waiting[i] = false;
      b.pos = p;
      this.belt.push(b);
      this.started = true;
    }
  }

  applyPours() {
    if (this.autoPour) this.bench.forEach((b, i) => {
      const landed = b && (!b.seating || this.time + 1e-9 >= b.seating.time + b.seating.duration);
      if (landed && !this.waiting[i] && this.filler.item !== b) this.pours.push(i);
    });
    while (this.pours.length) {
      const i = this.pours.shift();
      if (!this.bench[i] || this.waiting[i] || this.filler.item === this.bench[i]) continue;
      this.waiting[i] = true;
      this.started = true;
    }
    this.startNextPour();
  }

  startNextPour() {
    if (this.filler.item) return;
    const i = this.waiting.findIndex((w, idx) => w && this.bench[idx]);
    if (i < 0) return;
    const b = this.bench[i];
    // Keep the seat occupied until the gripper has actually picked this vessel up.
    this.waiting[i] = false;
    this.carriage.returnRemaining = 0;
    this.filler = { item: b, remaining: PACK, from: i,
      transferRemaining: FILL_MOVE, transferDuration: FILL_MOVE, carriageFrom: this.carriage.position };
  }
}

if (typeof module !== "undefined") {
  module.exports = {
    REVIVE_TIME, REVIVES, Session, Machine, VALUES, point, HATCH, SHOP, RETURN, LEN, CAP, LOOP, PACK, WORK, STEP, FILL_MOVE, CART_HOME, CART_FILL, CART_RETURN, CART_PHASES, carriageMotion, PRODUCTS, LABEL, SYM, JAR
  };
}
