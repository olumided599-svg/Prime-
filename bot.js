require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');

const bot = new Telegraf(process.env.BOT_TOKEN);

// ===== SETTINGS =====
const ADMIN_ID = 7510750214;
const FORCE_GROUP = '@primevestglobalinvestments'; // change to your real Telegram group username
const BANK_NAME = 'Moniepoint MFB';
const ACCOUNT_NUMBER = '5075903950';
const ACCOUNT_NAME = 'Kamsi Chosen Oragwam';

// ===== DATABASE FILES =====
function load(file, fallback={}){
 try { return JSON.parse(fs.readFileSync(file)); }
 catch(e){ return fallback; }
}
function save(file,data){ fs.writeFileSync(file, JSON.stringify(data,null,2)); }

let users = load('users.json', {});
let pendingDeposits = load('pendingDeposits.json', {});
let pendingWithdrawals = load('pendingWithdrawals.json', {});
let state = {};

function saveAll(){
 save('users.json', users);
 save('pendingDeposits.json', pendingDeposits);
 save('pendingWithdrawals.json', pendingWithdrawals);
}

async function joinedGroup(userId){
 try{
   const m = await bot.telegram.getChatMember(FORCE_GROUP, userId);
   return ['member','administrator','creator'].includes(m.status);
 }catch(e){
   return false;
 }
}

function mainMenu(){
 return Markup.keyboard([
 ['💰 Invest','💳 Deposit'],
 ['🏧 Withdraw','💼 Balance'],
 ['👥 Referral','🆘 Support']
 ]).resize();
}

function amountMenu(title){
 return Markup.keyboard([
 ['₦3000','₦5000'],
 ['₦10000','₦20000'],
 ['₦30000','₦50000'],
 ['⬅️ Back']
 ]).resize();
}

// ===== START =====
bot.start(async (ctx)=>{
 const id = ctx.from.id;
 if(!(await joinedGroup(id))){
   return ctx.reply(
`🔒 Join our group first to use this bot:\nhttps://t.me/${FORCE_GROUP.replace('@','')}\n\nAfter joining press /start again`
   );
 }
 if(!users[id]) users[id]={balance:0,invested:0};
 saveAll();
 return ctx.reply('🏠 MAIN MENU', mainMenu());
});

bot.hears('⬅️ Back',(ctx)=> ctx.reply('🏠 MAIN MENU', mainMenu()));

// ===== SUPPORT =====
bot.hears('🆘 Support',(ctx)=>{
 ctx.reply('📩 Contact admin: @DEEPOUNDS001');
});

// ===== BALANCE =====
bot.hears('💼 Balance',(ctx)=>{
 const id=ctx.from.id;
 if(!users[id]) users[id]={balance:0,invested:0};
 saveAll();
 ctx.reply(
`💼 ACCOUNT DETAILS\n\n💳 Balance: ₦${users[id].balance}\n📈 Invested: ₦${users[id].invested}`
 );
});

// ===== REFERRAL =====
bot.hears('👥 Referral',(ctx)=>{
 ctx.reply(
`👥 Earn 18% referral bonus\n\nhttps://t.me/${ctx.botInfo.username}?start=${ctx.from.id}`
 );
});

// ===== DEPOSIT =====
bot.hears('💳 Deposit',(ctx)=>{
 state[ctx.from.id]='deposit';
 ctx.reply('💳 Choose amount:', amountMenu());
});

// ===== INVEST =====
bot.hears('💰 Invest',(ctx)=>{
 const id=ctx.from.id;
 if(!users[id] || users[id].balance<=0){
   return ctx.reply('❌ Deposit first before investing');
 }
 state[id]='invest';
 ctx.reply('💰 Choose investment amount:', amountMenu());
});

// ===== WITHDRAW =====
bot.hears('🏧 Withdraw',(ctx)=>{
 const id=ctx.from.id;
 if(!users[id] || users[id].invested<=0){
  return ctx.reply('❌ You must invest before withdrawing');
 }
 if(users[id].balance < 500){
  return ctx.reply('❌ Minimum withdrawal is ₦500');
 }
 state[id]='withdraw_details';
 ctx.reply('🏦 Send: Name - Bank - Account Number');
});

