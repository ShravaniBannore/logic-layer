const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { createClient } = require("@supabase/supabase-js");
const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");
const nlp = require("compromise"); // lightweight NLP for noun-verb detection

const app = express();
app.use(cors());
app.use(express.json());

// -------------------------
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// -------------------------
const evaluationWeightage = {
  novelty: "40%",
  feasibility: "30%",
  impact: "30%"
};

// -------------------------
// Keyword Groups
// -------------------------
const noveltyKeywords = [
  "breakthrough","disruptive","next-generation","cutting-edge",
  "autonomous","self-learning","adaptive","intelligent",
  "bio-inspired","cognitive","predictive","decentralized",
  "self-optimizing","generative","synthetic","neuromorphic",
  "nanorobotics","molecular assembly","AI","proprietary algorithm"
];

const feasibilityKeywords = [
  "AI","artificial intelligence","machine learning","deep learning",
  "neural networks","edge computing","distributed systems",
  "sensor fusion","robotics","computer vision","nlp",
  "blockchain","cloud computing","embedded systems",
  "autonomous systems","cyber physical systems","neuromorphic computing",
  "nanorobotics","proprietary algorithm","system architecture"
];

const impactKeywords = [
  "smart infrastructure","industrial automation",
  "energy optimization","digital transformation",
  "advanced manufacturing","smart grid",
  "precision agriculture","intelligent transportation",
  "sustainable energy","climate technology",
  "space technology","biomedical innovation","healthcare",
  "biomedical","defense technology","high-performance computing"
];

const advancedTechKeywords = [
"quantum computing","nanotechnology","biotechnology",
"genetic engineering","synthetic biology",
"autonomous robotics","swarm robotics",
"brain computer interface","neuromorphic computing",
"fusion energy","space propulsion",
"satellite technology","quantum cryptography"
];  

const structuralVerbs = ["Method", "Apparatus"];
const commonWords = ["good","simple","easy","basic","normal","common","vague"];

// -------------------------
// Keyword Score Function (Case-insensitive)
// -------------------------
function keywordScore(text, keywords) {
  let matches = 0;
  keywords.forEach(keyword => {
    const regex = new RegExp(keyword.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), "i");
    if (regex.test(text)) matches++;
  });
  return Math.round((matches / keywords.length) * 100);
}

// -------------------------
// Novelty Score (Noun-Verb density + Structural verbs)
// -------------------------
function noveltyScore(text) {
  const doc = nlp(text);
  const nouns = doc.nouns().out('array');
  const complexNouns = nouns.filter(n => n.length > 5);
  let score = 0;

  // Scale boost: 5 points per complex noun if structural verb exists
  structuralVerbs.forEach(sv => {
    if (text.toLowerCase().includes(sv.toLowerCase())) {
      score += complexNouns.length * 5;
    }
  });

  // Noun-Verb density
  const verbs = doc.verbs().out('array');
  const words = text.split(/\s+/);
  score += ((nouns.length + verbs.length) / words.length) * 50;

  // Add keyword-based novelty contribution
  score += keywordScore(text, noveltyKeywords) * 0.5;

  return Math.min(score, 100);
}

// -------------------------
// Impact Score (penalize vague/common words)
// -------------------------
function impactScore(text) {
  let penalty = 0;
  commonWords.forEach(word => {
    const regex = new RegExp(`\\b${word}\\b`, "i");
    if (regex.test(text)) penalty += 10; // penalize per occurrence
  });

  // Keyword-based impact contribution
  let base = keywordScore(text, impactKeywords);
  let final = base - penalty;
  return Math.max(final, 0);
}

// -------------------------
// Technical / Feasibility Score
// -------------------------
function feasibilityScore(text) {
  return keywordScore(text, feasibilityKeywords);
}

// -------------------------
// Combined Patent Score (40-30-30)
// -------------------------
function calculatePatentScore(novelty, feasibility, impact) {
  const score = novelty * 0.4 + feasibility * 0.3 + impact * 0.3;
  return Math.round(score);
}

