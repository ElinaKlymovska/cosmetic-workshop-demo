/* Watch the real level through the same commands as a player. */
const ShopDemo = (() => {
  const Strategy = typeof module !== "undefined" ? require("./strategy.js") : ShopStrategy;
  const pendingTime = new WeakMap(), nextAction = new WeakMap();
  // One visible-state decision every 0.4 s of game time, like a quick player.
  const INTERVAL = .4;
  function command(game) {
    const s = game.session;
    if (s.time + 1e-9 < (nextAction.get(s) ?? 0)) return;
    nextAction.set(s, s.time + INTERVAL);
    const action = Strategy.choose(Strategy.observe(s), "value");
    if (action) game.command(action.type, action.index);
  }
  function advance(game, seconds) {
    if (game.phase !== "playing") return;
    const session = game.session;
    let pending = (pendingTime.get(session) || 0) + seconds;
    // Issue commands once per simulation tick, even when display frames are shorter.
    while (pending + 1e-10 >= .01 && game.phase === "playing") {
      command(game);
      game.advance(.01);
      pending -= .01;
    }
    pendingTime.set(session, Math.max(0, pending));
  }
  return { advance };
})();
if (typeof module !== "undefined") module.exports = { ShopDemo };
