const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname)));

let qrData = null;
let isReady = false;
let sock = null;
let GROUP_ID = process.env.GROUP_ID || null;
let groups = [];

async function start() {
    const { state, saveCreds } = await useMultiFileAuthState('./auth');
    sock = makeWASocket({ auth: state, printQRInTerminal: false });
    sock.ev.on('creds.update', saveCreds);
    sock.ev.on('connection.update', async (up) => {
        const { connection, lastDisconnect, qr } = up;
        if (qr) { qrData = qr; isReady = false; }
        if (connection === 'open') {
            isReady = true; qrData = null;
            try {
                const all = await sock.groupFetchAllParticipating();
                groups = Object.values(all).map(g => ({ id: g.id, name: g.subject }));
            } catch(e){}
        }
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) start();
        }
    });
}
start();

app.get('/', (req,res) => {
  const p1 = path.join(__dirname, 'public', 'index.html');
  const p2 = path.join(__dirname, 'index.html');
  if (fs.existsSync(p1)) return res.sendFile(p1);
  if (fs.existsSync(p2)) return res.sendFile(p2);
  return res.status(404).send('<h1>index.html not found</h1>');
});

app.get('/status', (req,res) => res.send(`<h2>${isReady?'READY':'QR Baki'}</h2>`));
app.get('/qr', async (req,res) => {
    if (isReady) return res.send('<h2>READY</h2>');
    if (!qrData) return res.send('<h3>QR yetoy...</h3><script>setTimeout(()=>location.reload(),2000)</script>');
    const img = await qrcode.toDataURL(qrData);
    res.send(`<center><img src="${img}" style="width:340px"/></center>`);
});
app.get('/groups', (req,res) => {
    if (!isReady) return res.send('Adhi /qr la scan kara');
    let h='<h2>Groups</h2>';
    groups.forEach(g=>{ h+= `<div><b>${g.name}</b><br><a href="/set-group/${g.id}">${g.id}</a></div>` });
    res.send(h);
});
app.get('/set-group/:id', (req,res)=>{ GROUP_ID = req.params.id; res.send(`Group Set: ${GROUP_ID}`); });
app.get('/test-order', async (req,res)=>{
    if(!isReady||!GROUP_ID) return res.send('READY nahi');
    await sock.sendMessage(GROUP_ID, { text: `Test Order ${new Date().toLocaleString()}` });
    res.send('Message gela');
});
app.post('/order', async (req,res)=>{
    if(!GROUP_ID) return res.json({ok:false});
    await sock.sendMessage(GROUP_ID, { text: `New Order: ${JSON.stringify(req.body)}` });
    res.json({ok:true});
});
app.listen(process.env.PORT||10000, ()=>console.log('Live'));
