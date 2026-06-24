import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { requireDirector, HttpError, jsonError } from '@/lib/server/auth';
import { rateLimit, rateLimitResponse } from '@/lib/security';

export async function POST(request: Request) {
  try {
    const clientIp = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    const rl = rateLimit(`ai-tagging:${clientIp}`, 10, 60_000);
    if (!rl.allowed) return rateLimitResponse(rl.resetAt);

    await requireDirector(request);

    const { title, description } = await request.json();

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ 
        error: "GEMINI_API_KEY is not configured.", 
        priority: "STANDARD", 
        tools: ["React", "Node.js"] // Fallback tags
      });
    }

    // Load the Gemini 1.5 Flash model for fast text parsing
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
      You are an expert IT Project Manager analyzing a new task.
      Task Title: "${title}"
      Task Description: "${description}"
      
      Based on this task, provide:
      1. A priority level strictly chosen from: CRITICAL, HIGH, STANDARD, or LOW.
      2. A strictly comma-separated list of 2 to 4 technical tools or languages (e.g. React, Python, Docker) required to complete the task.

      Return your response STRICTLY in the following JSON format:
      {
        "priority": "HIGH",
        "tools": ["Tool1", "Tool2", "Tool3"]
      }
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    // Strip markdown formatting if Gemini included it (e.g., ```json ... ```)
    const cleanJsonString = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const parsedData = JSON.parse(cleanJsonString);

    return NextResponse.json({
      priority: parsedData.priority || "STANDARD",
      tools: parsedData.tools || ["General"]
    });

  } catch (error) {
    console.error("Gemini API Error:", error);
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (error instanceof HttpError) {
      return jsonError(error);
    }

    return NextResponse.json({
      error: "Failed to generate AI tags",
      priority: "STANDARD",
      tools: ["Manual Review Needed"]
    });
  }
}
