import express from "express";
import path from "path";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import pg from "pg";

const { Pool } = pg;

dotenv.config();

const app = express();
app.use(express.json());

// Detect Vercel or other Serverless / Read-only environments
const isVercel = process.env.VERCEL === "1" || !!process.env.NOW_BUILDER;
const DB_FILE_PATH = isVercel 
  ? path.join("/tmp", "records_db.json")
  : path.join(process.cwd(), "records_db.json");

// Neon PostgreSQL Database Configuration
const DEFAULT_PG_URL = "postgresql://neondb_owner:npg_XLc7PKeAEp8o@ep-ancient-art-aomh7xrl-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";
const connectionString = process.env.DATABASE_URL || DEFAULT_PG_URL;

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

let dbInitialized = false;

// Initialize PostgreSQL tables and seed data if empty
async function initDB() {
  if (dbInitialized) return true;
  try {
    const client = await pool.connect();
    try {
      // 1. Create student_records table
      await client.query(`
        CREATE TABLE IF NOT EXISTS student_records (
          id INT PRIMARY KEY,
          name VARCHAR(100),
          score INT,
          opinion TEXT,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 2. Create counseling_logs table
      await client.query(`
        CREATE TABLE IF NOT EXISTS counseling_logs (
          id SERIAL PRIMARY KEY,
          user_message TEXT,
          ai_response TEXT,
          detected_pillar VARCHAR(100),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // 3. Seed student records if completely empty
      const checkResult = await client.query("SELECT COUNT(*) FROM student_records;");
      const count = parseInt(checkResult.rows[0].count, 10);
      if (count === 0) {
        console.log("Seeding initial 31 student records into PostgreSQL...");
        for (let i = 1; i <= 31; i++) {
          await client.query(
            "INSERT INTO student_records (id, name, score, opinion) VALUES ($1, $2, $3, $4);",
            [i, `${i}번 학생`, 50, ""]
          );
        }
      }
      dbInitialized = true;
      console.log("PostgreSQL database initialized and verified successfully.");
      return true;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Failed to initialize PostgreSQL database, falling back to local storage options:", err);
    return false;
  }
}

// Define basic default data
function getDefaultData() {
  return {
    scores: Array(31).fill(50), // index 0..30 represent students 1..31, default 50
    opinions: Array(31).fill(""), // 31 student opinions
    names: Array.from({ length: 31 }, (_, i) => `${i + 1}번 학생`), // 31 student names
  };
}

// In-Memory Database Fallback to absolutely guarantee 500-free runtime
let inMemoryDB: { scores: number[]; opinions: string[]; names: string[] } | null = null;

// Helper to read DB safely (Local JSON fallback)
function readLocalDB() {
  const defaults = getDefaultData();

  if (inMemoryDB) {
    return inMemoryDB;
  }

  try {
    if (fs.existsSync(DB_FILE_PATH)) {
      const content = fs.readFileSync(DB_FILE_PATH, "utf-8");
      const data = JSON.parse(content);
      const scores = Array.isArray(data.scores) ? data.scores : defaults.scores;
      const opinions = Array.isArray(data.opinions) ? data.opinions : defaults.opinions;
      const names = Array.isArray(data.names) ? data.names : defaults.names;

      // Normalize array lengths to precisely 31
      while (scores.length < 31) scores.push(50);
      while (opinions.length < 31) opinions.push("");
      while (names.length < 31) names.push(`${names.length + 1}번 학생`);

      const normalized = {
        scores: scores.slice(0, 31).map((s: any) => typeof s === "number" ? s : 50),
        opinions: opinions.slice(0, 31).map((o: any) => typeof o === "string" ? o : ""),
        names: names.slice(0, 31).map((n: any, i: number) => typeof n === "string" ? n : `${i + 1}번 학생`),
      };

      inMemoryDB = normalized;
      return normalized;
    }
  } catch (err) {
    console.error("Error reading db file, falling back to in-memory defaults:", err);
  }

  if (!inMemoryDB) {
    inMemoryDB = defaults;
  }
  return inMemoryDB;
}

// Helper to write DB with automatic in-memory safety fallback
function writeLocalDB(data: { scores: number[]; opinions: string[]; names: string[] }) {
  inMemoryDB = data;
  try {
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(data, null, 2), "utf-8");
    return true;
  } catch (err) {
    console.warn("Failed writing DB to disk (possibly read-only file system). Updating in-memory cache successfully.", err);
    return false;
  }
}

// Fetch records from PostgreSQL
async function fetchRecordsFromPostgres() {
  const active = await initDB();
  if (!active) return null;

  try {
    const res = await pool.query("SELECT id, name, score, opinion FROM student_records ORDER BY id ASC;");
    if (res.rows.length > 0) {
      const scores = Array(31).fill(50);
      const opinions = Array(31).fill("");
      const names = Array(31).fill("");

      res.rows.forEach((row) => {
        const index = row.id - 1;
        if (index >= 0 && index < 31) {
          scores[index] = typeof row.score === "number" ? row.score : 50;
          opinions[index] = typeof row.opinion === "string" ? row.opinion : "";
          names[index] = typeof row.name === "string" ? row.name : `${row.id}번 학생`;
        }
      });

      return { scores, opinions, names };
    }
  } catch (err) {
    console.error("Error fetching records from PostgreSQL:", err);
  }
  return null;
}

// Save records to PostgreSQL
async function saveRecordsToPostgres(data: { scores: number[]; opinions: string[]; names: string[] }) {
  const active = await initDB();
  if (!active) return false;

  try {
    const client = await pool.connect();
    try {
      await client.query("BEGIN;");
      for (let i = 1; i <= 31; i++) {
        const index = i - 1;
        const score = data.scores[index] !== undefined ? data.scores[index] : 50;
        const opinion = data.opinions[index] !== undefined ? data.opinions[index] : "";
        const name = data.names[index] !== undefined ? data.names[index] : `${i}번 학생`;

        await client.query(
          `INSERT INTO student_records (id, name, score, opinion) 
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (id) DO UPDATE 
           SET name = EXCLUDED.name, score = EXCLUDED.score, opinion = EXCLUDED.opinion, updated_at = NOW();`,
          [i, name, score, opinion]
        );
      }
      await client.query("COMMIT;");
      return true;
    } catch (err) {
      await client.query("ROLLBACK;");
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Failed to save records to PostgreSQL:", err);
    return false;
  }
}

// Lazy init Gemini AI Client
let ai: GoogleGenAI | null = null;
function getAI() {
  if (!ai) {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      console.warn("GEMINI_API_KEY environment variable is not set.");
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
app.get(["/api/records", "/records"], async (req, res) => {
  try {
    const pgData = await fetchRecordsFromPostgres();
    if (pgData) {
      inMemoryDB = pgData;
      return res.json(pgData);
    }
    res.json(readLocalDB());
  } catch (err: any) {
    console.error("Critical error in /api/records GET:", err);
    res.status(200).json(inMemoryDB || getDefaultData());
  }
});

app.post(["/api/records", "/records"], async (req, res) => {
  try {
    const { scores, opinions, names } = req.body;
    const db = inMemoryDB || readLocalDB();

    if (scores && Array.isArray(scores)) {
      db.scores = scores.slice(0, 31).map((s) => Number(s));
    }
    if (opinions && Array.isArray(opinions)) {
      db.opinions = opinions.slice(0, 31).map((o) => String(o));
    }
    if (names && Array.isArray(names)) {
      db.names = names.slice(0, 31).map((n) => String(n));
    }

    // Attempt to persist both online (Postgres) and locally as fallback
    const pgSuccess = await saveRecordsToPostgres(db);
    writeLocalDB(db);

    res.json({ success: true, pgSynced: pgSuccess, ...db });
  } catch (err: any) {
    console.error("Critical error in /api/records POST:", err);
    res.status(500).json({ error: "Internal Server Error", detail: err.message });
  }
});

// AI Chat Evaluation route
app.post(["/api/chat", "/chat"], async (req, res) => {
  const { message, history } = req.body;
  if (!message) {
    return res.status(400).json({ error: "Message is required." });
  }

  const cleanedMessage = String(message).trim();
  const isTrigger = cleanedMessage === "결과 보여줘" || cleanedMessage.includes("결과 보여줘");

  const client = getAI();
  if (!client) {
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
    
    // Extract classification pillar from the response
    let detectedPillar = null;
    const pillarRegex = /\[([^\]]+)\]$/;
    const match = reply.match(pillarRegex);
    if (match) {
      detectedPillar = `[${match[1]}]`;
    }

    // Save interaction log asynchronously into Neon PostgreSQL
    try {
      const active = await initDB();
      if (active) {
        await pool.query(
          "INSERT INTO counseling_logs (user_message, ai_response, detected_pillar) VALUES ($1, $2, $3);",
          [cleanedMessage, reply.trim(), detectedPillar]
        );
        console.log("Counseling session saved to PostgreSQL successfully.");
      }
    } catch (dbErr) {
      console.error("Failed to save counseling log to PostgreSQL:", dbErr);
    }

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

// GET /api/db-status
app.get(["/api/db-status", "/db-status"], async (req, res) => {
  try {
    const active = await initDB();
    if (!active) {
      return res.status(200).json({ 
        status: "disconnected", 
        message: "Neon PostgreSQL 데이터베이스 서버 연결이 비활성화되었거나 실패했습니다." 
      });
    }
    const countRes = await pool.query("SELECT COUNT(*) FROM counseling_logs;");
    const count = parseInt(countRes.rows[0].count, 10);
    res.json({
      status: "connected",
      message: "Neon PostgreSQL 데이터베이스에 성공적으로 연결되었습니다.",
      count: count
    });
  } catch (err: any) {
    console.error("Neon PostgreSQL connection check failed:", err);
    res.status(200).json({ 
      status: "error", 
      message: err.message || "데이터베이스 연결 중 오류가 발생했습니다." 
    });
  }
});

// GET /api/counseling-logs
app.get(["/api/counseling-logs", "/counseling-logs"], async (req, res) => {
  try {
    const active = await initDB();
    if (!active) {
      return res.json([]);
    }
    const result = await pool.query(
      "SELECT id, user_message, ai_response, detected_pillar, created_at FROM counseling_logs ORDER BY created_at DESC LIMIT 50;"
    );
    res.json(result.rows);
  } catch (err: any) {
    console.error("Error fetching counseling logs:", err);
    res.status(500).json({ error: err.message });
  }
});

export default app;
