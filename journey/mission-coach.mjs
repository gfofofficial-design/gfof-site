import { missionHint } from '../lib/mission-coach-core.mjs';

const coach = document.querySelector('[data-mission-coach]');
if (coach) {
  const mission = coach.dataset.missionCoach;
  const first = missionHint(mission, 0);
  if (first) {
    const label = document.createElement('label');
    label.htmlFor = 'mission-hint-depth';
    label.textContent = 'Hint depth';
    const depth = document.createElement('select');
    depth.id = label.htmlFor;
    const levels = ['Start with the idea', 'Help me compare', 'Challenge my reasoning'];
    levels.forEach((text, index) => depth.add(new Option(text, String(index))));
    const result = document.createElement('p');
    result.setAttribute('role', 'status');
    result.textContent = first.hint;
    depth.addEventListener('change', () => {
      result.textContent = missionHint(mission, Number(depth.value)).hint;
    });
    coach.append(label, depth, result);
    coach.hidden = false;
  }
}
