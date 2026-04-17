
const { Telegraf, Markup } = require("telegraf");

// ===== CONFIG =====
const BOT_TOKEN = process.env.TOKEN;
const ADMIN_ID = Number(process.env.ADMIN_ID);
const GROUP = "@primevestglobalinvestments";

// BANK
const BANK_NAME = "Moniepoint MFB";
const ACCOUNT_NAME = "Kamsi Chosen Oragwam";
const ACCOUNT_NUMBER = "5075903950";

const bot = new Telegraf(BOT_TOKEN);

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
      bank: null
    };
  }
  return users[id];
}

// ===== FORCE JOIN =====
async function isJoined(ctx) {
  try {
    let member = await ctx.telegram.getChatMember(GROUP, ctx.from.id);
    return ["member","administrator","creator"].includes(member.status);
  } catch {
    return false;
  }
}

// ===== START =====
bot.start(async (ctx) => {
  let joined = await isJoined(ctx);

  if (!joined) {
    return ctx.reply(
      "🚫 Join group first!",
      Markup.inlineKeyboard([
        [Markup.button.url("📢 Join", `https://t.me/${GROUP.replace("@","")}`)],
        [Markup.button.callback("✅ Verify", "verify")]
      ])
    );
  }

  showMenu(ctx);
});

// VERIFY
bot.action("verify", async (ctx) => {
  let joined = await isJoined(ctx);
  if (!joined) return ctx.answerCbQuery("❌ Join first");

   ctx.answerCbQuery("✅ Verified");
  showMenu(ctx);
});

// ===== MENU =====
function showMenu(ctx) {
  userMode[ctx.from.id] = null;

  ctx.reply(
    "🏠 MAIN MENU",
    Markup.keyboard([
      ["💼 Invest","💰 Balance"],
      ["💸 Withdraw","🏦 Deposit"],
      ["👥 Referral"]
    ]).resize()
  );
}

// ===== BALANCE =====
bot.hears("💰 Balance", (ctx) => {
  let u = getUser(ctx.from.id);

  ctx.reply(
`💰 Balance: ₦${u.balance}
💼 Invested: ₦${u.invested}`
  );
});

// ===== REFERRAL =====
bot.hears("👥 Referral", (ctx) => {
  ctx.reply(
`👥 REFERRAL PROGRAM

Earn 18% of your referral investment 💰

🔗 https://t.me/primevestglobal_bot?start=${ctx.from.id}`
  );
});

// ===== INVEST =====
bot.hears("💼 Invest", (ctx) => {
  let u = getUser(ctx.from.id);

  if (u.balance <= 0) {
    return ctx.reply("❌ You must deposit first");
  }

  u.invested += u.balance;
  u.balance = 0;

  ctx.reply("✅ Investment successful");
});

// ===== DEPOSIT =====
bot.hears("🏦 Deposit", (ctx) => {
  userMode[ctx.from.id] = "deposit";

  ctx.reply(
    "💰 Choose amount:",
    Markup.keyboard([
      ["₦3000","₦5000"],
      ["₦10000","₦20000"],
      ["₦30000","₦50000"],
      ["⬅️ Back"]
    ]).resize()
  );
});

// ===== WITHDRAW =====
bot.hears("💸 Withdraw", (ctx) => {
  let u = getUser(ctx.from.id);

  if (u.invested <= 0) {
    return ctx.reply("❌ You must invest before withdrawing");
  }

  userMode[ctx.from.id] = "withdraw_bank";

  ctx.reply("🏦 Send account details:\nName - Bank - Account Number\n⬅️ Back");
});

// ===== BACK =====
bot.hears("⬅️ Back", (ctx) => showMenu(ctx));

