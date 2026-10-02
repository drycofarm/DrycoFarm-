const express = require('express');
const cors = require('cors');
const path = require('path');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

let GROUP_ID = null;
let lastQR = null;

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: { args: ['--no-sandbox','--disable-setuid-sandbox'] }
});

client.on('qr', qr => { lastQR = qr; });
client.on('ready', () => {
  console.log('✅ READY');
  client.getChats().then(chats => {
    chats.filter(c=>c.isGroup).forEach(g => console.log(`GROUP: ${g.name} => ${g.id._serialized}`));
  });
});

client.initialize();

app.get('/qr', async (req,res)=>{
  if(!lastQR) return res.send('QR yet nahi - 10 sec ne refresh kara');
  const img = await qrcode.toDataURL(lastQR);
  res.send(`<center><img src="${img}" width="350"></center>`);
});

app.get('/pair', async (req,res)=>{
  const num = req.query.number;
  if(!num) return res.send('Use /pair?number=919969129992');
  try {
    const code = await client.requestPairingCode(num);
    res.send(`<h1>CODE: ${code}</h1><p>WhatsApp > Linked Devices > Link with phone number > Code taka</p>`);
  } catch(e){ res.send('Error: '+e.message+' - 1 min ne parat try kara'); }
});

app.get('/set-group/:id', (req,res)=>{ GROUP_ID=req.params.id; res.send('Group Set: '+GROUP_ID); });

app.post('/api/order', async (req,res)=>{
  if(!GROUP_ID) return res.status(400).json({error:'Group set nahi'});
  const {name,mobile,product,qty,address}=req.body;
  const msg = `🛒 NEW ORDER\nNaav: ${name}\nMob: ${mobile}\nProd: ${product}\nQty: ${qty}\nAddr: ${address}`;
  await client.sendMessage(GROUP_ID, msg);
  res.json({success:true});
});

app.get('/', (req,res)=> res.sendFile(path.join(__dirname,'index.html')));
app.listen(process.env.PORT||3000, ()=> console.log('Server chalu'));
