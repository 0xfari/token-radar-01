// Token Radar dashboard: renders the ranked board, a filterable table, a per-protocol detail
// view with the model's own maths and a farm plan, and the live-token set kept apart.
//
// The page reads window.RADAR (data.js, written by main.ts from the same board) and generates
// each protocol's farm plan from the same rules the model used, so the board and the page
// always agree. No network: every byte the page needs ships with it.
(function () {
  var DATA = window.RADAR || null;
  var state = { q: '', category: 'all', chain: 'all', tab: 'pre-token', sort: 'implied', dir: -1, selected: null, watchOnly: false };

  function fmtUsd(n) {
    if (n === null || n === undefined) return '—';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + String(n);
  }
  function fmtUsdFull(n) {
    if (n === null || n === undefined) return '—';
    return '$' + Math.round(n).toLocaleString('en-US');
  }
  function fmtPct(n) {
    if (n === null || n === undefined) return '—';
    return (n > 0 ? '+' : '') + n.toFixed(1) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days < 30) return days + 'd';
    if (days < 365) return Math.round(days / 30) + 'mo';
    return (days / 365).toFixed(1) + 'y';
  }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'text') node.textContent = attrs[k];
      else if (k === 'html') node.innerHTML = attrs[k];
      else if (k.slice(0, 2) === 'on' && typeof attrs[k] === 'function') node.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
    });
    if (children !== undefined && children !== null) {
      if (!Array.isArray(children)) children = [children];
      children.forEach(function (c) { if (c) node.appendChild(c); });
    }
    return node;
  }

  // ---- the farm plan: the same rules lib/model.ts uses, so board and page agree ----
  function chainOf(p) { return p.chains && p.chains.length > 0 ? p.chains[0] : 'its main chain'; }
  function capitalFor(p) {
    if (p.tvl_usd >= 1000000000) return 200;
    if (p.tvl_usd >= 100000000) return 120;
    return 75;
  }
  function gasFor(p) { return chainOf(p) === 'Ethereum' ? 6 : 1; }
  function holdDaysFor(age) {
    if (age === null || age === undefined) return 45;
    if (age < 180) return 90;
    if (age < 365) return 60;
    return 30;
  }
  function actionFor(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    if (c.indexOf('chain') !== -1) return 'Bridge $' + capital + ' of USDC to ' + name + ' and use two of its native apps, so the wallet is active on the chain itself.';
    if (c.indexOf('lend') !== -1 || c.indexOf('cdp') !== -1 || c.indexOf('collateral') !== -1) return 'Supply $' + capital + ' of USDC to ' + name + ' on ' + chain + ' and keep the position open.';
    if (c.indexOf('dex') !== -1 || c.indexOf('amm') !== -1 || c.indexOf('swap') !== -1) return 'Provide $' + capital + ' of liquidity to ' + name + "'s main pool on " + chain + ' and keep the position open.';
    if (c.indexOf('bridge') !== -1) return 'Bridge $' + capital + ' of USDC to ' + chain + ' through ' + name + ' and use the bridged funds in its app.';
    if (c.indexOf('staking') !== -1 || c.indexOf('restak') !== -1) return 'Stake $' + capital + " of the chain's staking asset through " + name + ' and keep the receipt.';
    if (c.indexOf('perpetual') !== -1 || c.indexOf('derivative') !== -1) return 'Deposit $' + capital + ' of USDC as margin on ' + name + ' and open one small hedge.';
    if (c.indexOf('prediction') !== -1) return 'Fund $' + capital + ' and place one market position on ' + name + '.';
    if (c.indexOf('yield') !== -1 || c.indexOf('vault') !== -1 || c.indexOf('curator') !== -1 || c.indexOf('allocator') !== -1) return 'Deposit $' + capital + ' into a ' + name + ' vault on ' + chain + ' and keep the shares.';
    if (c.indexOf('stable') !== -1) return 'Mint or deposit $' + capital + ' of the stable asset through ' + name + ' on ' + chain + '.';
    if (c.indexOf('rwa') !== -1) return 'Mint $' + capital + " of the protocol's yield asset on " + chain + ' and hold it.';
    if (c.indexOf('insurance') !== -1) return 'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' and keep the policy.';
    return 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and keep the position open.';
  }
  function farmSteps(p, age) {
    var chain = chainOf(p);
    var capital = capitalFor(p);
    var gas = gasFor(p);
    var hold = holdDaysFor(age);
    var action = actionFor(p, capital, chain);
    return [
      { text: 'Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.', cost: 'under $' + (gas + 2) + ' of gas for the first transaction', time: '5 minutes' },
      { text: action, cost: '$' + capital + ' of capital and about $' + gas + ' of gas', time: '15 minutes to set up' },
      { text: 'Repeat one qualifying action each week, such as a deposit, a swap, a vote or a borrow, so the wallet stays active.', cost: 'about $' + gas + ' of gas a week', time: '10 minutes a week' },
      { text: 'Hold the position for at least ' + hold + ' days so the activity lands in more than one snapshot.', cost: 'the $' + capital + ' stays in the position', time: hold + ' days' },
      { text: "Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.", cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
      { text: 'Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.', cost: 'nothing but the log', time: '5 minutes' },
    ];
  }
  function stepText(step) {
    var s = step.text + ' Cost: ' + step.cost + '. Time: ' + step.time + '.';
    if (s.length > 600) s = s.slice(0, 596) + '...';
    if (s.length < 20) s = s + ' Hold the position and check the protocol\'s own page.';
    return s;
  }
  // Exposed for the entry's own verification (main.ts must write the same six steps).
  window.RADAR_TEST = { farmSteps: farmSteps, stepText: stepText };

  // ---- state from the address hash, so each view has its own link ----
  function readHash() {
    // A hash link states the whole view: anything it does not name is reset, so a link to
    // one view never carries another view's selection along with it.
    state.q = ''; state.category = 'all'; state.chain = 'all'; state.tab = 'pre-token';
    state.sort = 'implied'; state.dir = -1; state.selected = null; state.watchOnly = false;
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('chain')) state.chain = params.get('chain');
    if (params.get('tab')) state.tab = params.get('tab');
    if (params.get('sort')) state.sort = params.get('sort');
    if (params.get('watch') === '1') state.watchOnly = true;
    if (params.get('detail')) state.selected = params.get('detail');
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.tab !== 'pre-token') params.set('tab', state.tab);
    if (state.sort !== 'implied') params.set('sort', state.sort);
    if (state.watchOnly) params.set('watch', '1');
    if (state.selected) params.set('detail', state.selected);
    var h = params.toString();
    history.replaceState(null, '', h ? '#' + h : '#');
  }

  // ---- filtering and sorting ----
  function rows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.watchOnly && !r.watchlist) return false;
      if (state.category !== 'all' && (r.category || 'Other') !== state.category) return false;
      if (state.chain !== 'all' && r.chains.indexOf(state.chain) === -1) return false;
      if (q && (r.name + ' ' + r.slug + ' ' + (r.category || '')).toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
  }
  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var d = 0;
      if (key === 'name') d = a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
      else if (key === 'tvl') d = a.tvl_usd - b.tvl_usd;
      else if (key === 'change') d = (a.change_7d || 0) - (b.change_7d || 0);
      else if (key === 'age') d = (a.age_days === null ? -1 : a.age_days) - (b.age_days === null ? -1 : b.age_days);
      else d = a.implied_value_usd - b.implied_value_usd;
      if (d === 0) d = a.slug < b.slug ? -1 : 1;
      return d * state.dir;
    });
  }
  function openDetail(slug) { state.selected = slug; writeHash(); render(); }
  function closeDetail() { state.selected = null; writeHash(); render(); }

  // ---- rendering ----
  function header() {
    var total = DATA.rows.reduce(function (n, r) { return n + r.implied_value_usd; }, 0);
    return el('div', {}, [
      el('header', { class: 'hero' }, [
        el('h1', { html: 'Token Radar<span class="dot">.</span>' }),
        el('p', { text: 'Every protocol in the snapshot that records no token, ranked by what its launch would be worth — and what to do to farm it before it launches.' }),
        el('div', { class: 'meta', text: 'Snapshot ' + DATA.as_of + ' · ' + DATA.source + ' · Model ' + DATA.model_version + ' · Implied values are this radar\u2019s own model, not a market price.' }),
      ]),
      el('div', { class: 'stats' }, [
        el('div', { class: 'stat' }, [el('span', { text: 'Watchlist' }), el('b', { text: String(DATA.watchlist_size) }), el('small', { text: 'protocols at or above the $50M floor' })]),
        el('div', { class: 'stat' }, [el('span', { text: 'Board rows' }), el('b', { text: String(DATA.board_size) }), el('small', { text: DATA.early_size + ' early finds below the floor' })]),
        el('div', { class: 'stat' }, [el('span', { text: 'Total implied value' }), el('b', { text: fmtUsd(total) }), el('small', { text: 'across the whole board' })]),
        el('div', { class: 'stat' }, [el('span', { text: 'Median market multiple' }), el('b', { text: DATA.global_multiple.toFixed(2) + '×' }), el('small', { text: 'market cap / TVL of tokenized protocols' })]),
      ]),
    ]);
  }

  function controls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var chains = Array.from(new Set(DATA.rows.reduce(function (a, r) { return a.concat(r.chains); }, []))).sort();
    var search = el('input', { type: 'search', placeholder: 'Search a protocol…', value: state.q, 'aria-label': 'Search protocols' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    var cat = el('select', { 'aria-label': 'Filter by category' });
    cat.appendChild(el('option', { value: 'all', text: 'All categories' }));
    categories.forEach(function (c) { cat.appendChild(el('option', { value: c, text: c, selected: c === state.category ? 'selected' : null })); });
    cat.addEventListener('change', function () { state.category = cat.value; writeHash(); render(); });
    var ch = el('select', { 'aria-label': 'Filter by chain' });
    ch.appendChild(el('option', { value: 'all', text: 'All chains' }));
    chains.forEach(function (c) { ch.appendChild(el('option', { value: c, text: c, selected: c === state.chain ? 'selected' : null })); });
    ch.addEventListener('change', function () { state.chain = ch.value; writeHash(); render(); });
    var sort = el('select', { 'aria-label': 'Sort the board' });
    [['implied', 'Implied value'], ['tvl', 'TVL'], ['change', '7-day change'], ['age', 'Age without a token'], ['name', 'Name']].forEach(function (o) {
      sort.appendChild(el('option', { value: o[0], text: o[1], selected: o[0] === state.sort ? 'selected' : null }));
    });
    sort.addEventListener('change', function () { state.sort = sort.value; state.dir = -1; writeHash(); render(); });
    var watch = el('input', { type: 'checkbox', checked: state.watchOnly ? 'checked' : null, 'aria-label': 'Watchlist only' });
    watch.addEventListener('change', function () { state.watchOnly = watch.checked; writeHash(); render(); });
    var pre = el('button', { type: 'button', 'aria-pressed': state.tab === 'pre-token' ? 'true' : 'false', text: 'Pre-token', onclick: function () { state.tab = 'pre-token'; writeHash(); render(); } });
    var live = el('button', { type: 'button', 'aria-pressed': state.tab === 'live' ? 'true' : 'false', text: 'Live token', onclick: function () { state.tab = 'live'; writeHash(); render(); } });
    var count = state.tab === 'pre-token' ? rows().length + ' of ' + DATA.rows.length + ' rows shown' : DATA.live.length + ' live-token protocols';
    return el('div', { class: 'controls' }, [
      el('div', { class: 'field' }, [el('label', { text: 'Search' }), search]),
      el('div', { class: 'field' }, [el('label', { text: 'Category' }), cat]),
      el('div', { class: 'field' }, [el('label', { text: 'Chain' }), ch]),
      el('div', { class: 'field' }, [el('label', { text: 'Sort by' }), sort]),
      el('label', { class: 'check' }, [watch, document.createTextNode('Watchlist only')]),
      el('div', { class: 'field' }, [el('label', { text: 'Token status' }), el('div', { class: 'tabs' }, [pre, live])]),
      el('span', { class: 'count', text: count }),
    ]);
  }

  function sortHeader(key, label) {
    var arrow = state.sort === key ? (state.dir < 0 ? ' ▼' : ' ▲') : '';
    return el('th', {}, el('button', {
      type: 'button',
      text: label + arrow,
      onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = -1; } writeHash(); render(); },
    }));
  }

  function boardTable() {
    var list = sortedRows(rows());
    if (list.length === 0) {
      return el('div', { class: 'empty' }, [
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { text: 'Try a different search, category or chain.' }),
        el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; state.watchOnly = false; writeHash(); render(); } }),
      ]);
    }
    var head = el('tr', {}, [
      sortHeader('implied', 'Rank'),
      sortHeader('name', 'Protocol'),
      el('th', { text: 'Category' }),
      el('th', { text: 'Chains' }),
      sortHeader('tvl', 'TVL'),
      sortHeader('change', '7d'),
      sortHeader('age', 'Age'),
      sortHeader('implied', 'Implied value'),
      el('th', { class: 'num', text: 'Multiple' }),
    ]);
    var body = el('tbody', {});
    list.forEach(function (r) {
      var chg = r.change_7d === null ? el('td', { class: 'num', text: '—' }) : el('td', { class: 'num ' + (r.change_7d >= 0 ? 'up' : 'down'), text: fmtPct(r.change_7d) });
      var row = el('tr', {
        class: state.selected === r.slug ? 'selected' : null,
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } },
      }, [
        el('td', { class: 'num', text: '#' + r.rank }),
        el('td', {}, [document.createTextNode(r.name + ' '), el('span', { class: 'slug', text: r.slug }), r.watchlist ? el('span', { class: 'badge', text: '★ Watchlist' }) : null]),
        el('td', { text: r.category || 'Other' }),
        el('td', { text: r.chains.slice(0, 3).join(', ') + (r.chains.length > 3 ? ' +' + (r.chains.length - 3) : '') }),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        chg,
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', { class: 'num implied', text: fmtUsd(r.implied_value_usd) }),
        el('td', { class: 'num', text: r.category_multiple.toFixed(2) + '×' }),
      ]);
      body.appendChild(row);
    });
    var table = el('table', {}, [el('thead', {}, head), body]);
    return el('div', {}, [table, el('p', { class: 'note', text: 'Click a row for the protocol\u2019s detail view and farm plan. ★ marks the 40 watchlist protocols at or above the $50M floor.' })]);
  }

  function liveTable() {
    var head = el('tr', {}, [
      el('th', { text: 'Protocol' }), el('th', { text: 'Category' }), el('th', { text: 'Chains' }),
      el('th', { class: 'num', text: 'TVL' }), el('th', { class: 'num', text: '7d' }), el('th', { class: 'num', text: 'Market cap' }),
    ]);
    var body = el('tbody', {});
    DATA.live.forEach(function (r) {
      body.appendChild(el('tr', {}, [
        el('td', {}, [document.createTextNode(r.name + ' '), el('span', { class: 'slug', text: r.slug })]),
        el('td', { text: r.category || 'Other' }),
        el('td', { text: r.chains.slice(0, 3).join(', ') + (r.chains.length > 3 ? ' +' + (r.chains.length - 3) : '') }),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + ((r.change_7d || 0) >= 0 ? 'up' : 'down'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num implied', text: fmtUsd(r.mcap_usd) }),
      ]));
    });
    return el('div', {}, [
      el('table', {}, [el('thead', {}, head), body]),
      el('p', { class: 'note', text: 'These protocols already trade: the board shows the market\u2019s own value for them, never a model\u2019s. They are kept apart from the ranked board.' }),
    ]);
  }

  function detailCard() {
    var r = null;
    for (var i = 0; i < DATA.rows.length; i++) if (DATA.rows[i].slug === state.selected) { r = DATA.rows[i]; break; }
    if (!r) return null;
    var steps = farmSteps(r, r.age_days).map(stepText);
    var math = 'TVL ' + fmtUsdFull(r.tvl_usd) + ' × ' + r.category_multiple.toFixed(2) + ' (category multiple) × ' + r.growth_multiplier.toFixed(2) + ' (growth) × ' + r.maturity_multiplier.toFixed(2) + ' (maturity) × ' + r.breadth_multiplier.toFixed(2) + ' (breadth) ≈ ' + fmtUsdFull(r.implied_value_usd);
    return el('section', { class: 'detail', 'aria-label': 'Protocol detail' }, [
      el('h2', {}, [document.createTextNode('#' + r.rank + ' ' + r.name + ' '), r.watchlist ? el('span', { class: 'badge', text: '★ Watchlist' }) : null]),
      el('div', { class: 'sub', text: r.slug + ' · ' + (r.category || 'Other') + ' · ' + r.chains.join(', ') + ' · tracked since ' + (r.listed_at || 'unknown') }),
      el('div', { class: 'facts' }, [
        el('div', {}, [el('span', { text: 'Implied value' }), el('b', { text: fmtUsdFull(r.implied_value_usd) })]),
        el('div', {}, [el('span', { text: 'TVL' }), el('b', { text: fmtUsdFull(r.tvl_usd) })]),
        el('div', {}, [el('span', { text: '7-day change' }), el('b', { text: fmtPct(r.change_7d) })]),
        el('div', {}, [el('span', { text: 'Age without a token' }), el('b', { text: fmtAge(r.age_days) })]),
      ]),
      el('div', { class: 'math' }, [el('b', { text: 'How the value is built: ' }), el('code', { text: math })]),
      el('h3', { text: 'Farm plan — six steps' }),
      el('ol', { class: 'steps' }, steps.map(function (s) { return el('li', { text: s }); })),
      el('p', { class: 'note', text: 'This protocol records no token in the snapshot. That is not proof it has none: a token the snapshot does not carry would still be missing from this board.' }),
      el('button', { class: 'close', type: 'button', text: 'Close detail', onclick: closeDetail }),
    ]);
  }

  function setAsideSection() {
    if (!DATA.set_aside || DATA.set_aside.length === 0) return null;
    var head = el('tr', {}, [
      el('th', { text: 'Protocol' }), el('th', { text: 'Category' }),
      el('th', { class: 'num', text: 'TVL' }), el('th', { text: 'Why it is not ranked' }),
    ]);
    var body = el('tbody', {});
    DATA.set_aside.forEach(function (r) {
      body.appendChild(el('tr', {}, [
        el('td', {}, [document.createTextNode(r.name + ' '), el('span', { class: 'slug', text: r.slug })]),
        el('td', { text: r.category || 'Other' }),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { text: r.reason }),
      ]));
    });
    return el('section', { class: 'method' }, [
      el('h2', { text: 'Set aside — not ranked' }),
      el('p', { text: 'These protocols record no token either, but they are wrapped, staked or bridged products of a token that already trades — WBTC is Bitcoin on Ethereum, Binance staked ETH is ETH in Binance\u2019s staking product — so they are not protocols still waiting on a launch of their own. ' + DATA.set_aside_size + ' such products are set aside in all; the 12 biggest are shown.' }),
      el('table', {}, [el('thead', {}, head), body]),
    ]);
  }

  function method() {
    var m = DATA.model;
    return el('section', { class: 'method' }, [
      el('h2', { text: 'How the radar works' }),
      el('p', { html: 'Implied value = <code>TVL × category multiple × growth × maturity × breadth</code>. The category multiple is the median market-cap-to-TVL ratio of the tokenized protocols in the same category (at least ' + m.min_comps + ' comparables, else the global median of ' + DATA.global_multiple.toFixed(2) + '×), clamped to ' + m.mult_min + '–' + m.mult_max + '. Growth is the 7-day TVL change clamped to ' + m.growth_floor + '…+' + m.growth_cap + '% and weighted ' + m.growth_weight + '. Maturity runs ' + m.maturity_floor + '–' + (m.maturity_floor + m.maturity_range) + ' over ' + m.maturity_days + ' days without a token (' + m.unknown_age_days + ' days when the listing date is unknown). Breadth adds ' + m.breadth_step + ' per extra chain, up to ' + m.breadth_max_extra + ' extra chains. No protocol name is ever special-cased.' }),
      el('p', { text: 'The watchlist is the floor, never the ceiling: the 40 protocols at or above $50M with no token recorded, minus wrapped, staked and bridged products. The board adds every other pre-token protocol it can rank, so the radar also finds the early ones below the floor. Wrapped, staked and bridged products are set aside, never ranked, and the live-token protocols are shown apart with the market\u2019s own values.' }),
      el('p', { text: 'What this radar does not do: it does not predict whether or when a protocol issues a token. The implied value is the entry\u2019s own claim about what a launch would be worth if the protocol\u2019s record stayed as it is.' }),
    ]);
  }

  function render() {
    var root = document.getElementById('board');
    root.setAttribute('aria-busy', 'false');
    root.textContent = '';
    root.appendChild(header());
    root.appendChild(controls());
    var d = detailCard();
    if (d) root.appendChild(d);
    root.appendChild(state.tab === 'pre-token' ? boardTable() : liveTable());
    if (state.tab === 'pre-token') { var s = setAsideSection(); if (s) root.appendChild(s); }
    root.appendChild(method());
    root.appendChild(el('footer', {}, [
      el('p', { text: 'Data: DefiLlama protocols snapshot, as of ' + DATA.as_of + '. ' + DATA.source }),
      el('p', { text: 'Token Radar, model ' + DATA.model_version + '. Implied values are this entry\u2019s own model, not a market price, and not investment advice.' }),
    ]));
  }

  function init() {
    if (!DATA) {
      document.getElementById('board').textContent = 'Token Radar: no data. The dashboard needs its data.js beside it.';
      return;
    }
    readHash();
    window.addEventListener('hashchange', function () { readHash(); render(); });
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
