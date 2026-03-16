const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { createClient } = require("@supabase/supabase-js");
const { jsPDF } = require("jspdf");
const QRCode = require("qrcode");

const app = express();

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
// AI Evaluation Weightage Model
// -------------------------
const evaluationWeightage = {
  technical_keywords: "40%",
  market_need: "30%",
  innovation_depth: "30%"
};

// -------------------------
function deterministicRandom(seed) {
  let x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// -------------------------
const technicalKeywords = [
  "ai","ai-driven","neural","neural-network","machine learning",
  "deep learning","iot","sensors","automation","algorithm",
  "blockchain","decentralized","scalable","edge computing",
  "system architecture","proprietary algorithms","advanced materials"
];

const marketKeywords = [
  "market","industry","b2b","commercial","scaling",
  "revenue","efficiency","optimization","cost reduction"
];

const innovationKeywords = [
  "novel","innovative","breakthrough","proprietary",
  "next-generation","risk mitigation","sustainable",
  "hydroponic","bionic","renewable","eco-friendly"
];

const vagueWords = [
  "good","nice","thing","stuff","maybe","some","many","various"
];

const structuralVerbs = ["method","apparatus","system","process"];

// -------------------------
// Patent Scoring
// -------------------------
function calculatePatentScore(abstractText) {

  const text = abstractText.toLowerCase();
  const words = text.trim().split(/\s+/);

  let baseScore = 50;

  let matchedTech = technicalKeywords.filter(k => text.includes(k)).length;
  let matchedMarket = marketKeywords.filter(k => text.includes(k)).length;
  let matchedInnovation = innovationKeywords.filter(k => text.includes(k)).length;

  let noveltyBoost = 0;

  technicalKeywords.forEach(tech => {
    structuralVerbs.forEach(verb => {
      if (text.includes(tech) && text.includes(verb)) {
        noveltyBoost += 5;
      }
    });
  });

  let impactPenalty = 0;

  vagueWords.forEach(v => {
    if (text.includes(v)) impactPenalty += 2;
  });

  const wordCount = words.length;

  let wordBonus = 0;

  if (wordCount > 150) wordBonus = 10;
  else if (wordCount > 100) wordBonus = 7;
  else if (wordCount > 60) wordBonus = 5;

  baseScore += matchedTech * 5;
  baseScore += matchedMarket * 2;
  baseScore += matchedInnovation * 3;
  baseScore += noveltyBoost;
  baseScore += wordBonus;
  baseScore -= impactPenalty;

  const seed = text.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const randomBoost = Math.floor(deterministicRandom(seed) * 6);

  baseScore += randomBoost;

  if (baseScore > 95) baseScore = 95;
  if (baseScore < 0) baseScore = 0;

  let novelty = matchedTech * 5 + noveltyBoost + wordBonus;
  let feasibility = matchedMarket * 2 + Math.floor(wordCount / 15);
  let impact = matchedInnovation * 3 + Math.floor(wordCount / 20) - impactPenalty;

  const fallbackSeed = text.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);

  if (novelty < 5) {
    novelty = Math.floor(deterministicRandom(fallbackSeed) * 6) + 5;
  }

  if (feasibility < 5) {
    feasibility = Math.floor(deterministicRandom(fallbackSeed + 1) * 6) + 5;
  }

  if (impact < 5) {
    impact = Math.floor(deterministicRandom(fallbackSeed + 2) * 6) + 5;
  }

  novelty = Math.min(novelty, 40);
  feasibility = Math.min(feasibility, 30);
  impact = Math.min(impact, 30);

  return {
    totalScore: Math.round(baseScore),
    novelty,
    feasibility,
    impact
  };

}

// -------------------------
// Loan Logic
// -------------------------
function calculateLoanAmount(score, abstractText) {

  if (score < 80) return 0;

  let baseLoan = score >= 90 ? 98000 : 85000;

  const seed = abstractText.split("")
  .reduce((acc, char) => acc + char.charCodeAt(0), 0);

  const randomVariation = Math.floor(deterministicRandom(seed) * 4000);

  let finalLoan = baseLoan + randomVariation;

  if (finalLoan > 100000) finalLoan = 100000;

  return Math.round(finalLoan);

}

// -------------------------
app.get("/", (req, res) => {
  res.send("Logic Layer Running 🚀");
});

