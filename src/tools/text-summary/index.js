import nlp from 'compromise';

function summarizeText(inputText) {
  if (!inputText) return '';

  const doc = nlp(inputText);
  const sentences = doc.sentences().out('array');
  const summary = [];
  const sentenceLimit = 5;

  for (let i = 0; i < Math.min(sentences.length, sentenceLimit); i++) {
    summary.push(sentences[i]);
  }

  return summary.join(' ');
}

export default summarizeText;
