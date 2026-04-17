const { Telegraf, Markup } = require("telegraf");
const express = require("express");

// ===== CONFIG =====
const bot = new Telegraf(process.env.TOKEN);
const ADMIN_ID = Number(process.env.ADMIN_ID);

// ===== BANK DETAILS =====
const BANK_NAME = "Moniepoint MFB";
const ACCOUNT_NAME = "Kamsi Chosen Oragwam";
const ACCOUNT_NUMBER = "5075903950";

// ===== DATABASE =====
let users = {};
let userMode = {};
let pendingDeposits = {};
let pendingWithdrawals = {};

// ===== USER =====
function getUser(id) {
  if (!users[id]) {
    users[id] = {
      balance: 0,
      invested: 0,
      bank: null,
      refBy: null
    };
  }
  return users[id];
}

// ===== MENU =====
function mainMenu(ctx) {
  return ctx.reply(
    "🏠 MAIN MENU",
    Markup.keyboard([
      ["💰 Invest", "💳 Deposit"],
      ["🏧 Withdraw", "💼 Balance"],
      ["👥 Referral"]
    ]).resize()
  );
}

// ===== START =====
bot.start((ctx) => {
  let id = ctx.from.id;
  getUser(id);

  return mainMenu(ctx);
});

// ===== BALANCE =====
bot.hears("💼 Balance", (ctx) => {
  let u = getUser(ctx.from.id);
  ctx.reply(`💰 Balance: ₦${u.balance}\n📊 Invested: ₦${u.invested}`);
});

// ===== INVEST =====
bot.hears("💰 Invest", (ctx) => {
  userMode[ctx.from.id] = "invest";

  ctx.reply(
    "💼 Choose investment amount:",
    Markup.keyboard([
      ["₦3000", "₦5000"],
      ["₦10000", "₦20000"],
      ["₦30000", "₦50000"],
      ["🔙 Back"]
    ]).resize()
  );
});

// ===== DEPOSIT =====
bot.hears("💳 Deposit", (ctx) => {
  userMode[ctx.from.id] = "deposit";

  ctx.reply(
    "💳 Choose deposit amount:",
    Markup.keyboard([
      ["₦3000", "₦5000"],
      ["₦10000", "₦20000"],
      ["₦30000", "₦50000"],
      ["🔙 Back"]
    ]).resize()
  );
});

// ===== WITHDRAW =====
bot.hears("🏧 Withdraw", (ctx) => {
  let user = getUser(ctx.from.id);

  if (user.invested <= 0) {
    return ctx.reply("❌ You must invest before withdrawing");
  }

  userMode[ctx.from.id] = "bank";
  ctx.reply("🏦 Send account details:\nName - Bank - Account Number");
});

// ===== REFERRAL =====
bot.hears("👥 Referral", (ctx) => {
  ctx.reply(`👥 Earn 18% of your referral\n\nhttps://t.me/${ctx.botInfo.username}?start=${ctx.from.id}`);
});

// ===== BACK =====
bot.hears("🔙 Back", (ctx) => {
  userMode[ctx.from.id] = null;
  return mainMenu(ctx);
});

// ===== TEXT HANDLER =====
bot.on("text", (ctx) => {
  let id = ctx.from.id;
  let text = ctx.message.text;
  let user = getUser(id);

  let amount = parseInt(text.replace(/[^\d]/g, ""));

  // ===== INVEST =====
  if (userMode[id] === "invest" && amount) {
    if (amount > 50000) return;

    user.balance += amount;
    user.invested += amount;

    userMode[id] = null;
    return ctx.reply(`✅ Invested ₦${amount}`);
  }

  // ===== DEPOSIT =====
  if (userMode[id] === "deposit" && amount) {
    pendingDeposits[id] = amount;
    userMode[id] = "deposit_proof";

    return ctx.reply(
`🏦 Pay ₦${amount} to:

Bank: ${BANK_NAME}
Name: ${ACCOUNT_NAME}
Account: ${ACCOUNT_NUMBER}

📸 Send screenshot after payment`
    );
  }

  // ===== BANK =====
  if (userMode[id] === "bank") {
    user.bank = text;
    userMode[id] = "withdraw_amount";

    return ctx.reply("💸 Enter amount to withdraw:");
  }

  // ===== WITHDRAW AMOUNT =====
  if (userMode[id] === "withdraw_amount") {
    let amt = amount;

    if (amt > user.balance) {
      return ctx.reply("❌ Insufficient balance");
    }

    pendingWithdrawals[id] = amt;
    userMode[id] = null;

    ctx.telegram.sendMessage(
      ADMIN_ID,
      `📤 Withdrawal\nUser: ${id}\nAmount: ₦${amt}\nBank: ${user.bank}`,
      Markup.inlineKeyboard([
        [Markup.button.callback("✅ Approve", `approve_wd_${id}`),
         Markup.button.callback("❌ Reject", `reject_wd_${id}`)]
      ])
    );

    return ctx.reply("⏳ Waiting for admin approval...");
  }
});

// ===== PHOTO (DEPOSIT PROOF) =====
bot.on("photo", (ctx) => {
  let id = ctx.from.id;

  if (!pendingDeposits[id]) return;

  let amt = pendingDeposits[id];

  ctx.telegram.sendPhoto(
    ADMIN_ID,
    ctx.message.photo.pop().file_id,
    {
      caption: `📥 Deposit\nUser: ${id}\nAmount: ₦${amt}`,
      reply_markup: {
        inline_keyboard: [[
          { text: "✅ Approve", callback_data: `approve_dep_${id}` },
          { text: "❌ Reject", callback_data: `reject_dep_${id}` }
        ]]
      }
    }
  );

  ctx.reply("⏳ Waiting for admin approval...");
});

// ===== APPROVE DEPOSIT =====
bot.action(/approve_dep_(.+)/, (ctx) => {
  let id = ctx.match[1];
  let amt = pendingDeposits[id];

  let user = getUser(id);
  user.balance += amt;

  delete pendingDeposits[id];

  ctx.telegram.sendMessage(id, "✅ Deposit approved & added to balance");
  ctx.editMessageText("✅ Deposit Approved");
});

// ===== APPROVE WITHDRAW =====
bot.action(/approve_wd_(.+)/, (ctx) => {
  let id = ctx.match[1];
  let amt = pendingWithdrawals[id];

  let user = getUser(id);
  user.balance -= amt;

  delete pendingWithdrawals[id];

  ctx.telegram.sendMessage(id, "✅ Withdrawal approved");
  ctx.editMessageText("✅ Withdrawal Approved");
});

// ===== REJECT =====
bot.action(/reject_(.+)/, (ctx) => {
  ctx.editMessageText("❌ Rejected");
// ===== EXPRESS SERVER FOR RENDER =====
const express = require("express");
const app = express();

// Webhook route
app.use(bot.webhookCallback("/bot"));

// Set webhook
bot.telegram.setWebhook(process.env.WEBHOOK_URL + "/bot");

// Test route
app.get("/", (req, res) => {
  res.send("🚀 Prime Vest Bot is LIVE");
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🚀 Server running on port " + PORT);
});

// ===== ERROR HANDLING =====
process.on('uncaughtException', (err) => {
  console.error("UNCAUGHT ERROR:", err);
});

process.on('unhandledRejection', (err) => {
  console.error("UNHANDLED PROMISE:", err);
});

// ===== STOP HANDLER =====
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
