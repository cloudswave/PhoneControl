import { describe, it, expect } from 'vitest';

/**
 * Calculate the actual displayed image dimensions and offset within the container
 * considering object-fit: contain
 */
function getImageLayout(containerWidth: number, containerHeight: number, imgWidth: number, imgHeight: number) {
  if (imgWidth === 0 || imgHeight === 0) {
    return { displayWidth: containerWidth, displayHeight: containerHeight, offsetX: 0, offsetY: 0 };
  }

  const containerAspect = containerWidth / containerHeight;
  const imageAspect = imgWidth / imgHeight;

  let displayWidth: number;
  let displayHeight: number;

  if (imageAspect > containerAspect) {
    // Image is wider than container, fit to width
    displayWidth = containerWidth;
    displayHeight = containerWidth / imageAspect;
  } else {
    // Image is taller than container, fit to height
    displayHeight = containerHeight;
    displayWidth = containerHeight * imageAspect;
  }

  const offsetX = (containerWidth - displayWidth) / 2;
  const offsetY = (containerHeight - displayHeight) / 2;

  return { displayWidth, displayHeight, offsetX, offsetY };
}

describe('Image Layout Calculation (object-fit: contain)', () => {
  describe('Portrait image in portrait container', () => {
    it('should fit image that is wider than container aspect', () => {
      // Container: 200x356, Container aspect = 0.5618
      // Image: 1080x1920, Image aspect = 0.5625
      // Image is slightly wider, so fit to width
      const layout = getImageLayout(200, 356, 1080, 1920);

      // Image should fit to width (200)
      // Height: 200 / (1080/1920) = 200 * (1920/1080) = 355.56
      expect(layout.displayWidth).toBeCloseTo(200, 0);
      expect(layout.displayHeight).toBeCloseTo(355.56, 0);
      expect(layout.offsetX).toBeCloseTo(0, 1);
      expect(layout.offsetY).toBeCloseTo(0.22, 1);
    });

    it('should fit portrait image', () => {
      // Container: 200x356, Image: 720x1280 (portrait)
      // Image aspect: 720/1280 = 0.5625
      const layout = getImageLayout(200, 356, 720, 1280);

      // Fit to width since image aspect is slightly wider than container
      expect(layout.displayWidth).toBeCloseTo(200, 0);
      expect(layout.displayHeight).toBeCloseTo(200 * (1280 / 720), 0);
      expect(layout.offsetX).toBeCloseTo(0, 1);
      expect(layout.offsetY).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Landscape image in portrait container', () => {
    it('should fit wider image with offset', () => {
      // Container: 200x356, Image: 1920x1080 (landscape)
      // Image aspect: 1920/1080 = 1.778
      const layout = getImageLayout(200, 356, 1920, 1080);

      // Container aspect: 200/356 = 0.561
      // Image is much wider, fit to width
      expect(layout.displayWidth).toBeCloseTo(200, 0);
      expect(layout.displayHeight).toBeCloseTo(200 / 1.778, 0);
      expect(layout.offsetX).toBeCloseTo(0, 1);
      expect(layout.offsetY).toBeGreaterThan(0);
    });
  });

  describe('Square image', () => {
    it('should center square image', () => {
      // Container: 200x356, Image: 1000x1000
      const layout = getImageLayout(200, 356, 1000, 1000);

      // Image aspect = 1, Container aspect = 0.561
      // Fit to width: displayWidth = 200, displayHeight = 200
      expect(layout.displayWidth).toBeCloseTo(200, 0);
      expect(layout.displayHeight).toBeCloseTo(200, 0);
      expect(layout.offsetX).toBeCloseTo(0, 1);
      expect(layout.offsetY).toBeCloseTo((356 - 200) / 2, 0);
    });
  });

  describe('Zero dimensions', () => {
    it('should handle zero image width', () => {
      const layout = getImageLayout(200, 356, 0, 1920);
      expect(layout.displayWidth).toBe(200);
      expect(layout.displayHeight).toBe(356);
      expect(layout.offsetX).toBe(0);
      expect(layout.offsetY).toBe(0);
    });

    it('should handle zero image height', () => {
      const layout = getImageLayout(200, 356, 1080, 0);
      expect(layout.displayWidth).toBe(200);
      expect(layout.displayHeight).toBe(356);
      expect(layout.offsetX).toBe(0);
      expect(layout.offsetY).toBe(0);
    });
  });

  describe('Coordinate mapping', () => {
    it('should map click from container to image coordinates', () => {
      // Container: 200x356, Image: 1080x1920
      const layout = getImageLayout(200, 356, 1080, 1920);

      // Click at center of container
      const containerX = 100;
      const containerY = 178;

      // Map to image coordinates
      const imageX = containerX - layout.offsetX;
      const imageY = containerY - layout.offsetY;

      // Should be at center of image (roughly)
      expect(imageX).toBeCloseTo(100, 0);
      expect(imageY).toBeCloseTo(177.78, 0);
    });

    it('should map click with vertical centering offset', () => {
      // Container: 200x356, Image: 1000x1000 (square, centered vertically)
      const layout = getImageLayout(200, 356, 1000, 1000);
      expect(layout.offsetY).toBeGreaterThan(0);

      // Click at top of container (above image)
      const containerY = 0;
      const imageY = containerY - layout.offsetY;

      // Should be negative (click is above the image)
      expect(imageY).toBeLessThan(0);
    });
  });
});
