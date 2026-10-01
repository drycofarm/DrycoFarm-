# DryCo Farm — Render Free Deployment

This package is prepared as a Render Static Site.

## Deploy
1. Create/sign in to a GitHub account.
2. Create a new repository, for example `drycofarm`.
3. Upload all files in this folder to the repository root (make sure `index.html` is at the root).
4. In Render: New → Static Site → connect the GitHub repository.
5. Branch: `main`.
6. Build Command: leave empty.
7. Publish Directory: `.`
8. Create Static Site.

Render provides an `onrender.com` URL. A custom domain can be added later.

## Important about WhatsApp group automation
The static frontend can collect Name, Size (100/200/500 g), Quantity and Delivery Address and can open the WhatsApp chat to the store number.

The included `server.js` is the experimental server-side WhatsApp Web automation from the previous package. Do NOT deploy that as the production order relay on Render Free: Free web services spin down after 15 minutes of inactivity and their local filesystem is ephemeral, so a WhatsApp Web session stored locally can be lost after restart/spindown.

For reliable automatic group posting, use an official WhatsApp Business/Cloud API-compatible backend or another persistent server/automation provider.
