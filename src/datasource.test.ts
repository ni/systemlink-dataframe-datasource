import { of } from 'rxjs';
import { DataQueryRequest, DataSourceInstanceSettings, dateTime, Field, FieldType } from '@grafana/data';
import { BackendSrvRequest, FetchResponse } from '@grafana/runtime';

import { DataframeQuery } from './types';
import { DataFrameDataSource } from './datasource';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => ({ fetch: fetchMock }),
  getTemplateSrv: () => ({ replace: replaceMock }),
}));

const fetchMock = jest.fn<number, [BackendSrvRequest]>();
const replaceMock = jest.fn((a: string, ...rest: any) => a);

let ds: DataFrameDataSource;

beforeEach(() => {
  jest.clearAllMocks();
  const instanceSettings = {
    url: '_',
    name: 'SystemLink Dataframes',
  };
  ds = new DataFrameDataSource(instanceSettings as DataSourceInstanceSettings);
  setupFetchMock(fakeDataResponse);
});

it('should return no data if there are no valid queries', async () => {
  const query = buildQuery([
    { refId: 'A' }, // initial state when creating a panel
    { refId: 'B', tableId: '_' }, // state after entering a table id, but no columns selected
  ]);

  const response = await ds.query(query);

  expect(response.data).toHaveLength(0);
});

it('should return data ignoring invalid queries', async () => {
  const query = buildQuery([
    { refId: 'A', tableId: '_' }, // invalid
    { refId: 'B', tableId: '1', columns: [{ name: 'float', dataType: 'FLOAT32', columnType: 'NORMAL' }] },
  ]);

  await ds.query(query);

  expect(fetchMock).toBeCalledTimes(1);
  expect(fetchMock).toBeCalledWith(expect.objectContaining({ url: '_/v1/tables/1/query-decimated-data' }));
});

it('should return data for multiple targets', async () => {
  const query = buildQuery([
    { refId: 'A', tableId: '1', columns: [{ name: 'int', dataType: 'INT32', columnType: 'NORMAL' }] },
    { refId: 'B', tableId: '2', columns: [{ name: 'float', dataType: 'FLOAT32', columnType: 'NORMAL' }] },
  ]);

  const response = await ds.query(query);

  expect(fetchMock).toBeCalledTimes(2);
  expect(response.data).toHaveLength(2);
});

it('should convert columns to Grafana fields', async () => {
  const query = buildQuery([
    {
      refId: 'A',
      tableId: '_',
      columns: [
        { name: 'int', dataType: 'INT32', columnType: 'INDEX' },
        { name: 'float', dataType: 'FLOAT32', columnType: 'NORMAL' },
        { name: 'string', dataType: 'STRING', columnType: 'NORMAL' },
        { name: 'time', dataType: 'TIMESTAMP', columnType: 'NORMAL' },
        { name: 'bool', dataType: 'BOOL', columnType: 'NORMAL' },
      ],
    },
  ]);

  const response = await ds.query(query);

  const fields = response.data[0].fields as Field[];
  const actual = fields.map(({ name, type, values }) => ({ name, type, values: values.toArray() }));
  expect(actual).toEqual([
    { name: 'int', type: FieldType.number, values: [1, 2] },
    { name: 'float', type: FieldType.number, values: [1.1, 2.2] },
    { name: 'string', type: FieldType.string, values: ['first', 'second'] },
    { name: 'time', type: FieldType.time, values: [1663135260000, 1663135320000] },
    { name: 'bool', type: FieldType.boolean, values: [true, false] },
  ]);
});

it('should automatically apply time filters when index column is a timestamp', async () => {
  const query = buildQuery([
    {
      refId: 'A',
      tableId: '_',
      columns: [{ name: 'time', dataType: 'TIMESTAMP', columnType: 'INDEX' }],
      applyTimeFilters: true,
    },
  ]);
  const from = dateTime('2022-09-14T00:00:00Z');
  const to = dateTime('2022-09-16T00:00:00Z');
  query.range = { from, to, raw: { from, to } };

  await ds.query(query);

  expect(fetchMock).toBeCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        filters: [
          { column: 'time', operation: 'GREATER_THAN_EQUALS', value: from.toISOString() },
          { column: 'time', operation: 'LESS_THAN_EQUALS', value: to.toISOString() },
        ],
      }),
    })
  );
});

