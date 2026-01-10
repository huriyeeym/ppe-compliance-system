"""
WebSocket endpoints for real-time notifications
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from typing import List, Dict, Set
import json
import asyncio
from datetime import datetime

from backend.utils.logger import logger
from backend.database import schemas


router = APIRouter(prefix="/ws", tags=["WebSocket"])


class ConnectionManager:
    """
    Manages WebSocket connections and broadcasts messages to all connected clients
    """
    
    def __init__(self):
        # Store active connections: {websocket: {domain_ids: Set[int], user_id: Optional[int]}}
        self.active_connections: Dict[WebSocket, Dict] = {}
        self.lock = asyncio.Lock()
    
    async def connect(self, websocket: WebSocket, domain_ids: Set[int] = None, user_id: int = None):
        """
        Accept a new WebSocket connection
        
        Args:
            websocket: WebSocket connection
            domain_ids: Set of domain IDs this client is interested in (None = all domains)
            user_id: Optional user ID for user-specific notifications
        """
        await websocket.accept()
        async with self.lock:
            self.active_connections[websocket] = {
                "domain_ids": domain_ids or set(),  # Empty set = all domains
                "user_id": user_id,
                "connected_at": datetime.utcnow()
            }
        logger.info(f"WebSocket client connected. Total connections: {len(self.active_connections)}")
    
    async def disconnect(self, websocket: WebSocket):
        """Remove a WebSocket connection"""
        async with self.lock:
            if websocket in self.active_connections:
                del self.active_connections[websocket]
        logger.info(f"WebSocket client disconnected. Total connections: {len(self.active_connections)}")
    
    async def send_personal_message(self, message: dict, websocket: WebSocket):
        """Send a message to a specific client"""
        try:
            await websocket.send_json(message)
        except Exception as e:
            logger.error(f"Error sending personal message: {e}")
            await self.disconnect(websocket)
    
    async def broadcast(self, message: dict, domain_id: int = None):
        """
        Broadcast a message to all connected clients
        
        Args:
            message: Message dict to broadcast
            domain_id: Optional domain ID to filter recipients (None = all domains)
        """
        disconnected = []
        
        async with self.lock:
            connections = list(self.active_connections.items())
        
        for websocket, info in connections:
            try:
                # Filter by domain_id if specified
                if domain_id is not None:
                    client_domains = info.get("domain_ids", set())
                    # If client has no domain filter (empty set), send to all
                    # Otherwise, only send if domain_id matches
                    if client_domains and domain_id not in client_domains:
                        continue
                
                await websocket.send_json(message)
            except Exception as e:
                logger.error(f"Error broadcasting to client: {e}")
                disconnected.append(websocket)
        
        # Clean up disconnected clients
        for ws in disconnected:
            await self.disconnect(ws)
        
        if disconnected:
            logger.info(f"Cleaned up {len(disconnected)} disconnected clients")
    
    async def broadcast_violation(self, violation: dict):
        """
        Broadcast a violation notification to all relevant clients
        
        Args:
            violation: Violation dict with domain_id
        """
        domain_id = violation.get("domain_id")
        message = {
            "type": "violation",
            "data": violation,
            "timestamp": datetime.utcnow().isoformat()
        }
        await self.broadcast(message, domain_id=domain_id)
        logger.debug(f"Broadcasted violation notification for domain {domain_id}")


# Global connection manager instance
manager = ConnectionManager()


@router.websocket("/notifications")
async def websocket_notifications(
    websocket: WebSocket,
    domain_ids: str = None  # Comma-separated domain IDs (e.g., "1,2,3")
):
    """
    WebSocket endpoint for real-time violation notifications
    
    Query Parameters:
    - domain_ids: Optional comma-separated list of domain IDs to filter (e.g., "1,2,3")
                 If not provided, receives notifications for all domains
    
    Message Format (from server):
    {
        "type": "violation",
        "data": {
            "id": 123,
            "camera_id": 1,
            "domain_id": 1,
            "severity": "critical",
            "missing_ppe": [...],
            "timestamp": "2026-01-06T12:00:00Z",
            ...
        },
        "timestamp": "2026-01-06T12:00:00Z"
    }
    """
    # Parse domain_ids from query parameter
    domain_id_set = None
    if domain_ids:
        try:
            domain_id_set = {int(did.strip()) for did in domain_ids.split(",") if did.strip()}
        except ValueError:
            logger.warning(f"Invalid domain_ids parameter: {domain_ids}")
    
    await manager.connect(websocket, domain_ids=domain_id_set)
    
    try:
        # Send welcome message
        await websocket.send_json({
            "type": "connected",
            "message": "WebSocket connection established",
            "timestamp": datetime.utcnow().isoformat()
        })
        
        # Keep connection alive and handle incoming messages
        while True:
            # Wait for any message from client (ping/pong or other)
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
                # Handle ping/pong or other client messages if needed
                if data == "ping":
                    await websocket.send_json({"type": "pong"})
            except asyncio.TimeoutError:
                # Send keepalive ping
                await websocket.send_json({"type": "keepalive"})
            except WebSocketDisconnect:
                break
                
    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}", exc_info=True)
    finally:
        await manager.disconnect(websocket)


# Export manager for use in other modules
__all__ = ["router", "manager"]

