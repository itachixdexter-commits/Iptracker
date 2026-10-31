const https = require('https');
const fs = require('fs');
const path = require('path');

const FILES_TO_DOWNLOAD = [
  {
    url: 'https://raw.githubusercontent.com/RealSourceLeaks/moonsec-source-code/main/MoonSec/main.lua',
    dest: path.join(__dirname, 'MoonSec', 'main.lua')
  },
  {
    url: 'https://raw.githubusercontent.com/RealSourceLeaks/moonsec-source-code/main/MoonSec/Obfuscator.lua',
    dest: path.join(__dirname, 'MoonSec', 'Obfuscator.lua')
  },
  {
    url: 'https://raw.githubusercontent.com/RealSourceLeaks/moonsec-source-code/main/MoonSec/Lexer.lua',
    dest: path.join(__dirname, 'MoonSec', 'Lexer.lua')
  },
  {
    url: 'https://raw.githubusercontent.com/RealSourceLeaks/moonsec-source-code/main/MoonSec/Parser.lua',
    dest: path.join(__dirname, 'MoonSec', 'Parser.lua')
  },
  {
    url: 'https://raw.githubusercontent.com/RealSourceLeaks/moonsec-source-code/main/MoonSec/Minifier.lua',
    dest: path.join(__dirname, 'MoonSec', 'Minifier.lua')
  }
];

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(dest);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close();
        return downloadFile(response.headers.location, dest).then(resolve).catch(reject);
      }

      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest);
        return reject(new Error(`فشل تحميل ${url} - Status: ${response.statusCode}`));
      }

      response.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log(`✅ تم تحميل: ${path.basename(dest)}`);
        resolve();
      });
    }).on('error', (err) => {
      fs.unlinkSync(dest);
      reject(err);
    });
  });
}

async function setup() {
  console.log('🔄 جاري تحميل ملفات MoonSec...');

  const mainFile = path.join(__dirname, 'MoonSec', 'main.lua');
  if (fs.existsSync(mainFile)) {
    console.log('✅ MoonSec موجود مسبقاً');
    return;
  }

  for (const file of FILES_TO_DOWNLOAD) {
    try {
      await downloadFile(file.url, file.dest);
    } catch (err) {
      console.warn(`⚠️ تعذر تحميل ${path.basename(file.dest)}: ${err.message}`);
    }
  }

  console.log('✅ اكتمل إعداد MoonSec');
}

setup().catch(console.error);