// ===== AMOUNT BUTTONS =====
bot.hears(/₦\d+/,(ctx)=>{
 const id=ctx.from.id;
 const amt=parseInt(ctx.message.text.replace('₦',''));

 if(state[id]==='deposit'){
   pendingDeposits[id]={amount:amt};
   saveAll();

   ctx.reply(
`💳 Pay ₦${amt} to:\n\n🏦 ${BANK_NAME}\n👤 ${ACCOUNT_NAME}\n🔢 ${ACCOUNT_NUMBER}\n\n⏳ Await admin approval`
   );

   bot.telegram.sendMessage(
    ADMIN_ID,
`💰 New Deposit Request\n\nUser: ${id}\nAmount: ₦${amt}`,
Markup.inlineKeyboard([
[Markup.button.callback('✅ Approve',`approve_deposit_${id}`)],
[Markup.button.callback('❌ Reject',`reject_deposit_${id}`)]
])
   );
   state[id]=null;
   return;
 }

 if(state[id]==='invest'){
   if(users[id].balance < amt) return ctx.reply('❌ Insufficient balance');
   users[id].balance -= amt;
   users[id].invested += amt;
   saveAll();
   state[id]=null;
   return ctx.reply(`✅ Investment activated for ₦${amt}`);
 }
});

// ===== TEXT HANDLER =====
bot.on('text',(ctx)=>{
 const id=ctx.from.id;

 if(state[id]==='withdraw_details'){
   pendingWithdrawals[id]={details:ctx.message.text};
   saveAll();
   state[id]='withdraw_amount';
   return ctx.reply('💰 Enter withdrawal amount');
 }

 if(state[id]==='withdraw_amount'){
   const amt=parseInt(ctx.message.text);
   if(isNaN(amt)||amt<500) return ctx.reply('❌ Minimum is ₦500');
   if(users[id].balance<amt) return ctx.reply('❌ Insufficient balance');

   pendingWithdrawals[id].amount=amt;
   saveAll();

   bot.telegram.sendMessage(
ADMIN_ID,
`🏧 Withdrawal Request\n\nUser: ${id}\nAmount: ₦${amt}\nDetails: ${pendingWithdrawals[id].details}`,
Markup.inlineKeyboard([
[Markup.button.callback('✅ Approve',`approve_withdraw_${id}`)],
[Markup.button.callback('❌ Reject',`reject_withdraw_${id}`)]
])
   );

   state[id]=null;
   return ctx.reply('⏳ Withdrawal awaiting approval');
 }
});

// ===== ADMIN ACTIONS =====
bot.action(/approve_deposit_(\d+)/,(ctx)=>{
 const id=ctx.match[1];
 if(!pendingDeposits[id]) return;
 if(!users[id]) users[id]={balance:0,invested:0};
 users[id].balance += pendingDeposits[id].amount + 500;
 delete pendingDeposits[id];
 saveAll();
 ctx.editMessageText('✅ Deposit Approved');
 bot.telegram.sendMessage(id,'✅ Deposit approved + ₦500 bonus added');
});

bot.action(/reject_deposit_(\d+)/,(ctx)=>{
 delete pendingDeposits[ctx.match?.[1]];
 saveAll();
 ctx.editMessageText('❌ Deposit Rejected');
});

bot.action(/approve_withdraw_(\d+)/,(ctx)=>{
 const id=ctx.match[1];
 if(!pendingWithdrawals[id]) return;
 users[id].balance -= pendingWithdrawals[id].amount;
 delete pendingWithdrawals[id];
 saveAll();
 ctx.editMessageText('✅ Withdrawal Approved');
 bot.telegram.sendMessage(id,'✅ Withdrawal approved');
});

bot.action(/reject_withdraw_(\d+)/,(ctx)=>{
 delete pendingWithdrawals[ctx.match[1]];
 saveAll();
 ctx.editMessageText('❌ Withdrawal Rejected');
});

// ===== START BOT (LONG POLLING 24/7 WITH PM2) =====
bot.launch();
console.log('Prime Vest Global running...');

process.once('SIGINT', ()=> bot.stop('SIGINT'));
process.once('SIGTERM', ()=> bot.stop('SIGTERM'));
