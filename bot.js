const { Telegraf, Markup } = require("telegraf");
require("dotenv").config();

const bot = new Telegraf(process.env.BOT_TOKEN);

// ===== DATA =====
let users = {};
let pendingDeposits = {};
let pendingWithdrawals = {};
let userState = {};

// ===== ADMIN =====
const ADMIN_ID = 7510750214;

// ===== BANK DETAILS =====
const BANK_NAME = "Moniepoint MFB";
const ACCOUNT_NUMBER = "5075903950";
const ACCOUNT_NAME = "Kamsi Chosen Oragwam";

// ===== MAIN MENU =====
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

  // ===== DEPOSIT =====
  if (userState[id] === "deposit") {
    pendingDeposits[id] = { amount: amt };

    ctx.reply(
`💳 Pay ₦${amt} to:

🏦 Bank: ${BANK_NAME}
👤 Name: ${ACCOUNT_NAME}
🔢 Account: ${ACCOUNT_NUMBER}

After payment, wait for admin approval ⏳`
    );

    bot.telegram.sendMessage(ADMIN_ID,
`💰 New Deposit Request

👤 User: ${id}
💵 Amount: ₦${amt}`,
      Markup.inlineKeyboard([
        [Markup.button.callback("✅ Approve", `approve_deposit_${id}`)],
        [Markup.button.callback("❌ Reject", `reject_deposit_${id}`)]
      ])
    );

    userState[id] = null;
  }

  // ===== INVEST =====
  else if (userState[id] === "invest") {

    if (users[id].balance < amt) {
      return ctx.reply("❌ Insufficient balance");
    }

    users[id].balance -= amt;
    users[id].invested += amt;

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

  delete pendingDeposits[id];

  ctx.telegram.sendMessage(id,
`✅ Deposit Approved!

💰 Amount: ₦${data.amount}
🎁 Bonus: ₦${bonus}

💳 New Balance: ₦${users[id].balance}`
  );

  ctx.editMessageText("✅ Deposit Approved");
});

// ===== REJECT DEPOSIT =====
bot.action(/reject_deposit_/, (ctx) => {
  ctx.editMessageText("❌ Deposit Rejected");
});

// ===== WITHDRAW =====
bot.hears("🏧 Withdraw", (ctx) => {
  const id = ctx.from.id;

  // ❌ MUST INVEST FIRST
  if (!users[id] || users[id].invested <= 0) {
    return ctx.reply("❌ You must invest before withdrawing");
  }

  // ❌ MUST HAVE BALANCE
  if (users[id].balance < 500) {
    return ctx.reply("❌ Minimum withdrawal is ₦500");
  }

  userState[id] = "withdraw_details";

  ctx.reply("🏦 Send:\nName - Bank - Account Number\n\n⬅️ Back");
});

// ===== HANDLE WITHDRAW =====
bot.on("text", (ctx) => {
  const id = ctx.from.id;

  if (userState[id] === "withdraw_details") {
    pendingWithdrawals[id] = { details: ctx.message.text };
    userState[id] = "withdraw_amount";
    return ctx.reply("💰 Enter amount:");
  }

  if (userState[id] === "withdraw_amount") {
    const amt = parseInt(ctx.message.text);

    if (isNaN(amt) || amt < 500) {
      return ctx.reply("❌ Minimum withdrawal is ₦500");
    }

    if (users[id].balance < amt) {
      return ctx.reply("❌ Insufficient balance");
    }

    pendingWithdrawals[id].amount = amt;

    bot.telegram.sendMessage(ADMIN_ID,
`🏧 Withdrawal Request

👤 User: ${id}
💵 Amount: ₦${amt}

📋 Details:
${pendingWithdrawals[id].details}`,
      Markup.inlineKeyboard([
        [Markup.button.callback("✅ Approve", `approve_withdraw_${id}`)],
        [Markup.button.callback("❌ Reject", `reject_withdraw_${id}`)]
      ])
    );

    ctx.reply("⏳ Awaiting approval...");
    userState[id] = null;
  }
});

// ===== APPROVE WITHDRAW =====
bot.action(/approve_withdraw_(\d+)/, (ctx) => {
  const id = ctx.match[1];
  const data = pendingWithdrawals[id];

  if (!data) return;

  users[id].balance -= data.amount;

  delete pendingWithdrawals[id];

  ctx.telegram.sendMessage(id, "✅ Withdrawal Approved");
  ctx.editMessageText("✅ Approved");
});

// ===== REJECT WITHDRAW =====
bot.action(/reject_withdraw_/, (ctx) => {
  ctx.editMessageText("❌ Rejected");
});

// ===== BALANCE =====
bot.hears("💼 Balance", (ctx) => {
  const id = ctx.from.id;

  if (!users[id]) users[id] = { balance: 0, invested: 0 };

  ctx.reply(
`💼 ACCOUNT DETAILS

💳 Balance: ₦${users[id].balance}
📈 Invested: ₦${users[id].invested}`
  );
});

// ===== REFERRAL =====
bot.hears("👥 Referral", (ctx) => {
  const id = ctx.from.id;

  ctx.reply(
`👥 Earn 18% referral bonus

https://t.me/${ctx.botInfo.username}?start=${id}`
  );
});

// ===== EXPRESS SERVER =====
const express = require("express");
const app = express();

app.use(bot.webhookCallback("/bot"));

bot.telegram.setWebhook(process.env.WEBHOOK_URL);

app.get("/", (req, res) => {
  res.send("🚀 Prime Vest Bot is LIVE");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on " + PORT));

// ===== ERROR HANDLING =====
process.on("uncaughtException", console.error);
process.on("unhandledRejection", console.error);
