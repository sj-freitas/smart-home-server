import {
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  ConnectedSocket,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { BehaviorSubject } from "rxjs";
import { ServerMessage } from "./message";
import { HomeState } from "../services/state/types.zod";
import { StatePersistenceService } from "../services/state/state.persistence.service";
import { ConfigService } from "../config/config-service";

@WebSocketGateway({
  namespace: "/api/state",
  path: "/api/socket.io",
  cors: true,
})
export class HomeStateGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit<Server>
{
  private server!: Server;
  // Effectively state is an in-memory cache as the updates always trigger a change in it.
  // The state gets updated every POLLING_INTERVAL (120s) to sync it. This would not work
  // so well if we had multiple backend instances but that isn't the case.
  private state!: BehaviorSubject<HomeState | null>;
  private activeConnections = 0;
  private pollHandle: NodeJS.Timeout | null = null;

  public get isInitialized(): boolean {
    return Boolean(this.server);
  }

  constructor(
    readonly statePersistenceService: StatePersistenceService,
    private readonly configService: ConfigService,
  ) {}

  async afterInit(server: Server) {
    console.log(`Sockets are Initialized`);
    const home = this.configService.getConfig().home;

    this.server = server;
    this.state = new BehaviorSubject(
      await this.statePersistenceService.getHomeState(home.name),
    );
    this.state.subscribe((state) => this.broadcastSnapshot(state));
  }

  private makeMessage<T>(
    type: ServerMessage<T>["type"],
    payload: T,
  ): ServerMessage<T> {
    return { ts: new Date().toISOString(), type, payload };
  }

  private broadcastSnapshot(state: HomeState | null) {
    if (!state) {
      console.log(`Initial state - can't broadcast.`);
      return;
    }

    const stateMessage = this.makeMessage("snapshot", state);

    // Send the full state as an update.
    this.server.emit("state:update", stateMessage);
  }

  private stopPolling() {
    if (!this.pollHandle) {
      return;
    }
    clearInterval(this.pollHandle);
    this.pollHandle = null;
  }

  public handleConnection(client: Socket) {
    console.log("new client connected", client.id);

    this.activeConnections++;
    // Send immediate snapshot on connect if there's a state
    // This might run before init finished (race-condition)
    if (this.state) {
      const msg = this.makeMessage("snapshot", this.state.value);
      client.emit("state:update", msg);
    }
  }

  public handleDisconnect(client: Socket) {
    this.activeConnections = Math.max(0, this.activeConnections - 1);
    if (this.activeConnections === 0) {
      this.stopPolling();
    }
  }

  public updateState(next: HomeState) {
    this.state.next(next);
  }

  @SubscribeMessage("state:resync")
  handleResync(@ConnectedSocket() client: Socket) {
    client.emit("state:update", this.state.value);

    return { ok: true };
  }
}
