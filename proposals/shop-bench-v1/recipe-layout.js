/* Loose silhouettes in the room, with no cells; coordinates are relative to the room. */
const ShopRecipeLayout = (() => {
  function slots(count, variant = 0) {
    if (!Number.isInteger(count) || count < 1 || count > 8)
      throw new RangeError("A recipe has one to eight silhouettes.");
    // Stable scattered positions: silhouettes never jump when an ingredient arrives.
    // Dense sets use the free space beside the machine as well as the space above it.
    const positions = {
      1: [[138,116,88,-4]],
      2: [[79,105,86,-5],[198,139,80,5]],
      3: [[64,94,82,-5],[209,91,86,5],[138,160,78,-4]],
      4: [[72,90,82,-6],[201,96,78,5],[59,169,76,4],[211,169,80,-5]],
      5: [[46,86,76,-5],[139,88,82,6],[231,91,74,-4],[78,168,78,4],[206,171,80,-5]],
      6: [[46,88,78,-6],[141,85,76,5],[232,92,80,-4],[43,173,74,4],[138,159,72,-5],[234,175,76,5]],
      7: [[51,92,80,-5],[145,86,76,5],[232,96,74,-4],[51,168,72,4],[221,173,78,-5],[39,245,70,-4],[242,245,68,5]],
      8: [[48,90,80,-5],[144,81,74,6],[231,94,78,-4],[42,174,72,4],[139,160,70,-6],[235,176,74,5],[40,249,70,-4],[241,247,70,5]]
    }[count];
    return positions.map(([x,y,size,angle]) => ({
      x:(variant%2 ? 276-x : x)-size/2, y:y-size, size, angle:variant%2 ? -angle : angle
    }));
  }
  return { slots };
})();
if (typeof module !== "undefined") module.exports = ShopRecipeLayout;
