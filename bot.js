require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');

const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL; // e.g. https://yourdomain.com

if (!BOT_TOKEN) {
  console.error('Missing BOT_TOKEN in .env — get one from @BotFather');
  process.exit(1);
}
if (!WEBAPP_URL) {
  console.error('Missing WEBAPP_URL in .env — the HTTPS URL where your mini app is hosted');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

bot.start((ctx) => {
  ctx.reply(
    `👋 Welcome to Learn & Earn, ${ctx.from.first_name}!\n\n` +
    `Practice English from A1 to C1 and earn 10 coins for every correct answer.\n` +
    `Pick your level and start the quiz below 👇`,
    Markup.inlineKeyboard([
      Markup.button.webApp('📚 Open Learn & Earn', WEBAPP_URL)
    ])
  );
});

bot.command('play', (ctx) => {
  ctx.reply(
    'Ready to earn some coins?',
    Markup.inlineKeyboard([Markup.button.webApp('🎮 Play now', WEBAPP_URL)])
  );
});

bot.command('coins', async (ctx) => {
  ctx.reply('Open the app to see your live coin balance 🪙', Markup.inlineKeyboard([
    Markup.button.webApp('🪙 Check my coins', WEBAPP_URL)
  ]));
});

bot.help((ctx) => {
  ctx.reply(
    'Commands:\n' +
    '/start – open the welcome message and mini app\n' +
    '/play – jump straight into the quiz\n' +
    '/coins – check your coin balance'
  );
});

bot.launch().then(() => console.log('Bot is running (long polling)...'));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
