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
					// Capture the REQUEST (method/headers/body) for API calls —
					// needed to replay auth'd endpoints (headers like PNK-env)
					// and to read state the client pushes in commit bodies.
					var req = null;
					try {
						if (url.indexOf('/gs_api/') > -1 || url.indexOf('get_assets_with_als') > -1 || (url.indexOf('balancy.dev') > -1 && url.indexOf('/saves') > -1)) {
							var init = a[1] || {}, src0 = a[0] || {};
							var hdrs = {}, h = init.headers || src0.headers;
							if (h) {
								if (typeof h.forEach === 'function') h.forEach(function (v, k) { hdrs[k] = v; });
								else if (h.length) { for (var i = 0; i < h.length; i++) hdrs[h[i][0]] = h[i][1]; }
								else for (var k in h) hdrs[k] = h[k];
							}
							var rb = (init.body != null) ? init.body : null; var isSave = (url.indexOf('balancy.dev') > -1 && url.indexOf('/saves') > -1);
							req = { method: init.method || src0.method || 'GET', headers: hdrs, body: null };
							if (rb != null) {
								if (typeof rb === 'string') { req.body = rb.slice(0, isSave ? 2000000 : 60000); if (isSave) { try { window.__ffsave = rb; } catch (e) {} } }
								else if (rb.byteLength !== undefined && !rb.text) {
									// ArrayBuffer / TypedArray — keep bytes as base64.
									req.body = '<bin ' + (rb.byteLength || 0) + '>';
									req.b64 = __ff_b64(rb.buffer || rb, 200000);
								} else if (rb.text || rb instanceof Blob) {
									// Blob (the client commits a compressed/binary Blob).
									// Read it async and back-fill req.b64 on the same object.
									req.body = '<blob ' + (rb.size || 0) + ' ' + (rb.type || '') + '>';
									try { rb.arrayBuffer().then(function (ab) {
										if (isSave) { try { var _t = new TextDecoder().decode(ab); req.body = _t.slice(0, 2000000); window.__ffsave = _t; } catch (e) {} } else { req.b64 = __ff_b64(ab, 200000); }
									}, function () {}); } catch (e) {}
								} else { req.body = ('' + rb).slice(0, 60000); }
							}
						}
					} catch (e) {}
					var p = of.apply(this, a);
					try { p.then(function (r) {
						// Some gs_api responses are BINARY msgpack (the maze /
						// LabyrinthExpedition state), which .text() corrupts to
						// U+FFFD. Capture those as raw bytes (base64) instead.
						try {
							if (url.indexOf('expedition/') > -1 || url.indexOf('labyrinth') > -1) {
								r.clone().arrayBuffer().then(function (ab) {
									var o = { k: 'fetch', url: url,
										body: '<bin ' + (ab.byteLength || 0) + '>',
										b64: __ff_b64(ab, 6000000) };
									if (req) o.req = req;
									push(o);
								}, function () {});
								return;
							}
						} catch (e) {}
						try { r.clone().text().then(function (t) {
							// Keep gs_api responses whole (state loads are big and the
							// chest data can sit past 8000); trim everything else.
							var cap = (url.indexOf('profile/load') > -1) ? 6000000
									: (url.indexOf('get_opponent') > -1) ? 6000000
										: (url.indexOf('/gs_api/') > -1) ? 40000 : 8000;
							var o = { k: 'fetch', url: url, body: ('' + t).slice(0, cap) };
								var _ci = ('' + t).indexOf('"ChestBit"'); if (_ci > -1) o.chestbit = ('' + t).slice(_ci, _ci + 3000);
							// Pin the latest full player-state load so it survives ring-buffer
							// eviction (login fires it once; the battle-pass state reader needs
							// it long after).
							if (url.indexOf('profile/load') > -1) { try { window.__ffprofile = o.body; } catch (e) {} }
							if (req) o.req = req;
							push(o);
						}, function () {}); } catch (e) {}
					}); } catch (e) {}
					return p;
				};
			}
			var xo = XMLHttpRequest.prototype.open, xs = XMLHttpRequest.prototype.send;
			XMLHttpRequest.prototype.open = function (m, u) { this.__m = m; this.__u = u; return xo.apply(this, arguments); };
			XMLHttpRequest.prototype.send = function (b) {
				var x = this;
				// Capture the REQUEST body too, so XHR-based API calls can be
				// replayed the same way the fetch hook allows above.
				var reqBody = null;
				try {
					if (b != null) reqBody = (typeof b === 'string')
						? b.slice(0, 60000) : ('' + b).slice(0, 60000);
				} catch (e) {}
				try { x.addEventListener('load', function () {
					var rt = ''; try { rt = x.responseText; } catch (e) { rt = '<' + (x.responseType || '') + '>'; }
					var o = { k: 'xhr', url: '' + x.__u, m: x.__m, body: ('' + rt).slice(0, 8000) };
					if (reqBody != null) o.req = { method: x.__m, body: reqBody };
					push(o);
				}); } catch (e) {}
				return xs.apply(this, arguments);
			};
			// PA diamond ledger. Every change to the diamond balance arrives as
			// User.getInfo.i['@s.gc'] (the NEW balance) in a reply's `c` cache
			// delta, or in a push. Requests are flat JSON ({...params, reqId,
			// route}), so remembering them by reqId names what each change was
			// for. Each change is handed to the content script (a DOM event, so
			// the game's own window 'message' listeners never see it), which
			// forwards it to the service as it happens: nothing waits in the
			// page to be lost on a reload, and no poller has to re-install it.
			var dg = { reqs: {}, order: [], last: null, td: null };
			var dgText = function (d) {
				try {
					var u8 = (d instanceof ArrayBuffer) ? new Uint8Array(d)
						: new Uint8Array(d.buffer, d.byteOffset || 0, d.byteLength);
					var i = u8.indexOf(123);
					if (i < 0) return null;
					dg.td = dg.td || new TextDecoder();
					return dg.td.decode(u8.subarray(i)).replace(/\0+$/, '');
				} catch (e) { return null; }
			};
			var dgSent = function (m) {
				try {
					if (typeof m === 'string' || !m) return;
					var s = dgText(m); if (!s) return;
					var o = JSON.parse(s); if (o.reqId === undefined) return;
					var p = {}; for (var k in o) if (k !== 'reqId' && k !== 'route') p[k] = o[k];
					dg.reqs[o.reqId] = { route: o.route, p: p };
					dg.order.push(o.reqId);
					if (dg.order.length > 300) delete dg.reqs[dg.order.shift()];
				} catch (e) {}
			};
			// PA purchase log. A reply to a shop BUY route (s.b city/diamond
			// shop, s.d party, s.e party refresh, s.g event, s.i merged-server,
			// s.k garden, s.n diamond buy, s.p diamond unlock) is reported with
			// its request, its awards, and every currency / bag count it moved
			// -- before is the client's cache, which has not taken this frame
			// yet. Hand purchases included. Reads (s.a/c/f/h/j/o) are not buys.
			var PU_BUY = { 's.b': 1, 's.d': 1, 's.e': 1, 's.g': 1, 's.i': 1, 's.k': 1, 's.n': 1, 's.p': 1 };
			var puRecv = function (s) {
				try {
					var m = s.match(/"reqId":(\d+)/);
					var rq = m ? dg.reqs[m[1]] : null;
					if (!rq || !PU_BUY[rq.route] || !window.solar) return;
					var S = window.solar, env = JSON.parse(s), body = ((env || {}).d || {}).d || {};
					var it = S.Config.get('item_json') || {};
					var nm = function (id) { var c = it[id]; try { return c ? S.tr(c.name) : ''; } catch (e) { return ''; } };
					var c = body.c || {}, ui = (c['User.getInfo'] || {}).i || {}, cur = {}, items = {};
					for (var k in ui) {
						if (k.indexOf('@s.') !== 0 || typeof ui[k] !== 'number') continue;
						var f = k.slice(3), b = S.cache.get('User.getInfo', 'i.' + f);
						var pid = (window.PropType && typeof window.PropType[f] === 'number') ? window.PropType[f] : null;
						if (typeof b === 'number' && b !== ui[k]) cur[f] = [String(b), String(ui[k]), pid ? nm(pid) : ''];
					}
					var bl = (c['Bag.getList'] || {}).l || {};
					for (var key in bl) {
						var id = key.split('_@').pop(), v = (bl[key] || {})['@s.num'];
						if (typeof v !== 'number') continue;
						var b0 = 0; try { b0 = window.PropModel.getNum(+id); } catch (e) {}
						if (b0 !== v) items[id] = [b0, v, nm(+id)];
					}
					var row = null, p = rq.p || {};
					var cfg = rq.route === 's.b' ? 'shop_json' : rq.route === 's.g' ? 'festivalShop_json' : null;
					if (cfg && p.id !== undefined) {
						var r = (S.Config.get(cfg) || {})[p.id];
						if (r) row = { shoptype: r.shoptype, propId: r.propId, name: nm(r.propId), needPropId: r.needPropId, need: r.needNum };
					}
					var aw = (body.awds && body.awds.length !== undefined ? body.awds : (body.awds ? [body.awds] : [])).map(function (a) {
						var pid = (a.propId !== undefined) ? a.propId : a.cId; return { propId: pid, num: a.num, name: nm(pid) }; });
					var ev = { t: Date.now(), route: rq.route, p: p, s: (body.s === undefined ? null : body.s),
						msg: body.msg || null, awds: aw, cur: cur, items: items, row: row };
					var txt = JSON.stringify(ev);
					if (txt.length > 16000) { ev.items = {}; ev.awds = ev.awds.slice(0, 20); txt = JSON.stringify(ev); }
					document.dispatchEvent(new CustomEvent('ffifapi-pu', { detail: txt }));
				} catch (e) {}
			};
			var dgRecv = function (d) {
				try {
					if (typeof d === 'string' || !d) return;
					var s = dgText(d);
					if (s && s.indexOf('"reqId"') > -1) puRecv(s);
					if (!s || s.indexOf('"User.getInfo"') < 0 || !/"(@s\.)?gc":/.test(s)) return;
					var env = JSON.parse(s), dd = (env && env.d) || {}, body = dd.d || {};
					var c = body.c || dd.c || {}, i = (c['User.getInfo'] || {}).i || {};
					var after = (i['@s.gc'] !== undefined) ? i['@s.gc'] : i.gc;
					if (typeof after !== 'number') return;
					// Balance before: our own last sighting, else the client's
					// cache (this listener is added before the client's own, so
					// the cache has not taken this frame yet).
					var before = dg.last;
					if (before === null) {
						try { var g = window.solar && window.solar.cache.get('User.getInfo', 'i.gc');
							if (typeof g === 'number') before = g; } catch (e) {}
					}
					dg.last = after;
					if (before === after) return;
					var rq = (body.reqId !== undefined) ? dg.reqs[body.reqId] : null;
					var ev = { t: Date.now(), route: dd.t || (rq && rq.route) || null,
						p: rq ? rq.p : null, reqId: (body.reqId !== undefined) ? body.reqId : null,
						before: before, after: after, awds: body.awds || null };
					var txt = JSON.stringify(ev);
					if (txt.length > 8000) { ev.awds = null; ev.p = null; txt = JSON.stringify(ev); }
					document.dispatchEvent(new CustomEvent('ffifapi-dg', { detail: txt }));
				} catch (e) {}
			};
			if (window.WebSocket) {
				var OW = window.WebSocket;
				var NW = function (u, p) {
					var w = (p !== undefined) ? new OW(u, p) : new OW(u);
					push({ k: 'ws-open', url: '' + u });
					// Stash the live game socket so its own send() can be replayed
					// (e.g. to request market data without driving the UI).
					var game = false;
					try { if (('' + u).indexOf('cgg4game') > -1) { window.__ffws = w; game = true; } } catch (e) {}
					try { w.addEventListener('message', function (ev) {
						var d = ev.data;
						if (game) dgRecv(d);
						if (typeof d === 'string') push({ k: 'ws', url: '' + u, body: d.slice(0, 8000) });
						else if (d instanceof ArrayBuffer) push({ k: 'ws-bin', url: '' + u, n: d.byteLength, b64: __ff_b64(d, 2000000) });
						else push({ k: 'ws-blob', url: '' + u });
					}); } catch (e) {}
					try {
						var osend = w.send;
						w.send = function (m) {
							if (game) dgSent(m);
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
		// The page-world diamond hook above reports here; pass each change on to
		// the background, which sends it to the service unsolicited (buffered
		// there while the service is down).
		document.addEventListener('ffifapi-pu', function (e) {
			try {
				var ev = JSON.parse('' + e.detail);
				browser.runtime.sendMessage({ cmd: 'pa-purchase', ev: ev });
			} catch (err) {}
		});
		document.addEventListener('ffifapi-dg', function (e) {
			try {
				var ev = JSON.parse('' + e.detail);
				browser.runtime.sendMessage({ cmd: 'pa-diamond', ev: ev });
			} catch (err) {}
		});
		var s = document.createElement('script');
		s.textContent = code;
		(document.documentElement || document.head || document.body).appendChild(s);
		s.remove();
	} catch (e) {}
})();
