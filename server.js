const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let qrCodeData = null;
let isReady = false;
let allGroups = [];
let GROUP_ID = process.env.GROUP_ID || null;

const client = new Client({
    authStrategy: new LocalAuth({ clientId: "drycofarm" }),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--no-zygote', '--single-process']
    }
});

client.on('qr', async (qr) => {
    console.log('QR READY - Scan kara');
    qrCodeData = qr;
    isReady = false;
});

client.on('ready', async () => {
    console.log('✅ READY - Connected');
    isReady = true;
    qrCodeData = null;
    try {
        const chats = await client.getChats();
        allGroups = chats.filter(c => c.isGroup);
        console.log(`Groups found: ${allGroups.length}`);
        allGroups.forEach(g => console.log(`${g.name} => ${g.id._serialized}`));
    } catch (e) { console.log('Group fetch error', e.message); }
});

client.on('auth_failure', (m) => console.log('Auth Fail', m));
client.on('disconnected', (r) => {
    console.log('Disconnected', r);
    isReady = false;
    qrCodeData = null;
    client.initialize();
});

client.initialize();

// ROUTES
app.get('/', (req, res) => res.send(`<h2>DrycoFarm Live - ${isReady ? '✅ READY' : 'QR Scan Baki'} - <a href="/qr">/qr la ja</a></h2>`));

app.get('/qr', async (req, res) => {
    if (isReady) return res.send('<h2>✅ READY - WhatsApp Connected</h2><br><a href="/groups" style="font-size:20px">Groups Bagha</a>');
    if (!qrCodeData) return res.send('<h3>QR yetoy... 5 sec ne refresh kara</h3><script>setTimeout(()=>location.reload(),3000)</script>');
    const img = await qrcode.toDataURL(qrCodeData);
    res.send(`<center><h3>20 sec madhe scan kara</h3><img src="${img}" style="width:320px;border:10px solid #000"/><br><br>Scan nanter page auto READY hoil<script>setTimeout(()=>location.reload(),15000)</script></center>`);
});

app.get('/groups', (req, res) => {
    if (!isReady) return res.send('Adhi /qr la jaun scan kara');
    let html = '<h2>Tumche Groups (Set karaycha asel tar navavar click kara)</h2>';
    allGroups.forEach(g => {
        html += `<div style="padding:12px;border:1px solid #ccc;margin:5px"><b>${g.name}</b><br><a href="/set-group/${g.id._serialized}">${g.id._serialized}</a></div>`;
    });
    return res.send(html);
});

app.get('/set-group/:id', (req, res) => {
    GROUP_ID = req.params.id;
    console.log('GROUP SET:', GROUP_ID);
    res.send(`<h2>✅ Group Set Jhala:</h2><h3>${GROUP_ID}</h3><p>Aata test order taku shakto.</p><a href="/test-order">Test Order Pathav</a>`);
});

app.get('/test-order', async (req, res) => {
    if (!isReady) return res.send('WhatsApp READY nahi');
    if (!GROUP_ID) return res.send('Adhi /groups madhun group set kara');
    try {
        await client.sendMessage(GROUP_ID, `✅ DrycoFarm Test Order\nVel: ${new Date().toLocaleString()}\nGroup ID set zala!`);
        res.send('Test message group var gela - WhatsApp check kara');
    } catch (e) { res.send('Error: ' + e.message); }
});

app.post('/order', async (req, res) => {
    // Shopify / tumcha website hun order yeil tevha
    if (!GROUP_ID) return res.json({ ok: false });
    const msg = `🛒 New Order:\n${JSON.stringify(req.body, null, 2)}`;
    await client.sendMessage(GROUP_ID, msg);
    res.json({ ok: true });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log('Server Port ' + PORT));
