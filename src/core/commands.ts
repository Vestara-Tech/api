import type { RequestContext } from './context.js';

export interface Command {
  readonly type: string;
  readonly payload: unknown;
}

export interface CommandResult {
  readonly ok: true;
  readonly commandType: string;
  readonly operationId?: string;
  readonly result?: unknown;
}

export type CommandHandler<T extends Command = Command> = (command: T, ctx: RequestContext) => Promise<CommandResult>;

export class CommandBus {
  private readonly handlers = new Map<string, CommandHandler>();

  register(commandType: string, handler: CommandHandler): void {
    this.handlers.set(commandType, handler);
  }

  has(commandType: string): boolean {
    return this.handlers.has(commandType);
  }

  async dispatch(command: Command, ctx: RequestContext): Promise<CommandResult> {
    const handler = this.handlers.get(command.type);
    if (!handler) throw new Error(`No command handler registered for "${command.type}"`);
    return handler(command, ctx);
  }

  registeredTypes(): readonly string[] {
    return [...this.handlers.keys()].sort();
  }
}
