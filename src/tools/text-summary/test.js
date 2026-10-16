import summarizeText from './index.js';

const testText = `自然语言处理（NLP）是计算机科学中的一个领域，致力于在人类语言和计算机语言之间进行有效翻译。NLP 的一个重要应用是自动文本摘要，它能够从一长段文本中提取出主要内容。文本摘要有助于用户快速理解文档的大意，并减少阅读时间。`;

console.log(summarizeText(testText));
