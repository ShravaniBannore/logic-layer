const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { createClient } = require("@supabase/supabase-js");
const { jsPDF } = require("jspdf");
const QRCode = require("qrcode");
const multer = require("multer");

const app = express();
const upload = multer(); // memory storage

app.use(cors());
app.use(express.json());

// -------------------------
// Supabase Client
// -------------------------
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// -------------------------
// AI Evaluation Model
// -------------------------
const evaluationWeightage = {
  technical_keywords: "40%",
  market_need: "30%",
  innovation_depth: "30%"
};

function deterministicRandom(seed) {
  let x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// -------------------------
// Keywords
// -------------------------
const technicalKeywords = ["ai","machine learning","iot","blockchain","automation"];
const marketKeywords = ["market","revenue","efficiency","cost"];
const innovationKeywords = ["innovative","novel","breakthrough"];
const vagueWords = ["good","nice","thing"];
const structuralVerbs = ["method","system","process"];

// -------------------------
// Patent Score
// -------------------------
function calculatePatentScore(text) {
  text = text.toLowerCase();
  const words = text.split(/\s+/);

  let score = 50;

  const tech = technicalKeywords.filter(k => text.includes(k)).length;
  const market = marketKeywords.filter(k => text.includes(k)).length;
  const innovation = innovationKeywords.filter(k => text.includes(k)).length;

  score += tech * 5 + market * 2 + innovation * 3;

  if (words.length > 100) score += 10;

  vagueWords.forEach(v => { if (text.includes(v)) score -= 2; });

  const seed = text.split("").reduce((a,c)=>a+c.charCodeAt(0),0);
  score += Math.floor(deterministicRandom(seed) * 5);

  score = Math.max(0, Math.min(95, score));

  return {
    totalScore: score,
    novelty: Math.min(40, tech * 5),
    feasibility: Math.min(30, market * 3),
    impact: Math.min(30, innovation * 3)
  };
}

// -------------------------
// Loan
// -------------------------
function calculateLoanAmount(score) {
  if (score < 80) return 0;
  return score >= 90 ? 100000 : 85000;
}

// -------------------------
app.get("/", (req, res) => {
  res.send("Logic Layer Running 🚀");
});

// -------------------------
// SUBMIT
// -------------------------
app.post("/submit", async (req, res) => {
  try {
    const { student_name, invention_title, abstract_text } = req.body;

    if (!student_name || !invention_title || !abstract_text) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const scores = calculatePatentScore(abstract_text);
    const loan = calculateLoanAmount(scores.totalScore);

    const { data, error } = await supabase
      .from("Invention_Submissions")
      .insert([{
        student_name,
        invention_title,
        abstract_text,
        patent_score: scores.totalScore,
        loan_eligibility_amount: loan,
        novelty_score: scores.novelty,
        feasibility_score: scores.feasibility,
        impact_score: scores.impact
      }])
      .select();

    if (error) throw error;

    res.json({
      id: data[0].id,
      patent_score: scores.totalScore,
      loan_eligibility_amount: loan,
      novelty_score: scores.novelty,
      feasibility_score: scores.feasibility,
      impact_score: scores.impact
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------
// 🔥 UPLOAD CERTIFICATE + SAVE URL (MAIN FEATURE)
// -------------------------
app.post("/certificate/:id", upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    const id = req.params.id;

    if (!file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const fileName = `audit_${id}.pdf`;

    // Upload to Supabase
    const { error: uploadError } = await supabase.storage
      .from("certificates")
      .upload(fileName, file.buffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) throw uploadError;

    // Get Public URL
    const { data } = supabase.storage
      .from("certificates")
      .getPublicUrl(fileName);

    const publicUrl = data.publicUrl;

    // Save URL in DB
    const { error: dbError } = await supabase
      .from("Invention_Submissions")
      .update({ certificate_url: publicUrl })
      .eq("id", id);

    if (dbError) throw dbError;

    res.json({ success: true, certificate_url: publicUrl });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// -------------------------
// DOWNLOAD CERTIFICATE (optional fallback)
// -------------------------
app.get("/certificate/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { data } = await supabase
      .from("Invention_Submissions")
      .select("*")
      .eq("id", id)
      .single();

    if (!data) return res.status(404).send("Not found");

    const doc = new jsPDF();

    doc.text("Innovation Certificate", 105, 30, { align: "center" });
    doc.text(data.student_name, 105, 50, { align: "center" });
    doc.text(data.invention_title, 105, 70, { align: "center" });

    const qr = await QRCode.toDataURL(
      `https://logic-layer-server.onrender.com/verify?id=${id}`
    );

    doc.addImage(qr, "PNG", 80, 100, 50, 50);

    const pdf = doc.output("arraybuffer");

    res.setHeader("Content-Type", "application/pdf");
    res.send(Buffer.from(pdf));

  } catch (err) {
    res.status(500).send("Error");
  }
});

// -------------------------
// VERIFY
// -------------------------
app.get("/verify", async (req, res) => {
  const { id } = req.query;

  const { data } = await supabase
    .from("Invention_Submissions")
    .select("*")
    .eq("id", id)
    .single();

  if (!data) return res.send("Invalid");

  res.send(`
    <h1>✅ Verified</h1>
    <p>${data.student_name}</p>
    <p>${data.invention_title}</p>
    <p>${data.patent_score}</p>
  `);
});

// -------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log("Server running 🚀"));