// ===== TEXT HANDLER =====
bot.on("text", async (ctx) => {
  let id = ctx.from.id;
  let text = ctx.message.text;
  let user = getUser(id);

// ===== DEPOSIT =====
if (userMode[id] === "deposit") {
  let amt = parseInt(text.replace("₦",""));
  if (!amt) return;

  pendingDeposits[id] = amt;
  userMode[id] = "deposit_proof";

  return ctx.reply(
`🏦 PAY TO:

Bank: ${BANK_NAME}
Name: ${ACCOUNT_NAME}
Number: ${ACCOUNT_NUMBER}

📸 Send screenshot after paying ₦${amt}`
  );
}

// ===== WITHDRAW BANK =====
if (userMode[id] === "withdraw_bank") {

  if (!text.includes("-") || text.length < 10) {
    return ctx.reply("❌ Invalid format\nUse:\nName - Bank - Account Number");
  }

  user.bank = text;
  userMode[id] = "withdraw_amount";

  return ctx.reply("💰 Enter amount you want to withdraw");
}

// ===== WITHDRAW AMOUNT =====
if (userMode[id] === "withdraw_amount") {
  let amt = parseInt(text);

  if (!amt) return;

  if (amt > user.balance) {
    return ctx.reply("❌ Insufficient balance");
  }

  pendingWithdrawals[id] = amt;
  userMode[id] = null;

  ctx.telegram.sendMessage(
    ADMIN_ID,
    `📤 Withdrawal\nUser: ${id}\nAmount: ₦${amt}\nBank: ${user.bank}`,
    {
      reply_markup: {
        inline_keyboard: [[
          { text: "✅ Approve", callback_data: `approveW_${id}` },
          { text: "❌ Reject", callback_data: `rejectW_${id}` }
        ]]
      }
    }
  );

  return ctx.reply("⏳ Waiting for admin approval...");
}

});

// ===== SCREENSHOT =====
bot.on("photo", async (ctx) => {
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
          { text: "✅ Approve", callback_data: `approveD_${id}` },
          { text: "❌ Reject", callback_data: `rejectD_${id}` }
        ]]
      }
    }
  );

  ctx.reply("⏳ Waiting for admin approval...");
});

// ===== APPROVE DEPOSIT =====
bot.action(/approveD_(.+)/, (ctx) => {
  let id = ctx.match[1];
  let user = getUser(id);
  let amt = pendingDeposits[id];

  user.balance += amt;

  delete pendingDeposits[id];

  ctx.telegram.sendMessage(id, "✅ Deposit approved");
  ctx.editMessageText("✅ Approved");
});

// ===== APPROVE WITHDRAW =====
bot.action(/approveW_(.+)/, (ctx) => {
  let id = ctx.match[1];
  let user = getUser(id);
  let amt = pendingWithdrawals[id];

  user.balance -= amt;

  delete pendingWithdrawals[id];

  ctx.telegram.sendMessage(id, "✅ Withdrawal approved");
  ctx.editMessageText("✅ Approved");
});

// ===== REJECT =====
bot.action(/reject/, (ctx) => ctx.editMessageText("❌ Rejected"));


// ===== EXPRESS SERVER FOR RENDER =====
const express = require("express");
const app = express();

// Webhook route
app.use(bot.webhookCallback("/bot"));

// Set webhook (IMPORTANT)
bot.telegram.setWebhook(process.env.WEBHOOK_URL);

// Test route (to confirm it's working)
app.get("/", (req, res) => {
  res.send("🚀 Prime Vest Bot is LIVE");
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("🚀 Server running on port " + PORT);
});

// ===== ERROR HANDLING (PREVENT CRASH) =====
process.on('uncaughtException', (err) => {
  console.error("UNCAUGHT ERROR:", err);
});

process.on('unhandledRejection', (err) => {
  console.error("UNHANDLED PROMISE:", err);
});

// ===== START BOT PROPERLY =====

// Catch errors (VERY IMPORTANT)
process.on('uncaughtException', (err) => console.log(err));
process.on('unhandledRejection', (err) => console.log(err));

// Start bot (ONLY ONCE)
bot.launch().then(() => {
    console.log("🚀 Bot is running...");
});

// Graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
