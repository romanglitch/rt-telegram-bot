const { chromium } = require('playwright');
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

bot.onText(/\/start/, async msg => {
    await bot.sendMessage(msg.chat.id, 'Чтобы узнать количество дней до блокировки, используйте команду /check');
    console.log(`Пользователь ${msg.chat.id} запустил бота`);
});

bot.onText(/\/check/, async msg => {
    const chatId = msg.chat.id;
    await bot.sendMessage(chatId, 'Пожалуйста, подождите, загружаю информацию...');

    let context;
    try {
        context = await chromium.launchPersistentContext('./browser_data', { headless: true });
        const page = await context.newPage();
        await page.goto('https://my.rt.ru/', { waitUntil: 'domcontentloaded' });

        // Определяем, требуется ли авторизация
        if (await page.locator('#username').isVisible().catch(() => false)) {
            try {
                await page.fill('#username', process.env.RT_LOGIN);
                await page.fill('#password', process.env.RT_PASSWORD);
                await Promise.all([
                    page.waitForNavigation({ url: 'https://my.rt.ru/', waitUntil: 'networkidle' }),
                    page.click('#kc-login')
                ]);
                console.log('Авторизация выполнена');
            } catch (err) {
                new Error('Ошибка авторизации');
            }
        } else {
            console.log('Сессия авторизована');
        }

        // Ждём только нужный API-ответ
        const response = await page.waitForResponse(resp =>
            resp.url().includes('/api/lk/account/cabinet') && resp.status() === 200, { timeout: 7000 }
        ).catch(() => null);

        if (!response) new Error('Нет ответа от API кабинета');

        const data = await response.json();
        const daysToLock = data?.accountInfo?.daysToLock ?? 'неизвестно';

        await bot.sendMessage(chatId, `Дней до блокировки: ${daysToLock}`);
        console.log(`Дней до блокировки: ${daysToLock}`);
    } catch (err) {
        console.log('Ошибка:', err);
        await bot.sendMessage(chatId, 'Ошибка при запросе. Попробуйте позже или проверьте логин/пароль.');
        // Чистим сессию при ошибке авторизации
        if (err.message === 'Ошибка авторизации' && fs.existsSync('./browser_data')) {
            fs.rmSync('./browser_data', { recursive: true, force: true });
            console.log('Очистка браузерных данных из-за ошибок авторизации');
        }
    } finally {
        await bot.sendMessage(chatId, 'Повторить запрос: /check');
        if (context) await context.close();
        console.log('Запрос завершён');
    }
});

console.log('Бот запущен');