import { DataSourcePlugin } from '@grafana/data';
import { DataFrameDataSource } from './datasource';
import { ConfigEditor } from './ConfigEditor';
import { QueryEditor } from './QueryEditor';

export const plugin = new DataSourcePlugin(DataFrameDataSource)
  .setConfigEditor(ConfigEditor)
  .setQueryEditor(QueryEditor);
