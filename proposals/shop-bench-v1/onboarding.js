/* Tutorial hints: which single action to point at, what to say, and when to show the hand.
   Pure logic, no drawing, so the Unity port can mirror it 1:1.
   Level 1 (index 0): feed a queue; pouring is automatic (`autoPour`), a caption says so.
   Level 2 (index 1): feed, then pour with the funnel badge.
   Level 3 (index 2): the first chain — return the infusion to the ring for the cream. */
const ShopOnboarding = (() => {
  const Strategy = typeof module !== "undefined" ? require("./strategy.js") : ShopStrategy;
  const LEVELS = { 0: "naive", 1: "naive", 2: "value" };
  // Same wording in the web view and in Unity.
  const TEXT = Object.freeze({
    launch: "Торкніться черги — кулька поїде на кільце",
    pour: "Торкніться значка розливу — баночка стане на вітрину",
    return: "Поверніть настій на кільце — він піде в крем",
    note: "Готово! Баночка сама стане на вітрину"
  });
  // Own actions of a type after which that hand hides until the player is idle.
  const OWN_ACTIONS = Object.freeze({ launch: 3, pour: 1, return: 1 });
  const IDLE = 4;          // seconds of inactivity before the hand comes back

  // {type:"launch"|"return"|"pour"|"note", index, text} or null. "note" is a caption without a hand.
  function hint(session, levelIndex) {
    const mode = LEVELS[levelIndex];
    if (!mode || session.result !== "playing") return null;
    // Level 1: the first product on the bench is explained once, before anything has been shelved.
    if (session.autoPour && !session.vitrine.length && session.bench.some(Boolean))
      return { type: "note", index: -1, text: TEXT.note };
    const h = Strategy.choose(Strategy.observe(session), mode);
    return h ? { ...h, text: TEXT[h.type] } : null;
  }

  // Only on the first pass: the level is not completed yet.
  const eligible = (levelIndex, completed) => LEVELS[levelIndex] !== undefined && completed <= levelIndex;

  class Coach {
    constructor() { this.reset(); }
    reset() { this.actions = { launch: 0, pour: 0, return: 0 }; this.idle = 0; }
    act(type = "launch") { if (type in this.actions) this.actions[type]++; this.idle = 0; }
    tick(dt) { this.idle += dt; }
    // Shown at once; once the player has done this action enough times it waits for IDLE seconds of silence.
    visibleFor(type = "launch") { return type === "note" || this.actions[type] < OWN_ACTIONS[type] || this.idle >= IDLE; }
    get visible() { return this.visibleFor("launch"); }
  }
  return { hint, eligible, Coach, OWN_ACTIONS, IDLE, LEVELS, TEXT };
})();
if (typeof module !== "undefined") module.exports = ShopOnboarding;
