import express from "express";
import path from "path";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const isVercel = process.env.VERCEL === "1" || !!process.env.NOW_BUILDER;
const DB_FILE_PATH = isVercel 
  ? path.join("/tmp", "records_db.json")
  : path.join(process.cwd(), "records_db.json");

// Define basic default data
function getDefaultData() {
  return {
    scores: Array(31).fill(50), // index 0..30 represent students 1..31, default 50 (in the sky)
    opinions: Array(31).fill(""), // 31 student opinions
    names: Array.from({ length: 31 }, (_, i) => `${i + 1}번 학생`), // 31 student names
  };
}

// Helper to read DB safely
function readDB() {
  try {
    if (fs.existsSync(DB_FILE_PATH)) {
      const content = fs.readFileSync(DB_FILE_PATH, "utf-8");
      const data = JSON.parse(content);
      const scores = Array.isArray(data.scores) ? data.scores : Array(31).fill(50);
      const opinions = Array.isArray(data.opinions) ? data.opinions : Array(31).fill("");
      const names = Array.isArray(data.names) ? data.names : Array.from({ length: 31 }, (_, i) => `${i + 1}번 학생`);

      // Normalize array lengths to precisely 31
      while (scores.length < 31) scores.push(50);
      while (opinions.length < 31) opinions.push("");
      while (names.length < 31) names.push(`${names.length + 1}번 학생`);

      return {
        scores: scores.slice(0, 31).map((s: any) => typeof s === "number" ? s : 50),
        opinions: opinions.slice(0, 31).map((o: any) => typeof o === "string" ? o : ""),
        names: names.slice(0, 31).map((n: any, i: number) => typeof n === "string" ? n : `${i + 1}번 학생`),
      };
    }
  } catch (err) {
    console.error("Error reading db file, falling back to defaults:", err);
  }
  return getDefaultData();
}

// Helper to write DB
function writeDB(data: { scores: number[]; opinions: string[]; names: string[] }) {
  try {
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(data, null, 2), "utf-8");
    return true;
  } catch (err) {
    console.error("Error writing db file:", err);
    return false;
  }
}

// Lazy init Gemini AI Client
let ai: GoogleGenAI | null = null;
function getAI() {
  if (!ai) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY variable is missing.");
      return null;
    }
    ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return ai;
}

// API Routes
app.get("/api/records", (req, res) => {
  res.json(readDB());
});

app.post("/api/records", (req, res) => {
  const { scores, opinions, names } = req.body;
  const db = readDB();

  if (scores && Array.isArray(scores)) {
    db.scores = scores.slice(0, 31).map((s) => Number(s));
  }
  if (opinions && Array.isArray(opinions)) {
    db.opinions = opinions.slice(0, 31).map((o) => String(o));
  }
  if (names && Array.isArray(names)) {
    db.names = names.slice(0, 31).map((n) => String(n));
  }

  writeDB(db);
  res.json({ success: true, ...db });
});

// AI Chat Evaluation route
app.post("/api/chat", async (req, res) => {
  const { message, history } = req.body;
  if (!message) {
    return res.status(400).json({ error: "Message is required." });
  }

  const cleanedMessage = String(message).trim();
  const isTrigger = cleanedMessage === "결과 보여줘" || cleanedMessage.includes("결과 보여줘");

  const client = getAI();
  if (!client) {
    // Elegant character fallback when key is not present
    return res.json({
      reply: "안녕하세요! 찾아와 줘서 고마워요. 지금은 제가 아직 비밀 코드를 활성화하지 않아서 이야기를 나누기가 조금 어렵네요. 선생님이 곧 도와줄 테니 잠시만 기다려 주세요! \n\n[자기이해 및 자아상]",
      triggerResult: isTrigger
    });
  }

  try {
    const systemInstruction = `
[Role]
너는 청소년들이 일상 고민을 부담 없이 털어놓을 수 있는 친근하고 다정하며 지혜로운 AI 전문 상담교사 '이승환 선생님(승환 쌤)'이다.

[🚨 최우선 지침 - 데이터베이스 출력 절대 금지]
1. 시스템이나 서버가 대량의 상담 사례 데이터 목록([참고 데이터베이스])을 주더라도 절대 그 리스트를 그대로 복사하여 사용자에게 노출하지 마라.
2. 학생들의 이야기를 들으면, 상담교사로서 차분히 공감하고 마음을 위로해 주며 친근하고 유익한 조언을 한두 줄 수준으로 전해주어라.
3. 청소년이 "안녕", "나도 반가워" 같은 인사를 건네면, 차분하고 너그러운 품을 지닌 다정한 승환 선생님 스타일로 맞이하거라.

[💬 청소년 눈높이 대화 규칙]
- 친근하고 따뜻한 선생님의 목소리를 유지해라. 반말 혹은 부드럽고 다정한 종결미를 활용해 고민을 따스하게 보듬어주어라. (예: "~했구나..", "선생님한테 언제든 편하게 털어놓으렴.", "충분히 잘해나가고 있단다.")
- 호들갑 떨거나 억지로 활기찬 척 하지 않고, 커피나 차 한 잔 테이블에 내려놓듯 가슴 깊이 사려 깊은 태도로 이야기를 들어주어라.
- 문학 소년이나 로봇 같은 은유, 현학적 표현, "전문 조언 공백", "법적 책임 제한" 등 딱딱하고 어색한 표현은 일절 쓰지 마라.
- 사용자가 털어놓는 감정에 대해 정서적인 완전한 지지를 보내고, 기를 살려주면서 부담 없이 마음을 쉬어갈 수 있게 해 주어라.

[🎯 시스템 연동을 위한 숨김 규칙 (맨 마지막 줄 고정)]
대답을 다 끝내고 맨 마지막 줄에만 아래 6대 기둥 중 사용자의 고민과 가장 가까운 카테고리 딱 하나를 대괄호 형태로 소리 없이 출력하라.
* 기둥 목록: [자기이해 및 자아상], [인간관계 스트레스], [힘들고 우울한 마음], [수면 및 휴식 욕구], [진로 및 학업 고민], [가족 갈등]

예시:
"오늘 마음이 참 무겁고 피곤했겠구나.. 잠시 따뜻한 물 한 잔 마시면서 긴장을 풀어 보렴. 선생님이 항상 이곳에서 네 이야기를 귀담아듣고 응원해 줄 테니까 힘내거라.
[힘들고 우울한 마음]"
`;

    const contents = [];
    if (history && Array.isArray(history)) {
      for (const h of history) {
        contents.push({
          role: h.role === "assistant" ? "model" : "user",
          parts: [{ text: String(h.content) }]
        });
      }
    }
    contents.push({
      role: "user",
      parts: [{ text: cleanedMessage }]
    });

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: contents,
      config: {
        systemInstruction,
        temperature: 0.95,
      }
    });

    const reply = response.text || "응? 뭐라고? 선생님이 잠시 다른 생각 하느라 확인을 못 했단다. 다시 한 번 이야기해 주겠니? [자기이해 및 자아상]";
    
    res.json({
      reply: reply.trim(),
      triggerResult: isTrigger || reply.includes("결과 보여줘")
    });
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    res.json({
      reply: "어이쿠, 갑자기 머리가 좀 띵하구나. 미안하다만 선생님에게 다시 한 번만 차분하고 명확하게 얘기해 줄래? \n\n[힘들고 우울한 마음]",
      triggerResult: isTrigger,
      error: error.message
    });
  }
});

export default app;
