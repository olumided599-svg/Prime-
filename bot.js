require("dotenv").config();
const { Telegraf, Markup } = require("telegraf");
const fs = require("fs");

const bot = new Telegraf(process.env.BOT_TOKEN);

// ===== GROUP FORCE JOIN =====
const GROUP = "@primevestglobalinvestments";

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

// ===== BANK =====
const BANK_NAME = "Moniepoint MFB";
const ACCOUNT_NUMBER = "5075903950";
const ACCOUNT_NAME = "Kamsi Chosen Oragwam";

// ===== FORCE JOIN CHECK =====
async function isJoined(ctx) {
  try {
    const member = await ctx.telegram.getChatMember(
      GROUP,
      ctx.from.id
    );

    return ["member","administrator","creator"]
      .includes(member.status);

  } catch {
    return false;
  }
}

// ===== MENU =====
function mainMenu() {
  return Markup.keyboard([
    ["💰 Invest","💳 Deposit"],
    ["🏧 Withdraw","💼 Balance"],
    ["👥 Referral"]
  ]).resize();
}

// ===== START =====
bot.start(async (ctx)=>{

  const joined = await isJoined(ctx);

  if (!joined) {
    return ctx.reply(
      "🚫 Join our group first before using the bot",
      Markup.inlineKeyboard([
        [
          Markup.button.url(
            "📢 Join Group",
            "https://t.me/primevestglobalinvestments"
          )
        ],
        [
          Markup.button.callback(
            "✅ Verify",
            "verify_join"
          )
        ]
      ])
    );
  }

  const id = ctx.from.id;

  if (!users[id]) {
    users[id] = {
      balance:0,
      invested:0
    };
    saveUsers();
  }

  ctx.reply(
    "🏠 MAIN MENU",
    mainMenu()
  );

});

// ===== VERIFY =====
bot.action("verify_join", async (ctx)=>{

  const joined = await isJoined(ctx);

  if (!joined) {
    return ctx.answerCbQuery(
      "❌ You have not joined yet"
    );
  }

  await ctx.answerCbQuery(
    "✅ Verified"
  );

  const id = ctx.from.id;

  if (!users[id]) {
    users[id] = {
      balance:0,
      invested:0
    };
    saveUsers();
  }

  ctx.reply(
    "🏠 MAIN MENU",
    mainMenu()
  );

});

// ===== BACK =====
bot.hears("⬅️ Back",(ctx)=>{
  ctx.reply(
    "🏠 MAIN MENU",
    mainMenu()
  );
});

// ===== DEPOSIT =====
bot.hears("💳 Deposit",(ctx)=>{

  const id = ctx.from.id;

  userState[id]="deposit";

  ctx.reply(
    "💳 Choose amount:",
    Markup.keyboard([
      ["₦3000","₦5000"],
      ["₦10000","₦20000"],
      ["₦30000","₦50000"],
      ["⬅️ Back"]
    ]).resize()
  );

});

// ===== INVEST =====
bot.hears("💰 Invest",(ctx)=>{

  const id = ctx.from.id;

  if (!users[id] || users[id].balance <=0) {
    return ctx.reply(
      "❌ Deposit first before investing"
    );
  }

  userState[id]="invest";

  ctx.reply(
    "💼 Choose amount:",
    Markup.keyboard([
      ["₦3000","₦5000"],
      ["₦10000","₦20000"],
      ["₦30000","₦50000"],
      ["⬅️ Back"]
    ]).resize()
  );

});

