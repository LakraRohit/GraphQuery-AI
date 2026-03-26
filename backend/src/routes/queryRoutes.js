const express = require('express');
const { classify } = require('../guardrail/guardrail');
const { generateCypher, generateAnswer } = require('../llm/llmService');
const { executeCypher } = require('../query/queryEngine');

const router = express.Router();

router.post('/', async (req, res, next) => {
  const { query } = req.body || {};

  if (!query || typeof query !== 'string' || query.trim() === '') {
    return res.status(400).json({ message: 'query field is required.' });
  }

  const { inScope } = classify(query);

  if (!inScope) {
    return res.status(200).json({
      answer: 'This system is designed to answer dataset-related queries only.',
    });
  }

  try {
    // const cypher = await generateCypher(query);
    // const results = await executeCypher(cypher);
    // const answer = await generateAnswer(query, results);

    console.log("🟡 User Query:", query); // 👈 ADD

    const cypher = await generateCypher(query);
    console.log("🟢 Generated Cypher:", cypher); // 👈 ADD

    const results = await executeCypher(cypher);
    console.log("🔵 Query Results:", results); // 👈 ADD

    const answer = await generateAnswer(query, results);
    console.log("🟣 Final Answer:", answer); // 👈 ADD





    return res.status(200).json({ answer }); 
  } catch (err) {
    // next(err);
    console.error("🔴 ERROR OCCURRED:", err); // 👈 CRITICAL

    return res.status(500).json({
      answer: "Something went wrong in backend.",
      error: err.message
    });



  }
});

module.exports = router;
