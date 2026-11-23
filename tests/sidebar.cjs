const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'admin', 'dashboard.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'assets', 'admin.css'), 'utf8');
const js = fs.readFileSync(path.join(root, 'assets', 'panel.js'), 'utf8');

// 1. Dashboard HTML checks
assert.ok(html.includes('id="sidebar-close"'), 'dashboard.html deve possuir o botão sidebar-close');
assert.ok(html.includes('id="sidebar-backdrop"'), 'dashboard.html deve possuir o botão sidebar-backdrop');
assert.ok(html.includes('id="mobile-menu"'), 'dashboard.html deve possuir o botão mobile-menu');
assert.ok(html.includes('aria-controls="sidebar"'), 'mobile-menu deve possuir aria-controls="sidebar"');

// 2. CSS checks
assert.ok(css.includes('.sidebar-close'), 'admin.css deve estilizar .sidebar-close');
assert.ok(css.includes('.sidebar-backdrop'), 'admin.css deve estilizar .sidebar-backdrop');
assert.ok(css.includes('.sidebar.open'), 'admin.css deve possuir classe .sidebar.open');
assert.ok(css.includes('body.menu-open'), 'admin.css deve possuir classe body.menu-open');
assert.ok(!css.includes('margin-left: 250px'), 'admin.css não deve manter margin-left fixo de 250px no panel-main');

// 3. JS checks
assert.ok(js.includes('sidebarCloseEl'), 'panel.js deve registrar o evento de fechar sidebar');
assert.ok(js.includes('sidebarBackdropEl'), 'panel.js deve registrar o evento de fechar via backdrop');
assert.ok(js.includes('setSidebarOpen'), 'panel.js deve possuir função setSidebarOpen');

console.log('PASS: Sidebar sandwich model structure, close button, backdrop, and toggle logic verified.');
