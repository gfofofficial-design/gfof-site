'use strict';
(() => {
  const MINT = 'Dc9CeuctqvP947ipnCJb8fSf6HhNWDooAQxsVHj2RNBV';
  const PROGRAM = 'strmRqUCoQUgGUan5YhzUZa6KqdzwX5L6FpUxfmKg5m';
  const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
  const TOKEN_SCALE = 1e6;
  const MINT_SUPPLY = 1e15;
  const LOCKS = [
    ['AiRhuw9iFyXiZYv2hqanBK12dckebF4vNMoAzj9Nj9nY', 'F1iUer7wVsdv7uQ4if77Jy1ZAfTVDjSy4Pd7ZiXsVfS1'],
    ['BW6ZUUT5NXxSGMKNAzoMYbqrXy5Dm1ev1ekEgYSXJWX8', '9NeQZao9SNt7FztKbNMCwCmEYZTYkWnidZmW4chuupQq'],
    ['EPdpg7AYEzcwudN7TRdEkCGHQeHRrFhoK2yiYxDdGLnv', 'DkzEr7nsuhL4Ser6AyZQ71u2mBdGj86mXmHDAzpS1Pop'],
  ];
  const get = id => document.getElementById(id);
  const button = get('deck-lock-refresh');
  const results = get('deck-lock-results');
  const message = get('deck-lock-message');
  const total = get('deck-lock-total');
  const percent = get('deck-lock-percent');
  const cards = get('deck-lock-cards');
  const plot = get('deck-lock-timeline');
  const verification = get('deck-lock-verification');
  const sourceStates = document.querySelectorAll('[data-lock-source-state]');
  const sourceMarkers = document.querySelectorAll('[data-lock-source-marker]');
  const sourceDetails = get('deck-lock-source-details');
  const evidenceSummary = get('deck-lock-evidence-summary');
  const shortDate = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago', month: 'short', day: 'numeric', year: 'numeric',
  });
  const centralTime = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago', year: 'numeric', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', second: '2-digit', timeZoneName: 'short',
  });
  const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 });
  function quantity(baseUnits) {
    const remainder = baseUnits % TOKEN_SCALE;
    const whole = number.format((baseUnits - remainder) / TOKEN_SCALE);
    const fractional = remainder ? '.' + String(remainder).padStart(6, '0').replace(/0+$/, '') : '';
    return whole + fractional + ' GFOF';
  }
  let pending = false;

  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  function base58(bytes) {
    const alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let n = 0n;
    let out = '';
    for (const b of bytes) n = n * 256n + BigInt(b);
    while (n) {
      out = alphabet[Number(n % 58n)] + out;
      n /= 58n;
    }
    for (const b of bytes) {
      if (b !== 0) break;
      out = '1' + out;
    }
    return out;
  }

  function u64(bytes, offset) {
    const n = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getBigUint64(offset, true);
    if (n > BigInt(Number.MAX_SAFE_INTEGER)) throw Error('Unsafe quantity');
    return Number(n);
  }

  function decode(data) {
    const observedAt = Date.parse(data?.observedAt);
    if (data?.mint !== MINT || data.commitment !== 'finalized' ||
        !Number.isSafeInteger(data.slot) || data.slot < 0 ||
        !Array.isArray(data.accounts) || data.accounts.length !== 7 ||
        typeof data.observedAt !== 'string' || !Number.isFinite(observedAt) ||
        Math.abs(Date.now() - observedAt) > 120000) {
      throw Error('Unverified read');
    }
    const byAddress = new Map(data.accounts.map(entry => [entry.address, entry.account]));
    if (byAddress.size !== 7) throw Error('Duplicate account');
    const mint = byAddress.get(MINT);
    const info = mint?.data?.parsed?.info;
    if (mint?.owner !== TOKEN_PROGRAM || info?.decimals !== 6 || info?.supply !== String(MINT_SUPPLY)) {
      throw Error('Mint changed');
    }

    const locks = LOCKS.map(([metadata, escrow], index) => {
      const account = byAddress.get(metadata);
      const token = byAddress.get(escrow);
      const balance = token?.data?.parsed?.info;
      if (account?.owner !== PROGRAM || !Array.isArray(account.data) || account.data[1] !== 'base64') {
        throw Error('Metadata unavailable');
      }
      const bytes = Uint8Array.from(atob(account.data[0]), char => char.charCodeAt(0));
      if (bytes.length !== 1104 || bytes[8] !== 4 ||
          base58(bytes.slice(177, 209)) !== MINT || base58(bytes.slice(209, 241)) !== escrow) {
        throw Error('Contract mismatch');
      }
      if (token?.owner !== TOKEN_PROGRAM || balance?.mint !== MINT ||
          balance?.tokenAmount?.decimals !== 6 || !/^\d+$/.test(balance.tokenAmount.amount)) {
        throw Error('Escrow mismatch');
      }
      const escrowBalance = Number(balance.tokenAmount.amount);
      const principal = u64(bytes, 417);
      const withdrawn = u64(bytes, 17);
      const cliff = u64(bytes, 441);
      const end = u64(bytes, 33);
      const canceled = u64(bytes, 25) !== 0;
      if (!Number.isSafeInteger(escrowBalance) || withdrawn > principal ||
          u64(bytes, 409) !== cliff || end !== cliff || u64(bytes, 449) !== principal ||
          cliff < 1577836800 || cliff > 4102444800) {
        throw Error('Unsupported schedule');
      }
      const amount = canceled ? 0 : Math.min(escrowBalance, principal - withdrawn);
      const status = canceled ? 'Canceled' : observedAt >= end * 1000 ? 'Cliff reached' : 'Before cliff';
      return { index, metadata, escrow, amount, principal, withdrawn, escrowBalance, cliff, status };
    });
    const scheduledTotal = locks.reduce((sum, lock) => sum + lock.amount, 0);
    if (!Number.isSafeInteger(scheduledTotal) || scheduledTotal > MINT_SUPPLY) throw Error('Supply mismatch');
    return { locks, scheduledTotal, observedAt };
  }

  function definition(list, term, value) {
    const entry = element('div');
    const description = element('dd');
    description.append(value);
    entry.append(element('dt', term), description);
    list.append(entry);
  }

  function renderCard(lock, scheduledTotal) {
    const label = 'Lock ' + (lock.index + 1);
    const card = element('article', undefined, 'lock-signal');
    card.append(element('h3', label), element('span', lock.status, 'status'));
    card.append(element('strong', quantity(lock.amount), 'lock-quantity'));
    card.append(element('p', 'Scheduled tokens still in escrow', 'note'));
    const share = scheduledTotal ? lock.amount / scheduledTotal : 0;
    const meter = element('meter');
    meter.min = 0;
    meter.max = 1;
    meter.value = share;
    meter.setAttribute('aria-label', label + ' share of the scheduled total, ' + (share * 100).toFixed(1) + '%');
    card.append(meter);

    const table = element('dl', undefined, 'lock-facts');
    definition(table, 'Scheduled principal', quantity(lock.principal));
    definition(table, 'Observed escrow balance', quantity(lock.escrowBalance));
    const cliffDate = new Date(lock.cliff * 1000);
    const cliffTime = element('time', centralTime.format(cliffDate));
    cliffTime.setAttribute('datetime', cliffDate.toISOString());
    definition(table, 'Full-cliff time', cliffTime);
    card.append(table);
    if (lock.escrowBalance > lock.amount) {
      card.append(element('p', quantity(lock.escrowBalance - lock.amount) + ' in this escrow is outside the displayed scheduled amount.', 'note'));
    }

    const source = element('details');
    const fields = element('dl', undefined, 'lock-facts');
    definition(fields, 'Streamflow contract', element('code', lock.metadata));
    definition(fields, 'Escrow account', element('code', lock.escrow));
    definition(fields, 'Recorded withdrawals', quantity(lock.withdrawn));
    source.append(element('summary', label + ' source details'), fields);
    const link = element('a', 'Verify ' + label.toLowerCase() + ' on Streamflow');
    link.href = 'https://app.streamflow.finance/contract/solana/mainnet/' + lock.metadata;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    source.append(link);
    card.append(source);
    return card;
  }

  function svg(tag, fields) {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [key, value] of Object.entries(fields)) node.setAttribute(key, String(value));
    return node;
  }

  function renderTimeline(locks) {
    // The records already expose all dates as text, including in narrow layouts.
    const timeline = svg('svg', { viewBox: '0 0 720 120', 'aria-hidden': 'true', focusable: 'false' });
    const sorted = [...locks].sort((a, b) => a.cliff - b.cliff);
    const first = sorted[0].cliff;
    const last = sorted.at(-1).cliff;
    timeline.append(svg('line', { x1: 40, x2: 680, y1: 55, y2: 55 }));
    for (const lock of sorted) {
      const x = first === last ? 360 : 40 + (lock.cliff - first) / (last - first) * 640;
      timeline.append(svg('circle', { cx: x, cy: 55, r: 7 }));
      const label = svg('text', {
        x, y: lock.index === 0 ? 90 : 30, 'text-anchor': x > 650 ? 'end' : x < 70 ? 'start' : 'middle',
      });
      label.textContent = 'Lock ' + (lock.index + 1) + ' · ' + shortDate.format(lock.cliff * 1000);
      timeline.append(label);
    }
    plot.replaceChildren(timeline);
  }

  function setEvidence(state, data) {
    const recorded = state === 'Recorded';
    for (const item of sourceStates) {
      item.textContent = state;
      item.classList.toggle('recorded', recorded);
    }
    for (const marker of sourceMarkers) marker.classList.toggle('recorded', recorded);
    verification.textContent = 'No current verification available.';
    if (recorded) {
      const time = element('time', centralTime.format(data.observedAt));
      time.setAttribute('datetime', new Date(data.observedAt).toISOString());
      verification.replaceChildren('Finalized slot ' + number.format(data.slot) + ' · Last verified ', time);
    }
  }

  function render({ locks, scheduledTotal, observedAt }, slot) {
    total.textContent = quantity(scheduledTotal);
    percent.textContent = (scheduledTotal / MINT_SUPPLY * 100).toFixed(2) + '% of minted supply across these schedules.';
    cards.replaceChildren(...locks.map(lock => renderCard(lock, scheduledTotal)));
    renderTimeline(locks);
    setEvidence('Recorded', { slot, observedAt });
    message.textContent = 'Three lock records verified. ' + quantity(scheduledTotal) + ' in scheduled escrow.';
  }

  async function refresh() {
    if (pending) return;
    pending = true;
    button.setAttribute('aria-disabled', 'true');
    results.setAttribute('aria-busy', 'true');
    total.textContent = 'Checking…';
    percent.textContent = 'Waiting for a verified current read.';
    cards.replaceChildren();
    plot.replaceChildren();
    setEvidence('Checking');
    message.textContent = 'Checking the three public lock records.';

    const controller = new AbortController();
    let onAbort;
    const aborted = new Promise((_, reject) => {
      onAbort = () => reject(Error('Unavailable'));
      controller.signal.addEventListener('abort', onAbort, { once: true });
    });
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const data = await Promise.race([(async () => {
        const response = await fetch('/api/treasury-locks', { credentials: 'omit', signal: controller.signal });
        controller.signal.throwIfAborted();
        if (!response.ok) throw Error('Unavailable');
        return response.json();
      })(), aborted]);
      render(decode(data), data.slot);
    } catch {
      cards.replaceChildren();
      plot.replaceChildren();
      total.textContent = 'Unavailable';
      percent.textContent = 'Current read could not be verified.';
      setEvidence('Unavailable');
      message.textContent = 'Current lock records are unavailable. View the dated Treasury records or refresh to try again.';
    } finally {
      clearTimeout(timer);
      controller.signal.removeEventListener('abort', onAbort);
      controller.abort();
      pending = false;
      button.setAttribute('aria-disabled', 'false');
      results.setAttribute('aria-busy', 'false');
    }
  }

  get('deck-lock-source-link').addEventListener('click', event => {
    event.preventDefault();
    sourceDetails.parentElement.open = true;
    sourceDetails.focus();
  });
  get('deck-lock-evidence-return').addEventListener('click', event => {
    event.preventDefault();
    evidenceSummary.focus();
  });
  button.addEventListener('click', refresh);
  button.hidden = false;
  refresh();
})();
