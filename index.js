const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

// Initialize bot with token
const bot = new TelegramBot('YOUR_BOT_TOKEN', { polling: true });

// Load or initialize database
const dbFile = './data.json';
let db = fs.existsSync(dbFile) ? JSON.parse(fs.readFileSync(dbFile)) : { users: {}, admins: [] };

// Save database
function saveDB() {
    fs.writeFileSync(dbFile, JSON.stringify(db, null, 2));
}

// Admin ID (for simplicity, only one admin)
const adminID = 'ADMIN_TELEGRAM_ID'; // Replace with the admin's Telegram ID
if (!db.admins.includes(adminID)) db.admins.push(adminID);

// Commands
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const username = msg.from.username || 'NoUsername';

    if (!db.users[userId]) {
        db.users[userId] = { username, balance: 0, wallet: null, referredBy: null, banned: false };
        saveDB();
    }

    if (db.users[userId].banned) {
        bot.sendMessage(chatId, "🚫 You are banned from using this bot.");
        return;
    }

    bot.sendMessage(chatId, `🤖 Welcome to the Refer and Earn bot!`, {
        reply_markup: {
            keyboard: [
                ["💸 Refer & Earn", "📥 Withdraw"],
                ["👤 My Account", "📊 Balance"],
                ["📞 Support"]
            ],
            resize_keyboard: true,
        },
    });
});

// Handle user commands
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (!db.users[userId] || db.users[userId].banned) return;

    const text = msg.text;
    const user = db.users[userId];

    if (text === "💸 Refer & Earn") {
        bot.sendMessage(chatId, `🔗 Your referral link: https://t.me/YourBotUsername?start=${userId}`);
    } else if (text === "📥 Withdraw") {
        if (!user.wallet) {
            bot.sendMessage(chatId, "❌ Please set your wallet first in '👤 My Account'.");
        } else if (user.balance < 50) {
            bot.sendMessage(chatId, "❌ Minimum withdrawal is 50 credits.");
        } else {
            bot.sendMessage(chatId, "✅ Your withdrawal request has been sent to the admin.");
            bot.sendMessage(adminID, `📤 Withdraw request from @${user.username} (ID: ${userId})\nAmount: ${user.balance}\nWallet: ${user.wallet}`);
            user.balance = 0;
            saveDB();
        }
    } else if (text === "👤 My Account") {
        bot.sendMessage(chatId, `👤 *My Account*\n\n` +
            `Username: @${user.username}\n` +
            `User ID: ${userId}\n` +
            `Balance: ${user.balance} credits\n` +
            `Wallet: ${user.wallet || 'Not set'}`, { parse_mode: 'Markdown' });
    } else if (text === "📊 Balance") {
        bot.sendMessage(chatId, `💰 Your current balance is ${user.balance} credits.`);
    } else if (text === "📞 Support") {
        bot.sendMessage(chatId, "📝 Please type your message. The admin will respond shortly.");
        bot.once('message', (supportMsg) => {
            bot.sendMessage(adminID, `📩 Support message from @${user.username} (ID: ${userId}):\n${supportMsg.text}`);
            bot.sendMessage(chatId, "✅ Your message has been sent to the admin.");
        });
    }
});

// Handle admin commands
bot.onText(/\/admin/, (msg) => {
    const userId = msg.from.id;

    if (!db.admins.includes(String(userId))) return;

    bot.sendMessage(userId, "🔐 Welcome to the Admin Panel.", {
        reply_markup: {
            keyboard: [
                ["👥 View All Users", "🚫 Ban User", "✅ Unban User"],
                ["📢 Broadcast Message", "📂 User Data"],
            ],
            resize_keyboard: true,
        },
    });
});

// Admin functionalities
bot.on('message', (msg) => {
    const userId = msg.from.id;
    const text = msg.text;

    if (!db.admins.includes(String(userId))) return;

    if (text === "👥 View All Users") {
        const usersList = Object.entries(db.users)
            .map(([id, user]) => `${user.username} (ID: ${id}, Balance: ${user.balance}, Wallet: ${user.wallet || 'Not set'})`)
            .join('\n');
        bot.sendMessage(userId, `👥 All Users:\n\n${usersList}`);
    } else if (text === "🚫 Ban User") {
        bot.sendMessage(userId, "📝 Send the User ID to ban.");
        bot.once('message', (banMsg) => {
            const banId = banMsg.text;
            if (db.users[banId]) {
                db.users[banId].banned = true;
                saveDB();
                bot.sendMessage(userId, `✅ User ID ${banId} has been banned.`);
            } else {
                bot.sendMessage(userId, "❌ Invalid User ID.");
            }
        });
    } else if (text === "✅ Unban User") {
        bot.sendMessage(userId, "📝 Send the User ID to unban.");
        bot.once('message', (unbanMsg) => {
            const unbanId = unbanMsg.text;
            if (db.users[unbanId]) {
                db.users[unbanId].banned = false;
                saveDB();
                bot.sendMessage(userId, `✅ User ID ${unbanId} has been unbanned.`);
            } else {
                bot.sendMessage(userId, "❌ Invalid User ID.");
            }
        });
    } else if (text === "📢 Broadcast Message") {
        bot.sendMessage(userId, "📝 Send the message to broadcast.");
        bot.once('message', (broadcastMsg) => {
            const message = broadcastMsg.text;
            Object.keys(db.users).forEach((id) => {
                if (!db.users[id].banned) {
                    bot.sendMessage(id, `📢 ${message}`);
                }
            });
            bot.sendMessage(userId, "✅ Message broadcasted.");
        });
    } else if (text === "📂 User Data") {
        bot.sendMessage(userId, "📂 Exporting user data...");
        fs.writeFileSync('./exported_users.json', JSON.stringify(db.users, null, 2));
        bot.sendDocument(userId, './exported_users.json');
    }
});
