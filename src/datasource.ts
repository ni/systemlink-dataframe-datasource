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
  DataQueryError,
} from '@grafana/data';

import { BackendSrvRequest, getBackendSrv, getTemplateSrv, isFetchError } from '@grafana/runtime';

import {
  ColumnDataType,
  DataframeQuery,
  TableMetadata,
  TableMetadataList,
  TableDataRows,
  isValidQuery,
  QueryColumn,
  ColumnFilter,
  ValidDataframeQuery,
} from './types';
import { defaultDecimationMethod } from './constants';

interface TestingStatus {
  message?: string;
  status: string;
}

export class DataFrameDataSource extends DataSourceApi<DataframeQuery> {
  constructor(private instanceSettings: DataSourceInstanceSettings) {
    super(instanceSettings);
  }

  async query(options: DataQueryRequest<DataframeQuery>): Promise<DataQueryResponse> {
    try {
      const validTargets = options.targets.filter(isValidQuery);

      const data = await Promise.all(
        validTargets.map(async (query) => {
          query.tableId = getTemplateSrv().replace(query.tableId, options.scopedVars);
          const tableData = await this.getDecimatedTableData(query, options.range, options.maxDataPoints);

          const frame = toDataFrame({
            refId: query.refId,
            name: query.tableId,
            columns: query.columns.map(({ name }) => ({ text: name })),
            rows: tableData.frame.data,
          } as TableData);

          return this.convertDataFrameFields(frame, query.columns);
        })
      );

      return { data };
    } catch (error) {
      return { data: [], error: this.createDataQueryError(error) };
    }
  }

  async getTableMetadata(id?: string) {
    const resolvedId = getTemplateSrv().replace(id);
    if (!resolvedId) {
      return null;
    }
    return lastValueFrom(this.fetch<TableMetadata>('GET', `tables/${resolvedId}`).pipe(map((res) => res.data)));
  }

  async getDecimatedTableData(query: ValidDataframeQuery, timeRange: TimeRange, intervals = 1000) {
    const filters: ColumnFilter[] = [];

    if (query.applyTimeFilters) {
      filters.push(...this.constructTimeFilters(query.columns, timeRange));
    }

    if (query.filterNulls) {
      filters.push(...this.constructNullFilters(query.columns));
    }

    return lastValueFrom(
      this.fetch<TableDataRows>('POST', `tables/${query.tableId}/query-decimated-data`, {
        data: {
          columns: query.columns.map((c) => c.name),
          filters,
          decimation: {
            intervals,
            method: query.decimationMethod ?? defaultDecimationMethod,
            yColumns: this.getNumericColumns(query.columns).map((c) => c.name),
          },
        },
      }).pipe(map((res) => res.data))
    );
  }

  async queryTables(query: string) {
    var filter = `name.Contains("${query}")`;

    return lastValueFrom(
      this.fetch<TableMetadataList>('POST', 'query-tables', { data: { filter, take: 5 } }).pipe(
        map((res) => res.data.tables)
      )
    );
  }

  async testDatasource(): Promise<TestingStatus> {
    return lastValueFrom(
      this.fetch<TableMetadataList>('GET', 'tables', { params: { take: 1 } }).pipe(
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

  private constructNullFilters(columns: QueryColumn[]): ColumnFilter[] {
    return columns.flatMap(({ name, columnType, dataType }) => {
      const filters: ColumnFilter[] = [];

      if (columnType === 'NULLABLE') {
        filters.push({ column: name, operation: 'NOT_EQUALS', value: null });
      }
      if (dataType === 'FLOAT32' || dataType === 'FLOAT64') {
        filters.push({ column: name, operation: 'NOT_EQUALS', value: 'NaN' });
      }
      return filters;
    });
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

  private createDataQueryError(error: unknown): DataQueryError {
    if (!isFetchError(error)) {
      throw error;
    }

    return {
      message: `${error.status} - ${error.statusText}`,
      status: error.status,
      statusText: error.statusText,
      data: error.data,
    };
  }
}
