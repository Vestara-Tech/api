export type {
  FileCapability,
  FileRisk,
  FileResourceKind,
  FileResource,
  FileWorkspace,
  FileOperationKind,
  FileOperation,
  FileTransactionStatus,
  FileTransaction,
  FileDiffLine,
  FileVersionRecord,
  FileEventType,
  FileEvent,
  FileSearchQuery,
} from './domain/contracts.js';
export { FILE_CAPABILITY_RISK } from './domain/contracts.js';
export { WorkspaceSandbox, matchesPattern } from './domain/workspace-sandbox.js';
export type { ProviderReadResult, ProviderWriteInput } from './providers/file-provider-port.js';
export { providerFileResource } from './providers/file-provider-port.js';
export { MemoryProvider, hashOf } from './providers/memory-provider.js';
export { LocalProvider } from './providers/local-provider.js';
export type { FileServiceOptions } from './service/file-service.js';
export { FileService } from './service/file-service.js';
export { fileToolContributions } from './tools/file-tools.js';
