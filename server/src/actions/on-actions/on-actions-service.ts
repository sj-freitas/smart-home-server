import { OnAction } from "../../config/home.zod";

export interface OnActionHandler<T extends OnAction = OnAction> {
  readonly type: T["type"];
  handle(onAction: T): Promise<void>;
}

export class OnActionsService {
  constructor(private readonly handlers: OnActionHandler[]) {}

  public async handleOnAction(onAction: OnAction): Promise<void> {
    const handler = this.handlers.find((h) => h.type === onAction.type);
    if (!handler) {
      console.error(
        `No handler registered for onAction type: ${onAction.type}`,
      );
      return;
    }
    await handler.handle(onAction);
  }
}
