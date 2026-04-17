require("dotenv").config();
const { Telegraf, Markup } = require("telegraf");

const bot = new Telegraf(process.env.TOKEN);
const ADMIN_ID = Number(process.env.ADMIN_ID);

// ===== CHECK TOKEN =====
if (!process.env.TOKEN) {
  console.log("❌ BOT TOKEN MISSING");
  process.exit(1);
}

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
      bank: null
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
  getUser(ctx.from.id);
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
    "💼 Choose amount:",
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
    "💳 Choose amount:",
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
    return ctx.reply("❌ Invest before withdrawing");
  }

  userMode[ctx.from.id] = "bank";
  ctx.reply("🏦 Send: Name - Bank - Account Number");
});

// ===== REFERRAL =====
bot.hears("👥 Referral", (ctx) => {
  ctx.reply(
    `👥 Earn 18% referral bonus\n\nhttps://t.me/${ctx.botInfo.username}?start=${ctx.from.id}`
  );
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

  // INVEST
  if (userMode[id] === "invest" && amount) {
    user.balance += amount;
    user.invested += amount;
    userMode[id] = null;

    return ctx.reply(`✅ Invested ₦${amount}`);
  }

  // DEPOSIT
  if (userMode[id] === "deposit" && amount) {
    pendingDeposits[id] = amount;
    userMode[id] = "proof";

    return ctx.reply(
`🏦 Pay ₦${amount} to:

${BANK_NAME}
${ACCOUNT_NAME}
${ACCOUNT_NUMBER}

📸 Send screenshot`
    );
  }

  // BANK
  if (userMode[id] === "bank") {
    user.bank = text;
    userMode[id] = "withdraw_amount";

    return ctx.reply("💸 Enter amount:");
  }

  // WITHDRAW
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
        [
          Markup.button.callback("✅ Approve", `wd_${id}`),
          Markup.button.callback("❌ Reject", `rj_${id}`)
        ]
      ])
    );

    return ctx.reply("⏳ Awaiting approval...");
  }
});

// ===== PHOTO =====
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
          { text: "✅ Approve", callback_data: `dp_${id}` },
          { text: "❌ Reject", callback_data: `rj_${id}` }
        ]]
      }
    }
  );

  ctx.reply("⏳ Waiting for approval...");
});

// ===== APPROVE =====
bot.action(/dp_(.+)/, (ctx) => {
  let id = ctx.match[1];
  let amt = pendingDeposits[id];

  let user = getUser(id);
  user.balance += amt;

  delete pendingDeposits[id];

  ctx.telegram.sendMessage(id, "✅ Deposit approved");
  ctx.editMessageText("✅ Approved");
});

// ===== WITHDRAW APPROVE =====
bot.action(/wd_(.+)/, (ctx) => {
  let id = ctx.match[1];
  let amt = pendingWithdrawals[id];

  let user = getUser(id);
  user.balance -= amt;

  delete pendingWithdrawals[id];

  ctx.telegram.sendMessage(id, "✅ Withdrawal approved");
  ctx.editMessageText("✅ Approved");
});

// ===== REJECT =====
bot.action(/rj_(.+)/, (ctx) => {
  ctx.editMessageText("❌ Rejected");
});

// ===== START BOT =====
bot.launch();

console.log("🚀 Bot running...");

// Prevent crash
process.on("uncaughtException", console.error);
process.on("unhandledRejection", console.error);
