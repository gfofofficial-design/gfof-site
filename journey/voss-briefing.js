'use strict';
(() => {
  const signals = {
    structure: {
      kicker: 'Signal 01 / Token structure',
      title: '“The biggest account must be the team.”',
      context: 'A scout opens a Dossier Lens report and sees one very large token account. Its controller address matches a published program address. The scout wants to post that the team sold.',
      voss: 'A balance is an observation. A sale is an event. Are they the same claim?',
      truth: 'The Lens can show a dated mint and largest-account snapshot. An address match alone does not identify an account role, a person, or a sale. Follow transaction evidence separately and leave the role unclassified when it is unproven.',
      end: 'The record is narrower than the rumor.',
      links: [
        ['Open the Solana Lens beta', 'https://dossiertrack.co/token-structure'],
        ['Open the transaction trail', 'https://dossiertrack.co/transaction-trail']
      ],
      choices: [
        {label:'Post that the team sold', feedback:'That jumps from a balance to a sale and from an address to a person. Neither follows from this snapshot.', voss:'“Name the observation first. Investigate the event before naming an actor.”'},
        {label:'Describe the account as unclassified and check transaction evidence', feedback:'That keeps the finding useful without turning a clue into a verdict.', voss:'“A precise unknown is better than a confident story the record cannot carry.”'},
        {label:'Call the token safe because the account matches a known program', feedback:'A documented address match is not a safety check or proof of a pool vault for this mint.', voss:'“A familiar address can be a clue. It is not a certificate.”'}
      ]
    },
    lending: {
      kicker: 'Signal 02 / Real finance build',
      title: '“The Lending Lab takes deposits, right?”',
      context: 'A visitor enjoyed the wallet-free Lending Lab. They now offer real USDC to test the Federation market and ask what yield they will receive.',
      voss: 'The simulation teaches the loop. What can you invite them to do today?',
      truth: 'The Lending Lab uses fictional balances in the browser. The separate Solana lending program is in private development. There is no public deposit path, live market, or promised yield.',
      end: 'The real market is still being built.',
      links: [
        ['Play the Lending Lab', 'lending-lab.html'],
        ['See the real build and open gates', '/building#lending-progress']
      ],
      choices: [
        {label:'Ask them to send USDC so they can join the first pool', feedback:'There is no public lending market to receive their funds. A simulation cannot authorize a deposit.', voss:'“The right invitation is to test the idea, not to transfer money.”'},
        {label:'Invite them to replay the Lab and follow the public build record', feedback:'That gives them something usable now and a direct way to watch real product progress.', voss:'“Show the working model, then show the work still required.”'},
        {label:'Promise a return once GFOF migrates', feedback:'Token migration does not make a lending market live or establish a yield. That promise is unsupported.', voss:'“Milestones are not interest payments.”'}
      ]
    },
    journey: {
      kicker: 'Signal 03 / The Journey',
      title: '“Will finishing a mission earn GFOF?”',
      context: 'An explorer finishes a story chapter and sees a badge in their optional browser passport. They ask whether it is a token claim or a place in a future finance beta.',
      voss: 'The badge marks learning. What does it grant?',
      truth: 'Journey missions and badges are free, fictional education. An optional passport can remember completion on this device. A badge does not grant GFOF, yield, beta access, or a financial right.',
      end: 'The badge stays inside the story.',
      links: [
        ['Explore the Journey', './'],
        ['Read the product build record', '/building#lending-progress']
      ],
      choices: [
        {label:'Say the badge reserves a beta place', feedback:'The badge only records completion in the browser. It does not reserve access to a future product.', voss:'“A story reward should stay a story reward.”'},
        {label:'Explain the badge and invite them to another free mission', feedback:'That is the honest promise: a small accomplishment and another path to explore.', voss:'“Keep the door open without attaching a price tag to it.”'},
        {label:'Suggest they buy GFOF to make the badge valuable', feedback:'Mission completion has no token entitlement, and the Journey does not ask anyone to purchase.', voss:'“Let curiosity lead. Do not turn a badge into a sales claim.”'}
      ]
    }
  };
  const $ = id => document.getElementById(id);
  const panels = ['intro','routes','decision','result'];
  let active = null;
  function show(id) {
    panels.forEach(name => { $(name).hidden = name !== id; });
    const step = id === 'result' ? 3 : id === 'decision' ? 2 : 1;
    ['step-one','step-two','step-three'].forEach((name,index) => {
      $(name).classList.toggle('active',index === step-1);
      $(name).classList.toggle('done',index < step-1);
    });
    $('stage-label').textContent = id === 'result' ? 'Record checked' : id === 'decision' ? 'Response requested' : 'Awaiting your signal';
    if (id !== 'intro') $(id).querySelector('h2').focus();
  }
  function selectRoute(key) {
    active = signals[key];
    if (!active) return;
    $('decision-kicker').textContent = active.kicker;
    $('decision-title').textContent = active.title;
    $('decision-context').textContent = active.context;
    $('decision-voss').textContent = active.voss;
    $('choices').replaceChildren();
    active.choices.forEach((choice,index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = choice.label;
      button.addEventListener('click',() => decide(index));
      $('choices').append(button);
    });
    show('decision');
  }
  function decide(index) {
    if (!active || !active.choices[index]) return;
    const choice = active.choices[index];
    $('result-title').textContent = active.end;
    $('result-feedback').textContent = choice.feedback;
    $('result-truth').textContent = active.truth;
    $('result-voss').textContent = choice.voss;
    $('result-links').replaceChildren();
    active.links.forEach(([label,url]) => {
      const link = document.createElement('a');
      link.href = url;
      link.textContent = label + ' →';
      if (url.startsWith('https://')) { link.target = '_blank'; link.rel = 'noopener noreferrer'; }
      $('result-links').append(link);
    });
    show('result');
  }
  $('start').addEventListener('click',() => show('routes'));
  document.querySelectorAll('[data-route]').forEach(button => button.addEventListener('click',() => selectRoute(button.dataset.route)));
  $('back-to-routes').addEventListener('click',() => show('routes'));
  $('retry').addEventListener('click',() => { if (active) show('decision'); });
  $('another').addEventListener('click',() => { active = null; show('routes'); });
})();
