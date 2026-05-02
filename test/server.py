from websockets.asyncio.server import serve
from websockets.exceptions import ConnectionClosed
import aioconsole
import asyncio
import json
import time
import sys

port = 7777

class Server:
	
	def __init__(self):
		self._server = None
		self._conn = None
		self._recv_buffer = [ ]
		self._send_buffer = [ ]
	
	def isConnected(self):
		return (self._conn is not None)
	
	async def run(self):
		async with serve(self.recv, "localhost", port) as server:
			self._server = server
			await server.serve_forever()
	
	async def recv(self, conn):
		self._conn = conn
		
		if len(self._send_buffer):
			msg = self._send_buffer.pop()
			self._send_buffer = [ ]
			await self._conn.send(request)
		
		async for msg in conn:
			self._recv_buffer.append(msg)
	
	async def send(self, request):
		while not self.isConnected():
			await asyncio.sleep(0.1)
		
		try:
			await self._conn.send(request)
			while len(self._recv_buffer) == 0:
				await asyncio.sleep(0.1)
			return self._recv_buffer.pop()
		except ConnectionClosed:
			self._conn = None
		except: pass
		
		return False

server = Server()
loop = asyncio.new_event_loop()
			
class Console:
	
	async def run(self):
		id = 1
		while True:
			cmd = await aioconsole.ainput('> ')
			params = { }
			if ' ' in cmd:
				parts = cmd.split(' ', 1)
				cmd = parts.pop(0).strip()
				params = { k.strip(): v.strip() for k, v in [ p.split('=') for p in parts[0].split(',') ] }
			
			print('cp7 ' + cmd + ' ' + str(params))
			
			if cmd == 'exit' or cmd == 'quit': break
			
			if cmd == 'getTabs':
				msg = json.dumps({ 'cmd': 'getTabs', 'id': id })
			elif cmd == 'getCurrentTabViewportSize':
				msg = json.dumps({ 'cmd': 'getCurrentTabViewportSize' })
			elif cmd == 'getCurrentTabDivDimensions':
				msg = json.dumps({ 'cmd': 'getCurrentTabDivDimensions', 'div': params['div'] })
			elif cmd == 'createTab':
				msg = json.dumps({ 'cmd': 'createTab', 'properties': params, 'id': id })
			elif cmd == 'getBrowserInfo':
				msg = json.dumps({ 'cmd': 'getBrowserInfo', 'id': id })
			elif cmd == 'getCurrentWindowInfo':
				msg = json.dumps({ 'cmd': 'getCurrentWindowInfo', 'id': id })
			elif cmd == 'getContextualIdentities':
				msg = json.dumps({ 'cmd': 'getContextualIdentities', 'id': id })
			elif cmd == 'createContextualIdentity':
				msg = json.dumps({ 'cmd': 'createContextualIdentity', 'properties': params, 'id': id })
			else:
				print('Unknown Command')
				continue
			
			print(msg)
			id += 1
			
			response = await server.send(msg)
			print(response)
		
		loop.stop()

#async def echo(websocket):
#	print('sending message')
#	await websocket.send(json.dumps({ 'cmd': 'closeWindow' }))
#	print('message sent')
#	async for message in websocket:
#		print(message)

console = Console()

async def main():
	#async with serve(echo, "localhost", port) as server:
	#	await server.serve_forever()
	
	#await server.run()
	
	async with asyncio.TaskGroup() as tg:
		server_task = tg.create_task(server.run())
		console_task = tg.create_task(console.run())


if __name__ == "__main__":
	loop.run_until_complete(main())