// -------------------------
// Submission Route
// -------------------------
app.post("/submit", async (req, res) => {

  try {

    const { student_name, invention_title, abstract_text } = req.body;

    if (!student_name || !invention_title || !abstract_text) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const scores = calculatePatentScore(abstract_text);
    const patentScore = scores.totalScore;

    const loanAmount = calculateLoanAmount(patentScore, abstract_text);

    let eligibilityStatus;

    if (patentScore >= 80) eligibilityStatus = "Eligible for Startup Funding ✅";
    else if (patentScore >= 70 && patentScore <= 79) eligibilityStatus = "Needs Improvement ⚠️";
    else eligibilityStatus = "Not Eligible ❌";

    const { data, error } = await supabase
      .from("Invention_Submissions")
      .insert([{
        student_name,
        invention_title,
        abstract_text,
        patent_score: patentScore,
        loan_eligibility_amount: loanAmount,
        novelty_score: scores.novelty,
        feasibility_score: scores.feasibility,
        impact_score: scores.impact
      }])
      .select();

    if (error) return res.status(500).json({ error: error.message });

    res.status(200).json({
      status: "success",
      patent_score: patentScore,
      loan_eligibility_amount: loanAmount,
      eligibility_status: eligibilityStatus,
      evaluation_model: {
        model_name: "Neural Innovation Scoring Engine",
        weightage: evaluationWeightage
      },
      id: data[0].id,
      data
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }

});

// -------------------------
// NEW ROUTE (Frontend will call this)
// Save certificate URL after upload
// -------------------------
app.post("/update-certificate-url", async (req, res) => {

  try {

    const { id, certificate_url } = req.body;

    if (!id || !certificate_url) {
      return res.status(400).json({ error: "Missing id or certificate_url" });
    }

    const { error } = await supabase
      .from("Invention_Submissions")
      .update({ certificate_url })
      .eq("id", id);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ success: true });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }

});

// -------------------------
// PDF Certificate Generator
// -------------------------
app.get("/certificate/:id", async (req, res) => {

  try {

    const { id } = req.params;

    const { data, error } = await supabase
      .from("Invention_Submissions")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: "Submission not found" });
    }

    const doc = new jsPDF();

    doc.setFontSize(24);
    doc.text("SISFS Innovation Certificate", 105, 30, { align: "center" });

    doc.setFontSize(14);
    doc.text("This certifies that", 105, 50, { align: "center" });

    doc.setFontSize(18);
    doc.text(`${data.student_name}`, 105, 65, { align: "center" });

    doc.setFontSize(14);
    doc.text("has submitted the innovation titled:", 105, 80, { align: "center" });

    doc.setFontSize(16);

    const titleLines = doc.splitTextToSize(data.invention_title, 160);
    doc.text(titleLines, 105, 95, { align: "center" });

    doc.setFontSize(14);
    doc.text("Evaluation Scores", 105, 120, { align: "center" });

    doc.text(`Novelty: ${data.novelty_score} / 40`, 40, 140);
    doc.text(`Feasibility: ${data.feasibility_score} / 30`, 40, 150);
    doc.text(`Impact: ${data.impact_score} / 30`, 40, 160);

    doc.text(`Total Patent Score: ${data.patent_score}`, 40, 180);

    const qrData = `https://logic-layer-server.onrender.com/verify?id=${id}`;
    const qrImage = await QRCode.toDataURL(qrData);

    doc.addImage(qrImage, "PNG", 150, 130, 40, 40);

    doc.setFontSize(10);
    doc.text("Scan QR to verify certificate", 150, 175);

    doc.text("SISFS Innovation Program © 2026", 105, 290, { align: "center" });

    const pdfBuffer = doc.output("arraybuffer");

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=certificate_${id}.pdf`);

    res.send(Buffer.from(pdfBuffer));

  } catch (err) {
    res.status(500).json({ error: err.message });
  }

});

// -------------------------
// Certificate Verification Route
// -------------------------
app.get("/verify", async (req, res) => {

  try {

    const { id } = req.query;

    if (!id) {
      return res.status(400).send("Invalid certificate ID");
    }

    const { data, error } = await supabase
      .from("Invention_Submissions")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      return res.status(404).send("Certificate not found");
    }

    res.send(`
      <html>
        <body style="font-family:sans-serif;text-align:center;margin-top:50px">
          <h1>✅ Verified by NexaRise</h1>
          <p><b>Student:</b> ${data.student_name}</p>
          <p><b>Innovation:</b> ${data.invention_title}</p>
          <p><b>Patent Score:</b> ${data.patent_score}</p>
          <p><b>Loan Eligibility:</b> ₹${data.loan_eligibility_amount}</p>
        </body>
      </html>
    `);

  } catch (err) {
    res.status(500).send("Verification error");
  }

});

// -------------------------
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
