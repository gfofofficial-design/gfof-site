// Reviewed public copy only. These records do not control runtime permissions,
// indicate provider health or establish the freshness of any financial data.
import {QUOTE_PAIRS} from '../../assets/federation/swap/token-registry.mjs';

export const TOOL_COPY_REVIEWED = '2026-10-30';
const quoteSymbols = [...new Set(QUOTE_PAIRS.flatMap(({input, output}) => [input.symbol, output.symbol]))].join(', ');

export const FEDERATION_TOOLS = Object.freeze(Object.fromEntries(Object.entries({
  wallet: {
    title: 'Command Deck', action: 'Read wallet quantities', href: '/command-deck', workspaceHref: '/command-deck#wallet', state: 'read-only', status: 'Read only',
    description: 'Read public Solana token quantities and available reference prices.',
  },
  alliance: {
    title: 'Federation Alliance', action: 'Explore the Alliance', href: '/alliance#start-here', state: 'public-preview', status: 'Public preview · joining closed',
    description: 'Find project tools and proposed challenges. Public membership and competition enrollment remain closed.',
  },
  swap: {
    title: 'Galactic Swap', action: 'Check a token quote', href: '/swap', state: 'quote-only', status: 'Quote preview · trading closed',
    description: 'Compare quotes for ' + quoteSymbols + ' on Solana. Routes vary. No wallet is needed and no transaction is created.',
  },
  lens: {
    title: 'Dossier Lens', action: 'Research a Solana mint', href: 'https://dossiertrack.co/token-structure', state: 'read-only-beta', status: 'Public beta · read only',
    description: 'Inspect a Solana mint’s controls and token accounts, with sources and explicit unknowns.',
  },
  federationWallet: {
    title: 'Federation Wallet', href: '/wallet', state: 'public-beta', status: 'Public beta · separate Privy sign-in',
    description: 'Create or reopen a Solana wallet using Privy.',
  },
  bridge: {
    title: 'Swap & Bridge', href: '/bridge-preview.html', state: 'saved-demo', status: 'Saved route demo · trading closed',
    description: 'Explore examples of cross-chain routes.',
  },
  dossierAgent: {
    title: 'Dossier Agent', href: 'https://dossiertrack.co/dossier-agent', state: 'fictional-demo', status: 'Interactive demo · fictional data',
    description: 'Replay a signal and inspect the evidence behind it.',
  },
  treasury: {
    title: 'Treasury & transparency', href: '/treasury', state: 'published-evidence', status: 'Published token and lock evidence',
    description: 'Read the dated disclosures and source links behind the Federation’s token records.',
  },
  capitalCommand: {
    title: 'Capital Command', href: 'https://fcc.galacticfederation.co/', state: 'public-record', status: 'Public record',
    description: 'Review commitments, results and corrections.',
  },
  account: {
    title: 'Federation account', href: '/account', state: 'existing-accounts', status: 'Existing approved accounts only',
    description: 'Email-code sign-in is available for existing approved accounts. Public registration and cloud progress sync are not open. Google sign-in is deferred.',
  },
}).map(([id, value]) => [id, Object.freeze(value)])));

const escape = value => value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const workspaceTools = ['wallet', 'lens', 'swap', 'federationWallet', 'bridge', 'dossierAgent', 'treasury', 'capitalCommand'];

function renderDeckLinks(ids) {
  return ids.map(id => {
    const {href, title, status} = FEDERATION_TOOLS[id];
    return `    <li><a href="${escape(href)}">${escape(title)}</a><span>${escape(status)}</span></li>`;
  }).join('\n');
}

export function renderToolSlot(slot) {
  if (slot === 'alliance-account') {
    const tool = FEDERATION_TOOLS.account;
    return `<a class="alliance-account-shortcut" href="${tool.href}">Sign in<span>${escape(tool.status)}</span></a>`;
  }
  if (slot === 'deck-account') return escape(FEDERATION_TOOLS.account.description);
  if (slot === 'deck-evidence') return renderDeckLinks(['federationWallet', 'bridge', 'dossierAgent']);
  if (slot === 'deck-records') return renderDeckLinks(['treasury', 'capitalCommand']);
  if (slot === 'workspace-tools') {
    return '      <ul class="workspace-tool-list" role="list">\n' + workspaceTools.map(id => {
      const tool = FEDERATION_TOOLS[id];
      const href = tool.workspaceHref ?? tool.href;
      const name = id === 'wallet' ? tool.action : tool.title;
      return `        <li><a href="${escape(href)}"><strong>${escape(name)}</strong><span class="workspace-tool-state">${escape(tool.status)}</span><span>${escape(tool.description)}</span></a></li>`;
    }).join('\n') + '\n      </ul>';
  }
  if (slot === 'account-tools') {
    return '<ul>' + ['wallet', 'swap', 'lens', 'treasury'].map(id => {
      const tool = FEDERATION_TOOLS[id];
      return `<li><a href="${escape(tool.href)}">${escape(tool.title)}</a> · ${escape(tool.status)}<p>${escape(tool.description)}</p></li>`;
    }).join('\n') + '</ul>';
  }

  if (!['deck', 'alliance'].includes(slot)) throw Error('Unknown Federation tool slot');
  const ids = slot === 'deck' ? ['wallet', 'alliance', 'swap', 'lens'] : ['wallet', 'swap', 'lens', 'treasury'];
  return ids.map(id => {
    const tool = FEDERATION_TOOLS[id], href = slot === 'deck' && id === 'wallet' ? '#wallet' : tool.href;
    if (slot === 'alliance') return `<a href="${escape(href)}">${escape(tool.title)}<span>${escape(tool.status)}</span></a>`;
    return `<a class="brief-option" href="${escape(href)}"><span class="status">${escape(tool.status)}</span><strong>${escape(tool.action)}</strong><span>${escape(tool.description)}</span></a>`;
  }).join('\n');
}
