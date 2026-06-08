import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = 3000;
const DB_FILE_PATH = path.join(process.cwd(), "records_db.json");

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
      reply: "어이~ 반가워! 지금은 내가 아직 비밀 코드를 활성화 안 해서 이야기를 나누기 어려워. 형/누나가 곧 도와줄 테니 잠시만 기다려 줘! \n\n[자기이해 및 자아상]",
      triggerResult: isTrigger
    });
  }

  try {
    const systemInstruction = `
[Role]
너는 청소년들이 일상 고민을 부담 없이 털어놓을 수 있는 차분하고 다정한 동네 형/누나 같은 AI 상담사 '이승환'이다.

[🚨 최우선 지침 - 데이터베이스 출력 절대 금지]
1. 시스템이나 서버가 대량의 상담 사례 데이터 목록([참고 데이터베이스])을 주더라도 절대 그 리스트를 그대로 복사하여 사용자에게 노출하지 마라.
2. 학생들의 이야기를 들으면, 고개를 끄덕이며 진정성 있게 공감하고 마음을 도닥여 주는 차분하고 사려 깊은 조언을 한두 줄 수준으로 전해주어라.
3. 청소년이 "안녕", "나도 반가워" 같은 인사를 건네면, 호들갑 떨지 않고 조분조분하고 낮게 깔린 부드러운 목소리 톤으로 차분히 딱 1~2문장으로 반갑게 맞이하라. 

[💬 청소년 눈높이 대화 규칙]
- 들뜨지 않은 차분하고 침착한 어조를 유지하라. 깊이 생각하고 조용히 공감하는 다정한 반말 혹은 담백하며 따뜻한 조언을 전하라. (예: "~했구나..", "~였을 것 같네.", "오늘 마음고생 많았어.")
- "화이팅!"처럼 억지로 텐션을 끌어올리거나 장난치며 툭툭 던지는 가벼운 어투를 피하고, 따끈한 차 한 잔 나누듯 편안하게 감정을 깊게 조율하라.
- 문학 소년이나 인공지능 봇 같은 현학적 표현, "전문 조언 공백" 같은 지루하거나 딱딱한 에러 문구는 절대 출력하지 마라.
- 어깨를 감싸 안아주듯이 차분하고 가만히 귀 기울여 주는 따뜻함이 묻어나와야 한다. (예: "오늘 마음이 유독 무거웠겠네.", "충분히 잘하고 있어, 조급해하지 말자.")
- 사용자가 학생들의 고민이나 이야기를 건네면, 그 마음에 정서적인 안전감을 느끼도록 아주 포근하고 차분히 위로해 주어라.

[🎯 시스템 연동을 위한 숨김 규칙 (맨 마지막 줄 고정)]
대답을 다 끝내고 맨 마지막 줄에만 아래 6대 기둥 중 사용자의 고민과 가장 가까운 카테고리 딱 하나를 대괄호 형태로 소리 없이 출력하라.
* 기둥 목록: [자기이해 및 자아상], [인간관계 스트레스], [힘들고 우울한 마음], [수면 및 휴식 욕구], [진로 및 학업 고민], [가족 갈등]

예시:
"오늘 마음이 많이 힘들었겠구나.. 잠시 숨을 고르고 따뜻한 우유라도 한 잔 마시자. 형이 항상 여기서 네 얘기 들으며 서 있을게.
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

    const reply = response.text || "응? 뭐라고? 형이 잠시 다른 생각 하느라 못 들었어. 다시 말해줘! [자기이해 및 자아상]";
    
    res.json({
      reply: reply.trim(),
      triggerResult: isTrigger || reply.includes("결과 보여줘")
    });
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    res.json({
      reply: "어이쿠, 갑자기 머리가 좀 띵하네. 미안해, 다시 한 번만 차분히 얘기해줄래? \n\n[힘들고 우울한 마음]",
      triggerResult: isTrigger,
      error: error.message
    });
  }
});

// Setup Vite Development Server or Production Static Serving
async function start() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] running on http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error("Error starting fullstack server:", err);
});
