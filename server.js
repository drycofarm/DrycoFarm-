require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
// Keep Puppeteer's browser cache inside the deployed project so the same
// Chrome binary is available during both build and runtime on Render.
process.env.PUPPETEER_CACHE_DIR = process.env.PUPPETEER_CACHE_DIR || path.join(__dirname, '.cache', 'puppeteer');
const puppeteer = require('puppeteer');

const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const GROUP_INVITE = process.env.WHATSAPP_GROUP_INVITE || 'https://chat.whatsapp.com/HB927owa6B7LmICVHufRcg';
const MAIN_NUMBER = process.env.MAIN_NUMBER || '9969129992';
const DATA_DIR = path.join(__dirname, 'data');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(ORDERS_FILE)) fs.writeFileSync(ORDERS_FILE, '[]');

app.use(express.json({ limit: '20kb' }));
app.use(express.static(__dirname));

let waReady = false;
let groupChat = null;
let inviteCode = (GROUP_INVITE.match(/chat\.whatsapp\.com\/([A-Za-z0-9_-]+)/) || [])[1] || '';

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: path.join(__dirname, '.wwebjs_auth') }),
  puppeteer: {
    headless: true,
    executablePath: puppeteer.executablePath(),
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  }
});

client.on('qr', qr => {
  console.log('\nScan this QR with the WhatsApp account that should post orders:');
  qrcode.generate(qr, { small: true });
});
client.on('authenticated', () => console.log('WhatsApp authenticated.'));
client.on('auth_failure', msg => console.error('WhatsApp auth failure:', msg));
client.on('disconnected', reason => { waReady = false; groupChat = null; console.log('WhatsApp disconnected:', reason); });

async function resolveGroup() {
  // If already a member, locate the group from the invite information.
  if (inviteCode) {
    try {
      const info = await client.getInviteInfo(inviteCode);
      const gid = info?.id?._serialized || info?.gid?._serialized || info?.gid;
      if (gid) {
        try { groupChat = await client.getChatById(gid); } catch (_) {}
      }
      if (!groupChat && info?.subject) {
        const chats = await client.getChats();
        groupChat = chats.find(c => c.isGroup && c.name === info.subject) || null;
      }
      // If the account has not joined yet, join the supplied group.
      if (!groupChat) {
        try {
          const joinedId = await client.acceptInvite(inviteCode);
          groupChat = await client.getChatById(joinedId);
        } catch (joinErr) {
          console.error('Could not join/resolve the group automatically:', joinErr.message || joinErr);
        }
      }
    } catch (err) {
      console.error('Invite lookup failed:', err.message || err);
    }
  }

  if (!groupChat && process.env.WHATSAPP_GROUP_NAME) {
    const chats = await client.getChats();
    groupChat = chats.find(c => c.isGroup && c.name === process.env.WHATSAPP_GROUP_NAME) || null;
  }
  if (groupChat) console.log(`Order group ready: ${groupChat.name} (${groupChat.id._serialized})`);
  else console.log('Order group not resolved yet. Set WHATSAPP_GROUP_NAME if needed.');
}

client.on('ready', async () => {
  waReady = true;
  console.log('WhatsApp client is ready.');
  await resolveGroup();
});

function nextOrderId() {
  const date = new Date();
  const stamp = date.toISOString().slice(0,10).replace(/-/g,'');
  const rand = Math.floor(1000 + Math.random()*9000);
  return `DCF-${stamp}-${rand}`;
}

app.get('/api/status', (req,res) => res.json({ ready: waReady, groupReady: !!groupChat }));

app.post('/api/order', async (req,res) => {
  try {
    const { product, size, qty, name, address } = req.body || {};
    const allowedSizes = ['100 g','200 g','500 g'];
    if (!product || !name || !address || !allowedSizes.includes(size) || !Number.isInteger(Number(qty)) || Number(qty) < 1) {
      return res.status(400).json({ message: 'Please fill Name, Quantity, Size and Delivery Address correctly.' });
    }
    if (!waReady) return res.status(503).json({ message: 'Order service is starting. Please try again in a moment.' });
    if (!groupChat) await resolveGroup();
    if (!groupChat) return res.status(503).json({ message: 'The DryCo Farm order group is not connected yet. Please contact the store.' });

    const orderId = nextOrderId();
    const order = { orderId, product, size, qty: Number(qty), name: String(name).trim(), address: String(address).trim(), createdAt: new Date().toISOString() };
    const orders = JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8'));
    orders.push(order);
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));

    const message = [
      '🛒 *DRYCO FARM — NEW ORDER*',
      '',
      `*Order ID:* ${orderId}`,
      `*Product:* ${order.product}`,
      `*Size:* ${order.size}`,
      `*Quantity:* ${order.qty}`,
      `*Customer Name:* ${order.name}`,
      `*Delivery Address:* ${order.address}`,
      '',
      `*Order received via website*`,
      `*Store WhatsApp:* +91 ${MAIN_NUMBER}`
    ].join('\n');

    await groupChat.sendMessage(message);
    return res.json({ ok: true, orderId });
  } catch (err) {
    console.error('Order error:', err);
    return res.status(500).json({ message: 'Could not send the order. Please try again.' });
  }
});

app.get('*', (req,res) => res.sendFile(path.join(__dirname, 'index.html')));

client.initialize();
app.listen(PORT, () => console.log(`DryCo Farm website/order server running on http://localhost:${PORT}`));
