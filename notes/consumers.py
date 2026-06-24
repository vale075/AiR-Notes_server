import asyncio

import websockets
from channels.generic.websocket import AsyncWebsocketConsumer


class WhisperProxyConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        # 1. Check Django Authentication
        if self.scope["user"].is_authenticated:
            await self.accept()
            # 2. Connect to the local backend whisperlive server
            self.whisper_url = "ws://host.docker.internal:9090"
            try:
                self.whisper_ws = await websockets.connect(self.whisper_url)
                # Start a background task to read from Whisper and send to Client
                self.listen_task = asyncio.create_task(self.receive_from_whisper())
            except Exception as e:  # noqa: BLE001
                print(f"Failed to connect to Whisper server: {e}")  # noqa: T201
                await self.close()
        else:
            # Reject the connection if not authenticated
            await self.close(code=4003)

    async def disconnect(self, close_code):
        # Clean up tasks and close connection to Whisper backend
        if hasattr(self, "listen_task"):
            self.listen_task.cancel()
        if hasattr(self, "whisper_ws"):
            await self.whisper_ws.close()

    # Receive message from the browser client, forward to Whisper
    async def receive(self, text_data=None, bytes_data=None):
        if hasattr(self, "whisper_ws"):
            if text_data:
                await self.whisper_ws.send(text_data)
            elif bytes_data:
                await self.whisper_ws.send(bytes_data)

    # Background task: Receive from Whisper backend, forward to browser client
    async def receive_from_whisper(self):
        try:
            async for message in self.whisper_ws:
                if isinstance(message, str):
                    await self.send(text_data=message)
                else:
                    await self.send(bytes_data=message)
        except websockets.exceptions.ConnectionClosed:
            pass
        finally:
            await self.close()
