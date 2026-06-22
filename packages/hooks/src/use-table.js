import { computed, ref } from 'vue';
import useBoolean from './use-boolean';
import useLoading from './use-loading';
export default function useTable(options) {
  const { loading, startLoading, endLoading } = useLoading();
  const { bool: empty, setBool: setEmpty } = useBoolean();
  const { api, pagination, transform, columns, getColumnChecks, getColumns, onFetched, immediate = true } = options;
  const data = ref([]);
  const columnChecks = ref(getColumnChecks(columns()));
  const $columns = computed(() => getColumns(columns(), columnChecks.value));
  function reloadColumns() {
    const checkMap = new Map(columnChecks.value.map(col => [col.key, col.checked]));
    const fixedMap = new Map(columnChecks.value.map(col => [col.key, col.fixed]));
    const defaultChecks = getColumnChecks(columns());
    columnChecks.value = defaultChecks.map(col => ({
      ...col,
      checked: checkMap.get(col.key) ?? col.checked,
      fixed: (fixedMap.get(col.key) !== 'unFixed' ? fixedMap.get(col.key) : undefined) ?? col.fixed
    }));
  }
  async function getData() {
    try {
      startLoading();
      const response = await api();
      const transformed = transform(response);
      data.value = getTableData(transformed, pagination);
      setEmpty(data.value.length === 0);
      await onFetched?.(transformed);
    } finally {
      endLoading();
    }
  }
  if (immediate) {
    getData();
  }
  return {
    loading,
    empty,
    data,
    columns: $columns,
    columnChecks,
    reloadColumns,
    getData
  };
}
function getTableData(data, pagination) {
  if (pagination) {
    return data.data;
  }
  return data;
}
