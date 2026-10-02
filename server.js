const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const app = express();
app.use(express.json());
app.use(express.urlencoded({extended:true}));

let qrData = null;
let isReady = false;
let groups = [];

const client = new Client({
    authStrategy: new LocalAuth({ clientId: "dryco" }),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--single-process']
    }
});

client.on('qr', (qr) => {
    console.log('QR ready');
    qrData = qr;
    isReady = false;
});
client.on('ready', async () => {
    console.log('✅ READY');
    isReady = true;
    qrData = null;
    try{
        const chats = await client.getChats();
        groups = chats.filter(c=>c.isGroup).map(g=>({name:g.name, id:g.id._serialized}));
        console.log('GROUPS:', groups);
    }catch(e){ console.log(e) }
});
client.on('disconnected', ()=>{ isReady=false; qrData=null; client.initialize(); });
client.initialize();

app.get('/qr', async (req,res)=>{
    if(isReady) return res.send('<h2>✅ READY - WhatsApp Connected</h2><a href="/groups">Groups bagha</a>');
    if(!qrData) return res.send('<h3>30 sec ne refresh kara - QR yetoy...</h3><script>setTimeout(()=>location.reload(),5000)</script>');
    const qrImg = await qrcode.toDataURL(qrData);
    res.send(`<h3>Scan kara 20 sec madhe</h3><img src="${qrImg}" style="width:300px"/><script>setTimeout(()=>location.reload(),20000)</script>`);
});
app.get('/groups', (req,res)=>{
    if(!isReady) return res.send('Adhi QR scan kara');
    let h='<h2>Groups:</h2><ul>';
    groups.forEach(g=>{ h+=`<li>${g.name} => <a href="/set-group/${g.id}">${g.id}</a> <br><small>Ha link dabla ki group set hoil</small></li><br>` });
    res.send(h);
});
app.get('/set-group/:id', (req,res)=>{
    process.env.GROUP_ID = req.params.id;
    res.send(`Group Set: ${req.params.id} <br><br> Aata order test kara`);
});
app.get('/', (req,res)=>{ res.send('DrycoFarm Live - /qr la ja'); });

const PORT = process.env.PORT || 10000;
app.listen(PORT, ()=>console.log('Server chalu '+PORT));
