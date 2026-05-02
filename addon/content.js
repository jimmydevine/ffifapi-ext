


browser.runtime.onMessage.addListener(async (data, sender) => {
	switch (data.cmd)
	{
		case 'getViewportSize':
			let vw = window.innerWidth || document.documentElement.clientWidth || 0;
			let vh = window.innerHeight || document.documentElement.clientHeight || 0;
			return { w: vw, h: vh };
		case 'getDivDimensions':
			let div = data.div;
			let doc = document;
			if (div.indexOf('.') > -1)
			{
				let points = div.split('.');
				div = points.pop();
				
				for (let point of points)
				{
					let iframe = doc.getElementById(point);
					if (!iframe)
					{
						console.log('Failed to find iframe ' + point);
						return false;
					}
					doc = iframe.contentWindow.document;
				}
			}
			var el = doc.getElementById(data.div);
			if (!el)
			{
				console.log('Failed to find div ' + div);
				return false;
			}
			let rect = el.getBoundingClientRect();
			return { x: rect.left, y: rect.top, w: rect.right - rect.left, h: rect.bottom - rect.top };
		case 'getViewportOrigin':
			return { x: window.mozInnerScreenX, y: window.mozInnerScreenY };
		case 'scanElements':
		return (function(maxY, minX, textFilter) {
			let results = [];
			let selector = textFilter ? '*' : 'a, button, [role="button"], [onclick]';
			for (var el of document.querySelectorAll(selector)) {
				var r = el.getBoundingClientRect();
				if (r.width <= 0 || r.height <= 0) continue;
				if (maxY !== null && r.top > maxY) continue;
				if (minX !== null && r.left < minX) continue;
				let text = el.textContent.trim().slice(0, 80);
				if (textFilter && !text.toLowerCase().includes(textFilter.toLowerCase())) continue;
				results.push({
					tag: el.tagName.toLowerCase(),
					text: text,
					class: (typeof el.className === 'string' ? el.className : ''),
					id: el.id,
					href: el.href || null,
					x: r.left, y: r.top, w: r.width, h: r.height,
				});
			}
			return results;
		})(data.maxY !== undefined ? data.maxY : null,
		   data.minX !== undefined ? data.minX : null,
		   data.textFilter || null);
	case 'findElement':
			return (function(selectors, texts, maxY, minX) {
				function eligible(r) {
					if (r.width <= 0 || r.height <= 0) return false;
					if (maxY !== null && r.top > maxY) return false;
					if (minX !== null && r.left < minX) return false;
					return true;
				}
				for (var s of selectors) {
					var el = document.querySelector(s);
					if (el) { var r = el.getBoundingClientRect(); if (eligible(r)) return {x:r.left,y:r.top,w:r.width,h:r.height}; }
				}
				for (var el of document.querySelectorAll('a, button')) {
					if (texts.includes(el.textContent.trim().toLowerCase())) {
						var r = el.getBoundingClientRect(); if (eligible(r)) return {x:r.left,y:r.top,w:r.width,h:r.height};
					}
				}
				return null;
			})(data.selectors || [], data.texts || [], data.maxY !== undefined ? data.maxY : null, data.minX !== undefined ? data.minX : null);
		case 'selectRegion':
		return new Promise((resolve) => {
			// Create overlay
			let overlay = document.createElement('div');
			overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:999999;cursor:crosshair;background:rgba(0,0,0,0.15);';

			let box = document.createElement('div');
			box.style.cssText = 'position:fixed;border:2px solid #00ff00;background:rgba(0,255,0,0.1);z-index:1000000;display:none;pointer-events:none;';

			let coords = document.createElement('div');
			coords.style.cssText = 'position:fixed;z-index:1000001;color:#00ff00;font:bold 14px monospace;background:rgba(0,0,0,0.7);padding:4px 8px;pointer-events:none;display:none;';

			document.body.appendChild(overlay);
			document.body.appendChild(box);
			document.body.appendChild(coords);

			let startX, startY, dragging = false;

			overlay.addEventListener('mousedown', (e) => {
				startX = e.clientX;
				startY = e.clientY;
				dragging = true;
				box.style.display = 'block';
				coords.style.display = 'block';
				e.preventDefault();
			});

			overlay.addEventListener('mousemove', (e) => {
				if (!dragging) return;
				let x = Math.min(startX, e.clientX);
				let y = Math.min(startY, e.clientY);
				let w = Math.abs(e.clientX - startX);
				let h = Math.abs(e.clientY - startY);
				box.style.left = x + 'px';
				box.style.top = y + 'px';
				box.style.width = w + 'px';
				box.style.height = h + 'px';
				coords.style.left = x + 'px';
				coords.style.top = (y - 24) + 'px';
				coords.textContent = `x=${x} y=${y} w=${w} h=${h}`;
			});

			overlay.addEventListener('mouseup', (e) => {
				if (!dragging) return;
				dragging = false;
				let x = Math.min(startX, e.clientX);
				let y = Math.min(startY, e.clientY);
				let w = Math.abs(e.clientX - startX);
				let h = Math.abs(e.clientY - startY);

				// Clean up
				overlay.remove();
				box.remove();
				coords.remove();

				resolve({ x: x, y: y, w: w, h: h });
			});

			// ESC to cancel
			let escHandler = (e) => {
				if (e.key === 'Escape') {
					overlay.remove();
					box.remove();
					coords.remove();
					document.removeEventListener('keydown', escHandler);
					resolve(null);
				}
			};
			document.addEventListener('keydown', escHandler);
		});
	case 'trackMouse':
		return new Promise((resolve) => {
			let track = [];
			let tracking = false;

			let label = document.createElement('div');
			label.style.cssText = 'position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:1000001;color:#ff0;font:bold 14px monospace;background:rgba(0,0,0,0.7);padding:4px 12px;border-radius:4px;pointer-events:none;';
			label.textContent = 'Recording — draw in game, ESC to cancel';
			document.body.appendChild(label);

			function onDown(e) {
				tracking = true;
				track.push({t: Date.now(), x: e.clientX, y: e.clientY, e: 'down'});
			}
			function onMove(e) {
				if (!tracking) return;
				track.push({t: Date.now(), x: e.clientX, y: e.clientY, e: 'move'});
			}
			function onUp(e) {
				if (!tracking) return;
				tracking = false;
				track.push({t: Date.now(), x: e.clientX, y: e.clientY, e: 'up'});
				cleanup();
				resolve({track: track});
			}
			function onKey(e) {
				if (e.key === 'Escape') {
					cleanup();
					resolve(null);
				}
			}
			function cleanup() {
				document.removeEventListener('mousedown', onDown, true);
				document.removeEventListener('mousemove', onMove, true);
				document.removeEventListener('mouseup', onUp, true);
				document.removeEventListener('keydown', onKey, true);
				label.remove();
			}

			document.addEventListener('mousedown', onDown, true);
			document.addEventListener('mousemove', onMove, true);
			document.addEventListener('mouseup', onUp, true);
			document.addEventListener('keydown', onKey, true);
		});
	case 'fillInput':
			return (function(sel, val) {
				var el = document.querySelector(sel);
				if (!el) return false;
				var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
				setter.call(el, val);
				el.dispatchEvent(new Event('input',  {bubbles: true}));
				el.dispatchEvent(new Event('change', {bubbles: true}));
				return true;
			})(data.selector, data.value);
		case 'clickElement':
			return (function(sel) {
				var el = document.querySelector(sel);
				if (!el) return false;
				el.click(); return true;
			})(data.selector);
	}
	
	return false;
});


addEventListener("keydown", (e) => {
	console.log('keydown');
	if (e.ctrlKey)
	{
		switch (e.keyCode)
		{
			case 69: // ctrl-e
				console.log('ctrl-e');
				browser.runtime.sendMessage({ 'cmd': 'key-ctrl-e' });
				break;
			case 88: // ctrl-x
				console.log('ctrl-x');
				browser.runtime.sendMessage({ 'cmd': 'key-ctrl-x' });
				break;
			case 89: // ctrl-y
				console.log('ctrl-y');
				browser.runtime.sendMessage({ 'cmd': 'key-ctrl-y' });
				break;
			case 90: // ctrl-z
				console.log('ctrl-z');
				browser.runtime.sendMessage({ 'cmd': 'key-ctrl-z' });
				break;
		}
	}
});

