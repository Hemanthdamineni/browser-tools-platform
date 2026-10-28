/**
 * Image Upscaler core - uses Real-ESRGAN ONNX model via onnxruntime-web
 */
import { ToolError } from '@/lib/types';
import { loadModel, type LoadedModel } from '@/lib/ml/loader';
import {
  MAX_CANVAS_EDGE,
  MAX_CANVAS_PIXELS,
  assertCanvasBudget,
  createCanvas,
  context2d,
  decodeOriented,
  encodeCanvas,
  runBatch,
  type BatchEnv,
  throwIfAborted,
} from './image-batch';

export interface UpscaleOptions {
  scale: 2 | 4;
  model: 'realesrgan-x2' | 'realesrgan-x4' | 'realesrgan-anime-x2' | 'realesrgan-anime-x4';
  tileSize: number;
  outputFormat: 'png' | 'webp' | 'jpeg';
  jpegQuality: number;
}

export interface UpscaleResult {
  blob: Blob;
  width: number;
  height: number;
  scale: number;
}

/** Model configurations */
const MODEL_CONFIG = {
  'realesrgan-x2': { scale: 2, url: 'https://huggingface.co/real-esrgan/Real-ESRGAN/resolve/main/realesrgan-x2.onnx' },
  'realesrgan-x4': { scale: 4, url: 'https://huggingface.co/real-esrgan/Real-ESRGAN/resolve/main/realesrgan-x4.onnx' },
  'realesrgan-anime-x2': { scale: 2, url: 'https://huggingface.co/real-esrgan/Real-ESRGAN/resolve/main/realesrgan-anime-x2.onnx' },
  'realesrgan-anime-x4': { scale: 4, url: 'https://huggingface.co/real-esrgan/Real-ESRGAN/resolve/main/realesrgan-anime-x4.onnx' },
} as const;

type ModelKey = keyof typeof MODEL_CONFIG;

let modelCache: Map<ModelKey, LoadedModel> = new Map();

/** Get or load an upscale model */
async function getModel(modelKey: ModelKey, onProgress?: (progress: number) => void): Promise<LoadedModel> {
  let model = modelCache.get(modelKey);
  if (model) return model;

  const config = MODEL_CONFIG[modelKey];
  model = await loadModel({
    modelId: `realesrgan/${modelKey}`,
    modelUrls: [config.url],
    progressCallback: onProgress,
  });
  modelCache.set(modelKey, model);
  return model;
}

/** Preprocess image for model input (NHWC -> NCHW, normalize) */
function preprocessImage(
  imageBitmap: ImageBitmap,
  tileX: number,
  tileY: number,
  tileW: number,
  tileH: number
): Float32Array {
  const canvas = createCanvas(tileW, tileH, 'preprocess');
  const ctx = context2d(canvas);
  ctx.drawImage(imageBitmap, tileX, tileY, tileW, tileH, 0, 0, tileW, tileH);

  const imageData = ctx.getImageData(0, 0, tileW, tileH);
  const data = imageData.data;
  const input = new Float32Array(3 * tileH * tileW);

  // NHWC to NCHW, normalize to [0, 1]
  for (let y = 0; y < tileH; y++) {
    for (let x = 0; x < tileW; x++) {
      const i = (y * tileW + x) * 4;
      input[y * tileW + x] = data[i] / 255; // R
      input[tileH * tileW + y * tileW + x] = data[i + 1] / 255; // G
      input[2 * tileH * tileW + y * tileW + x] = data[i + 2] / 255; // B
    }
  }

  return input;
}

/** Postprocess model output (NCHW -> NHWC, denormalize) */
function postprocessOutput(
  output: Float32Array,
  outW: number,
  outH: number
): ImageData {
  const imageData = new ImageData(outW, outH);
  const data = imageData.data;

  // NCHW to NHWC, denormalize
  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      const i = (y * outW + x) * 4;
      const r = Math.round(Math.max(0, Math.min(1, output[y * outW + x])) * 255);
      const g = Math.round(Math.max(0, Math.min(1, output[outH * outW + y * outW + x])) * 255);
      const b = Math.round(Math.max(0, Math.min(1, output[2 * outH * outW + y * outW + x])) * 255);
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }

  return imageData;
}