it('should apply null and NaN filters', async () => {
  const query = buildQuery([
    {
      refId: 'A',
      tableId: '_',
      columns: [
        { name: 'int', dataType: 'TIMESTAMP', columnType: 'INDEX' },
        { name: 'float', dataType: 'FLOAT32', columnType: 'NULLABLE' },
        { name: 'string', dataType: 'STRING', columnType: 'NULLABLE' },
      ],
      filterNulls: true,
    },
  ]);

  await ds.query(query);

  expect(fetchMock).toBeCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        filters: [
          { column: 'float', operation: 'NOT_EQUALS', value: null },
          { column: 'float', operation: 'NOT_EQUALS', value: 'NaN' },
          { column: 'string', operation: 'NOT_EQUALS', value: null },
        ],
      }),
    })
  );
});

it('should provide decimation parameters correctly', async () => {
  const query = buildQuery([
    {
      refId: 'A',
      tableId: '_',
      columns: [
        { name: 'int', dataType: 'INT32', columnType: 'NORMAL' },
        { name: 'string', dataType: 'STRING', columnType: 'NORMAL' },
        { name: 'float', dataType: 'FLOAT32', columnType: 'NORMAL' },
      ],
      decimationMethod: 'ENTRY_EXIT',
    },
  ]);
  query.maxDataPoints = 300;

  await ds.query(query);

  expect(fetchMock).toBeCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        decimation: { intervals: 300, method: 'ENTRY_EXIT', yColumns: ['int', 'float'] },
      }),
    })
  );
});

it('attempts to replace variables in metadata query', async () => {
  const tableId = '${tableId}';

  await ds.getTableMetadata(tableId);

  expect(replaceMock).toBeCalledTimes(1);
  expect(replaceMock).toHaveBeenCalledWith(tableId);
});

it('attempts to replace variables in data query', async () => {
  const query = buildQuery([
    { refId: 'A', tableId: '${tableId}', columns: [{ name: 'float', dataType: 'FLOAT32', columnType: 'NORMAL' }] },
  ]);

  await ds.query(query);

  expect(replaceMock).toBeCalledTimes(1);
  expect(replaceMock).toHaveBeenCalledWith(query.targets[0].tableId, expect.anything());
});

const buildQuery = (targets: DataframeQuery[]): DataQueryRequest<DataframeQuery> => {
  return {
    ...defaultQuery,
    targets,
  };
};

const setupFetchMock = (response: any, mock?: any) => {
  const defaultMock = () => mock ?? of(createFetchResponse(response));
  fetchMock.mockImplementation(defaultMock);
};

const createFetchResponse = <T>(data: T): FetchResponse<T> => {
  return {
    data,
    status: 200,
    url: 'http://localhost:3000/api/ds/query',
    config: { url: 'http://localhost:3000/api/ds/query' },
    type: 'basic',
    statusText: 'Ok',
    redirected: false,
    headers: {} as unknown as Headers,
    ok: true,
  };
};

const fakeDataResponse = {
  frame: {
    columns: ['int', 'float', 'string', 'time', 'bool'],
    data: [
      ['1', '1.1', 'first', '2022-09-14T06:01:00.0000000Z', true],
      ['2', '2.2', 'second', '2022-09-14T06:02:00.0000000Z', false],
    ],
  },
  totalRowCount: 2,
  continuationToken: '_',
};

const defaultQuery: DataQueryRequest<DataframeQuery> = {
  requestId: '1',
  dashboardId: 0,
  interval: '0',
  intervalMs: 10,
  panelId: 0,
  scopedVars: {},
  range: {
    from: dateTime().subtract(1, 'h'),
    to: dateTime(),
    raw: { from: '1h', to: 'now' },
  },
  timezone: 'browser',
  app: 'explore',
  startTime: 0,
  targets: [],
};
