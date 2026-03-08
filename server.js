const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { createClient } = require("@supabase/supabase-js");
const jsPDF = require("jspdf");
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
// Evaluation Model Weightage
// -------------------------
const evaluationWeightage = {
  technical_keywords: "40%",
  market_need: "30%",
  innovation_depth: "30%"
};

// -------------------------
// Keyword Lists
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
// Patent Scoring (Dynamic & Case-insensitive)
// -------------------------
// Dynamic Patent Scoring
function calculatePatentScore(abstractText) {
  const text = abstractText.toLowerCase();
  const words = text.trim().split(/\s+/);

  // Keyword matches
  const matchedTech = technicalKeywords.filter(k => text.includes(k.toLowerCase())).length;
  const matchedMarket = marketKeywords.filter(k => text.includes(k.toLowerCase())).length;
  const matchedInnovation = innovationKeywords.filter(k => text.includes(k.toLowerCase())).length;

  // Word count bonus
  let wordBonus = 0;
  if (words.length > 150) wordBonus = 8;
  else if (words.length > 100) wordBonus = 5;
  else if (words.length > 60) wordBonus = 3;

  // Novelty Boost
  let noveltyBoost = 0;
  technicalKeywords.forEach(tech => {
    structuralVerbs.forEach(verb => {
      if (text.includes(tech.toLowerCase()) && text.includes(verb.toLowerCase())) {
        noveltyBoost += 3;
      }
    });
  });

  // Impact Penalty
  let impactPenalty = 0;
  vagueWords.forEach(v => {
    if (text.includes(v.toLowerCase())) impactPenalty += 1;
  });

  // Base weighted scores
  let noveltyScore = matchedTech * 5 + noveltyBoost + wordBonus;
  let feasibilityScore = matchedMarket * 3;
  let impactScore = matchedInnovation * 4 - impactPenalty;

  // Weighted total
  let totalScore = Math.round(
    noveltyScore * 0.4 + feasibilityScore * 0.3 + impactScore * 0.3
  );

  // Minimum baseline 35, maximum 100
  if (totalScore < 35) totalScore = 35;
  if (totalScore > 100) totalScore = 100;

  // Scale individual components proportionally
  const scaleFactor = totalScore / ((noveltyScore*0.4 + feasibilityScore*0.3 + impactScore*0.3) || 1);
  noveltyScore = Math.round(noveltyScore * scaleFactor);
  feasibilityScore = Math.round(feasibilityScore * scaleFactor);
  impactScore = Math.round(impactScore * scaleFactor);

  return {
    totalScore,
    novelty: noveltyScore,
    feasibility: feasibilityScore,
    impact: impactScore
  };
}

// -------------------------
// Loan Calculation
function calculateLoanAmount(score) {
  if(score < 80) return 0;
  let baseLoan = score >= 90 ? 98000 : 85000;

  // Add small dynamic factor but max 100000
  const randomFactor = Math.floor(Math.random() * 5000);
  let loanAmount = baseLoan + randomFactor;
  if(loanAmount > 100000) loanAmount = 100000;
  return loanAmount;
}

// -------------------------
// Routes
app.get("/", (req, res) => {
  res.send("Logic Layer Running 🚀");
});

app.post("/submit", async(req, res) => {
  try{
    const { student_name, invention_title, abstract_text } = req.body;
    if(!student_name || !invention_title || !abstract_text)
      return res.status(400).json({error:"Missing required fields"});

    const scores = calculatePatentScore(abstract_text);
    const patentScore = scores.totalScore;
    const loanAmount = calculateLoanAmount(patentScore);

    let eligibilityStatus;
    if(patentScore >= 80) eligibilityStatus = "Eligible for Startup Funding ✅";
    else if(patentScore >= 70) eligibilityStatus = "Needs Improvement ⚠️";
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

    if(error) return res.status(500).json({error:error.message});

    res.status(200).json({
      status:"success",
      patent_score: patentScore,
      loan_eligibility_amount: loanAmount,
      eligibility_status: eligibilityStatus,
      evaluation_model: {
        model_name: "Neural Innovation Scoring Engine",
        weightage: evaluationWeightage
      },
      data
    });

  } catch(err){
    res.status(500).json({error:err.message});
  }
});

// -------------------------
// PDF Certificate Generator
app.get("/certificate/:id", async(req, res) => {
  try{
    const { id } = req.params;
    const { data, error } = await supabase
      .from("Invention_Submissions")
      .select("*")
      .eq("id", id)
      .single();
    if(error || !data) return res.status(404).json({error:"Submission not found"});

    const doc = new jsPDF();
    doc.setFontSize(22);
    doc.text("SISFS Innovation Certificate", 105, 30, {align:"center"});
    doc.setFontSize(16);
    doc.text(`Student: ${data.student_name}`, 20, 60);
    doc.text(`Invention: ${data.invention_title}`, 20, 70);

    doc.text("Scores:", 20, 90);
    doc.text(`Novelty: ${data.novelty_score}`, 30, 100);
    doc.text(`Feasibility: ${data.feasibility_score}`, 30, 110);
    doc.text(`Impact: ${data.impact_score}`, 30, 120);
    doc.text(`Total Patent Score: ${data.patent_score}`, 20, 140);

    const qrData = `${process.env.FRONTEND_URL}/verify?id=${id}`;
    const qrImage = await QRCode.toDataURL(qrData);
    doc.addImage(qrImage, "PNG", 150, 60, 50, 50);
    doc.text("Scan QR for Verification", 150, 120);

    doc.setFontSize(10);
    doc.text("SISFS © 2026", 105, 290, {align:"center"});

    const pdfBuffer = doc.output("arraybuffer");
    res.setHeader("Content-Type","application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="certificate_${id}.pdf"`);
    res.send(Buffer.from(pdfBuffer));

  } catch(err){
    res.status(500).json({error:err.message});
  }
});

// -------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
