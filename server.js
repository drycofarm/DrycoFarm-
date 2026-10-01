require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

// Keep Puppeteer's Chrome cache inside the deployed project.
// Render build and runtime will use the same location.
process.env.PUPPETEER_CACHE_DIR =
  process.env.PUPPETEER_CACHE_DIR ||
  path.join(__dirname, '.cache', 'puppeteer');

const puppeteer = require('puppeteer');
const qrcode = require('qrcode-terminal');
const { Client, LocalAuth } = require('whatsapp-web.js');

const app = express();

const PORT = Number(process.env.PORT || 3000);

const GROUP_INVITE =
  process.env.WHATSAPP_GROUP_INVITE ||
  'https://chat.whatsapp.com/HB9270aa6B7LmICVHufReg';

const MAIN_NUMBER =
  process.env.MAIN_NUMBER || '9969129992';

const DATA_DIR = path.join(__dirname, 'data');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');

fs.mkdirSync(DATA_DIR, { recursive: true });

if (!fs.existsSync(ORDERS_FILE)) {
  fs.writeFileSync(ORDERS_FILE, '[]');
}

app.use(express.json({ limit: '20kb' }));
app.use(express.static(__dirname));

let waReady = false;
let groupChat = null;

// Extract WhatsApp group invite code.
const inviteMatch = GROUP_INVITE.match(
  /chat\.whatsapp\.com\/([A-Za-z0-9_-]+)/
);

const inviteCode = inviteMatch ? inviteMatch[1] : null;


// --------------------------------------------------
// Find Chrome
// --------------------------------------------------

function findChromeInDirectory(dir) {
  if (!fs.existsSync(dir)) return null;

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        const found = findChromeInDirectory(fullPath);

        if (found) {
          return found;
        }
      }

      if (
        entry.isFile() &&
        (
          entry.name === 'chrome' ||
          entry.name === 'chrome.exe' ||
          entry.name === 'Chromium'
        )
      ) {
        try {
          fs.accessSync(fullPath, fs.constants.X_OK);
          return fullPath;
        } catch (_) {}
      }
    }
  } catch (_) {}

  return null;
}


function getChromePath() {
  // 1. Explicit Render/environment path.
  if (
    process.env.PUPPETEER_EXECUTABLE_PATH &&
    fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)
  ) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  // 2. Puppeteer's configured cache.
  const cacheChrome = findChromeInDirectory(
    process.env.PUPPETEER_CACHE_DIR
  );

  if (cacheChrome) {
    return cacheChrome;
  }

  // 3. Common Linux Chrome locations.
  const commonPaths = [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser'
  ];

  for (const chromePath of commonPaths) {
    if (fs.existsSync(chromePath)) {
      return chromePath;
    }
  }

  // 4. Puppeteer's own executable path.
  try {
    const puppeteerPath = puppeteer.executablePath();

    if (puppeteerPath && fs.existsSync(puppeteerPath)) {
      return puppeteerPath;
    }
  } catch (_) {}

  return null;
}


// --------------------------------------------------
// Install Chrome automatically if required
// --------------------------------------------------

let chromePath = getChromePath();

if (!chromePath) {
  console.log('Chrome not found. Installing Chrome for Puppeteer...');

  try {
    execFileSync(
      'npx',
      ['--yes', 'puppeteer', 'browsers', 'install', 'chrome'],
      {
        stdio: 'inherit',
        env: {
          ...process.env,
          PUPPETEER_CACHE_DIR:
            process.env.PUPPETEER_CACHE_DIR
        }
      }
    );
  } catch (error) {
    console.error(
      'Automatic Chrome installation failed:',
      error.message
    );
  }

  chromePath = getChromePath();
}

if (chromePath) {
  console.log('Chrome executable found:', chromePath);
} else {
  console.error(
    'Chrome executable could not be found.'
  );
}


// --------------------------------------------------
// WhatsApp Client
// --------------------------------------------------

const client = new Client({
  authStrategy: new LocalAuth({
    dataPath: path.join(__dirname, '.wwebjs_auth')
  }),

  puppeteer: {
    headless: true,

    ...(chromePath
      ? { executablePath: chromePath }
      : {}),

    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--no-zygote',
      '--disable-extensions'
    ]
  }
});


// --------------------------------------------------
// WhatsApp Events
// --------------------------------------------------

client.on('qr', qr => {
  console.log(
    '\nScan this QR with the WhatsApp account that should post orders:\n'
  );

  qrcode.generate(qr, { small: true });
});


client.on('authenticated', () => {
  console.log('WhatsApp authenticated.');
});


client.on('auth_failure', msg => {
  console.error(
    'WhatsApp auth failure:',
    msg
  );
});


client.on('disconnected', reason => {
  waReady = false;
  groupChat = null;

  console.log(
    'WhatsApp disconnected:',
    reason
  );
});


// --------------------------------------------------
// Resolve WhatsApp Group
// --------------------------------------------------