/** Process a single tile through the model */
async function processTile(
  model: LoadedModel,
  imageBitmap: ImageBitmap,
  tileX: number,
  tileY: number,
  tileW: number,
  tileH: number,
  scale: number
): Promise<ImageData> {
  const input = preprocessImage(imageBitmap, tileX, tileY, tileW, tileH);

  // Run inference - model expects [1, 3, H, W]
  const inputTensor = new model.session.inputType(input, [1, 3, tileH, tileW]);
  const feeds = { input: inputTensor };
  const results = await model.session.run(feeds);

  // Get output tensor - shape [1, 3, H*scale, W*scale]
  const outputTensor = results[model.session.outputNames[0]];
  const outputData = outputTensor.data as Float32Array;
  const outH = tileH * scale;
  const outW = tileW * scale;

  return postprocessOutput(outputData, outW, outH);
}

/** Upscale a single image using tiling */
export async function upscaleImage(
  file: File,
  options: UpscaleOptions,
  onProgress?: (progress: number, message: string) => void
): Promise<UpscaleResult> {
  const modelKey = options.model as ModelKey;
  const config = MODEL_CONFIG[modelKey];

  // Load model
  onProgress?.(0.05, 'Loading model...');
  const model = await getModel(modelKey, (p) => onProgress?.(0.05 + p * 0.15, `Loading model... ${Math.round(p * 100)}%`));

  // Decode image
  onProgress?.(0.2, 'Decoding image...');
  const imageBitmap = await decodeOriented(file);
  const { width, height } = imageBitmap;

  // Check size limits
  const outWidth = width * config.scale;
  const outHeight = height * config.scale;
  assertCanvasBudget(outWidth, outHeight, 'upscaled output');

  const tileSize = options.tileSize;
  const scale = config.scale;

  // Calculate tiles
  const tilesX = Math.ceil(width / tileSize);
  const tilesY = Math.ceil(height / tileSize);
  const totalTiles = tilesX * tilesY;

  // Create output canvas
  const outputCanvas = createCanvas(outWidth, outHeight, 'upscale-output');
  const outputCtx = context2d(outputCanvas);

  let processedTiles = 0;

  // Process tiles
  for (let ty = 0; ty < tilesY; ty++) {
    for (let tx = 0; tx < tilesX; tx++) {
      throwIfAborted();

      const tileX = tx * tileSize;
      const tileY = ty * tileSize;
      const tileW = Math.min(tileSize, width - tileX);
      const tileH = Math.min(tileSize, height - tileY);

      onProgress?.(
        0.2 + 0.75 * (processedTiles / totalTiles),
        `Processing tile ${processedTiles + 1}/${totalTiles}...`
      );

      const outputTile = await processTile(model, imageBitmap, tileX, tileY, tileW, tileH, scale);

      // Draw tile to output canvas
      const outX = tileX * scale;
      const outY = tileY * scale;
      const outW = tileW * scale;
      const outH = tileH * scale;

      const tileCanvas = createCanvas(outW, outH, 'tile-output');
      const tileCtx = context2d(tileCanvas);
      tileCtx.putImageData(outputTile, 0, 0);
      outputCtx.drawImage(tileCanvas, outX, outY, outW, outH);

      processedTiles++;
    }
  }

  imageBitmap.close();

  // Encode output
  onProgress?.(0.95, 'Encoding output...');
  const mimeType = options.outputFormat === 'png' ? 'image/png' :
                   options.outputFormat === 'webp' ? 'image/webp' : 'image/jpeg';
  const quality = options.outputFormat === 'jpeg' ? options.jpegQuality / 100 : undefined;

  const blob = await encodeCanvas(outputCanvas, mimeType, quality);

  onProgress?.(1, 'Done');

  return {
    blob,
    width: outWidth,
    height: outHeight,
    scale,
  };
}

/** Batch upscale multiple files */
export async function upscaleBatch(
  files: File[],
  options: UpscaleOptions,
  onProgress?: (fileIndex: number, totalFiles: number, fileProgress: number, message: string) => void
): Promise<UpscaleResult[]> {
  const env: BatchEnv = { signal: undefined as any }; // Will be set by caller

  return runBatch(files, env, 'upscaling', async (file, index) => {
    const result = await upscaleImage(file, options, (p, msg) =>
      onProgress?.(index, files.length, p, msg)
    );
    return result;
  });
}