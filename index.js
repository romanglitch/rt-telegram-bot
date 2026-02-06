const { chromium } = require('playwright');
const TelegramBot = require('node-telegram-bot-api');

const tgBot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {polling: true});

const msgIdsToDelete = [];
const deleteMessages = async (chatId, messagesToDelete) => {
    for (const msgId of messagesToDelete) {
        try {
            await tgBot.deleteMessage(chatId, msgId);
        } catch (e) {
            console.log('Не удалось удалить сообщение:', msgId);
        }
    }

    messagesToDelete.length = 0;

    console.log('Сообщения удалены')
}

tgBot.onText(/\/start/, async (msg) => {
    const {chat} = msg;

    await deleteMessages(chat.id, msgIdsToDelete)

    const startMessage = await tgBot.sendMessage(chat.id, 'Что бы узнать количество дней до блокировки используйте команду /check');
    msgIdsToDelete.push(startMessage.message_id)

    console.log('Пользователь ' + chat.id + ' запустил бота');
});

tgBot.onText(/\/check/, async (msg) => {
    const {chat} = msg;

    msgIdsToDelete.push(msg.message_id)
    await deleteMessages(chat.id, msgIdsToDelete)

    const loadingMsg = await tgBot.sendMessage(chat.id, `Пожалуйста подождите загружаю информацию...`);
    msgIdsToDelete.push(loadingMsg.message_id);

    console.log('Выполняется запрос данных...');

    const browser = await chromium.launchPersistentContext('./browser_data', {headless: false});
    const page = await browser.newPage();

    await page.goto('https://my.rt.ru/');

    page.once('load', async () => {
        if (page.url() !== 'https://my.rt.ru/') {
            try {
                await page.click('#standard_auth_btn');
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

                await deleteMessages(chat.id, msgIdsToDelete)

                const infoMessage = await tgBot.sendMessage(chat.id, `📊 Информация о счёте:\n\n` +
                    `⏳ Дней до блокировки: ${daysToLock} (${getLockDate(dateToLock, daysToLock)})\n` +
                    `💰 Баланс: ${formatCurrency(balance)}\n` +
                    `💳 Минимальный платеж: ${formatCurrency(MinPayment)}\n\n` +
                    `🔄 Повторить запрос: /check`);

                msgIdsToDelete.push(infoMessage.message_id)

                console.log(`Дней до блокировки: ${daysToLock}`);
            } catch (e) {
                await tgBot.sendMessage(chat.id, `❌ Ошибка при получении данных\n\n🔄 Повторить запрос: /check`);
                console.log('Ошибка при получении данных');
            } finally {
                await browser.close()
                console.log('Запрос завершен');
            }
        }
    });
});

console.log('Бот запущен');