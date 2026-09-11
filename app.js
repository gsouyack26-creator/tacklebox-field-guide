(() => {
  "use strict";
  const data = window.TACKLEBOX_DATA;
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const safeLoad = (key, fallback, isValid = () => true) => {
    try { const value = JSON.parse(localStorage.getItem(key)); return value != null && isValid(value) ? value : fallback; }
    catch { return fallback; }
  };
  const safeSave = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} };
  const advisorDefault = {water:"fresh",target:"general",trend:"stable",clarity:"stained",wind:"moderate",structure:"open",forage:"unknown",current:"moderate",light:"day",trouble:"none"};
  const sessionDefault = {water:"fresh",target:"general",access:"any",structureId:"point-fresh",trend:"stable",clarity:"stained",wind:"moderate",forage:"unknown",current:"moderate",light:"day",trouble:"none"};
  const validSession = value => value && typeof value === "object" && ["fresh","salt"].includes(value.water) && typeof value.structureId === "string";
  const validSavedSessions = value => Array.isArray(value) && value.every(item => item && typeof item.id === "string" && validSession(item.selections));
  const state = {
    water: "all", season: "all", access: "all", search: "", group: "all",
    savedOnly: false, saved: new Set(safeLoad("tacklebox-saved", [], Array.isArray)), compare: new Set(),
    manualSpecies: "striper", hotspotSpecies: "all",
    nj: safeLoad("tacklebox-nj", { species: data.nj.defaultSpecies, values: {} }, value => value && typeof value === "object" && typeof value.species === "string" && value.values && typeof value.values === "object"),
    advisor: safeLoad("tacklebox-advisor", advisorDefault, value => value && typeof value === "object" && typeof value.water === "string"),
    session: safeLoad("tacklebox-session", sessionDefault, validSession),
    savedSessions: safeLoad("tacklebox-session-plans", [], validSavedSessions).slice(0, 5)
  };
  const modules = [
    {id:"home", label:"Home", group:"Fish now"},
    {id:"advisor", label:"Conditions Advisor", group:"Fish now"},
    {id:"session", label:"Build My Session", group:"Fish now"},
    {id:"how-to", label:"How-To", group:"Fish now"},
    {id:"setups", label:"Recommended Setups", group:"Fish now"},
    {id:"nj-playbook", label:"NJ Playbook", group:"Fish now"},
    {id:"water-reading", label:"Water Reading", group:"Fish now"},
    {id:"rigs", label:"Rigs & Knots", group:"Fish now"},
    {id:"areas", label:"Fishing Areas", group:"Plan & reference"},
    {id:"regulations", label:"Regulations", group:"Plan & reference"},
    {id:"library", label:"Technique Library", group:"Plan & reference"},
    {id:"quiver", label:"Practical Quiver", group:"Plan & reference"},
    {id:"seasons", label:"Seasonal Compass", group:"Plan & reference"},
    {id:"notes", label:"Field Notes", group:"Plan & reference"},
    {id:"sources", label:"Sources & Limits", group:"Plan & reference"}
  ];
  const moduleIds = new Set(modules.map(item => item.id));
  const elements = {
    grid: $("#technique-grid"), empty: $("#empty-state"), status: $("#result-status"),
    groupFilters: $("#technique-filters"), season: $("#season-filter"), access: $("#access-filter"), search: $("#search-filter"),
    compareButton: $("#compare-button"), compareCount: $("#compare-count"), detail: $("#detail-dialog"), compare: $("#compare-dialog"),
    detailContent: $("#detail-content"), compareContent: $("#compare-content"), toast: $("#toast")
  };

  const lureProducts = window.TACKLEBOX_LURE_PRODUCTS || [];
  const advisor = window.TACKLEBOX_ADVISOR;
  const advisorEngine = window.TACKLEBOX_ADVISOR_ENGINE;
  const moduleMedia = matchMedia("(min-width: 62rem)");
  function setModuleMenu(isOpen) {
    const open = isOpen && !moduleMedia.matches;
    document.body.classList.toggle("module-menu-open", open);
    $("#module-menu-button").setAttribute("aria-expanded", String(open));
    const sidebar = $("#module-sidebar");
    sidebar.setAttribute("aria-hidden", String(!moduleMedia.matches && !open));
    sidebar.inert = !moduleMedia.matches && !open;
    $("#module-scrim").hidden = !open;
    if (open) requestAnimationFrame(() => $("#module-nav a")?.focus());
  }

  function activateModule(id, shouldFocus = false) {
    if (!moduleIds.has(id)) id = "home";
    $$(`[data-module]`).forEach(section => { section.hidden = section.dataset.module !== id; });
    $$(`[data-module-link]`).forEach(link => {
      link.toggleAttribute("aria-current", link.dataset.moduleLink === id);
    });
    safeSave("tacklebox-module", id);
    const module = modules.find(item => item.id === id);
    document.title = `${module.label} | Striper Tacklebox`;
    setModuleMenu(false);
    scrollTo(0, 0);
    if (shouldFocus) {
      const section = $(`[data-module="${id}"]`);
      section?.setAttribute("tabindex", "-1");
      section?.focus({preventScroll:true});
    }
  }

  function navigateModule(id, shouldFocus = true) {
    if (!moduleIds.has(id)) id = "home";
    if (location.hash === `#${id}`) activateModule(id, shouldFocus);
    else location.hash = id;
  }

  function renderModuleNav() {
    let group = "";
    $("#module-nav").innerHTML = modules.map((item, index) => {
      const heading = item.group === group ? "" : `<p>${escapeHtml(item.group)}</p>`;
      group = item.group;
      return `${heading}<a href="#${item.id}" data-module-link="${item.id}"><span>${String(index + 1).padStart(2, "0")}</span>${escapeHtml(item.label)}</a>`;
    }).join("");
  }

  const escapeHtml = value => String(value).replace(/[&<>"\x27]/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","\x27":"&#39;"}[char]));
  const techniqueById = id => data.techniques.find(item => item.id === id);
  const filteredTechniques = () => data.techniques.filter(item => {
    const haystack = [item.name, item.summary, item.group, ...item.species, ...item.lures.flatMap(lure => [lure.name, lure.when])].join(" ").toLowerCase();
    return (state.water === "all" || item.water === state.water)
      && (state.season === "all" || item.seasons.includes(state.season))
      && (state.access === "all" || item.access.includes(state.access))
      && (state.group === "all" || item.group === state.group)
      && (!state.search || haystack.includes(state.search.toLowerCase()))
      && (!state.savedOnly || state.saved.has(item.id));
  });

  const speciesLabels = { all: "All targets", striper: "Striped bass", fluke: "Fluke", bluefish: "Bluefish", sheeps: "Sheepshead" };
  const manual = data.manual;
  const knotSvg = id => {
    const paths = {
      palomar: `<path d="M18 56h115c35 0 31-38 65-38s32 38 65 38h239"/><path class="working" d="M198 18c-38 17-36 64 5 73 46 10 81-36 48-65-22-19-60-3-49 24 8 20 38 21 53 8"/>`,
      "improved-clinch": `<path d="M18 58h130c40 0 38-42 75-42s34 42 71 42h208"/><path class="working" d="M219 17c-18 18-18 60 7 76M231 22c-18 18-18 52 5 67M243 28c-15 17-14 42 4 56"/>`,
      loop: `<path d="M18 61h125c32 0 32-46 69-46s39 46 75 46h215"/><path class="working" d="M212 15c-42 10-48 68-8 79 39 11 67-31 45-55-17-19-48-4-37 18 7 15 28 15 40 4"/>`,
      "double-uni": `<path d="M15 39h155c24 0 28 38 58 38h274"/><path class="working" d="M15 78h145c32 0 35-39 68-39h274M176 31c-20 12-19 45 7 53M193 28c-20 17-16 47 8 55M228 34c18 10 22 34 5 49M247 34c18 14 19 36 2 50"/>`,
      "dropper-loop": `<path d="M18 57h170c29 0 29-40 64-40s35 40 67 40h183"/><path class="working" d="M252 17v80M230 31c21 10 21 43 0 54M272 31c-21 10-21 43 0 54"/>`
    };
    return `<svg class="instruction-svg" viewBox="0 0 520 110" aria-hidden="true">${paths[id] || paths.loop}</svg>`;
  };
  const ordered = items => `<ol class="instruction-steps">${items.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ol>`;

  const videoMarkup = (video, knotName) => {
    if (!video || !/^[A-Za-z0-9_-]{11}$/.test(video.id)) return "";
    const watchUrl = `https://www.youtube.com/watch?v=${video.id}`;
    return `<section class="detail-section knot-video"><h3>Video tutorial</h3><p><strong>${escapeHtml(video.title)}</strong><br><span>By ${escapeHtml(video.channel)} · requires an internet connection</span></p><div class="video-facade" data-video-container><button type="button" data-video-id="${escapeHtml(video.id)}" data-video-title="${escapeHtml(knotName)}">▶ Load YouTube tutorial</button><p class="video-offline" ${navigator.onLine ? "hidden" : ""}>You are offline. Use the diagram and numbered steps above.</p></div><a href="${escapeHtml(watchUrl)}" target="_blank" rel="noopener noreferrer">Open directly on YouTube</a><p class="video-privacy">YouTube does not receive a request until you press the load button.</p></section>`;
  };

  const productExamplesMarkup = (field, id) => {
    const products = lureProducts.filter(item => item[field]?.includes(id));
    if (!products.length) return "";
    return `<details class="product-examples"><summary>Actual lure examples (${products.length})</summary><div>${products.map(item => `<article><span>${escapeHtml(item.maker)}</span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.spec)}</small><p>${escapeHtml(item.use)}</p><a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">Official product page</a></article>`).join("")}</div><p>Examples only. Not ranked, sponsored, or affiliate-linked. Match size and weight to the rod, depth, current, forage, and local rules.</p></details>`;
  };

  const rodOptionsMarkup = profile => !profile.rodOptions?.length ? "" : `<details class="rod-options"><summary>Other recommended rods</summary><ul>${profile.rodOptions.map(rod => `<li><a href="${escapeHtml(rod.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(rod.name)}</a></li>`).join("")}</ul></details>`;

  const setupMarkup = procedureId => {
    const profile = manual.setupProfiles[manual.setupMap[procedureId]];
    if (!profile) return "";
    const tierOrder = {budget:0, mid:1, high:2};
    const tiers = [...profile.tiers].sort((a,b) => tierOrder[a.tier] - tierOrder[b.tier]);
    return `<details class="setup-examples"><summary>Budget, Mid-tier & High-tier setups</summary><p class="setup-profile-name">${escapeHtml(profile.name)} · examples, not universal best choices</p><div class="setup-tier-list">${tiers.map(tier => `<article class="setup-tier"><div><span class="setup-tier-label">${escapeHtml(tier.label)}</span><strong>${escapeHtml(tier.rod)}</strong></div><p><b>Primary reel:</b> ${escapeHtml(tier.reel)}</p><p><b>Penn / Shimano / Daiwa options:</b> ${escapeHtml(tier.reelOptions.join(" · "))}</p><p><b>Line:</b> ${escapeHtml(tier.line)}</p><p>${escapeHtml(tier.fit)}</p><a href="${escapeHtml(tier.url)}" target="_blank" rel="noopener noreferrer">Verify rod specs</a></article>`).join("")}</div>${rodOptionsMarkup(profile)}<p class="setup-disclosure"><strong>Examples, not endorsements.</strong> Not sponsored. No affiliate links, referral codes, or commission. Reel size numbers are not standardized across Penn, Shimano, and Daiwa; compare capacity, drag, weight, and balance before buying.</p><div class="setup-brand-links">${Object.values(manual.brandLinks).map(brand => `<a href="${escapeHtml(brand.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(brand.label)} manufacturer site</a>`).join("")}</div></details>`;
  };

  function procedureMarkup(item) {
    const knot = manual.knots[item.knot]; const rig = manual.rigs[item.rig];
    return `<article class="detail-inner howto-detail"><p class="section-kicker">${escapeHtml(speciesLabels[item.species])} · Field procedure</p><h2>${escapeHtml(item.title)}</h2><p class="detail-deck">${escapeHtml(item.when)}</p><section class="detail-section"><h3>Working setup</h3><p>${escapeHtml(item.setup)}</p></section><section class="detail-section"><h3>1. Where and how to cast</h3>${ordered(item.cast)}</section><section class="detail-section"><h3>2. Retrieve or present the bait</h3>${ordered(item.retrieve)}</section><section class="detail-section"><h3>3. Bite and hookset</h3><p>${escapeHtml(item.hookset)}</p></section><section class="detail-section diagram-section"><h3>4. Build the ${escapeHtml(rig.name)}</h3><div class="rig-chain">${rig.parts.map((part,index) => `<span><b>${index + 1}</b>${escapeHtml(part)}</span>`).join("")}</div></section><section class="detail-section diagram-section"><h3>5. Tie the ${escapeHtml(knot.name)}</h3><p>${escapeHtml(knot.use)}</p>${knotSvg(item.knot)}${ordered(knot.steps)}<aside class="nj-caution"><strong>Avoid</strong><span>${escapeHtml(knot.avoid)}</span></aside></section>${videoMarkup(knot.video, knot.name)}<aside class="tip-callout"><strong>Most common mistake</strong><br>${escapeHtml(item.mistakes)}</aside>${productExamplesMarkup("procedures", item.id)}${setupMarkup(item.id)}</article>`;
  }

  const advisorOptionMarkup = options => options.map(([value,label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`).join("");

  function advisorSelections() {
    return Object.fromEntries(["water","target","trend","clarity","wind","structure","forage","current","light","trouble"].map(key => [key, $(`#advisor-${key}`).value]));
  }

  function populateAdvisorChoices() {
    const water = $("#advisor-water").value;
    for (const key of ["target","structure","forage"]) {
      const select = $(`#advisor-${key}`);
      const options = advisorEngine.choices(advisor, key, water);
      const preferred = state.advisor[key];
      select.innerHTML = advisorOptionMarkup(options);
      select.value = options.some(option => option[0] === preferred) ? preferred : options[0][0];
    }
    $("#advisor-current-field").hidden = water !== "salt";
  }

  function renderAdvisor() {
    const selections = advisorSelections();
    state.advisor = selections;
    safeSave("tacklebox-advisor", selections);
    const match = advisorEngine.recommend(advisor, selections);
    if (!match) { $("#advisor-result").innerHTML = `<p>No matching pattern found. Open the Technique Library for the broad guide.</p>`; return; }
    const technique = techniqueById(match.profile.technique);
    const trouble = advisor.trouble[selections.trouble];
    const adjustments = [
      advisor.adjustments.trend[selections.trend], advisor.adjustments.clarity[selections.clarity],
      advisor.adjustments.wind[selections.wind], selections.water === "salt" ? advisor.adjustments.current[selections.current] : "",
      advisor.adjustments.light[selections.light], advisor.adjustments.forage[selections.forage]
    ].filter(Boolean);
    const procedureId = advisor.procedureByTarget[selections.target];
    $("#advisor-result").innerHTML = `<p class="advisor-fit">${escapeHtml(match.fit)} · ${match.matched.length} signals matched</p><h3>${escapeHtml(technique.name)}</h3><div class="advisor-primary"><span>Start with</span><strong>${escapeHtml(match.profile.lure)}</strong><p>${escapeHtml(match.profile.presentation)}</p></div><section><h4>Why this pattern</h4><p>${escapeHtml(match.profile.why)}</p></section><section><h4>Tune it to today</h4><ul>${adjustments.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul></section><aside class="advisor-adjust"><strong>First controlled adjustment</strong><p>${escapeHtml(trouble.action)}</p><small>${escapeHtml(trouble.check)}</small></aside><div class="advisor-actions"><button type="button" data-open="${escapeHtml(technique.id)}">Open technique card</button>${procedureId ? `<button type="button" data-procedure="${escapeHtml(procedureId)}">Open NJ how-to</button>` : ""}</div>${productExamplesMarkup("techniques", technique.id)}`;
    $("#advisor-caveat").textContent = advisor.caveat;
  }

  function initializeAdvisor() {
    for (const key of ["water","trend","clarity","wind","current","light"]) {
      const select = $(`#advisor-${key}`);
      if ([...select.options].some(option => option.value === state.advisor[key])) select.value = state.advisor[key];
    }
    $("#advisor-trouble").innerHTML = advisorOptionMarkup(Object.entries(advisor.trouble).map(([id,item]) => [id,item.label]));
    $("#advisor-trouble").value = advisor.trouble[state.advisor.trouble] ? state.advisor.trouble : "none";
    populateAdvisorChoices();
    renderAdvisor();
  }

  const sessionStructureCategory = {
    "point-fresh":"wood-rock", "flat-edge":"deep-current", "submerged-wood":"wood-rock",
    "creek-seam":"deep-current", "dam-tailwater":"deep-current", "weed-edge":"vegetation",
    "surf-trough":"open-beach", "inlet-rip":"inlet-current", "jetty-base":"bridge-jetty",
    "bridge-shadow":"bridge-jetty", "bar-tip":"open-beach", "creek-mouth-salt":"bay-flat"
  };
  const sessionSafety = {
    "point-fresh":"Confirm footing and depth changes before wading; rock edges can drop quickly.",
    "flat-edge":"Watch wind drift and changing depth, especially from a kayak or small boat.",
    "submerged-wood":"Keep the cast outside visible limbs first; do not climb or wade into unstable timber.",
    "creek-seam":"Current strength and footing can change within one step; wear a PFD where appropriate.",
    "dam-tailwater":"Obey exclusion zones and discharge warnings. Flow can change without notice.",
    "weed-edge":"Avoid entering dense vegetation or soft bottom without confirming a safe return path.",
    "surf-trough":"Read the beach at low tide when possible; never turn your back on breaking waves.",
    "inlet-rip":"Know the exit route before fishing. Surge, sweep, and slick rock can intensify quickly.",
    "jetty-base":"Use appropriate traction, stay back from wash, and never step onto wet rock for a cast.",
    "bridge-shadow":"Stay clear of traffic, restricted areas, overhead hazards, and marked navigation channels.",
    "bar-tip":"Bars can flood behind you on a rising tide; track the return route continuously.",
    "creek-mouth-salt":"Current reversals, soft mud, and rising water can cut off wading routes quickly."
  };
  const sessionKeys = ["water","target","access","structureId","trend","clarity","wind","forage","current","light","trouble"];
  const sessionSelections = () => Object.fromEntries(sessionKeys.map(key => [key, $(`#session-${key === "structureId" ? "structure" : key}`).value]));
  const optionLabel = (options, value) => options.find(option => option[0] === value)?.[1] || value;
  const sessionStructure = selections => (data.structures || []).find(item => item.id === selections.structureId);

  function sessionPlan(selections) {
    const structure = sessionStructure(selections);
    if (!structure) return null;
    const engineSelections = {...selections, structure:sessionStructureCategory[structure.id]};
    const match = advisorEngine.recommend(advisor, engineSelections);
    if (!match) return null;
    const technique = techniqueById(match.profile.technique);
    const trouble = advisor.trouble[selections.trouble] || advisor.trouble.none;
    const targetLabel = optionLabel(advisor.targets[selections.water], selections.target);
    const accessLabel = selections.access === "any" ? "Any access" : ({bank:"Bank / shore",surf:"Surf",pier:"Pier / jetty",kayak:"Kayak",boat:"Boat"}[selections.access] || selections.access);
    return {selections,structure,match,technique,trouble,targetLabel,accessLabel,safety:sessionSafety[structure.id]};
  }

  function populateSessionChoices(preferred = state.session) {
    const water = $("#session-water").value;
    const access = $("#session-access").value;
    const targetOptions = advisor.targets[water] || [];
    const forageOptions = advisor.forage[water] || [];
    const available = (data.structures || []).filter(item => item.water === water && (access === "any" || item.access.includes(access)));
    $("#session-target").innerHTML = advisorOptionMarkup(targetOptions);
    $("#session-forage").innerHTML = advisorOptionMarkup(forageOptions);
    $("#session-structure").innerHTML = available.map(item => `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`).join("");
    $("#session-target").value = targetOptions.some(item => item[0] === preferred.target) ? preferred.target : targetOptions[0][0];
    $("#session-forage").value = forageOptions.some(item => item[0] === preferred.forage) ? preferred.forage : forageOptions.at(-1)[0];
    $("#session-structure").value = available.some(item => item.id === preferred.structureId) ? preferred.structureId : available[0]?.id || "";
    $("#session-current-field").hidden = water !== "salt";
  }

  function sessionPlanMarkup(plan, saved = false) {
    if (!plan) return `<p>No structure matches this water and access combination. Broaden access to build a plan.</p>`;
    const {selections,structure,match,technique,trouble,targetLabel,accessLabel,safety} = plan;
    const procedureId = advisor.procedureByTarget[selections.target];
    return `<p class="advisor-fit">${escapeHtml(match.fit)} · ${escapeHtml(targetLabel)} · ${escapeHtml(accessLabel)}</p><h3>${escapeHtml(structure.name)}</h3><p class="session-technique">${escapeHtml(technique.name)} <span>with ${escapeHtml(match.profile.lure)}</span></p><div class="session-brief"><section><span>01 · Position</span><strong>${escapeHtml(structure.depthZone)}</strong></section><section><span>02 · First cast</span><strong>${escapeHtml(structure.firstCast)}</strong></section><section><span>03 · Presentation</span><strong>${escapeHtml(match.profile.presentation)}</strong></section><section><span>04 · One adjustment</span><strong>${escapeHtml(structure.adjustment)}</strong><small>${escapeHtml(trouble.action)}</small></section></div><aside class="session-safety"><strong>Safety check</strong><p>${escapeHtml(safety)}</p></aside><div class="advisor-actions">${saved ? `<button type="button" data-load-session="${escapeHtml(selections.structureId)}">Load this briefing</button>` : `<button type="button" data-save-session>Save offline briefing</button>`}<button type="button" data-structure="${escapeHtml(structure.id)}">Open cast diagram</button><button type="button" data-open="${escapeHtml(technique.id)}">Open technique</button>${procedureId ? `<button type="button" data-procedure="${escapeHtml(procedureId)}">Open NJ how-to</button>` : ""}</div>`;
  }

  function renderSavedSessions() {
    $("#session-save-status").textContent = `${state.savedSessions.length} of 5 saved`;
    $("#saved-session-list").innerHTML = state.savedSessions.length ? state.savedSessions.map(item => {
      const plan = sessionPlan(item.selections);
      if (!plan) return "";
      return `<article class="saved-session-card"><div><p class="advisor-fit">${escapeHtml(plan.targetLabel)} · ${plan.selections.water === "fresh" ? "Freshwater" : "Saltwater"}</p><h4>${escapeHtml(plan.structure.name)}</h4><p>${escapeHtml(plan.technique.name)} · ${escapeHtml(plan.match.profile.lure)}</p></div><div><button type="button" data-load-session-id="${escapeHtml(item.id)}">Load</button><button type="button" data-delete-session="${escapeHtml(item.id)}">Delete</button></div></article>`;
    }).join("") : `<p class="session-empty">No saved briefings yet. Build a plan, then save it for offline use.</p>`;
  }

  function renderSession() {
    const selections = sessionSelections();
    state.session = selections;
    safeSave("tacklebox-session", selections);
    $("#session-result").innerHTML = sessionPlanMarkup(sessionPlan(selections));
    renderSavedSessions();
  }

  function applySessionSelections(selections) {
    state.session = {...sessionDefault,...selections};
    for (const key of ["water","access","trend","clarity","wind","current","light","trouble"]) {
      const select = $(`#session-${key}`);
      if ([...select.options].some(option => option.value === state.session[key])) select.value = state.session[key];
    }
    populateSessionChoices(state.session);
    renderSession();
  }

  function initializeSession() {
    $("#session-trouble").innerHTML = advisorOptionMarkup(Object.entries(advisor.trouble).map(([id,item]) => [id,item.label]));
    applySessionSelections(state.session);
  }

  function renderManual() {
    const filters = ["striper", "fluke", "bluefish", "sheeps"];
    $("#manual-species").innerHTML = filters.map(id => `<button type="button" data-manual-species="${id}" aria-pressed="${id === state.manualSpecies}">${speciesLabels[id]}</button>`).join("");
    const procedures = manual.procedures.filter(item => item.species === state.manualSpecies);
    $("#manual-grid").innerHTML = procedures.map((item,index) => `<article class="manual-card ${item.species === "striper" ? "primary" : ""}"><span class="manual-number">${String(index + 1).padStart(2, "0")}</span><p class="manual-when">${escapeHtml(item.when)}</p><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.setup)}</p><button type="button" data-procedure="${item.id}">Open step-by-step</button></article>`).join("");
  }

  function renderRecommendedSetups() {
    const proceduresById = Object.fromEntries(manual.procedures.map(item => [item.id, item]));
    const profileTechniques = Object.fromEntries(Object.keys(manual.setupProfiles).map(id => [id, []]));
    Object.entries(manual.setupMap).forEach(([procedureId, profileId]) => {
      if (profileTechniques[profileId] && proceduresById[procedureId]) profileTechniques[profileId].push(proceduresById[procedureId]);
    });
    const tierOrder = {budget:0, mid:1, high:2};
    $("#setup-module-grid").innerHTML = Object.entries(manual.setupProfiles).map(([profileId, profile]) => {
      const tiers = [...profile.tiers].sort((a,b) => tierOrder[a.tier] - tierOrder[b.tier]);
      const techniques = profileTechniques[profileId];
      const techniqueNames = techniques.map(item => item.title);
      return `<details class="setup-system-card"><summary class="setup-system-summary"><span><small>${techniques.length} techniques</small><strong>${escapeHtml(profile.name)}</strong><span class="setup-system-preview">${escapeHtml(techniqueNames.slice(0, 3).join(" · "))}${techniqueNames.length > 3 ? ` +${techniqueNames.length - 3} more` : ""}</span></span><b aria-hidden="true">＋</b></summary><div class="setup-system-body"><div class="setup-system-tiers">${tiers.map(tier => `<div class="setup-system-tier"><header><span class="setup-tier-label">${escapeHtml(tier.label)}</span><strong>${escapeHtml(tier.rod)}</strong></header><dl><div><dt>Reel</dt><dd>${escapeHtml(tier.reel)}</dd></div><div><dt>Line</dt><dd>${escapeHtml(tier.line)}</dd></div><div><dt>Other reels</dt><dd>${escapeHtml(tier.reelOptions.join(" · "))}</dd></div></dl><p class="setup-fit">${escapeHtml(tier.fit)}</p><a href="${escapeHtml(tier.url)}" target="_blank" rel="noopener noreferrer">Check rod specs</a></div>`).join("")}</div>${rodOptionsMarkup(profile)}<div class="setup-techniques"><p>Open a technique</p><div>${techniques.map(item => `<button type="button" data-procedure="${escapeHtml(item.id)}">${escapeHtml(item.title)}</button>`).join("")}</div></div></div></details>`;
    }).join("");
  }

  function renderBench() {
    $("#knot-grid").innerHTML = Object.entries(manual.knots).map(([id,item]) => `<button type="button" class="bench-card" data-knot="${id}"><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.use)}</span></button>`).join("");
    $("#rig-grid-manual").innerHTML = Object.entries(manual.rigs).map(([id,item]) => `<button type="button" class="bench-card" data-rig="${id}"><strong>${escapeHtml(item.name)}</strong><span>${item.parts.length} parts · view build</span></button>`).join("");
  }

  function renderHotspots() {
    const filters = ["all", "striper", "fluke", "bluefish", "sheeps"];
    $("#hotspot-species").innerHTML = filters.map(id => `<button type="button" data-hotspot-species="${id}" aria-pressed="${id === state.hotspotSpecies}">${speciesLabels[id]}</button>`).join("");
    const spots = manual.hotspots.filter(item => state.hotspotSpecies === "all" || item.species.includes(state.hotspotSpecies));
    $("#hotspot-grid").innerHTML = spots.map(item => `<article class="hotspot-card"><p class="section-kicker">${escapeHtml(item.region)}</p><h3>${escapeHtml(item.name)}</h3><div class="hotspot-tags">${item.species.map(id => `<span>${speciesLabels[id]}</span>`).join("")}</div><p><strong>Window:</strong> ${escapeHtml(item.season)}</p><p><strong>Target:</strong> ${escapeHtml(item.habitat)}</p><p><strong>First cast:</strong> ${escapeHtml(item.first)}</p><button type="button" data-hotspot="${item.id}">Access, tide, and safety</button></article>`).join("");
  }

  function renderWaterReading() {
    const structures = data.structures || [];
    const filters = ["all","fresh","salt"];
    const filterLabels = {all:"All water",fresh:"Freshwater",salt:"Saltwater"};
    const activeWater = state.water === "all" ? "all" : state.water;
    const aLabels = {bank:"Bank",boat:"Boat",kayak:"Kayak",surf:"Surf",pier:"Pier"};
    const techById = id => data.techniques.find(t => t.id === id);
    $("#structure-water-filter").innerHTML = filters.map(id =>
      `<button type="button" data-structure-water="${id}" aria-pressed="${id === activeWater}">${escapeHtml(filterLabels[id])}</button>`
    ).join("");
    const visible = activeWater === "all" ? structures : structures.filter(item => item.water === activeWater);
    $("#structure-grid").innerHTML = visible.map(item => {
      const waterLabel = item.water === "fresh" ? "Freshwater" : "Saltwater";
      return `<article class="hotspot-card"><p class="section-kicker">${escapeHtml(waterLabel)}</p><h3>${escapeHtml(item.name)}</h3><div class="hotspot-tags">${item.access.map(a => `<span>${escapeHtml(aLabels[a] || a)}</span>`).join("")}</div><p><strong>Identify:</strong> ${escapeHtml(item.identify.slice(0, 90))}${item.identify.length > 90 ? "\u2026" : ""}</p><p><strong>First cast:</strong> ${escapeHtml(item.firstCast.slice(0, 80))}${item.firstCast.length > 80 ? "\u2026" : ""}</p><button type="button" data-structure="${item.id}">Cast path and adjustments</button></article>`;
    }).join("") || `<p class="result-status">No structures for the current filter.</p>`;
  }

  function castDiagramMarkup(item) {
    const scenes = {
      "point-fresh": `<path class="terrain" d="M0 0h235c28 58 44 104 126 142-82 39-99 91-126 198H0z"/><path class="depth-line" d="M250 18c27 66 61 94 143 124-81 36-116 75-143 180"/><ellipse class="holding-zone" cx="378" cy="145" rx="72" ry="28"/><path class="cast-path" d="M82 76Q235 68 362 133"/><path class="follow-path" d="M82 222Q231 220 368 158"/><text x="24" y="35">SHORE</text><text x="372" y="113">POINT TIP</text><text x="464" y="292">DEEP WATER</text>`,
      "flat-edge": `<path class="terrain" d="M0 0h640v96H0z"/><path class="depth-line" d="M0 178c145-17 252 20 378-2 101-18 166-12 262 3"/><path class="depth-line faint" d="M0 245c151-15 270 16 392-1 91-13 166-9 248 5"/><path class="holding-zone" d="M188 160c91-19 172 15 271-1l9 38c-104 22-187-14-274 3z"/><path class="cast-path" d="M310 47v98q0 42 75 83"/><text x="24" y="55">SHALLOW FLAT</text><text x="24" y="165">DROP LIP</text><text x="470" y="287">DEEP WATER</text>`,
      "submerged-wood": `<path class="terrain" d="M0 0h640v72H0z"/><path class="cover" d="M302 74l-18 171m12-102-91-48m84 82 112-59m-105 93-76 61m73-42 101 63"/><circle class="hazard" cx="294" cy="181" r="93"/><path class="holding-zone" d="M328 229c61-20 113-2 131 27-41 27-99 34-146 6z"/><path class="cast-path" d="M74 46Q213 45 278 105"/><path class="follow-path" d="M76 306Q228 305 324 254"/><text x="24" y="42">BANK</text><text x="204" y="102">OUTER LIMBS</text><text x="412" y="282">ROOT / BASE</text>`,
      "creek-seam": `<path class="current-band" d="M0 62c190 46 345-44 640 12v111c-255-54-415 39-640-16z"/><path class="current" d="M34 111h170m68-21h160m70 24h109"/><path class="seam" d="M0 185c228 49 382-43 640 4"/><path class="holding-zone" d="M253 177c88-23 159-14 226 5-48 30-142 43-225 25z"/><path class="cast-path" d="M101 43q92 52 177 139"/><text x="24" y="38">UPSTREAM</text><text x="445" y="163">FAST WATER</text><text x="396" y="232">SLOW SIDE</text>`,
      "dam-tailwater": `<path class="terrain" d="M0 0h640v70H0z"/><path class="dam" d="M82 40h476v67H82z"/><path class="current" d="M164 122v112m104-112v160m104-160v112m104-112v160"/><path class="hazard" d="M84 103h472v57H84z"/><path class="holding-zone" d="M112 236c56-26 104-18 145 14-44 34-96 39-153 12zm272 5c59-29 112-16 151 17-48 31-106 36-160 9z"/><path class="cast-path" d="M35 304Q94 213 164 208"/><text x="263" y="82">DAM</text><text x="212" y="148">BOIL / EXCLUSION</text><text x="235" y="318">DOWNSTREAM</text>`,
      "weed-edge": `<path class="vegetation" d="M0 0h246v340H0z"/><path class="weed-edge" d="M248 0c47 54-36 105 9 163 43 54-24 115 2 177"/><path class="holding-zone" d="M242 53c52 16 66 48 35 79-50-8-71-42-35-79zm7 164c60 13 74 50 42 83-57-8-79-45-42-83z"/><path class="cast-path" d="M402 28Q344 159 330 312"/><path class="follow-path" d="M475 60Q361 92 268 104"/><text x="47" y="36">VEGETATION</text><text x="285" y="324">OUTSIDE EDGE</text><text x="458" y="37">OPEN WATER</text>`,
      "surf-trough": `<path class="terrain" d="M0 0h640v70H0z"/><path class="bar" d="M0 205c165-27 331-22 640 4v52c-251-22-449-30-640-1z"/><path class="wave" d="M0 105c116-25 226 25 342 0s193 17 298 3M0 285c122-19 230 18 350-3s190 11 290-2"/><path class="holding-zone" d="M83 151c152-28 304-18 471 3l-6 35c-170-20-318-30-468-2z"/><path class="cast-path" d="M320 39v130"/><path class="follow-path" d="M105 40q113 55 144 123"/><text x="24" y="43">BEACH</text><text x="24" y="145">TROUGH</text><text x="467" y="238">OUTER BAR</text>`,
      "inlet-rip": `<path class="terrain" d="M0 0h215v340H0zm425 0h215v340H425z"/><path class="current-band" d="M215 0h210v340H215z"/><path class="current" d="M268 42v225m53-240v266m53-244v222"/><path class="seam" d="M222 0v340m196-340v340"/><path class="holding-zone" d="M389 74c51 33 53 77 11 118-41-33-47-80-11-118z"/><path class="cast-path" d="M517 72Q433 94 368 144"/><text x="34" y="36">JETTY</text><text x="272" y="322">OUTFLOW</text><text x="440" y="226">SLOW EDGE</text>`,
      "jetty-base": `<path class="terrain" d="M0 0h640v64H0z"/><path class="jetty" d="M260 56h120v229H260z"/><path class="rocks" d="M236 66l24-12 18 16 28-13 23 16 28-18 23 13 28-10v252H232z"/><path class="current" d="M64 119h137m238 0h137M52 200h143m248 0h145"/><path class="holding-zone" d="M385 92c52 31 60 83 10 118-35-35-42-78-10-118z"/><path class="hazard" d="M229 54h182v261H229z"/><path class="cast-path" d="M555 43Q452 60 392 123"/><text x="24" y="40">SHORE</text><text x="270" y="165">ROCKS</text><text x="422" y="243">CURRENT SEAM</text>`,
      "bridge-shadow": `<path class="current-band" d="M0 0h640v340H0z"/><path class="bridge" d="M0 116h640v78H0z"/><rect class="shadow" x="0" y="194" width="640" height="68"/><circle class="piling" cx="160" cy="155" r="27"/><circle class="piling" cx="480" cy="155" r="27"/><path class="current" d="M44 70h170m92 0h275M41 300h220m94 0h226"/><path class="holding-zone" d="M76 202h492v39H76z"/><path class="cast-path" d="M546 76Q435 128 354 207"/><text x="24" y="108">LIT WATER</text><text x="24" y="228">SHADOW EDGE</text><text x="24" y="287">DARK WATER</text>`,
      "bar-tip": `<path class="bar" d="M0 0h340c58 35 95 79 104 140-7 63-48 112-104 146H0z"/><path class="depth-line" d="M353 20c67 42 108 78 114 122-4 52-45 99-111 131"/><path class="current" d="M500 48v220m57-191v160"/><path class="holding-zone" d="M355 96c64 7 96 42 94 86-53 24-103 4-126-35z"/><path class="cast-path" d="M177 46Q307 61 386 117"/><path class="follow-path" d="M178 255Q305 236 387 182"/><text x="24" y="36">SANDBAR</text><text x="349" y="84">TIP</text><text x="478" y="304">SLOUGH</text>`,
      "creek-mouth-salt": `<path class="terrain" d="M0 0h215v153c30 25 54 45 105 50 50-5 76-25 105-50V0h215v340H0z"/><path class="current-band" d="M222 0h196v150c-24 38-54 61-98 71-44-10-74-33-98-71z"/><path class="current" d="M273 38v125m47-142v176m47-159v125"/><path class="seam" d="M215 145q105 138 210 0"/><path class="holding-zone" d="M230 175c56 10 79 39 90 67-49 25-96 17-125-16zm180 0c-56 10-79 39-90 67 49 25 96 17 125-16z"/><path class="cast-path" d="M83 285Q209 242 274 197"/><text x="267" y="28">CREEK</text><text x="268" y="272">MOUTH</text><text x="24" y="320">BAY / RIVER</text>`
    };
    const scene = scenes[item.id];
    if (!scene) return "";
    const titleId = `cast-diagram-${item.id}-title`;
    const descId = `cast-diagram-${item.id}-desc`;
    const hazardLegend = ["submerged-wood","dam-tailwater","jetty-base"].includes(item.id) ? `<span class="legend-hazard">Hazard</span>` : "";
    return `<figure class="cast-diagram"><div class="cast-diagram-heading"><div><span>Overhead field sketch</span><strong>Cast path and holding water</strong></div><div class="cast-diagram-legend" aria-hidden="true"><span class="legend-cast">Cast</span><span class="legend-hold">Hold</span>${hazardLegend}</div></div><svg viewBox="0 0 640 340" role="img" aria-labelledby="${titleId} ${descId}"><title id="${titleId}">${escapeHtml(item.name)} cast-path diagram</title><desc id="${descId}">Overhead schematic showing the recommended first cast, likely holding zone, structure, current, and hazards. Use the written field guidance and actual conditions.</desc><defs><marker id="cast-arrow-${item.id}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0l10 5-10 5z"/></marker><marker id="flow-arrow-${item.id}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0l10 5-10 5z"/></marker></defs><g style="--cast-arrow:url(#cast-arrow-${item.id});--flow-arrow:url(#flow-arrow-${item.id})">${scene}</g></svg><figcaption>Schematic, not to scale. Confirm depth, current, footing, access, and local restrictions before casting.</figcaption></figure>`;
  }

  function structureMarkup(item) {
    const aLabels = {bank:"Bank",boat:"Boat",kayak:"Kayak",surf:"Surf",pier:"Pier"};
    const techById = id => data.techniques.find(t => t.id === id);
    const techs = (item.techniques || []).map(id => techById(id)).filter(Boolean);
    return `<article class="detail-inner"><p class="section-kicker">${item.water === "fresh" ? "Freshwater" : "Saltwater"} structure</p><h2>${escapeHtml(item.name)}</h2><p class="detail-deck">Read the water. Place the cast.</p>${castDiagramMarkup(item)}<section class="detail-section"><h3>How to identify it</h3><p>${escapeHtml(item.identify)}</p></section><section class="detail-section"><h3>First cast</h3><p>${escapeHtml(item.firstCast)}</p></section><section class="detail-section"><h3>Depth zone</h3><p>${escapeHtml(item.depthZone)}</p></section><section class="detail-section"><h3>Lure families</h3><ul>${(item.lureFamilies || []).map(l => `<li>${escapeHtml(l)}</li>`).join("")}</ul></section><section class="detail-section"><h3>Adjustment</h3><p>${escapeHtml(item.adjustment)}</p></section>${techs.length ? `<section class="detail-section"><h3>Techniques to open</h3><ul>${techs.map(t => `<li><strong>${escapeHtml(t.name)}</strong> \u2014 ${escapeHtml(t.summary)}</li>`).join("")}</ul></section>` : ""}<aside class="tip-callout"><strong>Access</strong><br>${item.access.map(a => aLabels[a] || a).join(", ")}</aside></article>`;
  }

  function renderRegulations() {
    $("#regulation-grid").innerHTML = manual.regulations.map(item => `<article><h3>${escapeHtml(item.species)}</h3><p>${escapeHtml(item.summary)}</p><a href="${escapeHtml(item.source)}" target="_blank" rel="noopener noreferrer">Verify current rule</a></article>`).join("");
  }

  function knotMarkup(id) {
    const item = manual.knots[id];
    return `<article class="detail-inner howto-detail"><p class="section-kicker">Field knot</p><h2>${escapeHtml(item.name)}</h2><p class="detail-deck">${escapeHtml(item.use)}</p><section class="detail-section diagram-section">${knotSvg(id)}${ordered(item.steps)}</section>${videoMarkup(item.video, item.name)}<aside class="tip-callout"><strong>Avoid</strong><br>${escapeHtml(item.avoid)}</aside></article>`;
  }

  function rigMarkup(id) {
    const item = manual.rigs[id];
    return `<article class="detail-inner howto-detail"><p class="section-kicker">Rig build</p><h2>${escapeHtml(item.name)}</h2><section class="detail-section diagram-section"><div class="rig-chain">${item.parts.map((part,index) => `<span><b>${index + 1}</b>${escapeHtml(part)}</span>`).join("")}</div></section><aside class="tip-callout"><strong>Before casting</strong><br>Pull-test every knot, expose the hook point, inspect leader for abrasion, and confirm the sinker or lure matches current and crowd conditions.</aside></article>`;
  }

  function hotspotMarkup(item) {
    return `<article class="detail-inner"><p class="section-kicker">${escapeHtml(item.region)} · Public access guide</p><h2>${escapeHtml(item.name)}</h2><p class="detail-deck">Fish habitat and conditions, not a guaranteed pin.</p><section class="detail-section"><h3>Access</h3><p>${escapeHtml(item.access)}</p></section><section class="detail-section"><h3>Where to cast</h3><p>${escapeHtml(item.cast)}</p></section><section class="detail-section"><h3>Tide, wind, and season</h3><p>${escapeHtml(item.conditions)}</p><p><strong>Window:</strong> ${escapeHtml(item.season)}</p></section><section class="detail-section"><h3>Start with</h3><p>${escapeHtml(item.first)}</p></section><aside class="tip-callout"><strong>Access and safety</strong><br>${escapeHtml(item.safety)}</aside><p><a href="${escapeHtml(item.source)}" target="_blank" rel="noopener noreferrer">Verify official access information</a></p></article>`;
  }

  function openManualDialog(markup) {
    elements.detailContent.innerHTML = markup;
    elements.detail.showModal();
    updateOnlineState();
  }

  const njSpecies = () => data.nj.species[state.nj.species];
  const njOptionLabel = (field, value) => field.options.find(option => option[0] === value)?.[1] || "Any";
  const njScore = play => Object.entries(state.nj.values).reduce((score, [key, value]) => {
    if (!value) return score;
    return score + (play.match[key]?.includes(value) ? 3 : 0);
  }, 0);

  function resolveNjPlay() {
    const species = njSpecies();
    return [...species.plays].sort((a, b) => njScore(b) - njScore(a))[0];
  }

  function renderNjResult(play) {
    const species = njSpecies();
    const selected = species.fields.filter(field => state.nj.values[field.id]).map(field => njOptionLabel(field, state.nj.values[field.id]));
    $("#nj-status").textContent = `${species.label}${selected.length ? ` · ${selected.join(" · ")}` : ""} → ${play.name}`;
    $("#nj-result").innerHTML = `<p class="nj-match">Best available match</p><h3>${escapeHtml(play.name)}</h3><div class="rig-grid"><div><span>Lure or bait</span><strong>${escapeHtml(play.lure)}</strong></div><div><span>Rig</span><strong>${escapeHtml(play.rig)}</strong></div><div><span>Presentation</span><strong>${escapeHtml(play.retrieve)}</strong></div><div><span>Why this works</span><strong>${escapeHtml(play.why)}</strong></div></div><aside class="nj-caution"><strong>Heads-up</strong><span>${escapeHtml(play.caution)}</span></aside>`;
  }

  function renderNjPlaybook() {
    const species = njSpecies();
    $("#nj-species-tabs").innerHTML = Object.entries(data.nj.species).map(([id, item]) => `<button id="nj-tab-${id}" type="button" role="tab" data-nj-species="${id}" aria-selected="${id === state.nj.species}" tabindex="${id === state.nj.species ? 0 : -1}">${escapeHtml(item.label)}</button>`).join("");
    $("#nj-panel").setAttribute("aria-labelledby", `nj-tab-${state.nj.species}`);
    $("#nj-species-intro").innerHTML = `<strong>${escapeHtml(species.subtitle)}</strong><span>${escapeHtml(species.intro)}</span>`;
    $("#nj-selector").innerHTML = species.fields.map(field => `<label><span>${escapeHtml(field.label)}</span><select data-nj-field="${field.id}"><option value="">Any</option>${field.options.map(option => `<option value="${escapeHtml(option[0])}" ${state.nj.values[field.id] === option[0] ? "selected" : ""}>${escapeHtml(option[1])}</option>`).join("")}</select></label>`).join("");
    $("#nj-plays").innerHTML = species.plays.map(play => `<button type="button" data-nj-play="${play.id}">${escapeHtml(play.name)}</button>`).join("");
    const rules = species.rules ? `<details class="nj-rules"><summary>2026 NJ ${escapeHtml(species.label)} rules</summary><ul>${species.rules.map(rule => `<li>${escapeHtml(rule)}</li>`).join("")}</ul></details>` : "";
    $("#nj-footer").innerHTML = `${rules}<strong>Regulations and safety</strong><span>${escapeHtml(species.footer)}</span><div class="nj-source-links">${data.nj.sources.map(source => `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.name)}</a>`).join("")}</div>`;
    renderNjResult(resolveNjPlay());
    safeSave("tacklebox-nj", state.nj);
  }

  function activateNjSpecies(id, shouldFocus = false) {
    if (!data.nj.species[id]) return;
    state.nj = { species: id, values: {} };
    renderNjPlaybook();
    if (shouldFocus) $(`#nj-tab-${id}`).focus();
  }

  function renderGroupFilters() {
    const groups = [...new Set(data.techniques.filter(item => state.water === "all" || item.water === state.water).map(item => item.group))].sort();
    if (state.group !== "all" && !groups.includes(state.group)) state.group = "all";
    elements.groupFilters.innerHTML = ["all", ...groups].map(group => {
      const label = group === "all" ? "All techniques" : group;
      return `<button type="button" data-group="${escapeHtml(group)}" aria-pressed="${state.group === group}">${escapeHtml(label)}</button>`;
    }).join("");
  }

  function renderCard(item, index) {
    const isSaved = state.saved.has(item.id);
    const isCompared = state.compare.has(item.id);
    return `<article class="technique-card" data-index="${String(index + 1).padStart(2, "0")}">
      <div class="card-top"><span class="water-badge ${item.water}">${item.water === "fresh" ? "Freshwater" : "Saltwater"}</span><span class="technique-tag">${escapeHtml(item.group)}</span></div>
      <div><h3>${escapeHtml(item.name)}</h3><p class="card-summary">${escapeHtml(item.summary)}</p></div>
      <div class="card-season"><strong>Best window</strong><span>${escapeHtml(item.peak)}</span></div>
      <div class="card-actions">
        <button class="open-detail" type="button" data-open="${item.id}">Open field card</button>
        <button type="button" data-save="${item.id}" aria-pressed="${isSaved}" aria-label="${isSaved ? "Remove" : "Save"} ${escapeHtml(item.name)}">${isSaved ? "♥" : "♡"}</button>
        <button type="button" data-compare="${item.id}" aria-pressed="${isCompared}" aria-label="${isCompared ? "Remove from" : "Add to"} comparison">${isCompared ? "✓" : "+"}</button>
      </div>
    </article>`;
  }

  function render() {
    renderGroupFilters();
    const items = filteredTechniques();
    elements.grid.innerHTML = items.map(renderCard).join("");
    elements.grid.hidden = items.length === 0;
    elements.empty.hidden = items.length !== 0;
    elements.status.textContent = `${items.length} technique${items.length === 1 ? "" : "s"} matched${state.savedOnly ? " in saved field cards" : ""}.`;
    elements.compareCount.textContent = state.compare.size;
    elements.compareButton.disabled = state.compare.size < 2;
    $$("[data-water]").forEach(button => button.setAttribute("aria-pressed", button.dataset.water === state.water));
    $("#saved-toggle").setAttribute("aria-pressed", String(state.savedOnly));
    $("#nj-playbook").classList.toggle("nj-muted", state.water === "fresh");
  }

  function detailMarkup(item) {
    return `<article class="detail-inner">
      <p class="section-kicker">${item.water === "fresh" ? "Freshwater" : "Saltwater"} · ${escapeHtml(item.group)}</p>
      <h2>${escapeHtml(item.name)}</h2><p class="detail-deck">${escapeHtml(item.summary)}</p>
      <section class="detail-section"><h3>Working setup</h3><div class="rig-grid">${Object.entries(item.rig).map(([key,value]) => `<div><span>${escapeHtml(key)}</span><strong>${escapeHtml(value)}</strong></div>`).join("")}</div></section>
      <section class="detail-section"><h3>Baits and lures by window</h3><div class="lure-list">${item.lures.map(lure => `<div class="lure-row"><strong>${escapeHtml(lure.name)}</strong><span>${escapeHtml(lure.when)}</span></div>`).join("")}</div></section>
      <section class="detail-section"><h3>Season and targets</h3><p><strong>Peak:</strong> ${escapeHtml(item.peak)}</p><p><strong>Common targets:</strong> ${escapeHtml(item.species.join(", "))}</p><p><strong>Access:</strong> ${escapeHtml(item.access.join(", "))}</p></section>
      <aside class="tip-callout"><strong>Field note</strong><br>${escapeHtml(item.tip)}</aside>${productExamplesMarkup("techniques", item.id)}
    </article>`;
  }

  function openDetail(id) {
    const item = techniqueById(id); if (!item) return;
    elements.detailContent.innerHTML = detailMarkup(item);
    elements.detail.showModal();
  }

  function renderComparison() {
    const items = [...state.compare].map(techniqueById).filter(Boolean);
    const rows = [
      ["Water", item => item.water === "fresh" ? "Freshwater" : "Saltwater"],
      ["Best window", item => item.peak],
      ["Rod", item => item.rig.Rod], ["Reel", item => item.rig.Reel],
      ["Mainline", item => item.rig.Mainline], ["Leader", item => item.rig.Leader],
      ["Top choices", item => item.lures.map(lure => lure.name).join(", ")],
      ["Field note", item => item.tip]
    ];
    elements.compareContent.innerHTML = `<div class="compare-table-wrap"><table class="compare-table"><caption>Technique comparison</caption><thead><tr><th scope="col">Decision point</th>${items.map(item => `<th scope="col">${escapeHtml(item.name)}</th>`).join("")}</tr></thead><tbody>${rows.map(([label,getValue]) => `<tr><th scope="row">${label}</th>${items.map(item => `<td>${escapeHtml(getValue(item))}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
    elements.compare.showModal();
  }

  function persistSaved() { safeSave("tacklebox-saved", [...state.saved]); }
  let toastTimer;
  function showToast(message) { clearTimeout(toastTimer); elements.toast.textContent = message; elements.toast.hidden = false; toastTimer = setTimeout(() => { elements.toast.hidden = true; }, 2200); }
  function updateOnlineState() {
    document.querySelectorAll("[data-video-id]").forEach(button => { button.disabled = !navigator.onLine; });
    document.querySelectorAll(".video-offline").forEach(note => { note.hidden = navigator.onLine; });
  }

  function resetFilters() {
    Object.assign(state, {water:"all", season:"all", access:"all", search:"", group:"all", savedOnly:false});
    elements.season.value = "all"; elements.access.value = "all"; elements.search.value = ""; render();
  }

  document.addEventListener("click", event => {
    const button = event.target.closest("button"); if (!button) return;
    if (button.dataset.videoId) {
      const id = button.dataset.videoId;
      if (!navigator.onLine) { showToast("Video requires an internet connection"); return; }
      if (!/^[A-Za-z0-9_-]{11}$/.test(id)) { showToast("Invalid video link"); return; }
      const container = button.closest("[data-video-container]");
      const iframe = document.createElement("iframe");
      iframe.src = `https://www.youtube-nocookie.com/embed/${id}`;
      iframe.title = `How to tie the ${button.dataset.videoTitle} — video tutorial`;
      iframe.loading = "lazy";
      iframe.referrerPolicy = "strict-origin-when-cross-origin";
      iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-presentation");
      iframe.setAttribute("allow", "encrypted-media; picture-in-picture; fullscreen");
      iframe.setAttribute("allowfullscreen", "");
      container.replaceChildren(iframe);
      iframe.focus();
    }
    else if (button.id === "module-menu-button") setModuleMenu(true);
    else if (button.id === "module-menu-close" || button.id === "module-scrim") { setModuleMenu(false); $("#module-menu-button").focus(); }
    else if (button.dataset.water) { state.water = button.dataset.water; state.group = "all"; render(); navigateModule("library"); }
    else if (button.dataset.manualSpecies) { state.manualSpecies = button.dataset.manualSpecies; renderManual(); }
    else if (button.dataset.hotspotSpecies) { state.hotspotSpecies = button.dataset.hotspotSpecies; renderHotspots(); }
    else if (button.dataset.procedure) { const item = manual.procedures.find(entry => entry.id === button.dataset.procedure); if (item) openManualDialog(procedureMarkup(item)); }
    else if (button.dataset.knot) openManualDialog(knotMarkup(button.dataset.knot));
    else if (button.dataset.rig) openManualDialog(rigMarkup(button.dataset.rig));
    else if (button.dataset.hotspot) { const item = manual.hotspots.find(entry => entry.id === button.dataset.hotspot); if (item) openManualDialog(hotspotMarkup(item)); }
    else if (button.dataset.structureWater) { state.water = button.dataset.structureWater; renderWaterReading(); }
    else if (button.dataset.structure) { const item = (data.structures || []).find(entry => entry.id === button.dataset.structure); if (item) openManualDialog(structureMarkup(item)); }
    else if (button.hasAttribute("data-save-session")) {
      const selections = sessionSelections();
      const duplicate = state.savedSessions.find(item => JSON.stringify(item.selections) === JSON.stringify(selections));
      if (duplicate) showToast("This briefing is already saved");
      else { state.savedSessions = [{id:`session-${Date.now()}`,selections},...state.savedSessions].slice(0,5); safeSave("tacklebox-session-plans", state.savedSessions); renderSavedSessions(); showToast("Offline briefing saved"); }
    }
    else if (button.dataset.loadSessionId) { const item = state.savedSessions.find(entry => entry.id === button.dataset.loadSessionId); if (item) { applySessionSelections(item.selections); showToast("Briefing loaded"); } }
    else if (button.dataset.deleteSession) { state.savedSessions = state.savedSessions.filter(item => item.id !== button.dataset.deleteSession); safeSave("tacklebox-session-plans", state.savedSessions); renderSavedSessions(); showToast("Briefing deleted"); }
    else if (button.dataset.njSpecies) activateNjSpecies(button.dataset.njSpecies);
    else if (button.dataset.njPlay) {
      const play = njSpecies().plays.find(item => item.id === button.dataset.njPlay);
      if (play) { state.nj.values = Object.fromEntries(Object.entries(play.match).map(([key, values]) => [key, values[0]])); renderNjPlaybook(); }
    }
    else if (button.dataset.group) { state.group = button.dataset.group; render(); }
    else if (button.dataset.open) openDetail(button.dataset.open);
    else if (button.dataset.save) {
      const id = button.dataset.save; state.saved.has(id) ? state.saved.delete(id) : state.saved.add(id); persistSaved(); render(); showToast(state.saved.has(id) ? "Field card saved" : "Field card removed");
    } else if (button.dataset.compare) {
      const id = button.dataset.compare;
      if (state.compare.has(id)) state.compare.delete(id);
      else if (state.compare.size >= 3) showToast("Compare up to three techniques");
      else state.compare.add(id);
      render();
    } else if (button.classList.contains("dialog-close")) button.closest("dialog").close();
  });

  elements.season.addEventListener("change", event => { state.season = event.target.value; render(); });
  elements.access.addEventListener("change", event => { state.access = event.target.value; render(); });
  elements.search.addEventListener("input", event => { state.search = event.target.value.trim(); render(); });
  $("#clear-filters").addEventListener("click", resetFilters);
  $("#empty-reset").addEventListener("click", resetFilters);
  $("#saved-toggle").addEventListener("click", () => { state.savedOnly = !state.savedOnly; render(); navigateModule("library"); });
  $("#striper-focus").addEventListener("click", () => {
    state.manualSpecies = "striper"; renderManual(); navigateModule("how-to");
  });
  $("#advisor-form").addEventListener("change", event => {
    if (event.target.id === "advisor-water") populateAdvisorChoices();
    renderAdvisor();
  });
  $("#session-form").addEventListener("change", event => {
    if (["session-water","session-access"].includes(event.target.id)) populateSessionChoices(sessionSelections());
    renderSession();
  });
  $("#nj-selector").addEventListener("change", event => {
    if (!event.target.dataset.njField) return;
    state.nj.values[event.target.dataset.njField] = event.target.value;
    renderNjPlaybook();
  });
  $("#nj-species-tabs").addEventListener("keydown", event => {
    if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    const ids = Object.keys(data.nj.species); const current = ids.indexOf(state.nj.species);
    const next = (current + (event.key === "ArrowRight" ? 1 : -1) + ids.length) % ids.length;
    activateNjSpecies(ids[next], true); event.preventDefault();
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && document.body.classList.contains("module-menu-open")) {
      setModuleMenu(false); $("#module-menu-button").focus();
    }
  });
  window.addEventListener("hashchange", () => activateModule(location.hash.slice(1), true));
  moduleMedia.addEventListener("change", () => setModuleMenu(false));
  $("#module-nav").addEventListener("click", event => {
    const link = event.target.closest("[data-module-link]");
    if (link) { event.preventDefault(); navigateModule(link.dataset.moduleLink); }
  });
  window.addEventListener("online", updateOnlineState);
  window.addEventListener("offline", updateOnlineState);
  elements.compareButton.addEventListener("click", renderComparison);
  $$("dialog").forEach(dialog => dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); }));

  renderModuleNav();
  document.querySelectorAll(".brand[data-module-link]").forEach(link => link.addEventListener("click", event => { event.preventDefault(); navigateModule(link.dataset.moduleLink); }));
  $("#quiver-list").innerHTML = data.quiver.map((item,index) => `<article class="quiver-item"><span class="quiver-number">0${index + 1}</span><div><h3>${escapeHtml(item.name)}</h3><p class="spec-line">${escapeHtml(item.spec)}</p></div><p>${escapeHtml(item.use)}</p></article>`).join("");
  $("#season-grid").innerHTML = data.seasons.map(item => `<article class="season-card"><span>${escapeHtml(item.signal)}</span><h3>${escapeHtml(item.name)}</h3><ul>${item.points.map(point => `<li>${escapeHtml(point)}</li>`).join("")}</ul></article>`).join("");
  $("#field-note-list").innerHTML = data.notes.map(item => `<article class="note-item"><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.text)}</p></article>`).join("");
  $("#source-list").innerHTML = data.sources.map((source,index) => `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${index + 1}. ${escapeHtml(source.name)}</a>`).join("");
  initializeAdvisor();
  initializeSession();
  renderManual();
  renderRecommendedSetups();
  renderBench();
  renderHotspots();
  renderWaterReading();
  renderRegulations();
  if (!state.nj || !data.nj.species[state.nj.species]) state.nj = { species: data.nj.defaultSpecies, values: {} };
  if (!state.nj.values || typeof state.nj.values !== "object") state.nj.values = {};
  renderNjPlaybook();
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("./sw.js").catch(() => {});
  const requestedModule = location.hash.slice(1) || safeLoad("tacklebox-module", "home");
  const initialModule = moduleIds.has(requestedModule) ? requestedModule : "home";
  if (location.hash !== `#${initialModule}`) history.replaceState(null, "", `#${initialModule}`);
  activateModule(initialModule);
  render();
})();
