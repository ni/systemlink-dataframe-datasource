import { DataQuery } from '@grafana/data';

export type QueryColumn = Pick<Column, 'name' | 'dataType'>;

export interface DataframeQuery extends DataQuery {
  tableId?: string;
  columns?: QueryColumn[];
}

type WithRequired<T, K extends keyof T> = T & { [P in K]-?: T[P] };

export function isValidQuery(query: DataframeQuery): query is WithRequired<DataframeQuery, 'tableId' | 'columns'> {
  return Boolean(query.tableId) && Boolean(query.columns?.length);
}

export type ColumnDataType = 'BOOL' | 'INT32' | 'INT64' | 'FLOAT32' | 'FLOAT64' | 'STRING' | 'TIMESTAMP';

export interface Column {
  name: string;
  dataType: ColumnDataType;
  columnType: 'INDEX' | 'NULLABLE' | 'NORMAL';
  properties: Record<string, string>;
}

export interface TableMetadata {
  columns: Column[];
  id: string;
  name: string;
  workspace: string;
}

export interface TableMetadataList {
  tables: TableMetadata[];
  continuationToken: string;
}

export interface TableDataRows {
  frame: { columns: string[]; data: string[][] };
  continuationToken: string;
}
