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
        const tableData = await this.getTableData(tableId, columns);

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

  async getTableData(id: string, columns: QueryColumn[]) {
    const columnNames = columns.map((c) => c.name).join(',');
    return lastValueFrom(
      this.fetch<TableDataRows>('GET', `tables/${id}/data`, { columns: columnNames }).pipe(map((res) => res.data))
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
    }));
    return transformer({ conversions })([frame])[0];
  }

  private fetch<T>(method: string, route: string, params?: Record<string, any>) {
    const url = `${this.instanceSettings.url}/v1/${route}`;
    const req: BackendSrvRequest = {
      url,
      method,
      params,
    };

    return getBackendSrv().fetch<T>(req);
  }
}