// -------------------------
function calculateLoanAmount(score) {
  if (score < 80) return 0;
  const maxLoan = 100000;
  const baseLoan = score >= 90 ? 98000 : 85000;
  const randomFactor = Math.random() * 0.02;
  return Math.round(baseLoan + (maxLoan - baseLoan) * randomFactor);
}

// -------------------------
app.get("/", (req,res)=>{
  res.send("Logic Layer Running 🚀");
});

// -------------------------
app.post("/submit", async(req,res)=>{
  try {
    const { student_name, invention_title, abstract_text } = req.body;

    if (!student_name || !invention_title || !abstract_text) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const text = abstract_text.toLowerCase();

    const novelty = noveltyScore(text);
    const feasibility = feasibilityScore(text);
    const impact = impactScore(text);

    const patentScore = calculatePatentScore(novelty, feasibility, impact);
    const loanAmount = calculateLoanAmount(patentScore);

    let eligibilityStatus;
    if (patentScore >= 80) eligibilityStatus = "Eligible for Startup Funding ✅";
    else if (patentScore >= 70) eligibilityStatus = "Needs Improvement ⚠️";
    else eligibilityStatus = "Not Eligible ❌";

    const { data, error } = await supabase
      .from("Invention_Submissions")
      .insert([{
        student_name,
        invention_title,
        abstract_text,
        novelty_score: novelty,
        feasibility_score: feasibility,
        impact_score: impact,
        patent_score: patentScore,
        loan_eligibility_amount: loanAmount
      }])
      .select();

    if (error) return res.status(500).json({ error: error.message });

    res.status(200).json({
      status: "success",
      scores: { novelty, feasibility, impact },
      patent_score: patentScore,
      loan_eligibility_amount: loanAmount,
      eligibility_status: eligibilityStatus,
      evaluation_model: { model_name: "Neural Innovation Scoring Engine", weightage: evaluationWeightage },
      data
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------
// PDF Generator
// -------------------------
app.get("/generate-certificate/:id", async(req,res)=>{
  try {
    const id = req.params.id;

    const { data, error } = await supabase
      .from("Invention_Submissions")
      .select("*")
      .eq("id", id)
      .single();

    if (error) return res.status(500).json({ error: error.message });

    const verifyURL = `http://localhost:5000/verify?id=${id}`;
    const qr = await QRCode.toDataURL(verifyURL);
    const qrBuffer = Buffer.from(qr.split(",")[1], "base64");

    const doc = new PDFDocument();
    res.setHeader("Content-Type","application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=innovation_certificate_${id}.pdf`);

    doc.pipe(res);
    doc.fontSize(24).text("Innovation Certificate", { align: "center" });
    doc.moveDown();
    doc.fontSize(14).text(`Student Name: ${data.student_name}`);
    doc.text(`Invention Title: ${data.invention_title}`);
    doc.moveDown();
    doc.text(`Novelty Score: ${data.novelty_score}`);
    doc.text(`Feasibility Score: ${data.feasibility_score}`);
    doc.text(`Impact Score: ${data.impact_score}`);
    doc.moveDown();
    doc.text(`Final Patent Score: ${data.patent_score}`);
    doc.text(`Funding Eligibility: Rs ${data.loan_eligibility_amount}`);
    doc.moveDown();
    doc.text("Scan QR to Verify");
    doc.image(qrBuffer, { fit: [120, 120], align: "center" });
    doc.end();

  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

// -------------------------
// Verify Route
// -------------------------
app.get("/verify", async(req,res)=>{
  const id = req.query.id;

  const { data, error } = await supabase
    .from("Invention_Submissions")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return res.status(404).send("Certificate Not Found");

  res.json({
    status: "verified",
    student_name: data.student_name,
    invention_title: data.invention_title,
    patent_score: data.patent_score
  });
});

// -------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT,()=>{ console.log(`Server running on port ${PORT}`); });
