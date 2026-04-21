import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export const runtime = "edge";

// Initialize the Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
    try {
        if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === "your_actual_api_key_here") {
            return NextResponse.json({ error: "GEMINI_API_KEY is not configured in .env.local" }, { status: 401 });
        }
        const { imageBase64, prompt } = await req.json();

        // Gemini 1.5 Flash is the fastest model for multimodal vision tasks
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        // Remove the data URL prefix to get raw base64
        const base64Data = imageBase64.split(",")[1];

        const result = await model.generateContent([
            prompt || "Describe what you see in this image in one concise sentence.",
            { inlineData: { data: base64Data, mimeType: "image/jpeg" } }
        ]);

        return NextResponse.json({ text: result.response.text() });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to analyze image" }, { status: 500 });
    }
}