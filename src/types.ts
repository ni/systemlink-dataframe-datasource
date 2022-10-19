import { DataQuery } from '@grafana/data';

export type QueryColumn = Pick<Column, 'name' | 'dataType' | 'columnType'>;

export interface DataframeQuery extends DataQuery {
  tableId?: string;
  columns?: QueryColumn[];
  decimationMethod?: string;
  filterNulls?: boolean;
  applyTimeFilters?: boolean;
}

export interface ValidDataframeQuery extends DataframeQuery {
  tableId: string;
  columns: QueryColumn[];
}

export function isValidQuery(query: DataframeQuery): query is ValidDataframeQuery {
  return Boolean(query.tableId) && Boolean(query.columns?.length);
}

export type ColumnDataType = 'BOOL' | 'INT32' | 'INT64' | 'FLOAT32' | 'FLOAT64' | 'STRING' | 'TIMESTAMP';

export interface Column {
  name: string;
  dataType: ColumnDataType;
  columnType: 'INDEX' | 'NULLABLE' | 'NORMAL';
  properties: Record<string, string>;
}

export interface ColumnFilter {
  column: string;
  operation:
    | 'EQUALS'
    | 'LESS_THAN'
    | 'LESS_THAN_EQUALS'
    | 'GREATER_THAN'
    | 'GREATER_THAN_EQUALS'
    | 'NOT_EQUALS'
    | 'CONTAINS'
    | 'NOT_CONTAINS';
  value: string | null;
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

export interface SystemLinkError {
  error: {
    args: string[];
    code: number;
    message: string;
    name: string;
  }
}

export function isSystemLinkError(error: any): error is SystemLinkError {
  return Boolean(error?.error?.code) && Boolean(error?.error?.name);
}
