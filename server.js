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
// AI KEYWORD LIST
// -------------------------

const normalKeywords = [
  "novel",
  "efficiency",
  "sustainable",
  "integrated",
  "eco-friendly",
  "renewable",
  "automation",
  "iot",
  "blockchain",
  "decentralized",
  "optimization"
];

const highValueKeywords = [
  "proprietary",
  "neural",
  "neural network",
  "deep tech",
  "machine learning",
  "predictive analytics",
  "risk mitigation",
  "scalability",
  "ai model",
  "autonomous system"
];

// -------------------------
// Improved Patent Scoring
// -------------------------

function calculatePatentScore(abstractText) {

  let score = 50;

  const text = abstractText.toLowerCase();

  let matchedNormal = 0;
  let matchedHigh = 0;

  normalKeywords.forEach(keyword => {
    if (text.includes(keyword)) matchedNormal++;
  });

  highValueKeywords.forEach(keyword => {
    if (text.includes(keyword)) matchedHigh++;
  });

  // Normal keywords = +3 points
  score += matchedNormal * 3;

  // High-value deep tech keywords = +8 points
  score += matchedHigh * 8;

  // Word count scoring
  const wordCount = abstractText.trim().split(/\s+/).length;

  if (wordCount > 150) score += 10;
  else if (wordCount > 100) score += 7;
  else if (wordCount > 60) score += 5;

  // Cap score
  if (score > 95) score = 95;

  return Math.round(score);
}

// -------------------------
// Eligibility Status Logic
// -------------------------

function getEligibilityStatus(score) {

  if (score >= 80) {
    return "Eligible ✅";
  }

  if (score >= 70 && score < 80) {
    return "Potential - Needs Improvement ⚠️";
  }

  return "Ineligible ❌";
}

// -------------------------
// Loan Logic (Only ≥ 80)
// -------------------------

function calculateLoanAmount(score) {

  if (score < 80) return 0;

  const minLoan = 80000;
  const maxLoan = 100000;

  let randomFactor = Math.random() * 0.05;

  let baseLoan;

  if (score >= 90) baseLoan = 98000;
  else if (score >= 85) baseLoan = 90000;
  else baseLoan = 82000;

  let dynamicLoan =
    baseLoan + (maxLoan - baseLoan) * randomFactor;

  return Math.round(dynamicLoan);
}

// -------------------------
// Routes
// -------------------------

app.get("/", (req, res) => {
  res.send("Logic Layer Running 🚀");
});

app.get("/keywords", (req, res) => {

  res.json({
    normal_keywords: normalKeywords,
    high_value_keywords: highValueKeywords
  });

});

// -------------------------
// Submit Invention
// -------------------------

app.post("/submit", async (req, res) => {

  try {

    const { student_name, invention_title, abstract_text } = req.body;

    if (!student_name || !invention_title || !abstract_text) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // AI scoring
    const patentScore = calculatePatentScore(abstract_text);

    const loanAmount = calculateLoanAmount(patentScore);

    const eligibilityStatus = getEligibilityStatus(patentScore);

    // Save to Supabase
    const { data, error } = await supabase
      .from("Invention_Submissions")
      .insert([
        {
          student_name,
          invention_title,
          abstract_text,
          patent_score: patentScore,
          loan_eligibility_amount: loanAmount
        }
      ])
      .select();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    // API Response
    res.status(200).json({

      status: "success",

      patent_score: patentScore,

      loan_eligibility_amount: loanAmount,

      eligibility_status: eligibilityStatus,

      tracked_keywords: {
        normal: normalKeywords,
        high_value: highValueKeywords
      },

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
  console.log(Server running on port ${PORT});
});
