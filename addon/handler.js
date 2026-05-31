


/***********************************************************************************************************************************
* Request handler class
***********************************************************************************************************************************/
class Handler {
	
	
	/*******************************************************************************************************************************
	* Request handler constructor
	*******************************************************************************************************************************/
	constructor() {
		this.browser = new Browser();
	}
	
	
	/*******************************************************************************************************************************
	* Forwards requests to the intended destination
	*******************************************************************************************************************************/
	async forward(msg) {
		logger.debug(msg);
		switch (msg.cmd)
		{
			case 'closeWindow':
				return await this.browser.closeWindow();
			case 'getTabs':
				return await this.browser.getTabs();
			case 'createTab':
				return await this.browser.createTab(msg.properties);
			case 'updateTab':
				return await this.browser.updateTab(msg.tab, msg.properties);
			case 'refreshTab':
				return await this.browser.refreshTab(msg.tab, msg.properties);
			case 'closeTab':
				return await this.browser.closeTab(msg.tab);
			case 'getBrowserInfo':
				return await this.browser.getBrowserInfo();
			case 'getCurrentWindowInfo':
				return await this.browser.getCurrentWindowInfo();
			case 'getCurrentTabViewportSize':
				return await this.browser.getCurrentTabViewportSize();
			case 'getCurrentTabDivDimensions':
				return await this.browser.getCurrentTabDivDimensions(msg.div);
			case 'getContextualIdentities':
				return await this.browser.getContextualIdentities(msg.properties);
			case 'createContextualIdentity':
				return await this.browser.createContextualIdentity(msg.properties);
			case 'scanElements':
				return await this.browser._sendToTab(null, { cmd: 'scanElements', maxY: msg.maxY, minX: msg.minX, textFilter: msg.textFilter });
			case 'reloadExtension':
				browser.runtime.reload();
				return true;
			case 'executeScript':
				return await this.browser.executeScript(msg.tab, msg.code);
			case 'getViewportOrigin':
				return await this.browser.getViewportOrigin(msg.tab);
			case 'findElement':
				return await this.browser.findElement(msg.tab, msg.selectors, msg.texts, msg.maxY, msg.minX);
			case 'fillInput':
				return await this.browser.fillInput(msg.tab, msg.selector, msg.value);
			case 'clickElement':
				return await this.browser.clickElement(msg.tab, msg.selector);
			case 'selectRegion':
				return await this.browser._sendToTab(null, { cmd: 'selectRegion', fixedW: msg.fixedW, fixedH: msg.fixedH });
			case 'trackMouse':
				return await this.browser._sendToTab(null, { cmd: 'trackMouse' });
		}
		
		return false;
	}
	
	
}

