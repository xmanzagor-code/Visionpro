import { GoogleGenAI } from "@google/genai";
import { ethers } from "ethers";

const ai = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || "");

export async function removeBackground(base64Image: string): Promise<string> {
  try {
    const model = "gemini-2.5-flash-image";
    const base64Data = base64Image.split(',')[1];
    const mimeType = base64Image.split(';')[0].split(':')[1];

    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          { inlineData: { data: base64Data, mimeType: mimeType } },
          { text: "Remove the background from this image and return only the main subject on a transparent background." },
        ],
      },
    });

    const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if (part?.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
    throw new Error("Görüntü işlenemedi.");
  } catch (error) {
    console.error("Background removal error:", error);
    throw error;
  }
}

export async function upscaleImage(base64Image: string, scale: string): Promise<string> {
  try {
    const model = "gemini-2.5-flash-image";
    const base64Data = base64Image.split(',')[1];
    const mimeType = base64Image.split(';')[0].split(':')[1];

    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          { inlineData: { data: base64Data, mimeType: mimeType } },
          { text: `Upscale this image to ${scale} quality. Enhance details, remove noise, and improve sharpness while maintaining original colors.` },
        ],
      },
    });

    const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if (part?.inlineData) {
      return `data:image/png;base64,${part.inlineData.data}`;
    }
    throw new Error("Görüntü yükseltilemedi.");
  } catch (error) {
    console.error("Upscale error:", error);
    throw error;
  }
}

export async function verifyTransaction(txId: string, expectedAmount: number): Promise<boolean> {
  try {
    const provider = new ethers.JsonRpcProvider("https://bsc-dataseed.binance.org/");
    const tx = await provider.getTransaction(txId);
    if (!tx) return false;
    const receipt = await tx.wait();
    return receipt?.status === 1;
  } catch (error) {
    console.error("Transaction verification error:", error);
    return false;
  }
}
