/* Browser campaign around the Session: a level counts as passed with its first star. */
const ShopSessionType = typeof module !== "undefined" ? require("./engine.js").Session : Session;
class ShopCampaign {
  static key = "CosmeticWorkshop.WebShopProgress.v1";

  constructor(levels, storage) {
    this.levels = levels;
    this.storage = storage;
    this.completed = 0;
    this.best = levels.map(() => 0);
    this.storageAvailable = !!storage;
    try {
      const saved = JSON.parse(storage?.getItem(ShopCampaign.key) || "null");
      if (saved?.version === 1 && Number.isInteger(saved.completed) && saved.completed >= 0 && saved.completed <= levels.length)
        this.completed = saved.completed;
      if (saved?.version === 1 && Array.isArray(saved.best))
        saved.best.slice(0, levels.length).forEach((v, i) => { if (Number.isFinite(v) && v >= 0) this.best[i] = v; });
    } catch { this.storageAvailable = false; }
    this.load(this.unlocked - 1);
  }

  get unlocked() { return Math.min(this.levels.length, this.completed + 1); }
  get finished() { return this.completed === this.levels.length; }
  get passed() { return this.session.result === "finished" && this.session.stars > 0; }
  get lost() { return this.phase === "result" && this.session.lost; }
  get canRevive() { return this.phase === "result" && this.session.canRevive; }
  get canNext() { return this.passed && this.index + 1 < this.unlocked; }

  load(index) {
    if (!Number.isInteger(index) || index < 0 || index >= this.unlocked) return false;
    this.index = index;
    this.session = new ShopSessionType(this.levels[index]);
    this.phase = "ready";
    return true;
  }

  start() { if (this.phase === "ready" || this.phase === "paused") this.phase = "playing"; }
  pause() { if (this.phase === "playing") this.phase = "paused"; }
  revive() {
    if (!this.canRevive) return false;
    if (!this.session.revive()) return false;
    this.phase = "playing";
    return true;
  }
  restart() { this.load(this.index); }
  next() { return this.canNext && this.load(this.index + 1); }

  command(action, index) {
    if (this.phase !== "playing") return;
    if (action === "launch") this.session.request(index);
    else if (action === "return") this.session.returnToBelt(index);
    else if (action === "pour") this.session.pour(index);
  }

  advance(seconds) {
    if (this.phase !== "playing") return;
    this.session.advance(seconds);
    if (this.session.result === "playing") return;
    this.phase = "result";
    this.best[this.index] = Math.max(this.best[this.index], this.session.value);
    if (this.passed && this.completed === this.index) this.completed++;
    try {
      if (this.storage) {
        this.storage.setItem(ShopCampaign.key, JSON.stringify({ version: 1, completed: this.completed, best: this.best }));
        this.storageAvailable = true;
      }
    } catch { this.storageAvailable = false; }
  }
}
if (typeof module !== "undefined") module.exports = { ShopCampaign };
