const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

async function listModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("Ошибка: GEMINI_API_KEY не найден в .env");
    return;
  }

  console.log("Проверка ключа:", apiKey.substring(0, 10) + "...");
  const genAI = new GoogleGenerativeAI(apiKey);
  
  try {
    // В некоторых версиях SDK метод называется по-разному
    // Мы попробуем просто сделать тестовый запрос к самой базовой модели
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.0-flash",
      apiVersion: "v1beta" 
    });
    console.log("Пробуем gemini-2.0-flash (v1beta)...");
    const result = await model.generateContent("test");
    console.log("УСПЕХ! gemini-1.5-flash работает.");
  } catch (e) {
    console.error("gemini-1.5-flash НЕ работает:", e.message);
    
    try {
      console.log("Пробуем gemini-pro (старая)...");
      const model = genAI.getGenerativeModel({ model: "gemini-pro" });
      await model.generateContent("test");
      console.log("УСПЕХ! gemini-pro работает.");
    } catch (e2) {
      console.error("gemini-pro НЕ работает:", e2.message);
    }
  }
}

listModels();
