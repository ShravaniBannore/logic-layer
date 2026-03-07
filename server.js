const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { createClient } = require("@supabase/supabase-js");
const PDFDocument = require("pdfkit");
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
  novelty: "30%",
  feasibility: "30%",
  impact: "40%"
};

// -------------------------
// Keyword Groups
// -------------------------

const noveltyKeywords = [
  "novel","innovative","breakthrough","next-generation",
  "proprietary","advanced","bionic","hydroponic"
];

const feasibilityKeywords = [
  "automation","algorithm","iot","sensors",
  "machine learning","deep learning","edge computing",
  "scalable","integrated"
];

const impactKeywords = [
  "market","industry","revenue","efficiency",
  "optimization","cost reduction","commercial",
  "renewable","eco-friendly","sustainable"
];

// -------------------------
// Keyword Score Function
// -------------------------

function keywordScore(text, keywords){

  let score = 0;

  keywords.forEach(keyword => {

    const regex = new RegExp(keyword.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), "i");

    if(regex.test(text)) score += 10;

  });

  if(score > 100) score = 100;

  return score;
}

// -------------------------
// Patent Score
// -------------------------

function calculatePatentScore(novelty,feasibility,impact){

  const score =
    novelty * 0.3 +
    feasibility * 0.3 +
    impact * 0.4;

  return Math.round(score);
}

// -------------------------
function calculateLoanAmount(score){

  if(score < 80) return 0;

  const maxLoan = 100000;

  let baseLoan;

  if(score >= 90) baseLoan = 98000;
  else baseLoan = 85000;

  const randomFactor = Math.random()*0.05;

  return Math.round(baseLoan + (maxLoan-baseLoan)*randomFactor);

}

// -------------------------
app.get("/", (req,res)=>{
  res.send("Logic Layer Running 🚀");
});

// -------------------------
app.post("/submit", async(req,res)=>{

try{

const {student_name,invention_title,abstract_text} = req.body;

if(!student_name || !invention_title || !abstract_text){
return res.status(400).json({error:"Missing required fields"});
}

const text = abstract_text.toLowerCase();

const noveltyScore = keywordScore(text,noveltyKeywords);
const feasibilityScore = keywordScore(text,feasibilityKeywords);
const impactScore = keywordScore(text,impactKeywords);

const patentScore = calculatePatentScore(
noveltyScore,
feasibilityScore,
impactScore
);

const loanAmount = calculateLoanAmount(patentScore);

let eligibilityStatus;

if(patentScore>=80)
eligibilityStatus="Eligible for Startup Funding ✅";

else if(patentScore>=70)
eligibilityStatus="Needs Improvement ⚠️";

else
eligibilityStatus="Not Eligible ❌";

// -------------------------
const {data,error} = await supabase
.from("Invention_Submissions")
.insert([{
student_name,
invention_title,
abstract_text,
novelty_score:noveltyScore,
feasibility_score:feasibilityScore,
impact_score:impactScore,
patent_score:patentScore,
loan_eligibility_amount:loanAmount
}])
.select();

if(error){
return res.status(500).json({error:error.message});
}

// -------------------------
res.status(200).json({

status:"success",

scores:{
novelty:noveltyScore,
feasibility:feasibilityScore,
impact:impactScore
},

patent_score:patentScore,
loan_eligibility_amount:loanAmount,
eligibility_status:eligibilityStatus,

evaluation_model:{
model_name:"Neural Innovation Scoring Engine",
weightage:evaluationWeightage
},

data

});

}catch(err){
res.status(500).json({error:err.message});
}

});

// -------------------------
// PDF Generator
// -------------------------

app.get("/generate-certificate/:id", async(req,res)=>{

try{

const id = req.params.id;

const {data,error} = await supabase
.from("Invention_Submissions")
.select("*")
.eq("id",id)
.single();

if(error){
return res.status(500).json({error:error.message});
}

const verifyURL = `http://localhost:5000/verify?id=${id}`;

const qr = await QRCode.toDataURL(verifyURL);

const qrBuffer = Buffer.from(qr.split(",")[1], "base64");

const doc = new PDFDocument();

res.setHeader("Content-Type","application/pdf");

res.setHeader(
"Content-Disposition",
`attachment; filename=innovation_certificate_${id}.pdf`
);

doc.pipe(res);

doc.fontSize(24).text("Innovation Certificate",{align:"center"});
doc.moveDown();

doc.fontSize(14).text(`Student Name: ${data.student_name}`);
doc.text(`Invention Title: ${data.invention_title}`);

doc.moveDown();

doc.text(`Novelty Score: ${data.novelty_score}`);
doc.text(`Feasibility Score: ${data.feasibility_score}`);
doc.text(`Impact Score: ${data.impact_score}`);

doc.moveDown();

doc.text(`Final Patent Score: ${data.patent_score}`);

doc.text(`Funding Eligibility: ₹${data.loan_eligibility_amount}`);

doc.moveDown();

doc.text("Scan QR to Verify");

doc.image(qrBuffer,{fit:[120,120],align:"center"});

doc.end();

}catch(err){
res.status(500).json({error:err.message});
}

});

// -------------------------
// VERIFY ROUTE (FIXED)
// -------------------------

app.get("/verify",async(req,res)=>{

const id = req.query.id;

const {data,error} = await supabase
.from("Invention_Submissions")
.select("*")
.eq("id", id)
.single();

if(error)
return res.status(404).send("Certificate Not Found");

res.json({
status:"verified",
student_name:data.student_name,
invention_title:data.invention_title,
patent_score:data.patent_score
});

});

// -------------------------
const PORT = process.env.PORT || 5000;

app.listen(PORT,()=>{
console.log(`Server running on port ${PORT}`);
});
