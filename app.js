(() => {
  "use strict";
  const data = window.TACKLEBOX_DATA;
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const safeLoad = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const state = {
    water: "all", season: "all", access: "all", search: "", group: "all",
    savedOnly: false, saved: new Set(safeLoad("tacklebox-saved", [])), compare: new Set(),
    nj: safeLoad("tacklebox-nj", { species: data.nj.defaultSpecies, values: {} })
  };
  const elements = {
    grid: $("#technique-grid"), empty: $("#empty-state"), status: $("#result-status"),
    groupFilters: $("#technique-filters"), season: $("#season-filter"), access: $("#access-filter"), search: $("#search-filter"),
    compareButton: $("#compare-button"), compareCount: $("#compare-count"), detail: $("#detail-dialog"), compare: $("#compare-dialog"),
    detailContent: $("#detail-content"), compareContent: $("#compare-content"), toast: $("#toast")
  };

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
    localStorage.setItem("tacklebox-nj", JSON.stringify(state.nj));
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
      <aside class="tip-callout"><strong>Field note</strong><br>${escapeHtml(item.tip)}</aside>
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

  function persistSaved() { localStorage.setItem("tacklebox-saved", JSON.stringify([...state.saved])); }
  let toastTimer;
  function showToast(message) { clearTimeout(toastTimer); elements.toast.textContent = message; elements.toast.hidden = false; toastTimer = setTimeout(() => { elements.toast.hidden = true; }, 2200); }
  function resetFilters() {
    Object.assign(state, {water:"all", season:"all", access:"all", search:"", group:"all", savedOnly:false});
    elements.season.value = "all"; elements.access.value = "all"; elements.search.value = ""; render();
  }

  document.addEventListener("click", event => {
    const button = event.target.closest("button"); if (!button) return;
    if (button.dataset.water) { state.water = button.dataset.water; state.group = "all"; render(); }
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
  $("#saved-toggle").addEventListener("click", () => { state.savedOnly = !state.savedOnly; render(); });
  $("#sunlight-toggle").addEventListener("click", event => { const active = document.body.classList.toggle("sunlight"); event.currentTarget.setAttribute("aria-pressed", active); });
  $("#striper-focus").addEventListener("click", () => {
    activateNjSpecies("striper");
    $("#nj-playbook").scrollIntoView({ behavior: "smooth" });
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
  elements.compareButton.addEventListener("click", renderComparison);
  $$("dialog").forEach(dialog => dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); }));

  $("#quiver-list").innerHTML = data.quiver.map((item,index) => `<article class="quiver-item"><span class="quiver-number">0${index + 1}</span><div><h3>${escapeHtml(item.name)}</h3><p class="spec-line">${escapeHtml(item.spec)}</p></div><p>${escapeHtml(item.use)}</p></article>`).join("");
  $("#season-grid").innerHTML = data.seasons.map(item => `<article class="season-card"><span>${escapeHtml(item.signal)}</span><h3>${escapeHtml(item.name)}</h3><ul>${item.points.map(point => `<li>${escapeHtml(point)}</li>`).join("")}</ul></article>`).join("");
  $("#field-note-list").innerHTML = data.notes.map(item => `<article class="note-item"><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.text)}</p></article>`).join("");
  $("#source-list").innerHTML = data.sources.map((source,index) => `<a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${index + 1}. ${escapeHtml(source.name)}</a>`).join("");
  if (!data.nj.species[state.nj.species]) state.nj = { species: data.nj.defaultSpecies, values: {} };
  renderNjPlaybook();
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("./sw.js").catch(() => {});
  render();
})();