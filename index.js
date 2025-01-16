const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');

// Telegram Bot টোকেন এবং Webhook URL
const TOKEN = '8139201506:AAHbZfm08tbS-3IK8JnTzstqabJWgDBk6zg'; // আপনার Telegram Bot টোকেন দিন
const WEBHOOK_URL = 'https://refertgbot1109.vercel.app';

// Bot এবং Express অ্যাপ তৈরি
const bot = new TelegramBot(TOKEN, { webHook: true });
const app = express();
app.use(bodyParser.json());

// ডাটাবেস লোড বা ইনিশিয়ালাইজ
const dbFile = './data.json';
let db = fs.existsSync(dbFile) ? JSON.parse(fs.readFileSync(dbFile)) : { users: {}, admins: [] };

// ডাটাবেস সেভ ফাংশন
function saveDB() {
    fs.writeFileSync(dbFile, JSON.stringify(db, null, 2));
}

// অ্যাডমিন আইডি
const adminID = '7442526627'; // আপনার অ্যাডমিন টেলিগ্রাম আইডি দিন
if (!db.admins.includes(adminID)) db.admins.push(adminID);

// Webhook সেটআপ
bot.setWebHook(`${WEBHOOK_URL}/bot${TOKEN}`);

// Routes
app.get('/', (req, res) => {
    res.send('🤖 Telegram Bot is running!');
});

app.post(`/bot${TOKEN}`, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

// /start কমান্ড
bot.onText(/\/start (.+)?/, (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const username = msg.from.username || 'NoUsername';

    // নতুন ইউজার যুক্ত করা
    if (!db.users[userId]) {
        db.users[userId] = {
            username,
            balance: 0,
            wallet: null,
            referredBy: match[1] || null,
            banned: false,
        };
        // রেফারালের ব্যালেন্স বাড়ানো
        if (match[1] && db.users[match[1]]) {
            db.users[match[1]].balance += 10; // রেফার ইনসেনটিভ
        }
        saveDB();
    }

    // বট ব্লক চেক
    if (db.users[userId].banned) {
        bot.sendMessage(chatId, "🚫 আপনি এই বট থেকে ব্যানড হয়েছেন।");
        return;
    }

    // ইউজারকে মেসেজ পাঠানো
    bot.sendMessage(chatId, `🤖 *Welcome to the Refer & Earn Bot!*\n\n🔗 Invite friends and earn credits!`, {
        parse_mode: 'Markdown',
        reply_markup: {
            keyboard: [
                ["💸 Refer & Earn", "📥 Withdraw"],
                ["👤 My Account", "📊 Balance"],
                ["📞 Support"],
            ],
            resize_keyboard: true,
        },
    });
});

// ইউজার কমান্ড হ্যান্ডলিং
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;

    if (!db.users[userId] || db.users[userId].banned) return;

    const text = msg.text;
    const user = db.users[userId];

    if (text === "💸 Refer & Earn") {
        bot.sendMessage(chatId, `🔗 *Your referral link:*\nhttps://t.me/YourBotUsername?start=${userId}`, {
            parse_mode: 'Markdown',
        });
    } else if (text === "📥 Withdraw") {
        if (!user.wallet) {
            bot.sendMessage(chatId, "❌ দয়া করে প্রথমে আপনার ওয়ালেট সেট করুন।");
        } else if (user.balance < 50) {
            bot.sendMessage(chatId, "❌ মিনিমাম ৫০ ক্রেডিট উত্তোলন করতে হবে।");
        } else {
            bot.sendMessage(chatId, "✅ আপনার উত্তোলনের অনুরোধ পাঠানো হয়েছে।");
            bot.sendMessage(adminID, `📤 *Withdraw Request:*\n\n👤 User: @${user.username}\n🆔 User ID: ${userId}\n💰 Amount: ${user.balance}\n💳 Wallet: ${user.wallet}`, { parse_mode: 'Markdown' });
            user.balance = 0;
            saveDB();
        }
    } else if (text === "👤 My Account") {
        bot.sendMessage(chatId, `👤 *My Account*\n\n` +
            `👤 Username: @${user.username}\n` +
            `🆔 User ID: ${userId}\n` +
            `💰 Balance: ${user.balance} credits\n` +
            `💳 Wallet: ${user.wallet || 'Not set'}`, { parse_mode: 'Markdown' });
    } else if (text === "📊 Balance") {
        bot.sendMessage(chatId, `💰 Your current balance is ${user.balance} credits.`);
    } else if (text === "📞 Support") {
        bot.sendMessage(chatId, "📝 Send your message for support.");
        bot.once('message', (supportMsg) => {
            bot.sendMessage(adminID, `📩 *Support Message from @${user.username} (ID: ${userId}):*\n${supportMsg.text}`, { parse_mode: 'Markdown' });
            bot.sendMessage(chatId, "✅ Your message has been sent.");
        });
    }
});

// অ্যাডমিন প্যানেল
bot.onText(/\/admin/, (msg) => {
    const userId = msg.from.id;

    if (!db.admins.includes(String(userId))) return;

    bot.sendMessage(userId, "🔐 *Admin Panel*:\n\nChoose an option below:", {
        parse_mode: 'Markdown',
        reply_markup: {
            keyboard: [
                ["👥 View All Users", "🚫 Ban User", "✅ Unban User"],
                ["📢 Broadcast Message", "📂 Export Data"],
            ],
            resize_keyboard: true,
        },
    });
});
