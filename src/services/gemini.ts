// @ts-nocheck
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = (import.meta as any).env.VITE_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

export async function removeBackground(base64Image: string): Promise<string> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const base64Data = base64Image.split(',')[1];
    const mimeType = base64Image.split(';')[0].split(':')[1];

    const result = await model.generateContent([
      {
        inlineData: {
          data: base64Data,
          mimeType: mimeType
        }
      },
      { text: "Remove the background from this image and return only the main subject." },
    ]);

    const response = await result.response;
    return base64Image; 
  } catch (error) {
    console.error("Hata:", error);
    throw error;
  }
}
