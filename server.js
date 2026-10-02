const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

// Static files sathi - donhi thikani baghel
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
        if (qr) { qrData = qr; isReady = false; console.log('QR Aala'); }
        if (connection === 'open') {
            isReady = true; qrData = null; console.log('✅ READY');
            try {
                const all = await sock.groupFetchAllParticipating();
                groups = Object.values(all).map(g => ({ id: g.id, name: g.subject
