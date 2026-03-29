import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCREENSHOTS_DIR = path.resolve(__dirname, '../screenshots');

export interface CompareResult {
  diffPixels: number;
  totalPixels: number;
  diffPercent: number;
  diffPath: string;
}

export function compareScreenshots(screenName: string): CompareResult {
  const designPath = path.join(SCREENSHOTS_DIR, 'design', `${screenName}.png`);
  const browserPath = path.join(SCREENSHOTS_DIR, 'browser', `${screenName}.png`);
  const diffDir = path.join(SCREENSHOTS_DIR, 'diff');
  const diffPath = path.join(diffDir, `${screenName}.png`);

  fs.mkdirSync(diffDir, { recursive: true });

  const designImg = PNG.sync.read(fs.readFileSync(designPath));
  const browserImg = PNG.sync.read(fs.readFileSync(browserPath));

  // Crop to overlapping area
  const width = Math.min(designImg.width, browserImg.width);
  const height = Math.min(designImg.height, browserImg.height);

  const cropPng = (src: PNG, w: number, h: number): PNG => {
    if (src.width === w && src.height === h) return src;
    const cropped = new PNG({ width: w, height: h });
    for (let y = 0; y < h; y++) {
      src.data.copy(cropped.data, y * w * 4, y * src.width * 4, y * src.width * 4 + w * 4);
    }
    return cropped;
  };

  const d = cropPng(designImg, width, height);
  const b = cropPng(browserImg, width, height);
  const diff = new PNG({ width, height });

  const diffPixels = pixelmatch(d.data, b.data, diff.data, width, height, {
    threshold: 0.15,
    includeAA: false,
  });

  fs.writeFileSync(diffPath, PNG.sync.write(diff));

  const totalPixels = width * height;
  return {
    diffPixels,
    totalPixels,
    diffPercent: totalPixels > 0 ? (diffPixels / totalPixels) * 100 : 0,
    diffPath,
  };
}
