import type { ApiDefinition } from '../domain/types.js';
import { hashContract } from './hash.js';
import { compileOpenApi } from './openapi.js';
import { compileRouteDefinitions, type CompiledRouteDefinition } from './routes.js';

export const CONTRACT_COMPILER_VERSION = '1.0.0';

export interface CompiledContract {
  readonly definition: ApiDefinition;
  readonly hash: string;
  readonly compilerVersion: string;
  readonly openapi: Record<string, unknown>;
  readonly routes: readonly CompiledRouteDefinition[];
}

export class ContractCompiler {
  readonly version = CONTRACT_COMPILER_VERSION;

  compile(definition: ApiDefinition): CompiledContract {
    const openapi = compileOpenApi(definition);
    const routes = compileRouteDefinitions(definition);
    const hash = hashContract({ openapi, routes }, this.version);
    return { definition, hash, compilerVersion: this.version, openapi, routes };
  }
}
