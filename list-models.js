require('dotenv').config();

async function listModels() {
    const apiKey = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    
    try {
        console.log("Listing available models...");
        const response = await fetch(url);
        const data = await response.json();
        if (response.ok) {
            console.log("Available models:", JSON.stringify(data, null, 2));
        } else {
            console.error("FAILED to list models:", data);
        }
    } catch (e) {
        console.error("ERROR:", e.message);
    }
}

listModels();
