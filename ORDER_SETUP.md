# DryCo Farm — Automatic WhatsApp Group Orders

This version sends website orders directly into the DryCo Farm WhatsApp group **from the WhatsApp account used to scan the QR code**. Customers do not need to join the group.

## Important
The website itself cannot send a WhatsApp group message. The included Node.js backend uses `whatsapp-web.js` and a logged-in WhatsApp Web session to post the order into the group. This is not the official Meta Cloud API; it is a WhatsApp Web automation layer, so keep it on a stable server/PC and review WhatsApp's current terms before production use.

## Setup
1. Install Node.js 18+.
2. Open a terminal in this folder.
3. Run `npm install`.
4. Copy `.env.example` to `.env` if you want to change settings.
5. Run `npm start`.
6. The terminal will display a QR code. Scan it from the WhatsApp account/number that should appear as the sender in the order group.
7. Keep that server running. The first run may take a little longer while WhatsApp Web starts.
8. Open `http://localhost:3000` and test a product order.

The server attempts to resolve and join the supplied group invite automatically. If it cannot resolve the group, set `WHATSAPP_GROUP_NAME` in `.env` to the exact WhatsApp group name and restart.

## Order flow
Customer selects product → 100 g / 200 g / 500 g → quantity → name → delivery address → Submit.

The backend creates an Order ID, stores the order in `data/orders.json`, and posts a formatted message to the WhatsApp group. The sender is the WhatsApp account connected to the QR session.

## Customer-facing number
The form does not expose the group invite. The site can display the store number `9969129992` for support. Group orders are posted internally by the connected WhatsApp account.
