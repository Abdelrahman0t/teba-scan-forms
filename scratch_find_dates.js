const fs = require('fs');
const path = require('path');

const formsDir = 'app/forms';
const dirs = fs.readdirSync(formsDir);

dirs.forEach(d => {
  const p = path.join(formsDir, d, 'page.tsx');
  if (!fs.existsSync(p)) return;
  const content = fs.readFileSync(p, 'utf8');
  const lines = content.split('\n');
  console.log(`\n=== FORM: ${d} ===`);
  lines.forEach((l, i) => {
    if (l.includes('type="date"') || l.includes("type='date'") || l.includes('getCurrentDate') || l.includes('getCurrentTime') || (l.includes('<input') && (l.toLowerCase().includes('date') || l.toLowerCase().includes('time')))) {
      console.log(`Line ${i + 1}: ${l.trim()}`);
    }
  });
});
