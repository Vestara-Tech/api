import { OsService } from '../os/service/os-service.js';

export interface OsPlatform {
  readonly service: OsService;
}

/** OS — Composition root. OS Module service (discovery + desired state + diff + planner). */
export function buildOsPlatform(): OsPlatform {
  return { service: new OsService() };
}
