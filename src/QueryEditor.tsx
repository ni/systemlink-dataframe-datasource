import React from 'react';
import { useAsync } from 'react-use';
import { QueryEditorProps, SelectableValue, toOption } from '@grafana/data';
import { DataFrameDataSource } from './datasource';
import { Column, DataframeQuery, isValidQuery, QueryColumn } from './types';
import { InlineField, InlineSwitch, MultiSelect, Select } from '@grafana/ui';
import { decimationMethods, defaultDecimationMethod } from './constants';
import _ from 'lodash';
import { getTemplateSrv } from '@grafana/runtime';

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

  const handleIdChange = (item: SelectableValue<string>) => {
    if (query.tableId !== item.value) {
      handleQueryChange({ ...query, tableId: item.value, columns: [] }, false);
    }
  };

  const handleColumnChange = (items: Array<SelectableValue<string>>) => {
    const columns = items.map(({ value, dataType, columnType }) => ({ name: value!, dataType, columnType }));
    handleQueryChange({ ...query, columns }, false);
  };

  return (
    <>
      <InlineField label="Id" error="Table does not exist" invalid={!!tableMetadata.error}>
        <Select
          allowCustomValue
          noOptionsMessage="No dashboard variables"
          onChange={handleIdChange}
          options={getVariableOptions()}
          placeholder="Enter table id or variable"
          width={30}
          value={query.tableId ? toOption(query.tableId) : null}
        ></Select>
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

const getVariableOptions = () => {
  return getTemplateSrv()
    .getVariables()
    .map((v) => toOption('$' + v.name));
};
