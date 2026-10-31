const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

async function main() {
  console.log('🚀 بدء تشغيل البوت...');

  const mainLua = path.join(__dirname, 'MoonSec', 'main.lua');
  if (!fs.existsSync(mainLua)) {
    console.log('📥 تحميل MoonSec من GitHub...');
    require('./setup.js');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  try {
    const luaVersion = execSync('lua -v 2>&1').toString().trim();
    console.log(`✅ Lua متوفر: ${luaVersion}`);
  } catch {
    console.error('❌ Lua غير مثبت!');
    process.exit(1);
  }

  require('./index.js');
}

main().catch(err => {
  console.error('❌ خطأ في البدء:', err);
  process.exit(1);
});
