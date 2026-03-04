import {getPlatform} from '../platform';

const LOG_LEVELS = {
DEBUG: 'Debug',
INFO: 'Information',
WARNING: 'Warning',
ERROR: 'Error',
FATAL: 'Fatal'
};

const LOG_CATEGORIES = {
PLAYBACK: 'Playback',
NETWORK: 'Network',
APP: 'Application',
AUTHENTICATION: 'Authentication',
NAVIGATION: 'Navigation'
};

import packageJson from '../../package.json';
const APP_VERSION = packageJson.version;

const MAX_LOG_BUFFER = 50;

let isEnabled = false;
let logBuffer = [];
let deviceInfoCache = null;
let authGetter = null;
let deviceInfoLoader = null;

const getTimestamp = () => {
try {
return new Date().toISOString();
} catch {
return new Date().toString();
}
};

const loadDeviceInfo = async () => {
if (deviceInfoCache) return deviceInfoCache;

if (!deviceInfoLoader) {
if (getPlatform() === 'tizen') {
deviceInfoLoader = import('@moonfin/platform-tizen/deviceInfo');
} else {
deviceInfoLoader = import('@moonfin/platform-webos/deviceInfo');
}
}

try {
const mod = await deviceInfoLoader;
deviceInfoCache = await mod.getDeviceInfo();
} catch {
deviceInfoCache = {
platform: getPlatform(),
appVersion: APP_VERSION,
userAgent: navigator.userAgent || 'Unknown',
screenSize: `${window.screen.width}x${window.screen.height}`,
tvVersion: 'Unknown',
modelName: 'Unknown'
};
}

return deviceInfoCache;
};

const platformName = getPlatform() === 'tizen' ? 'Tizen' : 'webOS';
const logEndpointName = `moonfin-${getPlatform()}-log`;

const formatLogAsText = (entry) => {
const lines = [
`=== Moonfin for ${platformName} Log ===`,
`Timestamp: ${entry.timestamp}`,
`Level: ${entry.level}`,
`Category: ${entry.category}`,
`Message: ${entry.message}`,
'',
'=== Device Info ==='
];

if (entry.device) {
lines.push(`Platform: ${entry.device.platform}`);
lines.push(`App Version: ${entry.device.appVersion}`);
lines.push(`TV Version: ${entry.device.tvVersion}`);
lines.push(`Model: ${entry.device.modelName}`);
lines.push(`Screen: ${entry.device.screenSize}`);
lines.push(`User Agent: ${entry.device.userAgent}`);
}

if (entry.context && Object.keys(entry.context).length > 0) {
lines.push('');
lines.push('=== Context ===');
for (const [key, value] of Object.entries(entry.context)) {
const valueStr = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
lines.push(`${key}: ${valueStr}`);
}
}

return lines.join('\n');
};

const sendLogToServer = async (entry) => {
if (!authGetter) return;

const auth = authGetter();
if (!auth?.serverUrl || !auth?.accessToken) return;

const logContent = formatLogAsText(entry);
const url = `${auth.serverUrl}/ClientLog/Document?documentType=Log&name=${logEndpointName}`;

try {
await fetch(url, {
method: 'POST',
headers: {
'Content-Type': 'text/plain',
'Authorization': `MediaBrowser Token="${auth.accessToken}"`,
'X-MediaBrowser-Token': auth.accessToken
},
body: logContent
});
} catch (err) {
console.warn('[ServerLogger] Network error:', err.message);
}
};

const log = async (level, category, message, context = {}, immediate = false) => {
const entry = {
timestamp: getTimestamp(),
level,
category,
message,
context,
device: await loadDeviceInfo()
};

logBuffer.push(entry);
if (logBuffer.length > MAX_LOG_BUFFER) {
logBuffer.shift();
}

const consoleMethod = level === LOG_LEVELS.ERROR || level === LOG_LEVELS.FATAL ? 'error' : 'log';
console[consoleMethod]('[ServerLogger]', level, '-', category, ':', message, context);

if (!isEnabled) return;

if (immediate) {
sendLogToServer(entry);
}
};

const flushLogs = async () => {
if (!isEnabled || logBuffer.length === 0) return;

const logsToSend = [...logBuffer];
logBuffer = [];

for (const entry of logsToSend) {
await sendLogToServer(entry);
}
};

export const serverLogger = {
LOG_LEVELS,
LOG_CATEGORIES,

init: (options = {}) => {
isEnabled = options.enabled ?? false;
authGetter = options.getAuth ?? null;
loadDeviceInfo();
},

setEnabled: (enabled) => {
isEnabled = enabled;
},

isEnabled: () => isEnabled,

debug: (category, message, context) => log(LOG_LEVELS.DEBUG, category, message, context),
info: (category, message, context) => log(LOG_LEVELS.INFO, category, message, context),
warn: (category, message, context) => log(LOG_LEVELS.WARNING, category, message, context),
error: (category, message, context, immediate = true) => log(LOG_LEVELS.ERROR, category, message, context, immediate),
fatal: (category, message, context) => log(LOG_LEVELS.FATAL, category, message, context, true),

playback: (message, context) => log(LOG_LEVELS.INFO, LOG_CATEGORIES.PLAYBACK, message, context),
playbackError: (message, context) => log(LOG_LEVELS.ERROR, LOG_CATEGORIES.PLAYBACK, message, context, true),

flush: flushLogs,

getBuffer: () => [...logBuffer]
};

export default serverLogger;
