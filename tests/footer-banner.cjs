const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const codeGs = fs.readFileSync(path.join(root, 'apps-script', 'Code.gs'), 'utf8');

// 1. Mobile banner background verification
assert.ok(html.includes("background-image: url('bgground.png')") || html.includes('url(\'bgground.png\')'), 'index.html deve referenciar bgground.png');
assert.ok(html.includes('@media (min-width: 769px)'), 'index.html deve isolar background-attachment: fixed para telas desktop');
assert.ok(html.includes('background-attachment: scroll'), 'index.html deve usar background-attachment: scroll no banner para garantir exibição mobile');

// 2. Footer layout and logo icon verification
assert.ok(!html.includes('https://ssgmoradadecaboclos.kinghost.net/SOLO/1.png'), 'O rodapé não deve conter URL remota quebrada');
assert.ok(html.includes('<img src="1.png" alt="SOLO Ateliê Artesanal" class="footer-logo-img">'), 'O rodapé deve carregar o logo local 1.png');
assert.ok(html.includes('class="footer-grid"'), 'O rodapé deve possuir grid estruturado em colunas');
assert.ok(html.includes('class="footer-col"'), 'O rodapé deve possuir colunas organizadas');

// 3. Daily visit counter verification
assert.ok(html.includes('updateDailyVisits'), 'index.html deve conter função updateDailyVisits');
assert.ok(html.includes('recordVisit'), 'index.html deve chamar recordVisit');
assert.ok(html.includes('getDailyVisits'), 'index.html deve chamar getDailyVisits');
assert.ok(codeGs.includes('handleDailyVisits_'), 'Code.gs deve conter handleDailyVisits_');
assert.ok(codeGs.includes('DAILY_VISITS_DATE'), 'Code.gs deve controlar DAILY_VISITS_DATE');
assert.ok(codeGs.includes('DAILY_VISITS_COUNT'), 'Code.gs deve controlar DAILY_VISITS_COUNT');

console.log('PASS: Banner mobile, footer columns, local logo and daily visit counter verified.');
