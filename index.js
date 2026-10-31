const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, AttachmentBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const DATA_FILE = path.join(__dirname, 'allowed_channels.json');

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

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(TOKEN);
  try {
    console.log('⏳ جاري تسجيل الأوامر...');
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('✅ تم تسجيل الأوامر بنجاح');
  } catch (err) {
    console.error('❌ خطأ في تسجيل الأوامر:', err);
  }
}

function obfuscate(luaCode) {
  luaCode = luaCode.replace(/^--[^\n]*\n?/, '');

  const header = `-- تم تشفير بواسطه سيرفر angle و زيكو [https://discord.gg/tH6dHkPDQ]\n`;

  const moonsecPath = path.join(__dirname, 'MoonSec', 'main.lua');
  const tmpInput = path.join(__dirname, 'tmp_input.lua');
  const tmpOutput = path.join(__dirname, 'tmp_output.lua');

  fs.writeFileSync(tmpInput, luaCode, 'utf8');

  try {
    execSync(`lua "${moonsecPath}" "${tmpInput}" "${tmpOutput}"`, {
      timeout: 30000,
      stdio: 'pipe'
    });

    if (!fs.existsSync(tmpOutput)) {
      throw new Error('MoonSec لم ينتج ملف الإخراج');
    }

    let obfuscated = fs.readFileSync(tmpOutput, 'utf8');

    fs.unlinkSync(tmpInput);
    fs.unlinkSync(tmpOutput);

    return header + obfuscated;
  } catch (err) {
    if (fs.existsSync(tmpInput)) fs.unlinkSync(tmpInput);
    if (fs.existsSync(tmpOutput)) fs.unlinkSync(tmpOutput);
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
        content: '❌ **لم يتم تحديد روم بعد!**\nالادمن يحتاج يستخدم `/set` في الروم المطلوب أولاً.',
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

      if (!luaCode.trim()) {
        return interaction.editReply('❌ **الكود فاضي!**');
      }

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

if (!TOKEN || !CLIENT_ID) {
  console.error('❌ يجب تعيين DISCORD_TOKEN و CLIENT_ID في متغيرات البيئة!');
  process.exit(1);
}

client.login(TOKEN);
