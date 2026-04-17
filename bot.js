console.log("BOT STARTING...");
require("dotenv").config();
const { Telegraf, Markup } = require("telegraf");
const fs = require("fs");
const express = require("express");

const bot = new Telegraf(process.env.BOT_TOKEN);
const app = express();

// ===== LOAD USERS =====
let users = {};
try {
  users = JSON.parse(fs.readFileSync("users.json"));
} catch {
  users = {};
}

function saveUsers() {
  fs.writeFileSync("users.json", JSON.stringify(users, null, 2));
}

// ===== DATA =====
let pendingDeposits = {};
let pendingWithdrawals = {};
let userState = {};

// ===== ADMIN =====
const ADMIN_ID = 7510750214;

// ===== BANK DETAILS =====
const BANK_NAME = "Moniepoint MFB";
const ACCOUNT_NUMBER = "5075903950";
const ACCOUNT_NAME = "Kamsi Chosen Oragwam";

// ===== MENU =====
function mainMenu() {
  return Markup.keyboard([
    ["💰 Invest", "💳 Deposit"],
    ["🏧 Withdraw", "💼 Balance"],
    ["👥 Referral"]
  ]).resize();
}

// ===== START =====
bot.start((ctx) => {
  const id = ctx.from.id;

  if (!users[id]) {
    users[id] = { balance: 0, invested: 0 };
    saveUsers();
  }

  ctx.reply("🏠 MAIN MENU", mainMenu());
});

// ===== BACK =====
bot.hears("⬅️ Back", (ctx) => {
  ctx.reply("🏠 MAIN MENU", mainMenu());
});

// ===== DEPOSIT =====
bot.hears("💳 Deposit", (ctx) => {
  const id = ctx.from.id;
  userState[id] = "deposit";

  ctx.reply("💳 Choose amount:", Markup.keyboard([
    ["₦3000", "₦5000"],
    ["₦10000", "₦20000"],
    ["₦30000", "₦50000"],
    ["⬅️ Back"]
  ]).resize());
});

// ===== INVEST =====
bot.hears("💰 Invest", (ctx) => {
  const id = ctx.from.id;

  if (!users[id] || users[id].balance <= 0) {
    return ctx.reply("❌ You must deposit before investing");
  }

  userState[id] = "invest";

  ctx.reply("💼 Choose amount:", Markup.keyboard([
    ["₦3000", "₦5000"],
    ["₦10000", "₦20000"],
    ["₦30000", "₦50000"],
    ["⬅️ Back"]
  ]).resize());
});

// ===== HANDLE AMOUNT =====
bot.hears(/₦\d+/, (ctx) => {
  const id = ctx.from.id;
  const amt = parseInt(ctx.message.text.replace("₦", ""));

  if (userState[id] === "deposit") {
    pendingDeposits[id] = { amount: amt };

    ctx.reply(`💳 Pay ₦${amt} to:

🏦 ${BANK_NAME}
👤 ${ACCOUNT_NAME}
🔢 ${ACCOUNT_NUMBER}

⏳ Wait for approval`);

    bot.telegram.sendMessage(ADMIN_ID,
`💰 Deposit Request

User: ${id}
Amount: ₦${amt}`,
      Markup.inlineKeyboard([
        [Markup.button.callback("✅ Approve", `approve_deposit_${id}`)],
        [Markup.button.callback("❌ Reject", `reject_deposit_${id}`)]
      ])
    );

    userState[id] = null;
  }

  else if (userState[id] === "invest") {

    if (users[id].balance < amt) {
      return ctx.reply("❌ Insufficient balance");
    }

    users[id].balance -= amt;
    users[id].invested += amt;
    saveUsers();

    ctx.reply(`✅ Invested ₦${amt}`);
    userState[id] = null;
  }
});

// ===== APPROVE DEPOSIT =====
bot.action(/approve_deposit_(\d+)/, (ctx) => {
  const id = ctx.match[1];
  const data = pendingDeposits[id];

  if (!data) return;

  if (!users[id]) users[id] = { balance: 0, invested: 0 };

  const bonus = 500;

  users[id].balance += data.amount + bonus;
  saveUsers();

  delete pendingDeposits[id];

  ctx.telegram.sendMessage(id,
`✅ Deposit Approved

Amount: ₦${data.amount}
Bonus: ₦${bonus}

Balance: ₦${users[id].balance}`);

  ctx.editMessageText("✅ Approved");
});

// ===== WITHDRAW =====
bot.hears("🏧 Withdraw", (ctx) => {
  const id = ctx.from.id;

  if (!users[id] || users[id].invested <= 0) {
    return ctx.reply("❌ You must invest before withdrawing");
  }

  if (users[id].balance < 500) {
    return ctx.reply("❌ Minimum withdrawal is ₦500");
  }

  userState[id] = "withdraw_details";
  ctx.reply("Send: Name - Bank - Account Number");
});

// ===== HANDLE WITHDRAW =====
bot.on("text", (ctx) => {
  const id = ctx.from.id;

  if (userState[id] === "withdraw_details") {
    pendingWithdrawals[id] = { details: ctx.message.text };
    userState[id] = "withdraw_amount";
    return ctx.reply("Enter amount:");
  }

  if (userState[id] === "withdraw_amount") {
    const amt = parseInt(ctx.message.text);

    if (users[id].balance < amt) {
      return ctx.reply("❌ Insufficient balance");
    }

    pendingWithdrawals[id].amount = amt;

    bot.telegram.sendMessage(ADMIN_ID,
`Withdrawal Request

User: ${id}
Amount: ₦${amt}

${pendingWithdrawals[id].details}`);

    ctx.reply("⏳ Awaiting approval...");
    userState[id] = null;
  }
});

// ===== SERVER =====
app.use(bot.webhookCallback("/bot"));

bot.telegram.setWebhook(process.env.WEBHOOK_URL);

app.get("/", (req, res) => {
  res.send("Bot running");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running"));

process.on("uncaughtException", (err) => {
  console.log("CRASH ERROR:", err);
});

process.on("unhandledRejection", (err) => {
  console.log("PROMISE ERROR:", err);
});
