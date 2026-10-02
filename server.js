const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const path = require('path');

const app = express();
app.use(express.json());
// 1. Public folder add kela
app.use(express.static(path.join(__dirname, 'public')));

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
        if (qr) { qrData = qr; isReady = false; console.log('QR Aala'); }
        if (connection === 'open') {
            isReady = true; qrData = null;
            console.log('✅ READY');
            try {
                const all = await sock.groupFetchAllParticipating();
                groups = Object.values(all).map(g => ({ id: g.id, name: g.subject }));
                console.log(groups);
            } catch(e){}
        }
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) start();
        }
    });
}
start();

// 2. Aata / var tuza DryCo cha design disel
app.get('/', (req,res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 3. Juna wala status aata /status var gela
app.get('/status', (req,res) => res.send(`<h2>${isReady?'✅ READY - <a href=/groups>Groups bagh</a>':'QR Baki - <a href=/qr>/qr la ja</a>'}</h2>`));

app.get('/qr', async (req,res) => {
    if (isReady) return res.send('<h2>✅ READY</h2><a href=/groups style=font-size:24px>Groups Bagha</a>');
    if (!qrData) return res.send('<h3>QR yetoy... 5 sec ne refresh kara</h3><script>setTimeout(()=>location.reload(),2000)</script>');
    const img = await qrcode.toDataURL(qrData);
    res.send(`<center><h2>WhatsApp madhe QR Scan kara</h2><img src="${img}" style="width:340px;border:10px solid #000"/><script>setTimeout(()=>location.reload(),10000)</script></center>`);
});

app.get('/groups', (req,res) => {
    if (!isReady) return res.send('Adhi /qr la scan kara');
    let h='<h2>Group var click kara - set hoil</h2>';
    groups.forEach(g=>{ h+= `<div style="padding:12px;border:1px solid #ccc;margin:6px"><b>${g.name}</b><br><a href="/set-group/${g.id}">${g.id}</a></div>` });
    res.send(h);
});

app.get('/set-group/:id', (req,res)=>{
    GROUP_ID = req.params.id;
    console.log('GROUP SET', GROUP_ID);
    res.send(`<h2>✅ Group Set: ${GROUP_ID}</h2><a href="/test-order">Test Message Pathav</a>`);
});

app.get('/test-order', async (req,res)=>{
    if(!isReady||!GROUP_ID) return res.send('READY nahi kinva Group set nahi');
    await sock.sendMessage(GROUP_ID, { text: `✅ DrycoFarm Test Order Success\nVel: ${new Date().toLocaleString()}` });
    res.send('Message gela - WhatsApp check kara');
});

app.post('/order', async (req,res)=>{
    if(!GROUP_ID) return res.json({ok:false, msg: 'Group set nahi'});
    await sock.sendMessage(GROUP_ID, { text: `🛒 New Order:\n${JSON.stringify(req.body,null,2)}` });
    res.json({ok:true});
});

app.listen(process.env.PORT||10000, ()=>console.log('Live'));
