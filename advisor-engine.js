(() => {
  "use strict";
  const weights = { structure:5, clarity:4, current:4, trend:3, wind:2, forage:2, light:1 };

  function recommend(advisor, selections) {
    const candidates = advisor.profiles.filter(profile => profile.water === selections.water && profile.targets.includes(selections.target));
    const pool = candidates.length ? candidates : advisor.profiles.filter(profile => profile.water === selections.water && profile.targets.includes("general"));
    const signals = ["structure","clarity","trend","wind","forage","light"];
    if (selections.water === "salt") signals.push("current");
    const ranked = pool.map((profile, index) => {
      const matched = signals.filter(key => profile.tags.includes(selections[key]));
      return {profile, matched, score:matched.reduce((total, key) => total + weights[key], 0), index};
    }).sort((a, b) => b.score - a.score || a.index - b.index);
    const best = ranked[0];
    if (!best) return null;
    const fit = best.score >= 14 ? "Strong pattern fit" : best.score >= 9 ? "Moderate pattern fit" : "Broad starting point";
    return {...best, fit};
  }

  function choices(advisor, key, water) {
    const collections = {target:"targets",structure:"structures",forage:"forage"};
    return advisor[collections[key]]?.[water] || [];
  }

  window.TACKLEBOX_ADVISOR_ENGINE = {recommend,choices};
})();