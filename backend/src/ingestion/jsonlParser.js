const fs = require('fs');
const readline = require('readline');

/**
 * Async generator that reads a JSONL file line-by-line and yields parsed objects.
 * - Skips blank lines
 * - On parse error: logs { file, lineNumber, error } and continues — does not throw
 * - Preserves all values as-is (nulls stay null, strings stay strings, nested objects intact)
 *
 * @param {string} filePath - Path to the .jsonl file
 * @yields {object} Parsed JSON object for each valid line
 */
async function* parseJsonlStream(filePath) {
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath),
    crlfDelay: Infinity,
  });

  let lineNumber = 0;

  for await (const line of rl) {
    lineNumber++;
    if (line.trim() === '') continue;

    try {
      yield JSON.parse(line);
    } catch (error) {
      console.error({ file: filePath, lineNumber, error: error.message });
    }
  }
}

/**
 * Convenience function that collects all records from a JSONL file into an array.
 *
 * @param {string} filePath - Path to the .jsonl file
 * @returns {Promise<object[]>} Resolves to an array of parsed objects
 */
async function parseJsonlFile(filePath) {
  const results = [];
  for await (const record of parseJsonlStream(filePath)) {
    results.push(record);
  }
  return results;
}

module.exports = { parseJsonlStream, parseJsonlFile };
