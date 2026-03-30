import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from '../auth/auth.service';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
  namespace: '/analytics',
})
export class AnalyticsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(AnalyticsGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth as Record<string, string>)?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        this.logger.warn(`Client ${client.id} rejected — no token`);
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify<JwtPayload>(token);
      const room = `store:${payload.store_id}`;

      await client.join(room);
      this.logger.log(`Client ${client.id} joined room ${room}`);
    } catch (err) {
      this.logger.warn(`Client ${client.id} rejected — invalid token`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client ${client.id} disconnected`);
  }

  emitNewEvent(storeId: string, event: Record<string, unknown>): void {
    this.server.to(`store:${storeId}`).emit('new_event', event);
  }

  emitLiveVisitorCount(storeId: string, count: number): void {
    this.server.to(`store:${storeId}`).emit('live_visitors', { count });
  }
}
