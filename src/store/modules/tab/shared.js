import { $t } from '@/locales';
import { getRoutePath } from '@/router/elegant/transform';
/**
 * Get all tabs
 *
 * @param tabs Tabs
 * @param homeTab Home tab
 */
export function getAllTabs(tabs, homeTab) {
  if (!homeTab) {
    return [];
  }
  const filterHomeTabs = tabs.filter(tab => tab.id !== homeTab.id);
  const fixedTabs = filterHomeTabs.filter(isFixedTab).sort((a, b) => a.fixedIndex - b.fixedIndex);
  const remainTabs = filterHomeTabs.filter(tab => !isFixedTab(tab));
  const allTabs = [homeTab, ...fixedTabs, ...remainTabs];
  return updateTabsLabel(allTabs);
}
/**
 * Is fixed tab
 *
 * @param tab
 */
function isFixedTab(tab) {
  return tab.fixedIndex !== undefined && tab.fixedIndex !== null;
}
/**
 * Get tab id by route
 *
 * @param route
 */
export function getTabIdByRoute(route) {
  const { path, query = {}, meta } = route;
  let id = path;
  if (meta.multiTab) {
    const queryKeys = Object.keys(query).sort();
    const qs = queryKeys.map(key => `${key}=${query[key]}`).join('&');
    id = `${path}?${qs}`;
  }
  return id;
}
/**
 * Get tab by route
 *
 * @param route
 */
export function getTabByRoute(route) {
  const { name, path, fullPath = path, meta } = route;
  const { title, i18nKey, fixedIndexInTab } = meta;
  // Get icon and localIcon from getRouteIcons function
  const { icon, localIcon } = getRouteIcons(route);
  const label = i18nKey ? $t(i18nKey) : title;
  const tab = {
    id: getTabIdByRoute(route),
    label,
    routeKey: name,
    routePath: path,
    fullPath,
    fixedIndex: fixedIndexInTab,
    icon,
    localIcon,
    i18nKey
  };
  return tab;
}
/**
 * The vue router will automatically merge the meta of all matched items, and the icons here may be affected by other
 * matching items, so they need to be processed separately
 *
 * @param route
 */
export function getRouteIcons(route) {
  // Set default value for icon at the beginning
  let icon = route?.meta?.icon || import.meta.env.VITE_MENU_ICON;
  let localIcon = route?.meta?.localIcon;
  // Route.matched only appears when there are multiple matches,so check if route.matched exists
  if (route.matched) {
    // Find the meta of the current route from matched
    const currentRoute = route.matched.find(r => r.name === route.name);
    // If icon exists in currentRoute.meta, it will overwrite the default value
    icon = currentRoute?.meta?.icon || icon;
    localIcon = currentRoute?.meta?.localIcon;
  }
  return { icon, localIcon };
}
/**
 * Get default home tab
 *
 * @param router
 * @param homeRouteName routeHome in useRouteStore
 */
export function getDefaultHomeTab(router, homeRouteName) {
  const homeRoutePath = getRoutePath(homeRouteName);
  const i18nLabel = $t(`route.${homeRouteName}`);
  let homeTab = {
    id: getRoutePath(homeRouteName),
    label: i18nLabel || homeRouteName,
    routeKey: homeRouteName,
    routePath: homeRoutePath,
    fullPath: homeRoutePath
  };
  const routes = router.getRoutes();
  const homeRoute = routes.find(route => route.name === homeRouteName);
  if (homeRoute) {
    homeTab = getTabByRoute(homeRoute);
  }
  return homeTab;
}
/**
 * Is tab in tabs
 *
 * @param tab
 * @param tabs
 */
export function isTabInTabs(tabId, tabs) {
  return tabs.some(tab => tab.id === tabId);
}
/**
 * Filter tabs by id
 *
 * @param tabId
 * @param tabs
 */
export function filterTabsById(tabId, tabs) {
  return tabs.filter(tab => tab.id !== tabId);
}
/**
 * Filter tabs by ids
 *
 * @param tabIds
 * @param tabs
 */
export function filterTabsByIds(tabIds, tabs) {
  return tabs.filter(tab => !tabIds.includes(tab.id));
}
/**
 * extract tabs by all routes
 *
 * @param router
 * @param tabs
 */
export function extractTabsByAllRoutes(router, tabs) {
  const routes = router.getRoutes();
  const routeNames = routes.map(route => route.name);
  return tabs.filter(tab => routeNames.includes(tab.routeKey));
}
/**
 * Get fixed tabs
 *
 * @param tabs
 */
export function getFixedTabs(tabs) {
  return tabs.filter(isFixedTab);
}
/**
 * Get fixed tab ids
 *
 * @param tabs
 */
export function getFixedTabIds(tabs) {
  const fixedTabs = getFixedTabs(tabs);
  return fixedTabs.map(tab => tab.id);
}
/**
 * Reorder fixed tabs fixedIndex
 *
 * @param tabs
 */
export function reorderFixedTabs(tabs) {
  const fixedTabs = getFixedTabs(tabs);
  fixedTabs.forEach((t, i) => {
    t.fixedIndex = i;
  });
}
/**
 * Update tabs label
 *
 * @param tabs
 */
function updateTabsLabel(tabs) {
  const updated = tabs.map(tab => ({
    ...tab,
    label: tab.newLabel || tab.oldLabel || tab.label
  }));
  return updated;
}
/**
 * Update tab by i18n key
 *
 * @param tab
 */
export function updateTabByI18nKey(tab) {
  const { i18nKey, label } = tab;
  return {
    ...tab,
    label: i18nKey ? $t(i18nKey) : label
  };
}
/**
 * Update tabs by i18n key
 *
 * @param tabs
 */
export function updateTabsByI18nKey(tabs) {
  return tabs.map(tab => updateTabByI18nKey(tab));
}
/**
 * find tab by route name
 *
 * @param name
 * @param tabs
 */
export function findTabByRouteName(name, tabs) {
  const routePath = getRoutePath(name);
  const tabId = routePath;
  const multiTabId = `${routePath}?`;
  return tabs.find(tab => tab.id === tabId || tab.id.startsWith(multiTabId));
}
