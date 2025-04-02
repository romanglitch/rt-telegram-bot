const { chromium } = require('playwright');
const TelegramBot = require('node-telegram-bot-api');

const BOT = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {polling: true});

BOT.onText('/start', async (msg) => {
    const {chat} = msg
    await BOT.sendMessage(chat.id, 'Что бы узнать количество дней до блокировки используйте команду /check')
});

BOT.onText('/check', async (msg) => {
    const {chat} = msg

    await BOT.sendMessage(chat.id, `Пожалуйста подождите загружаю информацию...`)

    const browser = await chromium.launchPersistentContext('./browser_data', {headless: true});
    const page = await browser.newPage()

    await page.goto('https://my.rt.ru/')

    page.once('load', async () => {
        if (page.url() !== 'https://my.rt.ru/') {
            try {
                await page.fill('#username', process.env.RT_LOGIN);
                await page.fill('#password', process.env.RT_PASSWORD);
                await page.click('#kc-login');
                await page.waitForURL('https://my.rt.ru/')
            } catch (e) {
                console.log('Ошибка при выполнении авторизации')
            }
        }
    })

    page.on('response', async (response) => {
        if (response.url() === 'https://my.rt.ru/api/lk/account/cabinet') {
            try {
                const { accountInfo } = await response.json();
                const { daysToLock } = accountInfo

                await BOT.sendMessage(chat.id, `- Дней до блокировки: ${daysToLock}`)
            } catch (e) {
                await BOT.sendMessage(chat.id, `- Ошибка при получении данных`)
            } finally {
                await BOT.sendMessage(chat.id, `- Повторить запрос: /check`)
                await browser.close()
            }
        }
    });
});