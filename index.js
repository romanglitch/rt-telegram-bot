const { chromium } = require('playwright');
const TelegramBot = require('node-telegram-bot-api');

const Index = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {polling: true});

Index.onText(/\/start/, async (msg) => {
    const {chat} = msg;
    await Index.sendMessage(chat.id, 'Что бы узнать количество дней до блокировки используйте команду /check');
    console.log('Пользователь ' + chat.id + ' запустил бота');
});

Index.onText(/\/check/, async (msg) => {
    const {chat} = msg;

    await Index.sendMessage(chat.id, `Пожалуйста подождите загружаю информацию...`);
    console.log('Выполняется запрос данных...');

    const browser = await chromium.launchPersistentContext('./browser_data', {headless: true});
    const page = await browser.newPage();

    await page.goto('https://my.rt.ru/');

    page.once('load', async () => {
        if (page.url() !== 'https://my.rt.ru/') {
            try {
                await page.fill('#username', process.env.RT_LOGIN);
                await page.fill('#password', process.env.RT_PASSWORD);
                await page.click('#kc-login');
                await page.waitForURL('https://my.rt.ru/')
                console.log('Авторизация прошла успешно');
            } catch (e) {
                console.log('Ошибка при выполнении авторизации');
                await browser.close();
            }
        }
    });

    page.on('response', async (response) => {
        if (response.url() === 'https://my.rt.ru/api/lk/account/cabinet') {
            try {
                const { accountInfo } = await response.json();
                const { daysToLock } = accountInfo

                await Index.sendMessage(chat.id, `- Дней до блокировки: ${daysToLock}`)

                console.log(`Дней до блокировки: ${daysToLock}`);
            } catch (e) {
                await Index.sendMessage(chat.id, `- Ошибка при получении данных`)
                console.log('Ошибка при получении данных');
            } finally {
                await Index.sendMessage(chat.id, `- Повторить запрос: /check`)
                await browser.close()
                console.log('Запрос завершен');
            }
        }
    });
});