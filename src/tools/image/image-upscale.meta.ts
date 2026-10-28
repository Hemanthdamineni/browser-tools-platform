import type { ToolMeta } from '@/lib/types';

export const meta: ToolMeta = {
  id: 'image-upscale',
  name: 'Image Upscaler',
  category: 'image',
  summary: 'Upscale images 2x/4x using a permissively licensed ESRGAN model (Real-ESRGAN via ONNX).',
  description:
    'Increase image resolution using AI super-resolution. Uses a Real-ESRGAN model (MIT licensed) converted to ONNX format, running entirely in the browser via onnxruntime-web with WebGPU acceleration when available. Supports 2x and 4x upscaling. Note: First run downloads the model (~20 MB). Large images are tiled to fit in memory.',
  keywords: [
    'upscale',
    'super-resolution',
    'esrgan',
    'real-esrgan',
    'ai',
    'enhance',
    'resize',
    'onnx',
    'webgpu',
  ],
  privacy: { processing: 'on-device', network: 'none', offline: true },
  input: 'file',
  accept: 'image/*',
  multiple: true,
  options: [
    {
      key: 'scale',
      label: 'Scale Factor',
      type: 'select',
      default: '2',
      choices: [
        { value: '2', label: '2x' },
        { value: '4', label: '4x' },
      ],
      help: 'How much to increase resolution. 4x takes longer and uses more memory.',
    },
    {
      key: 'model',
      label: 'Model',
      type: 'select',
      default: 'realesrgan-x2',
      choices: [
        { value: 'realesrgan-x2', label: 'Real-ESRGAN 2x (general)' },
        { value: 'realesrgan-x4', label: 'Real-ESRGAN 4x (general)' },
        { value: 'realesrgan-anime-x2', label: 'Real-ESRGAN Anime 2x' },
        { value: 'realesrgan-anime-x4', label: 'Real-ESRGAN Anime 4x' },
      ],
      help: 'Model variant. Anime models work better for illustrations; general for photos.',
    },
    {
      key: 'tileSize',
      label: 'Tile Size',
      type: 'select',
      default: '256',
      choices: [
        { value: '128', label: '128 (low memory)' },
        { value: '256', label: '256 (balanced)' },
        { value: '512', label: '512 (high memory)' },
      ],
      help: 'Images are processed in tiles to limit memory usage. Smaller tiles = less memory but slower.',
    },
    {
      key: 'outputFormat',
      label: 'Output Format',
      type: 'select',
      default: 'png',
      choices: [
        { value: 'png', label: 'PNG (lossless)' },
        { value: 'webp', label: 'WebP (smaller)' },
        { value: 'jpeg', label: 'JPEG (smallest, lossy)' },
      ],
      help: 'Output image format. PNG preserves quality; WebP/JPEG are smaller.',
    },
    {
      key: 'jpegQuality',
      label: 'JPEG Quality',
      type: 'range',
      default: 90,
      min: 50,
      max: 100,
      step: 5,
      help: 'Quality for JPEG output (ignored for PNG/WebP).',
    },
  ],
  faq: [
    {
      q: 'How long does upscaling take?',
      a: 'Depends on image size, scale factor, and hardware. A 1 MP image at 2x takes ~2-5 seconds on a modern laptop with WebGPU; 4x takes ~8-20 seconds. CPU fallback is slower.',
    },
    {
      q: 'What is the maximum image size?',
      a: 'Limited by browser memory. The tool tiles large images automatically. Practical limit is around 4000x4000 input for 4x on typical devices (64 MP output).',
    },
    {
      q: 'Does this work on all image types?',
      a: 'Works best on photos and detailed illustrations. Anime/art models are optimized for flat-color artwork. Very low-quality or heavily compressed inputs may show artifacts.',
    },
    {
      q: 'Why does it take a moment to start?',
      a: 'The ONNX model (~20 MB) must be downloaded and compiled on first use. It is cached for subsequent runs. WebGPU compilation adds a few more seconds on first run.',
    },
    {
      q: 'Can I upscale multiple images at once?',
      a: 'Yes, select multiple files. They are processed sequentially with progress shown.',
    },
  ],
  related: ['image-resize', 'image-compress', 'image-convert'],
  credits: [
    {
      name: 'Real-ESRGAN',
      url: 'https://github.com/xinntao/Real-ESRGAN',
      license: 'MIT',
    },
    {
      name: 'onnxruntime-web',
      url: 'https://github.com/microsoft/onnxruntime',
      license: 'MIT',
    },
  ],
  status: 'beta',
};