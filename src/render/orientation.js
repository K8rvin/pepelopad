export function drawOrientedImage(
  ctx,
  image,
  x,
  y,
  width,
  height,
  rotation = 0,
) {
  if (!rotation) {
    ctx.drawImage(image, x, y, width, height);
    return;
  }
  ctx.save();
  ctx.translate(x + width / 2, y + height / 2);
  ctx.rotate(rotation);
  ctx.drawImage(image, -width / 2, -height / 2, width, height);
  ctx.restore();
}
