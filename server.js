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
// Patent Score Logic (40-30-30 Weightage)
// -------------------------
function calculatePatentScore(abstractText) {
  const text = abstractText.toLowerCase();

  // Technical Keywords (40%)
  const technicalKeywords = [
    "ai","neural","blockchain","automation","iot",
    "algorithm","machine learning","deep learning","scalable"
  ];

  // Market Need (30%)
  const marketKeywords = [
    "market","industry","demand","solution",
    "efficiency","optimization","cost reduction"
  ];

  // Innovation (30%)
  const innovationKeywords = [
    "novel","innovative","unique","breakthrough",
    "next-generation","proprietary"
  ];

  let technicalScore = 0;
  let marketScore = 0;
  let innovationScore = 0;

  technicalKeywords.forEach(word => {
    if (text.includes(word)) technicalScore += 10;
  });

  marketKeywords.forEach(word => {
    if (text.includes(word)) marketScore += 10;
  });

  innovationKeywords.forEach(word => {
    if (text.includes(word)) innovationScore += 10;
  });

  if (technicalScore > 100) technicalScore = 100;
  if (marketScore > 100) marketScore = 100;
  if (innovationScore > 100) innovationScore = 100;

  const finalScore =
    (technicalScore * 0.4) +
    (marketScore * 0.3) +
    (innovationScore * 0.3);

  return Math.floor(finalScore); // Floor to prevent rounding issues
}

// -------------------------
// Dynamic Loan Logic & Eligibility
// -------------------------
function calculateLoanAmountAndStatus(score) {
  const maxLoan = 100000;
  let baseLoan = 0;
  let eligibility_status = "";

  if (score >= 80) {
    // Eligible
    baseLoan = score >= 90 ? 98000 : 90000;
    const randomFactor = Math.random() * 0.05; // 0–5% dynamic variation
    const dynamicLoan = baseLoan + (maxLoan - baseLoan) * randomFactor;
    eligibility_status = "Eligible ✅";
    return { loan: Math.round(dynamicLoan), status: eligibility_status };
  } else if (score >= 70 && score < 80) {
    // Needs Improvement
    eligibility_status = "Needs Improvement ⚠️";
    return { loan: 0, status: eligibility_status };
  } else {
    // Ineligible
    eligibility_status = "Ineligible ❌";
    return { loan: 0, status: eligibility_status };
  }
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
