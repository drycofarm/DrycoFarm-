const express = require('express');
const cors = require('cors');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');

const app = express();
app.use(cors());
app.use(express.json());

// --- CONFIG ---
// Tumchya group cha ID ithe yeil, aadhi empty theva
let GROUP_ID = null; 

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox'] }
});

let lastQR = null;
client.on('qr', async (qr) => {
  lastQR = qr;
  console.log('QR RECEIVED, scan it');
});

client.on('ready', () => {
  console.log('Client is ready!');
  console.log('Groups baghtoy...');
  // Saglya groups che ID dakhvel
  client.getChats().then(chats => {
    chats.filter(c => c.isGroup).forEach(g => {
      console.log(`GROUP: ${g.name} => ID: ${g.id._serialized}`);
    });
  });
});

client.initialize();

// QR image dakhavnyasathi
app.get('/qr', async (req, res) => {
  if (!lastQR) return res.send('<h2>QR yet nahi, 1 min ne refresh kara</h2>');
  const img = await qrcode.toDataURL(lastQR);
  res.send(`<center><h2>DryCo Farm Bot - Scan kara</h2><img src="${img}" width="350"/><p>Scan zalyavar Render Logs madhe GROUP ID disel</p></center>`);
});

// Website varun order yenyasathi
app.post('/api/order', async (req, res) => {
  const { name, mobile, product, qty, address } = req.body;
  
  if (!GROUP_ID) return res.status(400).json({ error: 'Group ID set nahi' });

  const msg = `🛒 *NAVIN ORDER - DryCo Farm* 🛒\n\n*Naav:* ${name}\n*Mobile:* ${mobile}\n*Product:* ${product}\n*Qty:* ${qty}\n*Address:* ${address}\n\n_website varun aala_`;

  try {
    await client.sendMessage(GROUP_ID, msg);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Group ID set karnyasathi (ekdach karayche)
app.get('/set-group/:id', (req, res) => {
  GROUP_ID = req.params.id;
  res.send(`Group ID set jhala: ${GROUP_ID}`);
});

app.get('/', (req, res) => res.send('DryCo Farm Bot Chaluy'));

app.listen(process.env.PORT || 3000);
