import { NextRequest, NextResponse } from "next/server";
import { getEntriesByOrbit } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const { orbitId } = await request.json();
    if (!orbitId) return NextResponse.json({ error: "Missing orbitId" }, { status: 400 });

    const entries = await getEntriesByOrbit(orbitId);
    if (entries.length === 0) return NextResponse.json({ summary: "No entries to summarize." });

    const text = entries.map((e, i) => `[${i + 1}] ${e.content}`).join("\n\n");
    const prompt = `Summarize these ${entries.length} thoughts into 2-3 short paragraphs. Focus on patterns, key ideas, and connections between them. Be concise.\n\n${text.slice(0, 4000)}`;

    const apiKey = process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY || "";
    if (!apiKey) return NextResponse.json({ summary: "AI key not configured." });

    const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "deepseek-v4-flash",
        messages: [
          { role: "system", content: "You are a concise summarizer. Respond with plain text, no markdown." },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 300,
      }),
    });

    if (!response.ok) return NextResponse.json({ summary: "AI request failed." });

    const data = await response.json();
    const summary = data.choices?.[0]?.message?.content || "Could not generate summary.";

    return NextResponse.json({ summary });
  } catch {
    return NextResponse.json({ summary: "Something went wrong." });
  }
}
