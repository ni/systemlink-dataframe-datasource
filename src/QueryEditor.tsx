import React from 'react';
import { css } from '@emotion/css';
import { useAsync } from 'react-use';
import { CoreApp, QueryEditorProps, SelectableValue } from '@grafana/data';
import { DataFrameDataSource } from './datasource';
import { Column, DataframeQuery, QueryColumn } from './types';
import { Button, InlineField, Input, MultiSelect } from '@grafana/ui';

type Props = QueryEditorProps<DataFrameDataSource, DataframeQuery>;

export const QueryEditor: React.FC<Props> = ({ app, query, datasource, onChange, onRunQuery }) => {
  const tableMetadata = useAsync(async () => {
    return query.tableId ? await datasource.getTableMetadata(query.tableId) : null;
  }, [query.tableId]);

  const handleIdInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    if (query.tableId !== e.currentTarget.value) {
      onChange({ ...query, tableId: e.currentTarget.value, columns: [] });
    }
  };

  const handleColumnChange = (items: Array<SelectableValue<string>>) => {
    const columns = items.map(({ value, dataType, columnType }) => ({ name: value!, dataType, columnType }));
    onChange({ ...query, columns });
  };

  return (
    <>
      <InlineField label="Id" error="Table does not exist" invalid={!!tableMetadata.error}>
        <Input defaultValue={query.tableId} width={26} onBlur={handleIdInputBlur} />
      </InlineField>
      <InlineField label="Columns">
        <MultiSelect
          isLoading={tableMetadata.loading}
          options={columnsToOptions(tableMetadata.value?.columns)}
          onChange={handleColumnChange}
          value={columnsToOptions(query.columns)}
        />
      </InlineField>
      {app !== CoreApp.Explore && (
        <Button size="sm" icon="play" className={css({ marginTop: 20 })} onClick={onRunQuery}>
          Run query
        </Button>
      )}
    </>
  );
};

const columnsToOptions = (columns: Column[] | QueryColumn[] = []): Array<SelectableValue<string>> => {
  return columns.map(({ name, dataType, columnType }) => ({ label: name, value: name, dataType, columnType }));
};
