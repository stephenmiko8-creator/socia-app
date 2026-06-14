import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import Parser from "rss-parser";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { feedUrl, hoursToAdd = 2, platforms = ["linkedin"], ghostwriterMode = "expert" } = await req.json();

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: "Gemini API key is not configured in .env" }, { status: 500 });
    }

    if (!feedUrl) {
      return NextResponse.json({ error: "Please provide an RSS feed URL" }, { status: 400 });
    }

    let latestArticle = {};

    try {
      // Try to parse as RSS Feed
      const parser = new Parser();
      const feed = await parser.parseURL(feedUrl);

      if (feed.items && feed.items.length > 0) {
        latestArticle = feed.items[0];
        if (latestArticle.enclosure && latestArticle.enclosure.url) {
          latestArticle.imageUrl = latestArticle.enclosure.url;
        } else if (latestArticle.content) {
          const imgMatch = latestArticle.content.match(/<img[^>]*src=["']([^"']+)["']/i);
          if (imgMatch) latestArticle.imageUrl = imgMatch[1];
        }
      } else {
        throw new Error("Empty RSS");
      }
    } catch (e) {
      // Fallback: Treat the URL as a direct article link
      const res = await fetch(feedUrl);
      const html = await res.text();

      // Extract title using Regex
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : "Interesting Article";

      // Extract description using Regex
      const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
        html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
      let description = descMatch ? descMatch[1] : "";

      // Fallback to grabbing first paragraph
      if (!description) {
        const pMatch = html.match(/<p[^>]*>([^<]+)<\/p>/i);
        description = pMatch ? pMatch[1] : "Check out this insightful read.";
      }

      // Extract image using og:image
      const imgMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
                       html.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i);
      let imageUrl = imgMatch ? imgMatch[1] : "";

      latestArticle = {
        title,
        contentSnippet: description,
        link: feedUrl,
        imageUrl
      };
    }

    // 2. Fetch User Persona
    const userPersona = await prisma.persona.findUnique({ where: { userId: session.user.id } });
    const today = new Date().toLocaleString('en-US', { weekday: 'long' });
    let personaPrompt = "";
    
    if (userPersona && userPersona.matrix) {
      try {
        const matrix = JSON.parse(userPersona.matrix);
        const dayStrategy = matrix[today] || matrix["Monday"];
        personaPrompt = `
        CUSTOM PERSONA INSTRUCTIONS:
        Industry/Niche: ${userPersona.industry}
        Target Audience: ${userPersona.targetAudience}
        Preferred Vocabulary: ${userPersona.vocabulary}
        Today's Specific Content Strategy (${today}): ${dayStrategy.strategy} - ${dayStrategy.description}
        
        CRITICAL: You MUST adopt this exact strategy and vocabulary for today's post.
        `;
      } catch (e) {
        console.error("Error parsing matrix", e);
      }
    }

    // 3. Initialize Gemini
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });

    // 4. Generate the Post
    
    let viralInstructions = `
      1. Write a compelling, scroll-stopping hook under 210 characters.
      2. Use short, punchy paragraphs (1-2 sentences) to create visual breathing room.
      3. Sound like an expert talking over coffee—not a textbook or a PR agency.
      4. Give context, then provide extreme value/actionable steps.
      5. End with a sharp, open-ended question designed to start a professional debate in the comments.
    `;
    
    if (ghostwriterMode === "viral") {
      viralInstructions += `
      \nVIRAL ALGORITHM HACKER ADDITIONS:
      6. HOOK UPGRADE: Must be highly aggressive or contrarian. E.g., "Unpopular opinion: [X] is dead." or "I analyzed 500 [X]. Here is the exact blueprint."
      7. PSYCHOLOGY: Trigger curiosity, FOMO (fear of missing out), or validate the reader's hidden frustrations.
      8. CALL TO ACTION UPGRADE: Make the final question highly polarizing to force algorithm engagement.
      `;
    }

    const prompt = `
      You are an expert ghostwriter for top-tier executives on LinkedIn. Your style is concise, authoritative, and deeply human.
      ${personaPrompt}
      
      CORE MESSAGE/DATA POINT:
      Title: "${latestArticle.title}"
      Summary: "${latestArticle.contentSnippet || latestArticle.content || ""}"
      Link: "${latestArticle.link}"
      
      WRITING INSTRUCTIONS:
      ${viralInstructions}
      Do NOT wrap the post in quotes. Output only the post itself.
    `;

    const scheduledTime = new Date();
    scheduledTime.setHours(scheduledTime.getHours() + hoursToAdd);

    if (platforms.includes("linkedin")) {
      const result = await model.generateContent(prompt);
      let generatedText = result.response.text();
      if (latestArticle.imageUrl) generatedText += `\n\n[Image Attached: ${latestArticle.imageUrl}]`;

      await prisma.post.create({
        data: {
          text: generatedText,
          platforms: "linkedin",
          status: "SCHEDULED",
          scheduledAt: scheduledTime,
          userId: session.user.id
        }
      });
    }

    if (platforms.includes("twitter")) {
      let twitterViralInstructions = `
        1. Write a highly engaging Tweet under 280 characters.
        2. Give extreme value without corporate fluff.
        3. Do NOT use hashtags unless absolutely necessary.
      `;
      if (ghostwriterMode === "viral") {
        twitterViralInstructions += `
        \nVIRAL ALGORITHM HACKER ADDITIONS:
        4. HOOK UPGRADE: Must be highly aggressive or contrarian. Trigger FOMO.
        5. VALUE UPGRADE: A sharp, punchy data point or controversial take. No corporate fluff.
        `;
      }
      const twitterPrompt = `
        You are an expert ghostwriter for top-tier executives on Twitter/X.
        ${personaPrompt}
        
        CORE MESSAGE:
        Title: "${latestArticle.title}"
        Summary: "${latestArticle.contentSnippet || latestArticle.content || ""}"
        Link: "${latestArticle.link}"
        
        WRITING INSTRUCTIONS:
        ${twitterViralInstructions}
        4. Output ONLY the tweet text. Do not wrap in quotes.
      `;
      const twitterResult = await model.generateContent(twitterPrompt);
      let twitterText = twitterResult.response.text();
      if (latestArticle.imageUrl) twitterText += `\n\n[Image Attached: ${latestArticle.imageUrl}]`;

      await prisma.post.create({
        data: {
          text: twitterText,
          platforms: "twitter",
          status: "SCHEDULED",
          scheduledAt: scheduledTime,
          userId: session.user.id
        }
      });
    }

    return NextResponse.json({ success: true, articleTitle: latestArticle.title });
  } catch (error) {
    console.error("AI Generation Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
