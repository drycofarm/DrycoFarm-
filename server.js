const express = require('express');
const cors = require('cors');
const path = require('path');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// --- CONFIG ---
let GROUP_ID = null; 
let lastQR = null;

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: { 
    args: ['--no-sandbox', '--disable-setuid-sandbox'] 
  }
});

client.on('qr', (qr) => {
  lastQR = qr;
  console.log('QR RECEIVED - Scan at /qr');
});

client.on('ready', () => {
  console.log('✅ Client is ready!');
  client.getChats().then(chats => {
    console.log('--- Tumche Groups ---');
    chats.filter(c => c.isGroup).forEach(g => {
      console.log(`GROUP: ${g.name} => ID: ${g.id._serialized}`);
    });
    console.log('---------------------');
  });
});

client.initialize();

// 1. Website Home (index.html dakhvel)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 2. QR Code Page
app.get('/qr', async (req, res) => {
  if (!lastQR) {
    return res.send('<center><h2>QR tayar hotay... 30 sec ne refresh kara</h2><p>Client ready asel tar QR yenar nahi</p></center>');
  }
  const img = await qrcode.toDataURL(lastQR);
  res.send(`<center><h2>DryCo Farm Bot - QR Scan Kara</h2><img src="${img}" width="350" style="border:10px solid #fff; border-radius:20px;"/><p>Scan zalyavar Render > Logs madhe Group ID disel</p></center>`);
});

// 3. Group ID Set Karne (Ekda karayche)
app.get('/set-group/:id', (req, res) => {
  GROUP_ID = req.params.id;
  console.log('GROUP_ID SET:', GROUP_ID);
  res.send(`<h2>✅ Group ID Set Jhala!</h2><p>${GROUP_ID}</p><p>Aata website varun test order kara.</p>`);
});

// 4. Website Varun Order Ghene - Direct Group Var Jail
app.post('/api/order', async (req, res) => {
  const { name, mobile, product, qty, address } = req.body;

  if (!GROUP_ID) {
    return res.status(400).json({ error: 'GROUP_ID set nahi. /set-group/ID kara' });
  }

  const msg = `🛒 *NAVIN ORDER - DryCo Farm* 🛒\n\n*Naav:* ${name}\n*Mobile:* ${mobile}\n*Product:* ${product}\n*Qty:* ${qty}\n*Address:* ${address}\n\n_~ Website varun ala_`;

  try {
    await client.sendMessage(GROUP_ID, msg);
    console.log('Order sent to group:', GROUP_ID);
    res.json({ success: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server chalu on ${PORT}`));
