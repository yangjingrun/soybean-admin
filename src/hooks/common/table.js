import { computed, effectScope, onScopeDispose, reactive, shallowRef, watch } from 'vue';
import { useBoolean, useTable } from '@sa/hooks';
import { jsonClone } from '@sa/utils';
import { useAppStore } from '@/store/modules/app';
import { $t } from '@/locales';
const SELECTION_KEY = '__selection__';
const EXPAND_KEY = '__expand__';
export function useNaiveTable(options) {
  const scope = effectScope();
  const appStore = useAppStore();
  const result = useTable({
    ...options,
    getColumnChecks: cols => getColumnChecks(cols, options.getColumnVisible),
    getColumns
  });
  // calculate the total width of the table this is used for horizontal scrolling
  const scrollX = computed(() => {
    return result.columns.value.reduce((acc, column) => {
      return acc + Number(column.width ?? column.minWidth ?? 120);
    }, 0);
  });
  scope.run(() => {
    watch(
      () => appStore.locale,
      () => {
        result.reloadColumns();
      }
    );
  });
  onScopeDispose(() => {
    scope.stop();
  });
  return {
    ...result,
    scrollX
  };
}
export function useNaivePaginatedTable(options) {
  const scope = effectScope();
  const appStore = useAppStore();
  const isMobile = computed(() => appStore.isMobile);
  const showTotal = computed(() => options.showTotal ?? true);
  const pagination = reactive({
    page: 1,
    pageSize: 10,
    itemCount: 0,
    showSizePicker: true,
    pageSizes: [10, 15, 20, 25, 30],
    prefix: showTotal.value ? page => $t('datatable.itemCount', { total: page.itemCount }) : undefined,
    onUpdatePage(page) {
      pagination.page = page;
    },
    onUpdatePageSize(pageSize) {
      pagination.pageSize = pageSize;
      pagination.page = 1;
    },
    ...options.paginationProps
  });
  // this is for mobile, if the system does not support mobile, you can use `pagination` directly
  const mobilePagination = computed(() => {
    const p = {
      ...pagination,
      pageSlot: isMobile.value ? 3 : 9,
      prefix: !isMobile.value && showTotal.value ? pagination.prefix : undefined
    };
    return p;
  });
  const paginationParams = computed(() => {
    const { page, pageSize } = pagination;
    return {
      page,
      pageSize
    };
  });
  const result = useTable({
    ...options,
    pagination: true,
    getColumnChecks: cols => getColumnChecks(cols, options.getColumnVisible),
    getColumns,
    onFetched: data => {
      pagination.itemCount = data.total;
      pagination.pageSize = data.pageSize;
    }
  });
  async function getDataByPage(page = 1) {
    if (page !== pagination.page) {
      pagination.page = page;
      return;
    }
    await result.getData();
  }
  scope.run(() => {
    watch(
      () => appStore.locale,
      () => {
        result.reloadColumns();
      }
    );
    watch(paginationParams, async newVal => {
      await options.onPaginationParamsChange?.(newVal);
      await result.getData();
    });
  });
  onScopeDispose(() => {
    scope.stop();
  });
  return {
    ...result,
    getDataByPage,
    pagination,
    mobilePagination
  };
}
export function useTableOperate(data, idKey, getData) {
  const { bool: drawerVisible, setTrue: openDrawer, setFalse: closeDrawer } = useBoolean();
  const operateType = shallowRef('add');
  function handleAdd() {
    operateType.value = 'add';
    openDrawer();
  }
  /** the editing row data */
  const editingData = shallowRef(null);
  function handleEdit(id) {
    operateType.value = 'edit';
    const findItem = data.value.find(item => item[idKey] === id) || null;
    editingData.value = jsonClone(findItem);
    openDrawer();
  }
  /** the checked row keys of table */
  const checkedRowKeys = shallowRef([]);
  /** the hook after the batch delete operation is completed */
  async function onBatchDeleted() {
    window.$message?.success($t('common.deleteSuccess'));
    checkedRowKeys.value = [];
    await getData();
  }
  /** the hook after the delete operation is completed */
  async function onDeleted() {
    window.$message?.success($t('common.deleteSuccess'));
    await getData();
  }
  return {
    drawerVisible,
    openDrawer,
    closeDrawer,
    operateType,
    handleAdd,
    editingData,
    handleEdit,
    checkedRowKeys,
    onBatchDeleted,
    onDeleted
  };
}
export function defaultTransform(response) {
  const { data, error } = response;
  if (!error) {
    const { records, current, size, total } = data;
    return {
      data: records,
      pageNum: current,
      pageSize: size,
      total
    };
  }
  return {
    data: [],
    pageNum: 1,
    pageSize: 10,
    total: 0
  };
}
function getColumnChecks(cols, getColumnVisible) {
  const checks = [];
  cols.forEach(column => {
    if (isTableColumnHasKey(column)) {
      checks.push({
        key: column.key,
        title: column.title,
        checked: true,
        fixed: column.fixed ?? 'unFixed',
        visible: getColumnVisible?.(column) ?? true
      });
    } else if (column.type === 'selection') {
      checks.push({
        key: SELECTION_KEY,
        title: $t('common.check'),
        checked: true,
        fixed: column.fixed ?? 'unFixed',
        visible: getColumnVisible?.(column) ?? false
      });
    } else if (column.type === 'expand') {
      checks.push({
        key: EXPAND_KEY,
        title: $t('common.expandColumn'),
        checked: true,
        fixed: column.fixed ?? 'unFixed',
        visible: getColumnVisible?.(column) ?? false
      });
    }
  });
  return checks;
}
function getColumns(cols, checks) {
  const columnMap = new Map();
  cols.forEach(column => {
    if (isTableColumnHasKey(column)) {
      columnMap.set(column.key, column);
    } else if (column.type === 'selection') {
      columnMap.set(SELECTION_KEY, column);
    } else if (column.type === 'expand') {
      columnMap.set(EXPAND_KEY, column);
    }
  });
  const filteredColumns = checks
    .filter(item => item.checked)
    .map(check => {
      return {
        ...columnMap.get(check.key),
        fixed: check.fixed
      };
    });
  return filteredColumns;
}
export function isTableColumnHasKey(column) {
  return Boolean(column.key);
}
