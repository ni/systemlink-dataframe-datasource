import { of } from 'rxjs';
import { DataQueryRequest, DataSourceInstanceSettings, dateTime, PluginType } from '@grafana/data';
import { FetchResponse } from '@grafana/runtime';

import { DataframeQuery } from './types';
import { DataFrameDataSource } from './datasource';

const fetchMock = jest.fn();

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: () => ({ fetch: fetchMock }),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

it('test test', async () => {
  setupFetchMock(fakeDataResponse);

  const ds = new DataFrameDataSource(defaultSettings);
  const response = await ds.query({
    ...defaultQuery,
    targets: [{ refId: 'A', tableId: '123', columns: [{ name: 'col', dataType: 'FLOAT32' }] }],
  });
  expect(response).toBeTruthy();
});

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
    columns: ['int_col', 'float_col', 'text_col'],
    data: [
      ['1', '1.1', 'first'],
      ['2', '2.2', 'second'],
    ],
  },
  totalRowCount: 2,
  continuationToken: '_',
};

const defaultSettings: DataSourceInstanceSettings = {
  id: 0,
  uid: '0',
  type: 'tracing',
  name: 'jaeger',
  url: 'http://grafana.com',
  access: 'proxy',
  meta: {
    id: 'ni-dataframe-datasource',
    name: 'SystemLink Dataframes',
    type: PluginType.datasource,
    info: {} as any,
    module: '',
    baseUrl: '',
  },
  jsonData: {},
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
