import { h } from 'vue';
/**
 * Svg icon render hook
 *
 * @param SvgIcon Svg icon component
 */
export default function useSvgIconRender(SvgIcon) {
  /**
   * Svg icon VNode
   *
   * @param config
   */
  const SvgIconVNode = config => {
    const { color, fontSize, icon, localIcon } = config;
    const style = {};
    if (color) {
      style.color = color;
    }
    if (fontSize) {
      style.fontSize = `${fontSize}px`;
    }
    if (!icon && !localIcon) {
      return undefined;
    }
    return () => h(SvgIcon, { icon, localIcon, style });
  };
  return {
    SvgIconVNode
  };
}
