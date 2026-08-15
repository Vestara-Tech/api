import { conflict, notFound } from '../../core/errors.js';
import type { DatabaseConnection, DatabaseDefinition } from '../contracts.js';

/** DB-008 — definition store + connection store. */
export class DatabaseStore {
  private readonly definitions = new Map<string, DatabaseDefinition>();
  private readonly connections = new Map<string, DatabaseConnection>();

  createDefinition(definition: DatabaseDefinition): DatabaseDefinition {
    if (this.definitions.has(definition.id)) throw conflict(`Database definition "${definition.id}" already exists`);
    this.definitions.set(definition.id, definition);
    return definition;
  }

  getDefinition(id: string): DatabaseDefinition {
    const definition = this.definitions.get(id);
    if (!definition) throw notFound(`Database definition "${id}" not found`);
    return definition;
  }

  listDefinitions(): readonly DatabaseDefinition[] {
    return [...this.definitions.values()];
  }

  saveDefinition(definition: DatabaseDefinition): DatabaseDefinition {
    this.definitions.set(definition.id, { ...definition, updatedAt: new Date().toISOString() });
    return this.definitions.get(definition.id)!;
  }

  registerConnection(connection: DatabaseConnection): DatabaseConnection {
    this.connections.set(connection.id, connection);
    return connection;
  }

  getConnection(id: string): DatabaseConnection {
    const connection = this.connections.get(id);
    if (!connection) throw notFound(`Database connection "${id}" not found`);
    return connection;
  }

  listConnections(): readonly DatabaseConnection[] {
    return [...this.connections.values()];
  }
}
