// ffifapi network-capture content script.
//
// Runs at document_start in ALL frames so the fetch/XHR/WebSocket hook is
// installed in the page world BEFORE the page's own code runs — critical for
// the game frame (cdnen.cgg4game.com/.../richman2Release), which opens a
// persistent WebSocket at load. A late (post-load) hook misses that socket
// entirely; this catches it from the open.
//
// Captures are buffered on window.__ffcap in the page world; read them back with
//   cli.py exec-js file=<reader> frames=1
// which walks each frame and returns its buffer. This is an investigation tool;
// scope the manifest match down (or gate it) before treating it as production.
(function () {
	try {
		var code = '(' + function () {
			if (window.__ffcapInstalled) return;
			window.__ffcapInstalled = true;
			window.__ffcap = [];
			// base64 of the first `cap` bytes of an ArrayBuffer, for offline
			// inspection of binary WS frames (protobuf/JSON/compressed?).
			window.__ff_b64 = function (buf, cap) {
				try {
					var u8 = new Uint8Array(buf), n = Math.min(u8.length, cap || u8.length);
					var CH = 0x8000, parts = [];
					for (var i = 0; i < n; i += CH) parts.push(String.fromCharCode.apply(null, u8.subarray(i, i + CH)));
					return btoa(parts.join(''));
				} catch (e) { return '<b64err>'; }
			};
			var push = function (o) {
				try {
					o.t = Date.now();
					window.__ffcap.push(o);
					if (window.__ffcap.length > 800) window.__ffcap.shift();
				} catch (e) {}
			};
			if (window.fetch) {
				var of = window.fetch;
				window.fetch = function () {
					var a = arguments, url = (a[0] && a[0].url) ? a[0].url : ('' + a[0]);
					var p = of.apply(this, a);
					try { p.then(function (r) {
						try { r.clone().text().then(function (t) {
							push({ k: 'fetch', url: url, body: ('' + t).slice(0, 8000) });
						}, function () {}); } catch (e) {}
					}); } catch (e) {}
					return p;
				};
			}
			var xo = XMLHttpRequest.prototype.open, xs = XMLHttpRequest.prototype.send;
			XMLHttpRequest.prototype.open = function (m, u) { this.__m = m; this.__u = u; return xo.apply(this, arguments); };
			XMLHttpRequest.prototype.send = function (b) {
				var x = this;
				try { x.addEventListener('load', function () {
					var rt = ''; try { rt = x.responseText; } catch (e) { rt = '<' + (x.responseType || '') + '>'; }
					push({ k: 'xhr', url: '' + x.__u, m: x.__m, body: ('' + rt).slice(0, 8000) });
				}); } catch (e) {}
				return xs.apply(this, arguments);
			};
			if (window.WebSocket) {
				var OW = window.WebSocket;
				var NW = function (u, p) {
					var w = (p !== undefined) ? new OW(u, p) : new OW(u);
					push({ k: 'ws-open', url: '' + u });
					// Stash the live game socket so its own send() can be replayed
					// (e.g. to request market data without driving the UI).
					try { if (('' + u).indexOf('cgg4game') > -1) window.__ffws = w; } catch (e) {}
					try { w.addEventListener('message', function (ev) {
						var d = ev.data;
						if (typeof d === 'string') push({ k: 'ws', url: '' + u, body: d.slice(0, 8000) });
						else if (d instanceof ArrayBuffer) push({ k: 'ws-bin', url: '' + u, n: d.byteLength, b64: __ff_b64(d, 260000) });
						else push({ k: 'ws-blob', url: '' + u });
					}); } catch (e) {}
					try {
						var osend = w.send;
						w.send = function (m) {
							try {
								var o = { k: 'ws-send', url: '' + u };
								if (typeof m === 'string') { o.body = m.slice(0, 2000); }
								else if (m instanceof ArrayBuffer) { o.body = '<bin ' + m.byteLength + '>'; o.b64 = __ff_b64(m, 4000); }
								else if (m && m.buffer instanceof ArrayBuffer) { o.body = '<bin ' + (m.byteLength || 0) + '>'; o.b64 = __ff_b64(m.buffer, 4000); }
								else { o.body = '<bin ' + ((m && (m.byteLength || m.size)) || 0) + '>'; }
								push(o);
							} catch (e) {}
							return osend.apply(this, arguments);
						};
					} catch (e) {}
					return w;
				};
				NW.prototype = OW.prototype;
				NW.CONNECTING = OW.CONNECTING; NW.OPEN = OW.OPEN; NW.CLOSING = OW.CLOSING; NW.CLOSED = OW.CLOSED;
				try { window.WebSocket = NW; } catch (e) {}
			}
		}.toString() + ')();';
		var s = document.createElement('script');
		s.textContent = code;
		(document.documentElement || document.head || document.body).appendChild(s);
		s.remove();
	} catch (e) {}
})();
