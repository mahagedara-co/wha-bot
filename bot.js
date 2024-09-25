const { default: makeWASocket, useSingleFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const express = require('express');
const { Boom } = require('@hapi/boom');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');

const { state, saveState } = useSingleFileAuthState('./auth_info.json');
const app = express();
let sock;

async function startSock() {
    sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
    });

    // Handle connection updates
    sock.ev.on('connection.update', async (update) => {
        const { connection, qr } = update;
        if (qr) {
            // Generate and save QR code as an HTML page
            const qrCodeURL = await qrcode.toDataURL(qr);
            fs.writeFileSync('./qr.html', `<img src="${qrCodeURL}" alt="QR Code" />`);
        }

        if (connection === 'close') {
            const reason = new Boom(update.lastDisconnect?.error)?.output.statusCode;
            if (reason === DisconnectReason.loggedOut) {
                console.log('Logged out. Please re-scan QR.');
            } else {
                startSock();
            }
        }
    });

    sock.ev.on('creds.update', saveState);

    // Handle incoming messages
    sock.ev.on('messages.upsert', (m) => {
        const msg = m.messages[0];
        if (!msg.key.fromMe && msg.message.conversation === 'HI') {
            sock.sendMessage(msg.key.remoteJid, { text: 'Hello' });
        }
    });
}

startSock();

// Serve the QR code on a web page
app.get('/', (req, res) => {
    const qrPage = path.join(__dirname, 'qr.html');
    res.sendFile(qrPage);
});

// Uptime Robot keep-alive endpoint
app.get('/keepalive', (req, res) => {
    res.send('Bot is online!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
