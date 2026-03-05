const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { createClient } = require("@supabase/supabase-js");

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
// Patent Scoring
// -------------------------
function calculatePatentScore(abstractText) {

  const keywords = [
    "novel","efficiency","sustainable","integrated","scalable",
    "eco-friendly","renewable","zero-emission","circular-economy",
    "automation","iot","neural-network","blockchain","decentralized"
  ];

  let baseScore = 50;

  const text = abstractText.toLowerCase();

  let matchedKeywords = 0;

  keywords.forEach(keyword => {
    if (text.includes(keyword)) matchedKeywords++;
  });

  baseScore += matchedKeywords * 5;

  const wordCount = abstractText.trim().split(/\s+/).length;

  if (wordCount > 150) baseScore += 10;
  else if (wordCount > 100) baseScore += 7;
  else if (wordCount > 60) baseScore += 5;

  if (baseScore > 95) baseScore = 95;

  return Math.round(baseScore);
}

// -------------------------
// Loan Logic (STRICT 80)
// -------------------------
function calculateLoanAmount(score) {

  // Only 80+ eligible
  if (score < 80) return 0;

  const maxLoan = 100000;

  let baseLoan;

  if (score >= 90) baseLoan = 98000;
  else baseLoan = 85000;

  const randomFactor = Math.random() * 0.05;

  return Math.round(baseLoan + (maxLoan - baseLoan) * randomFactor);
}

// -------------------------
// Routes
// -------------------------

app.get("/", (req, res) => {
  res.send("Logic Layer Running 🚀");
});

app.post("/submit", async (req, res) => {

  try {

    const { student_name, invention_title, abstract_text } = req.body;

    if (!student_name || !invention_title || !abstract_text) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const patentScore = calculatePatentScore(abstract_text);

    const loanAmount = calculateLoanAmount(patentScore);

    // Eligibility logic
    let eligibilityStatus;

    if (patentScore >= 80) {
      eligibilityStatus = "Eligible ✅";
    } else {
      eligibilityStatus = "Not Eligible ❌";
    }

    const { data, error } = await supabase
      .from("Invention_Submissions")
      .insert([{
        student_name,
        invention_title,
        abstract_text,
        patent_score: patentScore,
        loan_eligibility_amount: loanAmount
      }])
      .select();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.status(200).json({
      status: "success",
      patent_score: patentScore,
      loan_eligibility_amount: loanAmount,
      eligibility_status: eligibilityStatus,
      data
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }

});

// -------------------------
// Start Server
// -------------------------
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
