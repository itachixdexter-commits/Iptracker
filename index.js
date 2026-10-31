const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, AttachmentBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');
const os = require('os');

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const DATA_FILE = path.join(__dirname, 'allowed_channels.json');
const OBF_DIR = path.join(__dirname, 'obf');
const CLI_PATH = path.join(OBF_DIR, 'IronBrew2 CLI.dll');

function loadChannels() {
  if (fs.existsSync(DATA_FILE)) {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  }
  return {};
}

function saveChannels(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

const commands = [
  new SlashCommandBuilder()
    .setName('set')
    .setDescription('تحديد الروم الي يشتغل فيه البوت (للادمن فقط)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder()
    .setName('obf')
    .setDescription('تشفير سكربت لوا')
    .addAttachmentOption(opt =>
      opt.setName('file')
        .setDescription('ارفع ملف .lua')
        .setRequired(false))
    .addStringOption(opt =>
      opt.setName('code')
        .setDescription('أو الصق الكود مباشرة')
        .setRequired(false)),
].map(cmd => cmd.toJSON());

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  try {
    console.log('⏳ جاري تسجيل الأوامر...');
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log('✅ تم تسجيل الأوامر بنجاح');
  } catch (err) {
    console.error('❌ خطأ في تسجيل الأوامر:', err);
  }
}

function obfuscate(luaCode) {
  luaCode = luaCode.replace(/^--[^\n]*\n?/, '');
  const header = `-- تم تشفير بواسطه سيرفر angle و زيكو [https://discord.gg/tH6dHkPDQ]\n`;

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'obf-'));
  const tmpInput = path.join(tmpDir, 'input.lua');
  const tmpOut = path.join(tmpDir, 'out.lua');

  fs.writeFileSync(tmpInput, luaCode, 'utf8');

  try {
    const result = spawnSync('dotnet', [CLI_PATH, tmpInput], {
      cwd: tmpDir,
      timeout: 60000,
      encoding: 'utf8'
    });

    if (result.error) throw new Error(`فشل تشغيل dotnet: ${result.error.message}`);
    if (result.status !== 0) throw new Error(`خطأ في التشفير:\n${result.stderr || result.stdout}`);

    const outFile = path.join(tmpDir, 'out.lua');
    if (!fs.existsSync(outFile)) throw new Error('لم ينتج ملف الإخراج');

    const obfuscated = fs.readFileSync(outFile, 'utf8');
    fs.rmSync(tmpDir, { recursive: true, force: true });

    return header + obfuscated;
  } catch (err) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    throw err;
  }
}

client.once('ready', async () => {
  console.log(`✅ البوت شغال كـ ${client.user.tag}`);
  await registerCommands();
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const channels = loadChannels();
  const guildId = interaction.guildId;

  if (interaction.commandName === 'set') {
    channels[guildId] = interaction.channelId;
    saveChannels(channels);
    return interaction.reply({
      content: `✅ **تم تحديد هذا الروم** <#${interaction.channelId}> كروم التشفير!\nالآن يمكن استخدام \`/obf\` هنا.`,
      ephemeral: true
    });
  }

  if (interaction.commandName === 'obf') {
    if (!channels[guildId]) {
      return interaction.reply({
        content: '❌ **لم يتم تحديد روم بعد!**\nالادمن يستخدم `/set` أولاً.',
        ephemeral: true
      });
    }

    if (channels[guildId] !== interaction.channelId) {
      return interaction.reply({
        content: `❌ **هذا الأمر يشتغل فقط في** <#${channels[guildId]}>`,
        ephemeral: true
      });
    }

    const fileAttachment = interaction.options.getAttachment('file');
    const codeInput = interaction.options.getString('code');

    if (!fileAttachment && !codeInput) {
      return interaction.reply({
        content: '❌ **لازم ترفع ملف `.lua` أو تكتب الكود مباشرة!**',
        ephemeral: true
      });
    }

    await interaction.deferReply();

    try {
      let luaCode = '';

      if (fileAttachment) {
        if (!fileAttachment.name.endsWith('.lua') && !fileAttachment.name.endsWith('.txt')) {
          return interaction.editReply('❌ **الملف لازم يكون `.lua` أو `.txt`**');
        }
        const response = await fetch(fileAttachment.url);
        luaCode = await response.text();
      } else {
        luaCode = codeInput;
      }

      if (!luaCode.trim()) return interaction.editReply('❌ **الكود فاضي!**');

      const obfuscated = obfuscate(luaCode);

      const outputName = fileAttachment
        ? fileAttachment.name.replace(/\.(lua|txt)$/, '_obf.lua')
        : 'obfuscated.lua';

      const buffer = Buffer.from(obfuscated, 'utf8');
      const attachment = new AttachmentBuilder(buffer, { name: outputName });

      await interaction.editReply({
        content: '✅ **تم تشفير السكربت بنجاح!** 🔒',
        files: [attachment]
      });

    } catch (err) {
      console.error('خطأ في التشفير:', err);
      await interaction.editReply({
        content: `❌ **فشل التشفير!**\n\`\`\`\n${err.message}\n\`\`\``
      });
    }
  }
});

if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error('❌ يجب تعيين DISCORD_TOKEN و CLIENT_ID و GUILD_ID');
  process.exit(1);
}

client.login(TOKEN);
