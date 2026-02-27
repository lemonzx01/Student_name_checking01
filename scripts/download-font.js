const https = require('https');
const fs = require('fs');
const path = require('path');

function download(url, cb) {
  https.get(url, { headers: { 'User-Agent': 'Node' } }, (res) => {
    if (res.statusCode >= 300 && res.statusCode < 400) {
      download(res.headers.location, cb);
    } else {
      const chunks = [];
      res.on('data', (d) => chunks.push(d));
      res.on('end', () => cb(Buffer.concat(chunks)));
    }
  }).on('error', (e) => console.error(e));
}

const url = 'https://cdn.jsdelivr.net/gh/nicholedlc/tha-sarabun-psk@master/THSarabunNew.ttf';

console.log('Downloading THSarabunNew.ttf...');
download(url, (buf) => {
  console.log('Downloaded', buf.length, 'bytes');
  
  // Verify it's a TTF (starts with 0x00010000 or 'true')
  const magic = buf.readUInt32BE(0);
  console.log('Magic:', '0x' + magic.toString(16));
  
  const b64 = buf.toString('base64');
  const out = `// Auto-generated: THSarabunNew TTF font for jsPDF Thai support
export const THAI_FONT_BASE64 = "${b64}";
`;
  
  const outPath = path.join(__dirname, '..', 'src', 'lib', 'thai-font.ts');
  fs.writeFileSync(outPath, out);
  console.log('Written to:', outPath, '(' + b64.length + ' base64 chars)');
});
