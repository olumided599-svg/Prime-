const { Telegraf, Markup } = require("telegraf");
const express = require("express");

const BOT_TOKEN = "8783194867:AAF4a8tAkN07v9t0o5ewB_CbRsZBDBNaKJw";
const ADMIN_ID = 7510750214;
const BOT_USERNAME = "primevestglobal_bot";
const CHANNEL = "@starfordfreenumbers";
const GROUP = "@primevestglobalinvestments";

const bot = new Telegraf(BOT_TOKEN);

// ===== SERVER (FOR RENDER) =====
const app = express();
app.get("/", (req, res) => res.send("Bot Running"));
app.listen(3000, () => console.log("Server running"));

// ===== DATABASE =====
let users = {};
let pendingDeposits = {};
let pendingWithdrawals = {};
let withdrawals = [];
let recentWithdrawals = [];
let activities = [];

// ===== GET USER =====
function getUser(id) {
  if (!users[id]) {
    users[id] = {
      balance: 500,
      profit: 0,
      invested: 0,
      bank: null,
      refBy: null,
      referrals: 0,
      totalEarned: 0
    };
  }
  return users[id];
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

// ===== MENU =====
function menu() {
  return Markup.keyboard([
    ["💼 Invest", "💰 Balance"],
    ["🏧 Withdraw", "💳 Deposit"],
    ["🏦 Add Bank", "👥 Referral"],
    ["📜 History", "📢 Activity"],
    ["🛠 Admin Panel"]
  ]).resize();
}

// ===== START =====
bot.start(async (ctx) => {
  let id = ctx.from.id;
  let u = getUser(id);

  let ref = ctx.startPayload;
  if (ref && ref != id && !u.refBy) {
    u.refBy = ref;
  }

  if (!(await checkJoin(ctx))) {
    return ctx.reply(
      "🚫 Join channel & group first",
      Markup.inlineKeyboard([
        [Markup.button.url("📢 Channel", `https://t.me/${CHANNEL.replace("@","")}`)],
        [Markup.button.url("👥 Group", `https://t.me/${GROUP.replace("@","")}`)]
      ])
    );
  }

  ctx.reply("🚀 Welcome to Prime Vest Global", menu());
});

// ===== BALANCE =====
bot.hears("💰 Balance", async (ctx) => {
  if (!(await checkJoin(ctx))) return;

  let u = getUser(ctx.from.id);

  ctx.reply(
`💰 Balance: ₦${u.balance}
📈 Profit: ₦${u.profit}
💼 Invested: ₦${u.invested}
👥 Referrals: ${u.referrals}`
  );
});

// ===== INVEST MENU =====
bot.hears("💼 Invest", async (ctx) => {
  if (!(await checkJoin(ctx))) return;

  ctx.reply(
    "📊 Choose Package:",
    Markup.keyboard([
      ["₦3000","₦5000"],
      ["₦10000","₦15000"],
      ["₦20000","₦25000"],
      ["₦40000","₦50000"],
      ["⬅️ Back"]
    ]).resize()
  );
});

// ===== INVEST HANDLE =====
const packages = [3000,5000,10000,15000,20000,25000,40000,50000];

bot.hears(packages.map(x=>"₦"+x),(ctx)=>{
  let amount = parseInt(ctx.message.text.replace("₦",""));
  let u = getUser(ctx.from.id);

  if(u.balance < amount) return ctx.reply("❌ Insufficient balance");

  u.balance -= amount;
  u.invested += amount;

  if(u.refBy){
    let ref = getUser(u.refBy);
    let bonus = Math.floor(amount * 0.18);

    ref.balance += bonus;
    ref.totalEarned += bonus;
    ref.referrals += 1;

    bot.telegram.sendMessage(u.refBy, `🎉 Referral bonus ₦${bonus}`);
  }

  activities.push(`User ${ctx.from.id} invested ₦${amount}`);

  ctx.reply(`✅ Invested ₦${amount}`);
});

// ===== DEPOSIT MENU =====
bot.hears("💳 Deposit", async (ctx) => {
  if (!(await checkJoin(ctx))) return;

  ctx.reply(
    "💳 Choose Deposit:",
    Markup.keyboard([
      ["₦3000","₦5000"],
      ["₦10000","₦15000"],
      ["₦20000","₦25000"],
      ["₦40000","₦50000"],
      ["⬅️ Back"]
    ]).resize()
  );
});

// ===== DEPOSIT SELECT =====
bot.hears(packages.map(x=>"₦"+x),(ctx)=>{
  let amount = parseInt(ctx.message.text.replace("₦",""));
  let id = ctx.from.id;

  pendingDeposits[id] = amount;

  ctx.reply(
`💳 Deposit ₦${amount}

🏦 Bank: Moniepoint
👤 Name: Kamsi
🔢 Account: 5075903950

📸 Send screenshot after payment`
  );
});

// ===== SCREENSHOT + APPROVE =====
bot.on("photo", async (ctx)=>{
  let id = ctx.from.id;

  if(pendingDeposits[id]){
    let amount = pendingDeposits[id];

    await bot.telegram.sendPhoto(
      ADMIN_ID,
      ctx.message.photo[0].file_id,
      {
        caption:`💳 Deposit Proof

User: ${id}
Amount: ₦${amount}`,
        ...Markup.inlineKeyboard([
          [Markup.button.callback("✅ Approve", `approve_${id}_${amount}`)],
          [Markup.button.callback("❌ Reject", `reject_${id}`)]
        ])
      }
    );

    ctx.reply("⏳ Waiting for approval...");
  }
});

// ===== APPROVE DEPOSIT =====
bot.action(/approve_(.+)/,(ctx)=>{
  let [userId,amount]=ctx.match[1].split("_");

  let u=getUser(userId);
  u.balance+=parseInt(amount);

  activities.push(`User ${userId} deposited ₦${amount}`);

  bot.telegram.sendMessage(userId,`✅ Deposit approved ₦${amount}`);

  ctx.editMessageCaption("✅ Approved");
});

// ===== REJECT DEPOSIT =====
bot.action(/reject_(.+)/,(ctx)=>{
  let userId=ctx.match[1];

  bot.telegram.sendMessage(userId,"❌ Deposit rejected");

  ctx.editMessageCaption("❌ Rejected");
});

// ===== WITHDRAW =====
bot.hears("🏧 Withdraw", async (ctx)=>{
  if (!(await checkJoin(ctx))) return;

  let u=getUser(ctx.from.id);
  let id=ctx.from.id;

  if(!u.bank) return ctx.reply("Add bank first");
  if(u.balance<=0) return ctx.reply("No balance");

  let amount=u.balance;
  pendingWithdrawals[id]=amount;

  bot.telegram.sendMessage(
    ADMIN_ID,
`🏧 Withdrawal

User: ${id}
Amount: ₦${amount}
Bank: ${u.bank}`,
    Markup.inlineKeyboard([
      [Markup.button.callback("✅ Approve", `wapprove_${id}_${amount}`)],
      [Markup.button.callback("❌ Reject", `wreject_${id}`)]
    ])
  );

  ctx.reply("⏳ Pending approval...");
});

// ===== APPROVE WITHDRAW =====
bot.action(/wapprove_(.+)/,(ctx)=>{
  let [userId,amount]=ctx.match[1].split("_");
  let u=getUser(userId);

  u.balance-=parseInt(amount);

  withdrawals.push(`User ${userId} ₦${amount}`);
  recentWithdrawals.push(`User ${userId} ₦${amount}`);

  bot.telegram.sendMessage(userId,`✅ Withdrawal ₦${amount} sent`);

  ctx.editMessageText("✅ Approved");
});

// ===== REJECT WITHDRAW =====
bot.action(/wreject_(.+)/,(ctx)=>{
  let userId=ctx.match[1];

  bot.telegram.sendMessage(userId,"❌ Withdrawal rejected");

  ctx.editMessageText("❌ Rejected");
});

// ===== ADD BANK =====
bot.hears("🏦 Add Bank",(ctx)=>{
  ctx.reply("Send Name / Bank / Account");
});

bot.on("text",(ctx)=>{
  let u=getUser(ctx.from.id);

  if(ctx.message.text.includes("/") && ctx.message.text.length>10){
    u.bank=ctx.message.text;
    ctx.reply("✅ Bank saved");
  }
});

// ===== REFERRAL =====
bot.hears("👥 Referral",(ctx)=>{
  let id=ctx.from.id;
  let u=getUser(id);

  ctx.reply(
`Link:
https://t.me/${BOT_USERNAME}?start=${id}

Referrals: ${u.referrals}
Earnings: ₦${u.totalEarned}`
  );
});

// ===== HISTORY =====
bot.hears("📜 History",(ctx)=>{
  ctx.reply(recentWithdrawals.join("\n")||"No withdrawals");
});

// ===== ACTIVITY =====
bot.hears("📢 Activity",(ctx)=>{
  ctx.reply(activities.join("\n")||"No activity");
});

// ===== ADMIN PANEL =====
bot.hears("🛠 Admin Panel",(ctx)=>{
  if(ctx.from.id!=ADMIN_ID) return;

  ctx.reply(
    "Admin Panel",
    Markup.keyboard([
      ["👥 Users"],
      ["💳 Deposits"],
      ["🏧 Withdrawals"],
      ["📊 Stats"],
      ["⬅️ Back"]
    ]).resize()
  );
});

bot.hears("👥 Users",(ctx)=>{
  if(ctx.from.id!=ADMIN_ID) return;
  ctx.reply(Object.keys(users).join("\n")||"No users");
});

bot.hears("💳 Deposits",(ctx)=>{
  if(ctx.from.id!=ADMIN_ID) return;
  ctx.reply(activities.join("\n")||"No deposits");
});

bot.hears("🏧 Withdrawals",(ctx)=>{
  if(ctx.from.id!=ADMIN_ID) return;
  ctx.reply(withdrawals.join("\n")||"No withdrawals");
});

bot.hears("📊 Stats",(ctx)=>{
  if(ctx.from.id!=ADMIN_ID) return;
  ctx.reply(`Users: ${Object.keys(users).length}`);
});

// ===== BACK =====
bot.hears("⬅️ Back",(ctx)=>ctx.reply("Menu",menu()));

bot.launch();
console.log("BOT RUNNING");

const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("Bot is running");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
