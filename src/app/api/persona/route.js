import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { background, audience, goal } = await req.json();

    if (!background || !audience || !goal) {
      return NextResponse.json({ error: "Missing required persona fields" }, { status: 400 });
    }

    // Initialize Gemini
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });

    const prompt = `
      You are an expert Social Media Branding Strategist for top-tier executives.
      Your client has provided the following details:
      Background / About: "${background}"
      Target Audience: "${audience}"
      Core Goal: "${goal}"

      Create a sophisticated, 5-Day LinkedIn Content Strategy Matrix specifically tailored to them.
      Identify their core Industry/Niche, 5 advanced vocabulary terms they should use, and a specific strategy for Monday through Friday.

      You MUST return the output EXACTLY in the following JSON format without markdown wrapping, without formatting, just pure JSON:
      {
        "industry": "string",
        "vocabulary": "comma separated string",
        "matrix": {
          "Monday": { "strategy": "string", "description": "string" },
          "Tuesday": { "strategy": "string", "description": "string" },
          "Wednesday": { "strategy": "string", "description": "string" },
          "Thursday": { "strategy": "string", "description": "string" },
          "Friday": { "strategy": "string", "description": "string" }
        }
      }
    `;

    const result = await model.generateContent(prompt);
    let text = result.response.text();
    
    // Clean up potential markdown formatting from the response
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    const parsedMatrix = JSON.parse(text);

    // Save or update Persona in DB
    const persona = await prisma.persona.upsert({
      where: { userId: session.user.id },
      update: {
        industry: parsedMatrix.industry,
        targetAudience: audience,
        vocabulary: parsedMatrix.vocabulary,
        matrix: JSON.stringify(parsedMatrix.matrix)
      },
      create: {
        userId: session.user.id,
        industry: parsedMatrix.industry,
        targetAudience: audience,
        vocabulary: parsedMatrix.vocabulary,
        matrix: JSON.stringify(parsedMatrix.matrix)
      }
    });

    return NextResponse.json({ success: true, persona, parsedMatrix });
  } catch (error) {
    console.error("Persona Generation Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const persona = await prisma.persona.findUnique({
      where: { userId: session.user.id }
    });
    
    if (!persona) return NextResponse.json({ success: true, persona: null });
    
    return NextResponse.json({ 
      success: true, 
      persona: {
        ...persona,
        matrix: persona.matrix ? JSON.parse(persona.matrix) : null
      }
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
