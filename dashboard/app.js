// Launch Radar dashboard: renders the board from window.RADAR_DATA (written by
// main.ts from the same rows as board.json), with search, filters, five sort
// orders, and a per-protocol detail view that shows the value model's math and
// the full farm plan. Hash routes: #p=<slug> opens a detail, #watch=1 filters
// to the watchlist, #cat=<category> filters by category (used for screenshots).

(function () {
  var data = window.RADAR_DATA;
  var rows = data.rows;
  var summary = data.summary;
  var bySlug = {};
  rows.forEach(function (r) { bySlug[r.slug] = r; });

  function fmtUsd(x) {
    if (x >= 1e9) return '$' + (x / 1e9).toFixed(2) + 'B';
    if (x >= 1e6) return '$' + (x / 1e6).toFixed(1) + 'M';
    if (x >= 1e3) return '$' + (x / 1e3).toFixed(1) + 'K';
    return '$' + x;
  }
  function fmtFull(x) { return '$' + Math.round(x).toLocaleString('en-US'); }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  // Header stats + methodology strip: the model, stated up front.
  var statsEl = document.getElementById('stats');
  var totalValue = rows.reduce(function (a, r) { return a + r.implied_value_usd; }, 0);
  var medianFarm = rows.map(function (r) { return r.farm_cost_usd; }).sort(function (a, b) { return a - b; })[Math.floor(rows.length / 2)];
  statsEl.innerHTML =
    '<div class="stat"><b>' + rows.length + '</b><span>pre-token ranked</span></div>' +
    '<div class="stat"><b>' + summary.watchlist_covered + '/' + summary.watchlist_total + '</b><span>watchlist covered</span></div>' +
    '<div class="stat"><b>' + fmtUsd(totalValue) + '</b><span>combined implied</span></div>' +
    '<div class="stat"><b>' + fmtFull(medianFarm) + '</b><span>median farm cost</span></div>' +
    '<div class="stat"><b>' + summary.as_of + '</b><span>snapshot date</span></div>';

  document.getElementById('methodStrip').innerHTML =
    '<span><b>How a value is derived:</b></span>' +
    '<span class="formula">implied = TVL × category comp multiple × growth × tenure × reach × scale</span>' +
    '<span>Multiples come from the ' + summary.tokenized_seen + ' already-tokenized protocols in the same snapshot (' +
    summary.categories_with_comps + ' categories, global median ' + summary.global_multiple + '× TVL). ' +
    'Open any protocol to see its own math, its low–high band, and its farm plan.</span>';

  // Filter option lists, from the data itself.
  var cats = {}, chains = {};
  rows.forEach(function (r) {
    if (r.category) cats[r.category] = 1;
    r.chains.forEach(function (c) { chains[c] = 1; });
  });
  var catSel = document.getElementById('catFilter');
  Object.keys(cats).sort().forEach(function (c) {
    var o = document.createElement('option'); o.value = c; o.textContent = c; catSel.appendChild(o);
  });
  var chainSel = document.getElementById('chainFilter');
  Object.keys(chains).sort().forEach(function (c) {
    var o = document.createElement('option'); o.value = c; o.textContent = c; chainSel.appendChild(o);
  });

  var q = document.getElementById('q');
  var tvlSel = document.getElementById('tvlFilter');
  var watchBox = document.getElementById('watchOnly');
  var sortSel = document.getElementById('sortBy');
  var tbody = document.getElementById('rows');
  var countEl = document.getElementById('rowCount');
  var selectedSlug = null;

  function visible() {
    var needle = q.value.trim().toLowerCase();
    var cat = catSel.value, chain = chainSel.value;
    var minTvl = Number(tvlSel.value);
    var out = rows.filter(function (r) {
      if (needle && (r.name + ' ' + r.slug).toLowerCase().indexOf(needle) === -1) return false;
      if (cat && r.category !== cat) return false;
      if (chain && r.chains.indexOf(chain) === -1) return false;
      if (r.tvl_usd < minTvl) return false;
      if (watchBox.checked && !r.on_watchlist) return false;
      return true;
    });
    var mode = sortSel.value;
    out.sort(function (a, b) {
      if (mode === 'tvl') return b.tvl_usd - a.tvl_usd;
      if (mode === 'growth') return (b.change_7d || -999) - (a.change_7d || -999);
      if (mode === 'value_per_tvl') return b.implied_value_usd / b.tvl_usd - a.implied_value_usd / a.tvl_usd;
      if (mode === 'cheap') return a.farm_cost_usd - b.farm_cost_usd;
      return a.rank - b.rank;
    });
    return out;
  }

  function render() {
    var list = visible();
    countEl.textContent = list.length + ' of ' + rows.length + ' shown';
    var html = '';
    list.slice(0, 400).forEach(function (r) {
      var chg = r.change_7d === null ? '<span class="band">—</span>'
        : '<span class="' + (r.change_7d >= 0 ? 'up' : 'down') + '">' + (r.change_7d >= 0 ? '+' : '') + r.change_7d.toFixed(1) + '%</span>';
      html += '<tr data-slug="' + esc(r.slug) + '"' + (r.slug === selectedSlug ? ' class="selected"' : '') + '>' +
        '<td class="num">' + r.rank + '</td>' +
        '<td><span class="pname">' + esc(r.name) + '</span>' + (r.on_watchlist ? '<span class="watch">WATCHLIST</span>' : '') +
        '<span class="pslug">' + esc(r.slug) + '</span></td>' +
        '<td>' + esc(r.category || '—') + '</td>' +
        '<td class="chains">' + esc(r.chains.slice(0, 3).join(', ')) + (r.chains.length > 3 ? ' +' + (r.chains.length - 3) : '') + '</td>' +
        '<td class="num">' + fmtUsd(r.tvl_usd) + '</td>' +
        '<td class="num">' + chg + '</td>' +
        '<td class="num value">' + fmtUsd(r.implied_value_usd) + '</td>' +
        '<td class="num band">' + fmtUsd(r.low_value_usd) + ' – ' + fmtUsd(r.high_value_usd) + '</td>' +
        '<td class="num">' + fmtFull(r.farm_cost_usd) + '</td></tr>';
    });
    tbody.innerHTML = html;
    Array.prototype.forEach.call(tbody.querySelectorAll('tr'), function (tr) {
      tr.addEventListener('click', function () { openDetail(tr.getAttribute('data-slug'), true); });
    });
  }

  function openDetail(slug, pushHash) {
    var r = bySlug[slug];
    if (!r) return;
    selectedSlug = slug;
    if (pushHash) history.replaceState(null, '', '#p=' + slug);
    var d = document.getElementById('detail');
    var stepsHtml = r.farm_steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('');
    d.innerHTML =
      '<button class="detail-close" id="detailClose" title="Close">×</button>' +
      '<h2>' + esc(r.name) + (r.on_watchlist ? '<span class="watch">WATCHLIST</span>' : '') + '</h2>' +
      '<p class="sub">Rank #' + r.rank + ' · ' + esc(r.category || 'Uncategorised') + ' · ' + esc(r.chains.join(', ')) +
      ' · records no token in the ' + summary.as_of + ' snapshot</p>' +
      '<div class="detail-grid"><div>' +
      '<h3>The value model, for this protocol</h3>' +
      '<div class="kv"><span>TVL (snapshot)</span><b>' + fmtFull(r.tvl_usd) + '</b></div>' +
      '<div class="kv"><span>Category comp multiple (' + r.comp_count + ' tokenized peers)</span><b>' + r.comp_multiple.toFixed(3) + '×</b></div>' +
      '<div class="kv"><span>Base value (TVL × multiple)</span><b>' + fmtFull(r.base_value_usd) + '</b></div>' +
      '<div class="kv"><span>Growth factor (7d ' + (r.change_7d === null ? 'n/a' : r.change_7d.toFixed(1) + '%') + ')</span><b>' + r.growth_factor + '×</b></div>' +
      '<div class="kv"><span>Tenure factor (listed ' + (r.listed_at || 'n/a') + ')</span><b>' + r.tenure_factor + '×</b></div>' +
      '<div class="kv"><span>Reach factor (' + r.chains.length + ' chains)</span><b>' + r.reach_factor + '×</b></div>' +
      '<div class="kv"><span>Scale factor</span><b>' + r.scale_factor + '×</b></div>' +
      '<div class="kv"><span>Implied launch value</span><b>' + fmtFull(r.implied_value_usd) + '</b></div>' +
      '<div class="kv"><span>Band (comp quartiles)</span><b>' + fmtFull(r.low_value_usd) + ' – ' + fmtFull(r.high_value_usd) + '</b></div>' +
      '<p class="factor-note">Every factor is computed from this protocol\'s own snapshot fields. No name, rumour or outside data enters the model.</p>' +
      '</div><div>' +
      '<h3>Farm plan — est. ' + fmtFull(r.farm_cost_usd) + ' · ' + r.farm_hours + ' hours over ±6 weeks</h3>' +
      '<ol class="steps">' + stepsHtml + '</ol>' +
      '</div></div>';
    d.className = 'detail open';
    var closeBtn = document.getElementById('detailClose');
    if (closeBtn) closeBtn.addEventListener('click', function () {
      d.className = 'detail';
      selectedSlug = null;
      history.replaceState(null, '', location.pathname);
      render();
    });
    render();
  }

  [q, catSel, chainSel, tvlSel, watchBox, sortSel].forEach(function (el) {
    el.addEventListener('input', render);
    el.addEventListener('change', render);
  });

  // Hash routes for deep links and screenshots.
  function applyHash() {
    var h = location.hash.replace(/^#/, '');
    var parts = h.split('&');
    var wantDetail = null;
    parts.forEach(function (kv) {
      var pair = kv.split('=');
      var key = decodeURIComponent(pair[0] || ''), val = decodeURIComponent(pair[1] || '');
      if (key === 'p') wantDetail = val;
      if (key === 'watch') watchBox.checked = val === '1';
      if (key === 'cat') catSel.value = val;
      if (key === 'q') q.value = val;
    });
    render();
    if (wantDetail && bySlug[wantDetail]) openDetail(wantDetail, false);
  }
  window.addEventListener('hashchange', applyHash);
  applyHash();
})();
