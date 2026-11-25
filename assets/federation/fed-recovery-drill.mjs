import {recoveryCases} from './fed-recovery-drill-cases.mjs';

const byId = name => document.getElementById('recovery-' + name);
const caseButtons = Array.from(byId('app').querySelectorAll('[data-case]'));
const form = byId('form');
const choices = byId('choices');
const options = byId('options');
const feedback = byId('feedback');
const checkButton = byId('check');
const continueButton = byId('continue');
const planLink = byId('plan-link');
let activeButton;
let activeCase;
let step = 0;
let correct = false;

function createText(tag, text) {
  const element = document.createElement(tag);
  element.textContent = text;
  return element;
}

function renderDecision() {
  const {question, update, choices: answers} = activeCase.decisions[step];
  byId('step').textContent = 'Decision ' + (step + 1) + ' of ' + activeCase.decisions.length;
  byId('question').textContent = question;
  byId('update').textContent = update ?? '';
  byId('update').hidden = !update;
  choices.replaceChildren(...answers.map(([labelText], index) => {
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'practice-answer';
    input.value = String(index);
    label.append(input, createText('span', labelText));
    return label;
  }));
  options.disabled = false;
  checkButton.disabled = false;
  form.hidden = false;
  feedback.hidden = true;
  byId('error').textContent = '';
}

function startCase(button) {
  activeButton = button;
  activeCase = recoveryCases[button.dataset.case];
  step = 0;
  for (const item of caseButtons) item.setAttribute('aria-pressed', String(item === activeButton));
  byId('case-title').textContent = activeCase.title;
  byId('story').textContent = activeCase.story;
  byId('facts').replaceChildren(...activeCase.facts.map(([term, value]) => {
    const group = document.createElement('div');
    group.append(createText('dt', term), createText('dd', value));
    return group;
  }));
  const {label, href, note} = activeCase.source;
  const sourceLink = byId('source-link');
  sourceLink.textContent = label;
  sourceLink.href = href;
  byId('source-note').textContent = note;
  sourceLink.closest('details').open = false;
  renderDecision();
}

function showFeedback(state, title, text, action) {
  feedback.dataset.state = state;
  byId('feedback-title').textContent = title;
  byId('feedback-text').textContent = text;
  continueButton.textContent = action;
  planLink.hidden = state !== 'complete';
  feedback.hidden = false;
  byId('feedback-title').focus();
}

for (const button of caseButtons) button.addEventListener('click', () => {
  startCase(button);
  byId('case-title').focus();
});

choices.addEventListener('change', () => {
  feedback.hidden = true;
  byId('error').textContent = '';
});

form.addEventListener('submit', event => {
  event.preventDefault();
  const answer = choices.querySelector('input:checked');
  if (!answer) {
    byId('error').textContent = 'Choose an answer to continue.';
    choices.querySelector('input').focus();
    return;
  }

  const selected = Number(answer.value);
  const decision = activeCase.decisions[step];
  correct = selected === decision.correct;
  options.disabled = correct;
  checkButton.disabled = correct;
  const explanation = decision.choices[selected][1];
  if (correct) {
    const action = step + 1 === activeCase.decisions.length ? 'Finish case' : 'Next decision';
    showFeedback('ready', 'Good next step', explanation, action);
  } else {
    showFeedback('retry', 'Try another answer', explanation, 'Choose again');
  }
});

continueButton.addEventListener('click', () => {
  if (form.hidden) {
    activeButton.focus();
    return;
  }
  if (!correct) {
    feedback.hidden = true;
    choices.querySelector('input:checked').focus();
    return;
  }
  step += 1;
  if (step === activeCase.decisions.length) {
    form.hidden = true;
    byId('step').textContent = 'Case complete';
    showFeedback('complete', 'Practice complete', activeCase.finish, 'Choose a practice case');
  } else {
    renderDecision();
    byId('update').focus();
  }
});

startCase(caseButtons[0]);
byId('fallback').hidden = true;
byId('app').hidden = false;
