import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

interface Column {
  column_name: string;
  data_type: string;
  is_nullable: boolean;
  is_primary_key: boolean;
}

interface Table {
  table_name: string;
  columns: Column[];
}

interface Policy {
  policyname: string;
  tablename: string;
  operation: string;
  definition: string;
  schemaname: string;
  roles: string[];
  cmd: string;
  qual: string;
  with_check: string;
}

interface Function {
  routine_name: string;
  routine_type: string;
  routine_definition: string;
}

interface ForeignKey {
  constraint_name: string;
  table_name: string;
  column_name: string;
  foreign_table_name: string;
  foreign_column_name: string;
}

interface Index {
  index_name: string;
  table_name: string;
  column_name: string;
  is_unique: boolean;
}

interface Trigger {
  trigger_name: string;
  table_name: string;
  trigger_type: string;
  trigger_timing: string;
  trigger_definition: string;
}

interface View {
  view_name: string;
  view_definition: string;
  is_updatable: boolean;
}

interface Extension {
  name: string;
  version: string;
  description: string;
}

const supabaseUrl = 'https://tcodwthqvujxxcybctus.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY no está definida en el archivo .env');
  process.exit(1);
}

async function generateDatabaseContext() {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey as string);

    const { data: tablesResult, error: tablesError } = await supabase
      .rpc('get_tables');
    if (tablesError) throw tablesError;
    const tables = (tablesResult || []) as Table[];

    const { data: policiesResult, error: policiesError } = await supabase
      .rpc('get_policies');
    if (policiesError) throw policiesError;
    const policies = (policiesResult || []) as Policy[];

    const { data: functionsResult, error: functionsError } = await supabase
      .rpc('get_functions');
    if (functionsError) throw functionsError;
    const functions = (functionsResult || []) as Function[];

    const { data: foreignKeysResult } = await supabase.rpc('get_foreign_keys');
    const foreignKeys = foreignKeysResult || [];

    const { data: indexesResult } = await supabase.rpc('get_indexes');
    const indexes = indexesResult || [];

    const { data: triggersResult } = await supabase.rpc('get_triggers');
    const triggers = triggersResult || [];

    const { data: viewsResult } = await supabase.rpc('get_views');
    const views = viewsResult || [];

    const { data: extensionsResult } = await supabase.rpc('get_extensions');
    const extensions = extensionsResult || [];

    const context = {
      tables: tables.map((table: Table) => ({
        name: table.table_name,
        columns: table.columns.map(column => ({
          name: column.column_name,
          type: column.data_type,
          nullable: column.is_nullable,
          isPrimaryKey: column.is_primary_key
        }))
      })),
      policies: policies.map((policy: Policy) => ({
        name: policy.policyname,
        table: policy.tablename,
        action: policy.operation,
        definition: policy.definition,
        schema: policy.schemaname,
        roles: policy.roles,
        command: policy.cmd,
        conditions: {
          qual: policy.qual,
          with_check: policy.with_check
        }
      })),
      functions: functions.map((func: Function) => ({
        name: func.routine_name,
        type: func.routine_type,
        definition: func.routine_definition,
      })),
      foreignKeys: foreignKeys.map((fk: ForeignKey) => ({
        name: fk.constraint_name,
        table: fk.table_name,
        column: fk.column_name,
        referencedTable: fk.foreign_table_name,
        referencedColumn: fk.foreign_column_name
      })),
      indexes: indexes.map((idx: Index) => ({
        name: idx.index_name,
        table: idx.table_name,
        column: idx.column_name,
        isUnique: idx.is_unique
      })),
      triggers: triggers.map((trg: Trigger) => ({
        name: trg.trigger_name,
        table: trg.table_name,
        type: trg.trigger_type,
        timing: trg.trigger_timing,
        definition: trg.trigger_definition
      })),
      views: views.map((view: View) => ({
        name: view.view_name,
        definition: view.view_definition,
        isUpdatable: view.is_updatable
      })),
      extensions: extensions.map((ext: Extension) => ({
        name: ext.name,
        version: ext.version,
        description: ext.description
      })),
      metadata: {
        generatedAt: new Date().toISOString(),
        supabaseVersion: '2.x', // Podrías obtener esto de manera dinámica
        databaseVersion: 'PostgreSQL 15.x', // Podrías obtener esto de manera dinámica
        environment: process.env.NODE_ENV || 'development'
      },
      lastUpdated: new Date().toISOString(),
    };

    const dir = path.join(process.cwd(), 'supabase');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const outputPath = path.join(dir, 'database-context.json');
    fs.writeFileSync(
      outputPath,
      JSON.stringify(context, null, 2)
    );

    console.log('✅ Contexto de base de datos generado exitosamente en:', outputPath);
  } catch (error) {
    console.error('❌ Error generando el contexto:', error);
    process.exit(1);
  }
}

generateDatabaseContext(); 