


/***********************************************************************************************************************************
* Browser interaction class
***********************************************************************************************************************************/
class Browser {
	
	
	/*******************************************************************************************************************************
	* Close the browser window
	*******************************************************************************************************************************/
	async closeWindow() {
		let win = await browser.windows.getCurrent();
		let id = win.id;
		
		// do not await so that the response will be sent first
		browser.windows.remove(id);
		
		return true;
	}
	
	
	/*******************************************************************************************************************************
	* Get a list of tabs and associated information
	*******************************************************************************************************************************/
	async getTabs() {
		let tabs = await browser.tabs.query({ currentWindow: true });
		
		return tabs;
	}
	
	
	/*******************************************************************************************************************************
	* Get the viewport size of the current active tab
	*******************************************************************************************************************************/
	async getCurrentTabViewportSize() {
		let tabs = await this.getTabs();
		for (let tab of tabs)
		{
			if (tab.active)
			{
				let size = await browser.tabs.sendMessage(tab.id, { 'cmd': 'getViewportSize' }, { frameId: 0 });
				console.log(size);
				return size;
			}
		}
		return false;
	}
	
	/*******************************************************************************************************************************
	* Get the viewport size of the current active tab
	*******************************************************************************************************************************/
	async getCurrentTabDivDimensions(div) {
		let tabs = await this.getTabs();
		for (let tab of tabs)
		{
			if (tab.active)
			{
				let size = await browser.tabs.sendMessage(tab.id, { 'cmd': 'getDivDimensions', 'div': div }, { frameId: 0 });
				console.log(size);
				return size;
			}
		}
		return false;
	}
	
	
	/*******************************************************************************************************************************
	* Create a new tab with associated properties
	*******************************************************************************************************************************/
	async createTab(properties) {
		if (!properties || typeof properties !== 'object')
		{
			return false;
		}
		return await browser.tabs.create(properties);
	}
	
	
	/*******************************************************************************************************************************
	* Update the given tab with associated properties
	*******************************************************************************************************************************/
	async updateTab(tab, properties) {
		if (!properties || typeof properties !== 'object')
		{
			return false;
		}
		await browser.tabs.update(tab, properties);
		
		return true;
	}
	
	
	/*******************************************************************************************************************************
	* Refresh the given tab with associated properties
	*******************************************************************************************************************************/
	async refreshTab(tab, properties) {
		if (!properties || typeof properties !== 'object')
		{
			properties = { };
		}
		await browser.tabs.reload(tab, properties);
		
		return true;
	}
	
	
	/*******************************************************************************************************************************
	* Close the given tab
	*******************************************************************************************************************************/
	async closeTab(tab) {
		await browser.tabs.remove(tab);
		return true;
	}
	
	
	/*******************************************************************************************************************************
	* Returns browser information
	*******************************************************************************************************************************/
	async getBrowserInfo() {
		return browser.runtime.getBrowserInfo();
	}
	
	
	/*******************************************************************************************************************************
	* Returns information about the current window
	*******************************************************************************************************************************/
	async getCurrentWindowInfo() {
		return browser.windows.getCurrent();
	}
	
	
	/*******************************************************************************************************************************
	* Returns information about contextual identities
	*******************************************************************************************************************************/
	async getContextualIdentities(properties) {
		if (browser.contextualIdentities == undefined)
		{
			return false;
		}
		if (properties)
		{
			if (typeof properties !== 'object')
			{
				return false;
			}
			return browser.contextualIdentities.query(properties);
		}
		return browser.contextualIdentities.query({ });
	}
	
	
	/*******************************************************************************************************************************
	* Creates a new contextual identity instance with the given properties
	*******************************************************************************************************************************/
	async createContextualIdentity(properties) {
		if (browser.contextualIdentities == undefined)
		{
			return false;
		}
		if (!properties || typeof properties !== 'object')
		{
			return false;
		}
		return browser.contextualIdentities.create(properties);
	}


	/*******************************************************************************************************************************
	* Execute a JavaScript code string in the given tab (defaults to active tab).
	* Returns the value of the last evaluated expression.
	*******************************************************************************************************************************/
	async executeScript(tab, code) {
		if (!tab)
		{
			let tabs = await this.getTabs();
			for (let t of tabs)
			{
				if (t.active) { tab = t.id; break; }
			}
		}
		let results = await browser.tabs.executeScript(tab, { code: code });
		return (results !== undefined && results.length > 0) ? results[0] : null;
	}


	/*******************************************************************************************************************************
	* Send a command to the active tab's content script and return the result.
	*******************************************************************************************************************************/
	async _sendToTab(tab, msg) {
		if (!tab) {
			let tabs = await this.getTabs();
			for (let t of tabs) { if (t.active) { tab = t.id; break; } }
		}
		return browser.tabs.sendMessage(tab, msg, { frameId: 0 });
	}

	async getViewportOrigin(tab) {
		return this._sendToTab(tab, { cmd: 'getViewportOrigin' });
	}

	async findElement(tab, selectors, texts, maxY, minX) {
		let msg = { cmd: 'findElement', selectors: selectors, texts: texts };
		if (maxY !== undefined) msg.maxY = maxY;
		if (minX !== undefined) msg.minX = minX;
		return this._sendToTab(tab, msg);
	}

	async fillInput(tab, selector, value) {
		return this._sendToTab(tab, { cmd: 'fillInput', selector: selector, value: value });
	}

	async clickElement(tab, selector) {
		return this._sendToTab(tab, { cmd: 'clickElement', selector: selector });
	}


}

