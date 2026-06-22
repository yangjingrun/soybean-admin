import { colord, extend } from 'colord';
import namesPlugin from 'colord/plugins/names';
import mixPlugin from 'colord/plugins/mix';
import labPlugin from 'colord/plugins/lab';
extend([namesPlugin, mixPlugin, labPlugin]);
export function isValidColor(color) {
  return colord(color).isValid();
}
export function getHex(color) {
  return colord(color).toHex();
}
export function getRgb(color) {
  return colord(color).toRgb();
}
export function getHsl(color) {
  return colord(color).toHsl();
}
export function getHsv(color) {
  return colord(color).toHsv();
}
export function getDeltaE(color1, color2) {
  return colord(color1).delta(color2);
}
export function transformHslToHex(color) {
  return colord(color).toHex();
}
/**
 * Add color alpha
 *
 * @param color - Color
 * @param alpha - Alpha (0 - 1)
 */
export function addColorAlpha(color, alpha) {
  return colord(color).alpha(alpha).toHex();
}
/**
 * Mix color
 *
 * @param firstColor - First color
 * @param secondColor - Second color
 * @param ratio - The ratio of the second color (0 - 1)
 */
export function mixColor(firstColor, secondColor, ratio) {
  return colord(firstColor).mix(secondColor, ratio).toHex();
}
/**
 * Transform color with opacity to similar color without opacity
 *
 * @param color - Color
 * @param alpha - Alpha (0 - 1)
 * @param bgColor Background color (usually white or black)
 */
export function transformColorWithOpacity(color, alpha, bgColor = '#ffffff') {
  const originColor = addColorAlpha(color, alpha);
  const { r: oR, g: oG, b: oB } = colord(originColor).toRgb();
  const { r: bgR, g: bgG, b: bgB } = colord(bgColor).toRgb();
  function calRgb(or, bg, al) {
    return bg + (or - bg) * al;
  }
  const resultRgb = {
    r: calRgb(oR, bgR, alpha),
    g: calRgb(oG, bgG, alpha),
    b: calRgb(oB, bgB, alpha)
  };
  return colord(resultRgb).toHex();
}
/**
 * Is white color
 *
 * @param color - Color
 */
export function isWhiteColor(color) {
  return colord(color).isEqual('#ffffff');
}
export { colord };
