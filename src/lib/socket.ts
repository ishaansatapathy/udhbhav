import { io, Socket } from "socket.io-client";
import type { CabState, EmergencyAlert } from "./geo";

class SocketManager {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  connect(): Socket {
    if (this.socket?.connected) return this.socket;

    this.socket = io(window.location.origin, {
      transports: ["websocket", "polling"],
      timeout: 5000,
    });

    this.socket.on("connect", () => {
      console.log("Connected to Sahayak server");
      this.reconnectAttempts = 0;
    });

    this.socket.on("disconnect", (reason) => {
      console.log("Disconnected:", reason);
      if (reason === "io server disconnect") {
        this.socket?.connect();
      }
    });

    this.socket.on("connect_error", (error) => {
      console.error("Connection error:", error);
      this.reconnectAttempts++;
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error("Max reconnection attempts reached");
      }
    });

    return this.socket;
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }

  joinStation(stationId: string) {
    this.socket?.emit("join_station", stationId);
  }

  onStationCabs(callback: (cabs: CabState[]) => void) {
    this.socket?.on("station_cabs", callback);
  }

  onCabUpdate(callback: (cab: CabState & { cabId: string }) => void) {
    this.socket?.on("cab_update", callback);
  }

  onCabLeft(callback: (cabId: string) => void) {
    this.socket?.on("cab_left", callback);
  }

  onEmergencyAlert(callback: (alert: EmergencyAlert) => void) {
    this.socket?.on("emergency_alert", callback);
  }

  emitCabPosition(cabId: string, lat: number, lon: number) {
    this.socket?.emit("cab_position", { cabId, lat, lon });
  }

  off(event: string, callback?: (...args: any[]) => void) {
    this.socket?.off(event, callback);
  }
}

export const socketManager = new SocketManager();