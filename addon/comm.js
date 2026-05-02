


/***********************************************************************************************************************************
* Websocket communication class
***********************************************************************************************************************************/
class Comm {
	
	
	/*******************************************************************************************************************************
	* Comm constructor
	*******************************************************************************************************************************/
	constructor(handler, port, host, protocol) {
		this._handler = handler;
		this._port = port;
		this._host = host;
		this._protocol = protocol;
		this._connected = false;
		this._write_buffer = [ ];
		
		// Set default port if none provided
		if (!this._port) this._port = 7777;
		
		// Set default host if none provided
		if (!this._host) this._host = '127.0.0.1';
		
		// Set default protocol if none provided
		if (!this._protocol) this._protocol = 'ws';
	}
	
	
	/*******************************************************************************************************************************
	* Initiate a new websocket connection
	*******************************************************************************************************************************/
	connect() {
		let _this = this;
		this.webSocket = new WebSocket(this._protocol + '://' + this._host + ':' + this._port);
		this.webSocket.onerror   = function(event) { _this.onWebSocketError(event);   }
		this.webSocket.onopen    = function(event) { _this.onWebSocketOpen(event);    }
		this.webSocket.onclose   = function(event) { _this.onWebSocketClose(event);   }
		this.webSocket.onmessage = function(event) { _this.onWebSocketMessage(event); }
	}
	
	
	/*******************************************************************************************************************************
	* Send a message
	*******************************************************************************************************************************/
	send(msg) {
		msg = JSON.stringify(msg);
		if (this._connected)
		{
			this.webSocket.send(msg);
		}
		else
		{
			this._write_buffer.push(msg);
		}
	}
	
	
	/*******************************************************************************************************************************
	* Websocket error handler
	*******************************************************************************************************************************/
	onWebSocketError(event) {
		logger.error("WebSocket error observed: " + event);
	};
	
	
	/*******************************************************************************************************************************
	* Websocket close handler
	*******************************************************************************************************************************/
	onWebSocketClose(event) {
		logger.info("WebSocket close: " + event);

		this._connected = false;
		let _this = this;
		// Fast retry — may be throttled by Firefox after extended inactivity
		setTimeout(() => { _this.connect(); }, 1000);
		// Reliable fallback: alarm fires every minute even when timers are throttled
		browser.alarms.create('reconnect', { periodInMinutes: 1 });
	};
	
	
	/*******************************************************************************************************************************
	* Websocket open handler
	*******************************************************************************************************************************/
	onWebSocketOpen(event) {
		logger.info("WebSocket open: " + this.webSocket.readyState);
		this._connected = true;
		browser.alarms.clear('reconnect');

		for (let msg of this._write_buffer)
		{
			this.webSocket.send(msg);
		}

		this._write_buffer = [ ];
	};
	
	
	/*******************************************************************************************************************************
	* Websocket message recv handler
	*******************************************************************************************************************************/
	onWebSocketMessage(event) {
		let _this = this;
		let msg = JSON.parse(event.data);
		this._handler.forward(msg).then(function(result) {
			let response = { 'result': result, 'id': msg.id };
			_this.webSocket.send(JSON.stringify(response));
		}).catch(function(err) {
			logger.error('Handler error for cmd ' + msg.cmd + ': ' + err);
			let response = { 'result': null, 'id': msg.id };
			_this.webSocket.send(JSON.stringify(response));
		});
	}
	
	
}

