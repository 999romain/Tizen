/**
 * Boot-critical polyfills for legacy smart TVs.
 * MUST be the very first import in index.js so these are in place before
 * @enact/core or any other library module executes.
 */

/* global self, NodeList */

// @enact/core/platform references globalThis directly without a typeof guard.
// Missing on Tizen 2.4 (WebKit r152340), webOS 3–5 (Chromium <71).
if (typeof globalThis === 'undefined') {
	if (typeof self !== 'undefined') {
		self.globalThis = self;
	} else if (typeof window !== 'undefined') {
		window.globalThis = window;
	}
}

// Enact Spotlight calls nodeList.forEach(); babel-preset-enact excludes the
// core-js polyfill for web.dom-collections.for-each.
if (typeof NodeList !== 'undefined' && !NodeList.prototype.forEach) {
	NodeList.prototype.forEach = Array.prototype.forEach;
}
