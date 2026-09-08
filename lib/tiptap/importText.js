// Helpers for pasting AI-drafted content into the WYSIWYG editors. Teachers
// ask an AI to write in the plain mini-markup (same syntax as the old editor),
// then paste it in — smart paste converts formatting automatically, and the
// "Import" dialog additionally parses a trailing "Answers:" block for Note
// Completion so correct answers land in the question list.

const { noteTextToDoc, docToNoteText } = require("./noteConvert");
const { theoryToDoc, docToTheoryMarkdown } = require("./theoryConvert");
const { blankIdsFromDoc } = require("./doc");

// Cheap heuristic: does this pasted text carry any of our markup?
function looksLikeMarkup(t) {
  return /(^|\n)\s*#{1,3}\s|(^|\n)\s*[-*]\s+|\[\[\d+\]\]|==[^=]+==(\{(green|blue|pink|red)\})?|\*\*[^*\n]+\*\*|(^|\n)\s*>\s|(^|\n)\s*\d+[.)]\s+|(^|\n)\s*---\s*(\n|$)/.test(
    String(t || "")
  );
}

// Split a Note-Completion draft into the note body and an answer map keyed by
// blank number. Recognised answer headers: "Answers:", "Answer key:",
// "Đáp án:" (with/without a colon), on their own line.
function splitAnswers(raw) {
  const lines = String(raw || "").split(/\r?\n/);
  const idx = lines.findIndex((l) => /^\s*(answers?|answer\s*key|đáp\s*án|dap\s*an)\s*:?\s*$/i.test(l));
  if (idx < 0) return { body: String(raw || ""), answers: {} };

  const body = lines.slice(0, idx).join("\n").replace(/\s+$/, "");
  const answers = {};
  for (const l of lines.slice(idx + 1)) {
    const m = l.match(/^\s*(\d+)\s*[.)\-:]\s*(.+?)\s*$/);
    if (!m) continue;
    const alts = m[2]
      .split(/\s*\/\s*|\s*;\s*|\s+OR\s+/i)
      .map((s) => s.trim())
      .filter(Boolean);
    if (alts.length) answers[Number(m[1])] = alts;
  }
  return { body, answers };
}

// Raw AI text -> { doc, noteText, answers }  (answers keyed by blank id)
function importNoteText(raw) {
  const { body, answers } = splitAnswers(raw);
  const doc = noteTextToDoc(body);
  return { doc, noteText: docToNoteText(doc), answers, blankIds: blankIdsFromDoc(doc) };
}

// Smart-paste: markup text -> doc node array to insert at the cursor. For Note
// Completion any trailing "Answers:" block is dropped (paste is formatting only;
// use the Import dialog to also capture answers).
function pasteToDoc(raw, isNote) {
  if (isNote) return noteTextToDoc(splitAnswers(raw).body);
  return theoryToDoc(String(raw || ""));
}

// Raw AI text -> { doc, html }
function importTheoryText(raw) {
  const doc = theoryToDoc(String(raw || ""));
  return { doc, html: docToTheoryMarkdown(doc) };
}

// Copy-me block shown in the Import dialog so teachers can hand the rules to an AI.
const NOTE_RULES = [
  "Write an IELTS Note/Summary Completion. Use ONLY this plain-text syntax and return the content only:",
  "",
  "Complete the notes below.",
  "Choose ONE WORD ONLY from the passage for each answer.",
  "---",
  "# Note title",
  "## A section sub-heading",
  "- a note line with a gap here [[1]]",
  "- another line [[2]] and maybe [[3]] on the same line",
  "",
  "Rules: put --- on its own line between the instructions and the notes. Number the gaps",
  "[[1]], [[2]], [[3]]… consecutively. Then add the answers on their own lines:",
  "",
  "Answers:",
  "1. correct answer",
  "2. answer / alternative answer",
  "3. answer",
].join("\n");

const THEORY_RULES = [
  "Write the theory/lesson content. Use ONLY this plain-text syntax and return the content only:",
  "",
  "# Main heading",
  "## Sub-heading",
  "### Small heading",
  "- bullet point",
  "1. numbered step",
  "> a note or example",
  "---",
  "**bold**, *italic*, `code`, [link text](https://example.com)",
  "==coloured text=={green|blue|pink|red}",
  "",
  "Leave a blank line between paragraphs.",
].join("\n");

module.exports = {
  looksLikeMarkup,
  splitAnswers,
  pasteToDoc,
  importNoteText,
  importTheoryText,
  NOTE_RULES,
  THEORY_RULES,
};
