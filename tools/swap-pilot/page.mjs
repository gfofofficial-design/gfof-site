// Deliberate release hold. No provider import, script loading or wallet handler.
const button=document.getElementById('open-provider');
const direction=document.getElementById('direction');
button.disabled=true;
direction.disabled=true;
document.getElementById('status').textContent='Testing paused. Jupiter Support has received the wallet-warning report.';
