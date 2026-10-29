// Reviewed public copy only. These records do not control runtime permissions,
// indicate provider health or establish the freshness of any financial data.
export const TOOL_COPY_REVIEWED = '2026-10-29';

export const FEDERATION_TOOLS = Object.freeze(Object.fromEntries(Object.entries({
  wallet: {
    title: 'Command Deck', action: 'Read wallet quantities', href: '/command-deck', state: 'read-only', status: 'Read only',
    description: 'Read public Solana token quantities and available reference prices.',
  },
  alliance: {
    title: 'Federation Alliance', action: 'Explore the Alliance', href: '/alliance#start-here', state: 'public-preview', status: 'Public preview · joining closed',
    description: 'Find project tools and proposed challenges. Public membership and competition enrollment remain closed.',
  },
  swap: {
    title: 'Galactic Swap', action: 'Check a GFOF quote', href: '/swap', state: 'quote-only', status: 'Quote preview · trading closed',
    description: 'Compare SOL and GFOF quotes. No wallet is needed and no transaction is created.',
  },
  lens: {
    title: 'Dossier Lens', action: 'Research a Solana mint', href: 'https://dossiertrack.co/token-structure', state: 'read-only-beta', status: 'Public beta · read only',
    description: 'Inspect a Solana mint’s controls and token accounts, with sources and explicit unknowns.',
  },
  treasury: {
    title: 'Treasury & transparency', href: '/treasury', state: 'published-evidence', status: 'Published token and lock evidence',
    description: 'Read the dated disclosures and source links behind the Federation’s token records.',
  },
  account: {
    title: 'Federation account', href: '/account', state: 'existing-accounts', status: 'Existing approved accounts only',
    description: 'Email-code sign-in is available for existing approved accounts. Public registration and cloud progress sync are not open. Google sign-in is deferred.',
  },
}).map(([id, value]) => [id, Object.freeze(value)])));

const escape = value => value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function renderToolSlot(slot) {
  if (slot === 'alliance-account') {
    const tool = FEDERATION_TOOLS.account;
    return `<a class="alliance-account-shortcut" href="${tool.href}">Sign in<span>${escape(tool.status)}</span></a>`;
  }
  if (slot === 'deck-account') return escape(FEDERATION_TOOLS.account.description);
  if (!['deck', 'alliance'].includes(slot)) throw Error('Unknown Federation tool slot');
  const ids = slot === 'deck' ? ['wallet', 'alliance', 'swap', 'lens'] : ['wallet', 'swap', 'lens', 'treasury'];
  return ids.map(id => {
    const tool = FEDERATION_TOOLS[id], href = slot === 'deck' && id === 'wallet' ? '#wallet' : tool.href;
    if (slot === 'alliance') return `<a href="${escape(href)}">${escape(tool.title)}<span>${escape(tool.status)}</span></a>`;
    return `<a class="brief-option" href="${escape(href)}"><span class="status">${escape(tool.status)}</span><strong>${escape(tool.action)}</strong><span>${escape(tool.description)}</span></a>`;
  }).join('\n');
}
