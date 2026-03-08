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
// PATENT SCORING (40-30-30)
// -------------------------
function calculatePatentScore(abstractText) {

  const text = abstractText.toLowerCase();

  const seed = text.split("").reduce((a,c)=>a+c.charCodeAt(0),0);
  const randomFactor = deterministicRandom(seed);

  const matchedTech = technicalKeywords.filter(k => text.includes(k)).length;
  const matchedMarket = marketKeywords.filter(k => text.includes(k)).length;
  const matchedInnovation = innovationKeywords.filter(k => text.includes(k)).length;

  // -----------------
  // NOVELTY (40)
  // -----------------
  let novelty = matchedTech * 4;

  technicalKeywords.forEach(tech=>{
    structuralVerbs.forEach(v=>{
      if(text.includes(tech) && text.includes(v)){
        novelty += 5;
      }
    });
  });

  novelty += Math.floor(randomFactor*5);

  if(novelty>40) novelty=40;

  // -----------------
  // FEASIBILITY (30)
  // -----------------
  let feasibility = matchedMarket * 4;

  feasibility += Math.floor(randomFactor*4);

  if(feasibility>30) feasibility=30;

  // -----------------
  // IMPACT (30)
  // -----------------
  let impact = matchedInnovation * 4;

  let vaguePenalty = 0;

  vagueWords.forEach(v=>{
    if(text.includes(v)) vaguePenalty += 3;
  });

  impact -= vaguePenalty;

  impact += Math.floor(randomFactor*4);

  if(impact>30) impact=30;
  if(impact<0) impact=0;

  // -----------------
  const totalScore = novelty + feasibility + impact;

  return{
    totalScore,
    novelty,
    feasibility,
    impact
  }

}

// -------------------------
function calculateLoanAmount(score,abstractText){

  if(score<80) return 0;

  let baseLoan = score>=90 ? 98000 : 85000;

  const seed = abstractText.split("")
  .reduce((a,c)=>a+c.charCodeAt(0),0);

  const randomVariation = Math.floor(deterministicRandom(seed)*4000);

  let finalLoan = baseLoan + randomVariation;

  if(finalLoan>100000) finalLoan = 100000;

  return Math.round(finalLoan);

}

// -------------------------
app.get("/", (req,res)=>{
  res.send("Logic Layer Running 🚀");
});

// -------------------------
app.post("/submit", async (req,res)=>{

  try{

    const {student_name,invention_title,abstract_text} = req.body;

    if(!student_name || !invention_title || !abstract_text){
      return res.status(400).json({error:"Missing required fields"});
    }

    const scores = calculatePatentScore(abstract_text);

    const patentScore = scores.totalScore;

    const loanAmount = calculateLoanAmount(patentScore,abstract_text);

    let eligibilityStatus;

    if(patentScore>=80) eligibilityStatus="Eligible for Startup Funding ✅";
    else if(patentScore>=70) eligibilityStatus="Needs Improvement ⚠️";
    else eligibilityStatus="Not Eligible ❌";

    const {data,error} = await supabase
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
      evaluation_model:{
        model_name:"Neural Innovation Scoring Engine",
        weightage:evaluationWeightage
      },
      data
    });

  }
  catch(err){
    res.status(500).json({error:err.message});
  }

});

// -------------------------
app.get("/certificate/:id", async(req,res)=>{

  try{

    const {id} = req.params;

    const {data,error} = await supabase
    .from("Invention_Submissions")
    .select("*")
    .eq("id",id)
    .single();

    if(error || !data){
      return res.status(404).json({error:"Submission not found"});
    }

    const doc = new jsPDF();

    doc.setFontSize(22);
    doc.text("SISFS Innovation Certificate",105,30,{align:"center"});

    doc.setFontSize(16);
    doc.text(`Student: ${data.student_name}`,20,60);
    doc.text(`Invention: ${data.invention_title}`,20,70);

    doc.text("Scores:",20,90);
    doc.text(`Novelty: ${data.novelty_score}`,30,100);
    doc.text(`Feasibility: ${data.feasibility_score}`,30,110);
    doc.text(`Impact: ${data.impact_score}`,30,120);

    doc.text(`Total Patent Score: ${data.patent_score}`,20,140);

    const qrData = `${process.env.FRONTEND_URL}/verify?id=${id}`;
    const qrImage = await QRCode.toDataURL(qrData);

    doc.addImage(qrImage,"PNG",150,60,50,50);
    doc.text("Scan QR for Verification",150,120);

    doc.setFontSize(10);
    doc.text("SISFS © 2026",105,290,{align:"center"});

    const pdfBuffer = doc.output("arraybuffer");

    res.setHeader("Content-Type","application/pdf");
    res.setHeader("Content-Disposition",`attachment; filename="certificate_${id}.pdf"`);

    res.send(Buffer.from(pdfBuffer));

  }
  catch(err){
    res.status(500).json({error:err.message});
  }

});

// -------------------------
const PORT = process.env.PORT || 5000;

app.listen(PORT,()=>{
  console.log(`Server running on port ${PORT}`);
});
