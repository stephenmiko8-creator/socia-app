import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/prisma";
import Parser from "rss-parser";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { feedUrls, platforms = ["linkedin"], ghostwriterMode = "expert" } = await req.json();
    if (!feedUrls) return NextResponse.json({ error: "Please provide RSS feed URLs" }, { status: 400 });

    const urls = feedUrls.split(/\r?\n|,/).map(u => u.trim()).filter(u => u.length > 0);
    if (urls.length === 0) return NextResponse.json({ error: "No valid URLs found" }, { status: 400 });

    // 1. Fetch all articles from all feeds
    const parser = new Parser();
    let allArticles = [];

    for (const url of urls) {
      try {
        const feed = await parser.parseURL(url);
        if (feed.items) {
          const items = feed.items.slice(0, 3).map(item => ({
            title: item.title,
            contentSnippet: item.contentSnippet || item.content || "",
            link: item.link,
            imageUrl: (item.enclosure && item.enclosure.url) ? item.enclosure.url : null
          }));
          allArticles = [...allArticles, ...items];
        }
      } catch (err) {
        console.error(`Failed to parse ${url}:`, err.message);
      }
    }

    if (allArticles.length === 0) {
      return NextResponse.json({ error: "Could not extract articles from the provided feeds." }, { status: 400 });
    }

    // Shuffle and pick exactly 5 articles
    allArticles = allArticles.sort(() => 0.5 - Math.random()).slice(0, 5);

    // 2. Fetch User Persona
    const userPersona = await prisma.persona.findUnique({ where: { userId: session.user.id } });
    let matrix = null;
    if (userPersona && userPersona.matrix) {
      try { matrix = JSON.parse(userPersona.matrix); } catch (e) {}
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });

    const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

    let viralInstructions = `1. Write a compelling hook. 2. Use short paragraphs. 3. Give extreme value. 4. End with an open-ended question.`;
    let twitterViralInstructions = `1. Write a highly engaging Tweet under 280 characters. 2. Give extreme value without corporate fluff.`;
    
    if (ghostwriterMode === "viral") {
      viralInstructions += `
      \nVIRAL ALGORITHM HACKER ADDITIONS:
      5. HOOK UPGRADE: Must be highly aggressive or contrarian. E.g., "Unpopular opinion: [X] is dead."
      6. PSYCHOLOGY: Trigger curiosity, FOMO, or validate reader frustrations.
      7. CALL TO ACTION UPGRADE: Ask a highly polarizing question at the end to force algorithm engagement.
      `;
      twitterViralInstructions += `
      \nVIRAL ALGORITHM HACKER ADDITIONS:
      3. HOOK UPGRADE: Must be highly aggressive or contrarian. Trigger FOMO.
      4. VALUE UPGRADE: A sharp, punchy data point or controversial take. No corporate fluff.
      `;
    }

    // 3. Generate Posts in Parallel for the 5 days
    const promises = days.map(async (day, index) => {
      // If we ran out of articles, don't generate
      if (!allArticles[index]) return null;
      
      const article = allArticles[index];
      const dayStrategy = matrix ? matrix[day] : { strategy: "General Post", description: "Share an insightful thought." };
      
      let personaPrompt = "";
      if (userPersona) {
        personaPrompt = `
        CUSTOM PERSONA INSTRUCTIONS:
        Industry/Niche: ${userPersona.industry}
        Target Audience: ${userPersona.targetAudience}
        Preferred Vocabulary: ${userPersona.vocabulary}
        Today's Specific Content Strategy (${day}): ${dayStrategy.strategy} - ${dayStrategy.description}
        CRITICAL: You MUST adopt this exact strategy and vocabulary for today's post.
        `;
      }

      const generatedDayPosts = [];
      const date = new Date();
      date.setDate(date.getDate() + (7 - date.getDay()) + (index + 1)); 
      date.setHours(9, 0, 0, 0);

      if (platforms.includes("linkedin")) {
        const prompt = `
          You are an expert ghostwriter for top-tier executives on LinkedIn. Your style is concise, authoritative, and deeply human.
          ${personaPrompt}
          CORE MESSAGE/DATA POINT: Title: "${article.title}" Summary: "${article.contentSnippet}" Link: "${article.link}"
          WRITING INSTRUCTIONS: ${viralInstructions} 5. Output ONLY the post text. No quotes.
        `;
        try {
          const result = await model.generateContent(prompt);
          let text = result.response.text();
          if (article.imageUrl) text += `\n\n[Image Attached: ${article.imageUrl}]`;
          generatedDayPosts.push({ text, scheduledAt: date, platform: "linkedin" });
        } catch(e) {}
      }

      if (platforms.includes("twitter")) {
        const twitterPrompt = `
          You are an expert ghostwriter for top-tier executives on Twitter/X.
          ${personaPrompt}
          CORE MESSAGE/DATA POINT: Title: "${article.title}" Summary: "${article.contentSnippet}" Link: "${article.link}"
          WRITING INSTRUCTIONS: ${twitterViralInstructions} 3. Output ONLY the tweet text. No quotes.
        `;
        try {
          const result = await model.generateContent(twitterPrompt);
          let text = result.response.text();
          if (article.imageUrl) text += `\n\n[Image Attached: ${article.imageUrl}]`;
          generatedDayPosts.push({ text, scheduledAt: date, platform: "twitter" });
        } catch(e) {}
      }

      return generatedDayPosts;
    });

    const resultsArray = await Promise.all(promises);
    // Flatten the array of arrays
    const validPosts = resultsArray.filter(Boolean).flat();

    // 4. Save to Database
    for (const p of validPosts) {
      await prisma.post.create({
        data: {
          text: p.text,
          platforms: p.platform,
          status: "SCHEDULED",
          scheduledAt: p.scheduledAt,
          userId: session.user.id
        }
      });
    }

    return NextResponse.json({ success: true, message: `Successfully drafted ${validPosts.length} posts for next week!` });
  } catch (error) {
    console.error("Bulk Generate Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
