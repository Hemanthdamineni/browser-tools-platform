# Browser Tools Platform - Performance Optimization Strategies

## Overview

Since artificial limits have been removed and the only constraint is the client's hardware (browser memory, CPU), this document outlines optimization strategies for handling large inputs efficiently.

## Batching Strategies

### 1. File Processing Batching
For tools processing multiple files (e.g., `images-to-pdf`, `pdf-merge`, `zip-extract`):
- Process files in chunks (e.g., 10-50 at a time)
- Yield to event loop between batches using `await new Promise(r => setTimeout(r, 0))`
- Report progress per batch via `onProgress` callback
- Allow abort via `AbortSignal`

```typescript
async function processFilesInBatches(
  files: File[],
  processor: (file: File) => Promise<Result>,
  onProgress?: (fraction: number, message: string) => void,
  signal?: AbortSignal,
  batchSize = 25
): Promise<Result[]> {
  const results: Result[] = [];
  for (let i = 0; i < files.length; i += batchSize) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const batch = files.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);
    onProgress?.(Math.min(1, (i + batchSize) / files.length), `Processed ${Math.min(i + batchSize, files.length)} of ${files.length} files`);
    await new Promise(r => setTimeout(r, 0)); // Yield to main thread
  }
  return results;
}
```

### 2. Large Text Processing Batching
For tools processing large text inputs (e.g., `word-frequency`, `text-stats`, `dedupe-lines`):
- Stream/chunk input text instead of loading all at once
- Use `TextDecoderStream` for large text files
- Process in chunks of ~10MB
- Accumulate results incrementally

```typescript
async function processLargeText(
  text: string,
  processor: (chunk: string) => Partial<Result>,
  onProgress?: (fraction: number) => void,
  chunkSize = 10 * 1024 * 1024
): Promise<Result> {
  const chunks = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  
  let combined: Partial<Result> = {};
  for (let i = 0; i < chunks.length; i++) {
    const partial = processor(chunks[i]);
    combined = mergeResults(combined, partial);
    onProgress?.((i + 1) / chunks.length);
    await new Promise(r => setTimeout(r, 0));
  }
  return finalizeResult(combined);
}
```

### 3. Image Processing Batching
For image tools (e.g., `image-blur-redact`, `image-watermark`, `images-to-pdf`):
- Use `OffscreenCanvas` in Web Workers for CPU-intensive operations
- Process one image at a time to limit memory pressure
- Downsample large images before processing (optional quality setting)
- Release image bitmaps after use with `bitmap.close()`

```typescript
async function processImagesInWorker(
  files: File[],
  workerScript: string,
  onProgress?: (fraction: number, message: string) => void
): Promise<Blob[]> {
  const worker = new Worker(workerScript);
  const results: Blob[] = [];
  
  for (let i = 0; i < files.length; i++) {
    const bitmap = await createImageBitmap(files[i]);
    const result = await new Promise<Blob>((resolve, reject) => {
      worker.postMessage({ bitmap, index: i }, [bitmap]);
      worker.onmessage = (e) => resolve(e.data.blob);
      worker.onerror = reject;
    });
    bitmap.close();
    results.push(result);
    onProgress?.((i + 1) / files.length, `Processed ${i + 1} of ${files.length} images`);
  }
  worker.terminate();
  return results;
}
```

### 4. PDF Generation Batching
For `images-to-pdf`, `pdf-page-numbers`, `pdf-watermark`:
- Add pages in batches of 10-20
- Call `doc.save()` periodically for very large PDFs (creates intermediate blobs)
- Use streaming if `pdf-lib` supports it (consider `pdf-lib` chunked saving)

### 5. Archive Processing Batching
For `zip-extract`, `zip-create`:
- Extract entries in batches using `fflate` streaming APIs
- Process central directory first, then extract matching entries in chunks
- Stream output blobs to avoid holding all in memory

## Memory Management Patterns

### WeakRef for Caching
```typescript
const cache = new Map<string, WeakRef<Blob>>();
function getCached(key: string): Blob | undefined {
  const ref = cache.get(key);
  return ref?.deref();
}
function setCached(key: string, blob: Blob) {
  cache.set(key, new WeakRef(blob));
}
```

### Explicit Cleanup
```typescript
try {
  const bitmap = await createImageBitmap(file);
  // process...
} finally {
  bitmap?.close(); // Release GPU memory
}
```

### Streaming Blobs
```typescript
// Instead of loading entire file into memory
const stream = file.stream();
const reader = stream.getReader();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  processChunk(value);
}
```

## Warning UI Pattern

For operations that may stress the browser, show a non-blocking warning:

```typescript
function showMemoryWarning(estimatedMB: number): boolean {
  if (estimatedMB > 500) {
    return confirm(
      `This operation may use ~${Math.round(estimatedMB)} MB of memory. ` +
      `Your browser tab might become unresponsive. Continue anyway?`
    );
  }
  return true;
}
```

## Implementation Priority

| Tool Category | Priority | Strategy |
|---------------|----------|----------|
| Multi-file PDF tools (`images-to-pdf`, `pdf-merge`, `pdf-to-images`) | High | Page/image batching + progress |
| Archive tools (`zip-extract`, `zip-create`) | High | Streaming + entry batching |
| Large text tools (`word-frequency`, `text-stats`) | Medium | Chunked processing |
| Image tools (`image-blur-redact`, `image-watermark`) | Medium | Web Worker + OffscreenCanvas |
| Generator tools (`lorem-ipsum`, `nanoid`, `ulid`) | Low | Simple loop with yield |

## Testing Large Inputs

```typescript
// Test helper for large file generation
function createLargeFile(sizeMB: number, name = 'large.bin'): File {
  return new File([new Uint8Array(sizeMB * 1024 * 1024)], name);
}

function createManyFiles(count: number, sizeKB = 100): File[] {
  return Array.from({ length: count }, (_, i) => 
    new File([new Uint8Array(sizeKB * 1024)], `file-${i}.bin`)
  );
}
```

## Future Enhancements

1. **WebAssembly** for CPU-intensive operations (image processing, compression)
2. **SharedArrayBuffer** for parallel processing in workers (requires COOP/COEP headers)
3. **WebGPU** for GPU-accelerated image/video processing
4. **File System Access API** for streaming large files without loading into memory
5. **IndexedDB** for temporary storage during multi-step operations