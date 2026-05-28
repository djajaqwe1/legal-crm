require('dotenv').config();

async function testDirect() {
    const apiKey = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    
    try {
        console.log("Testing direct V1 REST call...");
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: "test" }] }] })
        });
        const data = await response.json();
        if (response.ok) {
            console.log("SUCCESS! V1 REST works.");
        } else {
            console.error("V1 REST FAILED:", data);
        }
    } catch (e) {
        console.error("V1 REST ERROR:", e.message);
    }

    const urlBeta = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    try {
        console.log("\nTesting direct V1BETA REST call...");
        const responseBeta = await fetch(urlBeta, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: "test" }] }] })
        });
        const dataBeta = await responseBeta.json();
        if (responseBeta.ok) {
            console.log("SUCCESS! V1BETA REST works.");
        } else {
            console.error("V1BETA REST FAILED:", dataBeta);
        }
    } catch (e2) {
        console.error("V1BETA REST ERROR:", e2.message);
    }
}

testDirect();