async function resolveGroup() {

  // If invite code exists, try to locate/join the group.
  if (inviteCode) {
    try {
      const info =
        await client.getInviteInfo(inviteCode);

      const gid =
        info?.id?._serialized ||
        info?.gid?._serialized ||
        info?.gid;

      if (gid) {
        try {
          groupChat =
            await client.getChatById(gid);
        } catch (_) {}
      }

      // Try matching the invite subject.
      if (!groupChat && info?.subject) {
        const chats =
          await client.getChats();

        groupChat =
          chats.find(
            c =>
              c.isGroup &&
              c.name === info.subject
          ) || null;
      }

      // If account has not joined the group,
      // join the supplied invite.
      if (!groupChat) {
        try {
          const joinedId =
            await client.acceptInvite(inviteCode);

          groupChat =
            await client.getChatById(joinedId);
        } catch (joinErr) {
          console.error(
            'Could not join/resolve the group automatically:',
            joinErr.message || joinErr
          );
        }
      }

    } catch (err) {
      console.error(
        'Invite lookup failed:',
        err.message || err
      );
    }
  }


  // If group name is provided in Render Environment,
  // find the group by its exact name.
  if (
    !groupChat &&
    process.env.WHATSAPP_GROUP_NAME
  ) {
    const chats =
      await client.getChats();

    groupChat =
      chats.find(
        c =>
          c.isGroup &&
          c.name ===
            process.env.WHATSAPP_GROUP_NAME
      ) || null;
  }


  if (groupChat) {
    console.log(
      `Order group ready: ${groupChat.name} (${groupChat.id._serialized})`
    );
  } else {
    console.log(
      'Order group not resolved yet. Set WHATSAPP_GROUP_NAME if needed.'
    );
  }
}


// --------------------------------------------------
// WhatsApp Ready
// --------------------------------------------------

client.on('ready', async () => {
  waReady = true;

  console.log('WhatsApp client is ready.');

  await resolveGroup();
});


// --------------------------------------------------
// Order ID
// --------------------------------------------------

function nextOrderId() {
  const date = new Date();

  const stamp =
    date
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, '');

  const rand =
    Math.floor(
      1000 + Math.random() * 9000
    );

  return `DCF-${stamp}-${rand}`;
}


// --------------------------------------------------
// API Status
// --------------------------------------------------

app.get('/api/status', (req, res) => {
  res.json({
    ready: waReady,
    groupReady: !!groupChat
  });
});


// --------------------------------------------------
// API Order
// --------------------------------------------------

app.post('/api/order', async (req, res) => {

  try {

    const {
      product,
      size,
      qty,
      name,
      address
    } = req.body || {};


    const allowedSizes = [
      '100 g',
      '200 g',
      '500 g'
    ];


    if (
      !product ||
      !name ||
      !address ||
      !allowedSizes.includes(size) ||
      !Number.isInteger(Number(qty)) ||
      Number(qty) <= 0
    ) {
      return res.status(400).json({
        message:
          'Please fill Name, Quantity, Size and Delivery Address correctly.'
      });
    }


    if (!waReady) {
      return res.status(503).json({
        message:
          'Order service is starting. Please try again in a moment.'
      });
    }


    if (!groupChat) {
      await resolveGroup();
    }


    if (!groupChat) {
      return res.status(503).json({
        message:
          'The DryCo Farm order group is not connected yet. Please contact the store.'
      });
    }


    const orderId =
      nextOrderId();


    const order = {
      orderId,
      product: String(product).trim(),
      size,
      qty: Number(qty),
      name: String(name).trim(),
      address: String(address).trim(),
      createdAt: new Date().toISOString()
    };


    let orders = [];

    try {
      orders =
        JSON.parse(
          fs.readFileSync(
            ORDERS_FILE,
            'utf8'
          )
        );
    } catch (_) {
      orders = [];
    }


    orders.push(order);


    fs.writeFileSync(
      ORDERS_FILE,
      JSON.stringify(
        orders,
        null,
        2
      )
    );


    const message = [
      '*DRYCO FARM — NEW ORDER*',
      '',
      `*Order ID:* ${orderId}`,
      `*Product:* ${order.product}`,
      `*Size:* ${order.size}`,
      `*Quantity:* ${order.qty}`,
      `*Customer Name:* ${order.name}`,
      `*Delivery Address:* ${order.address}`,
      '',
      '*Order received via website*',
      `*Store WhatsApp:* +91 ${MAIN_NUMBER}`
    ].join('\n');


    await groupChat.sendMessage(
      message
    );


    return res.json({
      ok: true,
      orderId
    });

  } catch (err) {

    console.error(
      'Order error:',
      err
    );

    return res.status(500).json({
      message:
        'Could not send the order. Please try again.'
    });
  }
});


// --------------------------------------------------
// Website
// --------------------------------------------------

app.get('*', (req, res) => {
  res.sendFile(
    path.join(
      __dirname,
      'index.html'
    )
  );
});


// --------------------------------------------------
// Start WhatsApp
// --------------------------------------------------

client.initialize();


// --------------------------------------------------
// Start Server
// --------------------------------------------------

app.listen(PORT, () => {
  console.log(
    `DryCo Farm website/order server running on port ${PORT}`
  );
});
