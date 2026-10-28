import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'speaker-test',
  name: 'Speaker Test',
  category: 'device',
  summary: 'Test left/right/both channels and run a frequency sweep to verify speaker wiring and balance.',
  description:
    'Verify your speaker or headphone setup with channel tests and a frequency sweep. Play test tones on the left channel, right channel, or both to confirm stereo wiring and balance. The frequency sweep (20 Hz – 20 kHz) helps identify frequency response issues, rattles, or dead zones. All audio is generated locally using the Web Audio API — no files are downloaded.',
  keywords: [
    'speaker',
    'test',
    'audio',
    'channel',
    'left',
    'right',
    'stereo',
    'frequency',
    'sweep',
    'tone',
    'balance',
    'wiring',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'text',
  panel: 'speaker-test',
  options: [
    {
      key: 'masterVolume',
      label: 'Master Volume',
      type: 'range',
      default: 50,
      min: 0,
      max: 100,
      step: 5,
      help: 'Overall output level. Start low to protect your ears and equipment.',
    },
    {
      key: 'sweepDuration',
      label: 'Sweep Duration (s)',
      type: 'select',
      default: '10',
      choices: [
        { value: '5', label: '5 seconds (fast)' },
        { value: '10', label: '10 seconds' },
        { value: '20', label: '20 seconds (slow)' },
        { value: '30', label: '30 seconds (very slow)' },
      ],
      help: 'How long the frequency sweep takes. Slower = easier to hear issues.',
    },
    {
      key: 'sweepType',
      label: 'Sweep Type',
      type: 'select',
      default: 'logarithmic',
      choices: [
        { value: 'logarithmic', label: 'Logarithmic (perceptually even)' },
        { value: 'linear', label: 'Linear (constant Hz/s)' },
      ],
      help: 'Logarithmic matches human pitch perception; linear is constant rate of change.',
    },
  ],
  faq: [
    {
      q: 'No sound is playing — what should I check?',
      a: '1) Ensure the master volume is up. 2) Check your browser tab is not muted (right-click tab). 3) Check system volume and that the correct output device is selected. 4) Some browsers require a user gesture (click) before audio can start — click a test button.',
    },
    {
      q: 'The left/right test plays on the wrong side.',
      a: 'Your speakers or headphones may be swapped. Check the physical connections. Some audio drivers also have a "swap channels" option.',
    },
    {
      q: 'What is the frequency sweep for?',
      a: 'It plays a tone that slides from 20 Hz to 20 kHz. Listen for: dropouts (dead zones), rattles (resonance), distortion (clipping), or sudden volume changes (frequency response issues).',
    },
    {
      q: 'Can this damage my speakers?',
      a: 'At reasonable volumes, no. However, very low frequencies at high volume can damage some speakers. Start with volume low and increase gradually. Stop immediately if you hear distortion or rattling.',
    },
  ],
  related: ['mic-test', 'webcam-test', 'tuner'],
  status: 'stable',
};