import { lastValueFrom, map } from 'rxjs';
import {
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  toDataFrame,
  TableData,
  FieldType,
  standardTransformers,
  DataFrame,
  TimeRange,
} from '@grafana/data';

import { BackendSrvRequest, getBackendSrv } from '@grafana/runtime';

import {
  ColumnDataType,
  DataframeQuery,
  TableMetadata,
  TableMetadataList,
  TableDataRows,
  isValidQuery,
  QueryColumn,
  ColumnFilter,
} from './types';

interface TestingStatus {
  message?: string;
  status: string;
}

export class DataFrameDataSource extends DataSourceApi<DataframeQuery> {
  constructor(private instanceSettings: DataSourceInstanceSettings) {
    super(instanceSettings);
  }

  async query(options: DataQueryRequest<DataframeQuery>): Promise<DataQueryResponse> {
    const validTargets = options.targets.filter(isValidQuery);

    const data = await Promise.all(
      validTargets.map(async ({ columns, refId, tableId }) => {
        const tableData = true
          ? // TODO: Remove once decimation is added
            await this.getTableData(tableId, columns, options.range)
          : await this.getDecimatedTableData(tableId, columns, options.range, options.maxDataPoints);

        const frame = toDataFrame({
          refId,
          name: tableId,
          columns: columns.map(({ name }) => ({ text: name })),
          rows: tableData.frame.data,
        } as TableData);

        return this.convertDataFrameFields(frame, columns);
      })
    );

    return { data };
  }

  async getTableMetadata(id: string) {
    return lastValueFrom(this.fetch<TableMetadata>('GET', `tables/${id}`).pipe(map((res) => res.data)));
  }

  async getTableData(id: string, columns: QueryColumn[], timeRange: TimeRange) {
    const filters: ColumnFilter[] = this.constructTimeFilters(columns, timeRange);

    return lastValueFrom(
      this.fetch<TableDataRows>('POST', `tables/${id}/query-data`, {
        data: { columns: columns.map((c) => c.name), filters },
      }).pipe(map((res) => res.data))
    );
  }

  async getDecimatedTableData(id: string, columns: QueryColumn[], timeRange: TimeRange, intervals = 1000) {
    const filters: ColumnFilter[] = this.constructTimeFilters(columns, timeRange);

    return lastValueFrom(
      this.fetch<TableDataRows>('POST', `tables/${id}/query-decimated-data`, {
        data: {
          columns: columns.map((c) => c.name),
          filters,
          decimation: {
            intervals,
            method: 'MAX_MIN',
            yColumns: this.getNumericColumns(columns).map((c) => c.name),
          },
        },
      }).pipe(map((res) => res.data))
    );
  }

  async testDatasource(): Promise<TestingStatus> {
    return lastValueFrom(
      this.fetch<TableMetadataList>('GET', 'tables').pipe(
        map((_) => {
          return { status: 'success', message: 'Data source connected and authentication successful!' };
        })
      )
    );
  }

  private getFieldType(dataType: ColumnDataType): FieldType {
    switch (dataType) {
      case 'BOOL':
        return FieldType.boolean;
      case 'STRING':
        return FieldType.string;
      case 'TIMESTAMP':
        return FieldType.time;
      default:
        return FieldType.number;
    }
  }

  private convertDataFrameFields(frame: DataFrame, columns: QueryColumn[]) {
    const transformer = standardTransformers.convertFieldTypeTransformer.transformer;
    const conversions = columns.map(({ name, dataType }) => ({
      targetField: name,
      destinationType: this.getFieldType(dataType),
      dateFormat: 'YYYY-MM-DDTHH:mm:ss.SZ',
    }));
    return transformer({ conversions })([frame])[0];
  }

  private constructTimeFilters(columns: QueryColumn[], timeRange: TimeRange): ColumnFilter[] {
    const timeIndex = columns.find((c) => c.dataType === 'TIMESTAMP' && c.columnType === 'INDEX');

    if (!timeIndex) {
      return [];
    }

    return [
      { column: timeIndex.name, operation: 'GREATER_THAN_EQUALS', value: timeRange.from.toISOString() },
      { column: timeIndex.name, operation: 'LESS_THAN_EQUALS', value: timeRange.to.toISOString() },
    ];
  }

  private getNumericColumns(columns: QueryColumn[]) {
    return columns.filter(this.isColumnNumeric);
  }

  private isColumnNumeric(column: QueryColumn) {
    switch (column.dataType) {
      case 'FLOAT32':
      case 'FLOAT64':
      case 'INT32':
      case 'INT64':
      case 'TIMESTAMP':
        return true;
      default:
        return false;
    }
  }

  private fetch<T>(method: string, route: string, config?: Omit<BackendSrvRequest, 'url' | 'method'>) {
    const url = `${this.instanceSettings.url}/v1/${route}`;
    const req: BackendSrvRequest = {
      url,
      method,
      ...config,
    };

    return getBackendSrv().fetch<T>(req);
  }
}
