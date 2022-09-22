import React from 'react';
import { useAsync } from 'react-use';
import { QueryEditorProps, SelectableValue } from '@grafana/data';
import { DataFrameDataSource } from './datasource';
import { Column, DataframeQuery, isValidQuery, QueryColumn } from './types';
import { InlineField, InlineSwitch, Input, MultiSelect, Select } from '@grafana/ui';
import { decimationMethods, defaultDecimationMethod } from './constants';

type Props = QueryEditorProps<DataFrameDataSource, DataframeQuery>;

export const QueryEditor: React.FC<Props> = ({ query, datasource, onChange, onRunQuery }) => {
  const tableMetadata = useAsync(async () => {
    return query.tableId ? await datasource.getTableMetadata(query.tableId) : null;
  }, [query.tableId]);

  const runQueryIfValid = () => isValidQuery(query) && onRunQuery();

  const handleQueryChange = (value: DataframeQuery, runQuery: boolean) => {
    onChange(value);
    if (runQuery) {
      runQueryIfValid();
    }
  };

  const handleIdInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (query.tableId !== e.currentTarget.value) {
      handleQueryChange({ ...query, tableId: e.currentTarget.value, columns: [] }, false);
    }
  };

  const handleColumnChange = (items: Array<SelectableValue<string>>) => {
    const columns = items.map(({ value, dataType, columnType }) => ({ name: value!, dataType, columnType }));
    handleQueryChange({ ...query, columns }, false);
  };

  return (
    <>
      <InlineField label="Id" error="Table does not exist" invalid={!!tableMetadata.error}>
        <Input defaultValue={query.tableId} width={26} onBlur={handleIdInputBlur} />
      </InlineField>
      <InlineField label="Columns" tooltip="Specifies the columns to include in the response data.">
        <MultiSelect
          isLoading={tableMetadata.loading}
          options={columnsToOptions(tableMetadata.value?.columns)}
          onChange={handleColumnChange}
          onBlur={runQueryIfValid}
          value={columnsToOptions(query.columns)}
        />
      </InlineField>
      <InlineField label="Decimation" tooltip="Specifies the method used to decimate the data.">
        <Select
          options={decimationMethods}
          onChange={(item) => handleQueryChange({ ...query, decimationMethod: item.value }, true)}
          value={query.decimationMethod ?? defaultDecimationMethod}
        />
      </InlineField>
      <InlineField label="Filter nulls" tooltip="Filters out null and NaN values before decimating the data.">
        <InlineSwitch
          value={query.filterNulls}
          onChange={(event) => handleQueryChange({ ...query, filterNulls: event.currentTarget.checked }, true)}
        ></InlineSwitch>
      </InlineField>
      <InlineField
        label="Use time range"
        tooltip="Queries only for data within the dashboard time range if the table index is a timestamp. Enable when interacting with your data on a graph."
      >
        <InlineSwitch
          value={query.applyTimeFilters}
          onChange={(event) => handleQueryChange({ ...query, applyTimeFilters: event.currentTarget.checked }, true)}
        ></InlineSwitch>
      </InlineField>
    </>
  );
};

const columnsToOptions = (columns: Column[] | QueryColumn[] = []): Array<SelectableValue<string>> => {
  return columns.map(({ name, dataType, columnType }) => ({ label: name, value: name, dataType, columnType }));
};
