const fs = require('fs');
const path = require('path');

// Use the woff font from @fontsource
const fontPath = path.join(__dirname, '..', 'node_modules', '@fontsource', 'noto-sans-thai', 'files', 'noto-sans-thai-thai-400-normal.woff');

if (!fs.existsSync(fontPath)) {
  console.error('Font file not found:', fontPath);
  process.exit(1);
}

const fontBuffer = fs.readFileSync(fontPath);
const base64 = fontBuffer.toString('base64');

const output = `// Auto-generated Thai font (Noto Sans Thai 400 Normal, WOFF)
// Source: @fontsource/noto-sans-thai
export const THAI_FONT_BASE64 = "${base64}";
`;

const outPath = path.join(__dirname, '..', 'src', 'lib', 'thai-font.ts');
fs.writeFileSync(outPath, output);
console.log('Font file generated:', outPath, '(' + base64.length + ' chars)');
