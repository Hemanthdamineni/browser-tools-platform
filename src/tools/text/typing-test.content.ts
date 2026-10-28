/**
 * Editorial content for the typing-test tool page.
 *
 * Kept out of `typing-test.meta.ts` so the eager client registry never ships
 * this prose: pages and SEO endpoints import it at build time only.
 */
export const content = {
  article: [
    {
      heading: 'What you get back',
      body: 'Pick a time mode (15, 30, 60 or 120 seconds) or a word count (10, 25 or 50 words) and the tool produces a randomized word sequence to type. When typed text is supplied it scores the run: gross WPM from every keystroke, net WPM from the correctly typed characters only, the accuracy percentage, correct and total character counts, the error count and whether the target was completed inside the limit.',
    },
    {
      heading: 'How the scores are computed',
      body: 'A "word" is five keystrokes, the standard typing-test unit, spaces included. Gross WPM is (total characters / 5) divided by the minutes spent; net WPM replaces the total with the correct-character count, so mistakes cost you directly. Accuracy is correct characters over total characters typed. Characters are compared position by position against the target text, so an early error shifts every following comparison.',
    },
    {
      heading: 'Where the words come from',
      body: 'The target text is drawn from a few hundred of the most common English words, so the sequence reads naturally and the test works fully offline. Optional toggles add punctuation and digits when you want practice closer to real prose and data entry.',
    },
    {
      heading: 'Privacy and the interactive run',
      body: 'The live test itself runs in the browser tab: the words you type are compared on your device and any result history is stored locally in your browser only, never synced or uploaded. The plain `run()` form scores whatever typed text you pass, which also makes the metrics unit-testable without a DOM.',
    },
  ],
  faq: [
    {
      q: 'How is WPM calculated?',
      a: 'Gross WPM = (total keystrokes / 5) / minutes. Net WPM = (correct keystrokes / 5) / minutes. The standard "word" is defined as 5 keystrokes including spaces.',
    },
    {
      q: 'What is the difference between gross and net WPM?',
      a: 'Gross WPM counts all keystrokes. Net WPM only counts correctly typed characters, so errors reduce your net score.',
    },
    {
      q: 'Where is my history stored?',
      a: 'In your browser (the panel keeps it in local storage). It never leaves your device and is not synced anywhere.',
    },
    {
      q: 'Can I use my own text?',
      a: 'This tool generates randomized word sequences for the target. Any text you supply as input is scored against the generated target, so you can paste a finished run back in to see its metrics.',
    },
  ],
};
