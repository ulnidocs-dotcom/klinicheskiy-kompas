// Собирает копию демо, готовую к публикации как артефакт: node tools/build-artifact.js <папка>
// - копирует index.html, ui-kit.html, assets/**, data/**, patient/**, doctor/**, psych/** (без *_template*);
// - вырезает из HTML подключение telegram-web-app.js (внешний скрипт вне разрешённых CDN);
// - в doctor/profile.js заменяет confirm('Сбросить демо-данные?') на true (диалоги в песочнице заблокированы);
// - пишет kompas.html — содержимое index.html без обёртки doctype/html/head/body;
// - печатает в stdout JSON-список скопированных файлов (кроме index.html и kompas.html).
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const TG_SCRIPT = /[ \t]*<script src="https:\/\/telegram\.org\/js\/telegram-web-app\.js"><\/script>\r?\n?/g;
const CONFIRM = "confirm('Сбросить демо-данные?')";

function walk(dir) {
  return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = path.posix.join(dir, e.name);
    return e.isDirectory() ? walk(rel) : [rel];
  });
}

function transform(rel, text) {
  if (rel.endsWith('.html')) text = text.replace(TG_SCRIPT, '');
  if (rel === 'doctor/profile.js') {
    if (!text.includes(CONFIRM)) throw new Error('doctor/profile.js: не найден confirm сброса демо');
    text = text.split(CONFIRM).join('true');
  }
  return text;
}

// index.html без doctype/html/head/body: <title>, <meta>, <link>, <style> и скрипт темы из head + тело страницы.
function kompas(indexHtml) {
  const head = (/<head>([\s\S]*?)<\/head>/i.exec(indexHtml) || [])[1] || '';
  const bodyM = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(indexHtml);
  if (!bodyM) throw new Error('index.html: нет <body>');
  const keep = head.match(/<title>[\s\S]*?<\/title>|<meta\b[^>]*>|<link\b[^>]*>|<style>[\s\S]*?<\/style>/gi) || [];
  const title = keep.some((t) => /^<title>/i.test(t)) ? [] : ['<title>Клинический компас</title>'];
  const boot = '<script>document.documentElement.dataset.role="doctor";document.documentElement.lang="ru";</script>';
  // Тема применяется до отрисовки тела: theme.js читает kk:theme:staff (лаунчер — роль врача) и ставит data-theme.
  const theme = '<script src="assets/theme.js"></script>';
  return [...title, ...keep.map((t) => t.replace(/<title>[\s\S]*?<\/title>/i, '<title>Клинический компас</title>')), boot, theme, bodyM[1].trim(), ''].join('\n');
}

function build(outDir) {
  const files = ['index.html', 'ui-kit.html', 'variants.html', ...['assets', 'data', 'patient', 'doctor', 'psych'].flatMap(walk)]
    .filter((rel) => !path.posix.basename(rel).includes('_template'));
  for (const rel of files) {
    const src = path.join(ROOT, rel);
    const dst = path.join(outDir, rel);
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    if (/\.(html|js|css|json|md|txt|svg)$/i.test(rel)) fs.writeFileSync(dst, transform(rel, fs.readFileSync(src, 'utf8')));
    else fs.copyFileSync(src, dst);
  }
  const index = fs.readFileSync(path.join(outDir, 'index.html'), 'utf8');
  fs.writeFileSync(path.join(outDir, 'kompas.html'), kompas(index));
  return files.filter((f) => f !== 'index.html');
}

if (require.main === module) {
  const out = process.argv[2];
  if (!out) { console.error('Использование: node tools/build-artifact.js <папка>'); process.exit(1); }
  const list = build(path.resolve(out));
  process.stdout.write(JSON.stringify(list, null, 2) + '\n');
}

module.exports = { build, kompas, transform };
