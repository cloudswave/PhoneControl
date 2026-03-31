/**
 * Calculate the actual displayed image dimensions and offset within the container
 * considering object-fit: contain
 */
export function getImageLayout(
  containerWidth: number,
  containerHeight: number,
  imgWidth: number,
  imgHeight: number
) {
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
