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
// Weighted Patent Score Logic (40-30-30)
// -------------------------
const technicalKeywords = {
  "ai": 10,
  "neural": 20,
  "blockchain": 10,
  "automation": 10,
  "iot": 10,
  "algorithm": 10,
  "machine learning": 10,
  "deep learning": 10,
  "scalable": 15,
  "risk mitigation": 15
};

const marketKeywords = {
  "market": 10,
  "industry": 10,
  "demand": 10,
  "solution": 10,
  "efficiency": 10,
  "optimization": 10,
  "cost reduction": 10,
  "logistics": 10
};

const innovationKeywords = {
  "novel": 10,
  "innovative": 15,
  "unique": 15,
  "breakthrough": 15,
  "next-generation": 15,
  "proprietary": 20
};

function calculatePatentScore(abstractText) {
  const text = abstractText.toLowerCase();

  let technicalScore = 0;
  let marketScore = 0;
  let innovationScore = 0;

  // Technical
  for (let key in technicalKeywords) {
    if (text.includes(key)) technicalScore += technicalKeywords[key];
  }
  if (technicalScore > 100) technicalScore = 100;

  // Market
  for (let key in marketKeywords) {
    if (text.includes(key)) marketScore += marketKeywords[key];
  }
  if (marketScore > 100) marketScore = 100;

  // Innovation
  for (let key in innovationKeywords) {
    if (text.includes(key)) innovationScore += innovationKeywords[key];
  }
  if (innovationScore > 100) innovationScore = 100;

  const finalScore =
    technicalScore * 0.4 +
    marketScore * 0.3 +
    innovationScore * 0.3;

  return Math.round(finalScore);
}

// -------------------------
// Loan Calculation & Eligibility
// -------------------------
function calculateLoanAmountAndStatus(score) {
  const minLoan = 80000;
  const maxLoan = 100000;
  let status = "";
  let loan = 0;

  if (score >= 80) {
    const baseLoan = score >= 90 ? 98000 : 85000;
    const randomFactor = Math.random() * 0.05; // 0–5% variation
    loan = Math.round(baseLoan + (maxLoan - baseLoan) * randomFactor);
    status = "Eligible ✅";
  } else if (score >= 70) {
    loan = 0;
    status = "Potential – Needs Improvement ⚠️";
  } else {
    loan = 0;
    status = "Ineligible ❌";
  }

  return { loan, status };
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
    const { loan, status } = calculateLoanAmountAndStatus(patentScore);

    const { data, error } = await supabase
      .from("Invention_Submissions")
      .insert([
        {
          student_name,
          invention_title,
          abstract_text,
          patent_score: patentScore,
          loan_eligibility_amount: loan
        }
      ])
      .select();

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.status(200).json({
      status: "success",
      patent_score: patentScore,
      loan_eligibility_amount: loan,
      eligibility_status: status,
      weightage: {
        technical_keywords: "40%",
        market_need: "30%",
        innovation: "30%"
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
  console.log(`Server running on port ${PORT}`);
});
