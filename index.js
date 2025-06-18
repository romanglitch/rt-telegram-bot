const { chromium } = require('playwright');
const TelegramBot = require('node-telegram-bot-api');

const tgBot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {polling: true});

tgBot.onText(/\/start/, async (msg) => {
    const {chat} = msg;
    await tgBot.sendMessage(chat.id, 'Что бы узнать количество дней до блокировки используйте команду /check');
    console.log('Пользователь ' + chat.id + ' запустил бота');
});

tgBot.onText(/\/check/, async (msg) => {
    const {chat} = msg;

    await tgBot.sendMessage(chat.id, `Пожалуйста подождите загружаю информацию...`);
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

    // let TEST_RESP = {
    //     _errors_validate: null,
    //     AccountID: '3328899',
    //     balance: 770.63,
    //     credit: 0,
    //     daysToLock: 14,
    //     dateToLock: '2025-06-18',
    //     MinPayment: 856.26,
    //     payment: 856.26,
    //     TommorowMonthPay: 1626.89
    // }

    function formatCurrency(amount) {
        const number = parseFloat(amount).toFixed(0);
        const formatted = number.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
        return `${formatted} руб.`;
    }

    function getLockDate(dateToLock, daysToLock) {
        const months = [
            '', 'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
            'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
        ];
        // dateToLock - строка '2025-06-18'
        const [year, month, day] = dateToLock.split('-').map(Number);
        const lockDate = new Date(year, month - 1, day);
        lockDate.setDate(lockDate.getDate() + daysToLock);

        const lockDay = lockDate.getDate();
        const lockMonth = lockDate.getMonth() + 1;

        return `${lockDay} ${months[lockMonth]}`;
    }

    page.on('response', async (response) => {
        if (response.url() === 'https://my.rt.ru/api/lk/account/cabinet') {
            try {
                const { accountInfo } = await response.json();
                const { dateToLock, daysToLock, balance, MinPayment } = accountInfo

                await tgBot.sendMessage(chat.id, `- Дней до блокировки: ${daysToLock} (${getLockDate(dateToLock, daysToLock)})`)
                await tgBot.sendMessage(chat.id, `- Баланс: ${formatCurrency(balance)}`)
                await tgBot.sendMessage(chat.id, `- Минимальный платеж: ${formatCurrency(MinPayment)}`)

                console.log(`Дней до блокировки: ${daysToLock}`);
            } catch (e) {
                await tgBot.sendMessage(chat.id, `- Ошибка при получении данных`)
                console.log('Ошибка при получении данных');
            } finally {
                await tgBot.sendMessage(chat.id, `- Повторить запрос: /check`)
                await browser.close()
                console.log('Запрос завершен');
            }
        }
    });
});

console.log('Бот запущен');