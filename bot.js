const playwright = require('playwright');
const TelegramBot = require('node-telegram-bot-api');

const token = process.env.TELEGRAM_BOT_TOKEN;

const bot = new TelegramBot(token, {polling: true});

bot.onText('/start', async (msg, match) => {
    const chatId = msg.chat.id;
    await bot.sendMessage(chatId, 'Что бы узнать количество дней до блокировки используйте команду /check')
});

bot.onText('/check', async (msg, match) => {
    const chatId = msg.chat.id;

    const browser = await playwright.chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    let accountData = {}

    await bot.sendMessage(chatId, 'Пожалуйста подождите загружаю информацию...')

    try {
        await page.goto(process.env.RT_LOGIN_URL);

        await page.fill('#username', process.env.RT_LOGIN);

        await page.fill('#password', process.env.RT_PASSWORD);

        await page.click('#kc-login');

        await page.goto(process.env.RT_MAIN_URL)

        await page.waitForSelector('#account_info_block');

        const response = await page.waitForResponse(process.env.RT_API_URL, { timeout: 0 });

        const resBody = await response.body();

        accountData = await JSON.parse(resBody)
    } catch (error) {
        console.error('Произошла ошибка:', error);
        await bot.sendMessage(chatId, `Произошла ошибка:`, error)
    } finally {
        const { accountInfo } = accountData

        await bot.sendMessage(chatId, `- Дней до блокировки: ${accountInfo.daysToLock}`)
        await bot.sendMessage(chatId, `- Повторить запрос: /check`)

        await browser.close()
    }
});

console.log('Бот запущен!')