// ===== HANDLE BUTTON AMOUNTS =====
bot.hears(/₦\d+/,(ctx)=>{

  const id = ctx.from.id;

  const amt = parseInt(
    ctx.message.text.replace("₦","")
  );

  // DEPOSIT
  if (userState[id]==="deposit") {

    pendingDeposits[id]={
      amount:amt
    };

    ctx.reply(
`Pay ₦${amt} to:

🏦 ${BANK_NAME}
👤 ${ACCOUNT_NAME}
🔢 ${ACCOUNT_NUMBER}

⏳ Wait for admin approval`
    );

    bot.telegram.sendMessage(
      ADMIN_ID,
`Deposit Request

User: ${id}
Amount: ₦${amt}`,
Markup.inlineKeyboard([
[
Markup.button.callback(
"✅ Approve",
`approve_deposit_${id}`
)
],
[
Markup.button.callback(
"❌ Reject",
`reject_deposit_${id}`
)
]
])
    );

    userState[id]=null;
  }

  // INVEST
  else if (userState[id]==="invest") {

    if (users[id].balance < amt) {
      return ctx.reply(
        "❌ Insufficient balance"
      );
    }

    users[id].balance -= amt;
    users[id].invested += amt;

    saveUsers();

    ctx.reply(
      `✅ Invested ₦${amt}`
    );

    userState[id]=null;
  }

});

// ===== APPROVE DEPOSIT =====
bot.action(
/approve_deposit_(\d+)/,
(ctx)=>{

const id = ctx.match[1];

const data = pendingDeposits[id];

if(!data) return;

if(!users[id]){
users[id]={
balance:0,
invested:0
};
}

const bonus=500;

users[id].balance +=
data.amount + bonus;

saveUsers();

delete pendingDeposits[id];

ctx.telegram.sendMessage(
id,
`✅ Deposit Approved

Amount: ₦${data.amount}
Bonus: ₦${bonus}

Balance: ₦${users[id].balance}`
);

ctx.editMessageText(
"✅ Approved"
);

});

// ===== REJECT =====
bot.action(
/reject_deposit_/,
(ctx)=>{
ctx.editMessageText(
"❌ Rejected"
);
});

// ===== WITHDRAW =====
bot.hears(
"🏧 Withdraw",
(ctx)=>{

const id=ctx.from.id;

if(!users[id]||
users[id].invested<=0){
return ctx.reply(
"❌ Invest before withdrawing"
);
}

if(users[id].balance<500){
return ctx.reply(
"❌ Minimum withdraw is ₦500"
);
}

userState[id]="withdraw_details";

ctx.reply(
"Send:\nName - Bank - Account Number"
);

});

// ===== HANDLE TEXT =====
bot.on("text",(ctx)=>{

const id=ctx.from.id;

if(userState[id]==="withdraw_details"){

pendingWithdrawals[id]={
details:ctx.message.text
};

userState[id]="withdraw_amount";

return ctx.reply(
"Enter amount:"
);

}

if(userState[id]==="withdraw_amount"){

const amt=parseInt(
ctx.message.text
);

if(isNaN(amt)||
amt<500){
return ctx.reply(
"❌ Minimum ₦500"
);
}

if(users[id].balance<amt){
return ctx.reply(
"❌ Insufficient balance"
);
}

pendingWithdrawals[id].amount=amt;

bot.telegram.sendMessage(
ADMIN_ID,
`Withdrawal Request

User:${id}
Amount:₦${amt}

${pendingWithdrawals[id].details}`
);

ctx.reply(
"⏳ Awaiting approval..."
);

userState[id]=null;

}

});

// ===== BALANCE =====
bot.hears(
"💼 Balance",
(ctx)=>{

const id=ctx.from.id;

if(!users[id]){
users[id]={
balance:0,
invested:0
};
}

ctx.reply(
`Balance: ₦${users[id].balance}

Invested: ₦${users[id].invested}`
);

});

// ===== REFERRAL =====
bot.hears(
"👥 Referral",
(ctx)=>{

const id=ctx.from.id;

ctx.reply(
`Earn 18% referral bonus

https://t.me/${ctx.botInfo.username}?start=${id}`
);

});

// ===== POLLING MODE =====
bot.telegram.deleteWebhook()
.then(()=>{
return bot.launch();
})
.then(()=>{
console.log(
"🚀 Bot running"
);
})
.catch(console.error);

process.once(
"SIGINT",
()=>bot.stop("SIGINT")
);

process.once(
"SIGTERM",
()=>bot.stop("SIGTERM")
);

process.on(
"uncaughtException",
console.error
);

process.on(
"unhandledRejection",
console.error
);
