/**
 * Server Logger Module
 * Sends error logs and telemetry to the Jellyfin server's Activity Log
 * Similar to the Android TV app's TelemetryService
 */
var ServerLogger = (function () {
   "use strict";

   var LOG_LEVELS = {
      DEBUG: "Debug",
      INFO: "Information",
      WARNING: "Warning",
      ERROR: "Error",
      FATAL: "Fatal",
   };

   var LOG_CATEGORIES = {
      PLAYBACK: "Playback",
      NETWORK: "Network",
      APP: "Application",
      AUTHENTICATION: "Authentication",
      NAVIGATION: "Navigation",
   };

   var isEnabled = false;
   var maxLogBuffer = 50;
   var logBuffer = [];
   var appVersion = "1.0.0";
   var deviceInfo = null;

   /**
    * Initialize the server logger
    * @param {Object} options - Configuration options
    * @param {boolean} options.enabled - Whether server logging is enabled
    */
   function init(options) {
      options = options || {};

      loadSettings();

      if (typeof AppVersion !== "undefined" && AppVersion.version) {
         appVersion = AppVersion.version;
      }

      deviceInfo = getDeviceInfo();

      console.log(
         "[ServerLogger] Initialized - enabled:",
         isEnabled,
         "version:",
         appVersion
      );
   }

   /**
    * Load settings from storage
    */
   function loadSettings() {
      isEnabled = true;

      if (typeof storage === "undefined") return;

      try {
         var settingsStr = storage.getUserPreference("jellyfin_settings", null);
         if (settingsStr) {
            var settings = JSON.parse(settingsStr);
            if (settings.serverLogging === false) {
               isEnabled = false;
            }
         }
      } catch (e) {
         console.error("[ServerLogger] Error loading settings:", e);
      }
   }

   /**
    * Get device information for log context
    */
   function getDeviceInfo() {
      var info = {
         platform: "Tizen",
         appVersion: appVersion,
         userAgent: navigator.userAgent || "Unknown",
         screenSize:
            window.screen.width + "x" + window.screen.height || "Unknown",
         tizenVersion: "Unknown",
         modelName: "Unknown",
      };

      if (typeof tizen !== "undefined" && tizen.systeminfo) {
         try {
            tizen.systeminfo.getPropertyValue(
               "BUILD",
               function (build) {
                  info.tizenVersion = build.version || "Unknown";
                  info.modelName = build.model || "Unknown";
               },
               function () {}
            );
         } catch (e) {
            // Ignore errors
         }
      }

      return info;
   }

   /**
    * Format a log entry for the server
    * @param {string} level - Log level
    * @param {string} category - Log category
    * @param {string} message - Log message
    * @param {Object} context - Additional context data
    */
   function formatLogEntry(level, category, message, context) {
      var entry = {
         timestamp: new Date().toISOString(),
         level: level,
         category: category,
         message: message,
         context: context || {},
         device: deviceInfo,
      };

      return entry;
   }

   /**
    * Add a log entry to the buffer
    * @param {Object} entry - Log entry
    */
   function addToBuffer(entry) {
      logBuffer.push(entry);
      if (logBuffer.length > maxLogBuffer) {
         logBuffer.shift();
      }
   }

   /**
    * Send a log to the server
    * @param {string} level - Log level
    * @param {string} category - Log category
    * @param {string} message - Log message
    * @param {Object} context - Additional context
    * @param {boolean} immediate - Send immediately (for critical errors)
    */
   function log(level, category, message, context, immediate) {
      var entry = formatLogEntry(level, category, message, context);

      // Always add to local buffer for debugging
      addToBuffer(entry);

      // Console log for local debugging
      var consoleMethod = level === LOG_LEVELS.ERROR ? "error" : "log";
      console[consoleMethod](
         "[ServerLogger]",
         level,
         "-",
         category,
         ":",
         message,
         context || ""
      );

      if (!isEnabled) return;

      if (immediate) {
         sendLogToServer(entry);
      }
   }

   /**
    * Send a log entry to the Jellyfin server
    * @param {Object} entry - Log entry to send
    */
   function sendLogToServer(entry) {
      var auth = getAuth();
      if (!auth) {
         console.log("[ServerLogger] No auth available, skipping server log");
         return;
      }

      // Format as a text log file similar to Android TV
      var logContent = formatLogAsText(entry);

      // Use the ClientLog API endpoint
      var url =
         auth.serverAddress +
         "/ClientLog/Document?documentType=Log&name=moonfin-tizen-log";

      var xhr = new XMLHttpRequest();
      xhr.open("POST", url, true);
      xhr.setRequestHeader("Content-Type", "text/plain");
      
      // Add both authorization headers for maximum compatibility with reverse proxies
      var authHeader = buildAuthHeader(auth.accessToken);
      xhr.setRequestHeader("X-Emby-Authorization", authHeader);
      xhr.setRequestHeader("Authorization", authHeader);
      
      // Also add the token directly as some reverse proxies strip custom headers
      if (auth.accessToken) {
         xhr.setRequestHeader("X-MediaBrowser-Token", auth.accessToken);
      }
      
      // Set timeout for slow connections
      xhr.timeout = 10000;

      xhr.onreadystatechange = function () {
         if (xhr.readyState === 4) {
            if (xhr.status === 200 || xhr.status === 204) {
               console.log("[ServerLogger] Log sent to server successfully");
            } else if (xhr.status === 401 || xhr.status === 403) {
               console.warn(
                  "[ServerLogger] Authentication failed sending log to server (" + xhr.status + "). Check reverse proxy headers."
               );
            } else if (xhr.status !== 0) {
               console.warn(
                  "[ServerLogger] Failed to send log to server:",
                  xhr.status,
                  xhr.statusText
               );
            }
         }
      };

      xhr.onerror = function () {
         console.warn("[ServerLogger] Network error sending log to server - may be CORS/reverse proxy issue");
      };
      
      xhr.ontimeout = function () {
         console.warn("[ServerLogger] Timeout sending log to server");
      };

      try {
         xhr.send(logContent);
      } catch (e) {
         console.error("[ServerLogger] Error sending log:", e);
      }
   }

   /**
    * Format log entry as text for server
    */
   function formatLogAsText(entry) {
      var lines = [];

      lines.push("=== Moonfin Tizen Log ===");
      lines.push("Timestamp: " + entry.timestamp);
      lines.push("Level: " + entry.level);
      lines.push("Category: " + entry.category);
      lines.push("Message: " + entry.message);
      lines.push("");
      lines.push("=== Device Info ===");

      if (entry.device) {
         lines.push("Platform: " + entry.device.platform);
         lines.push("App Version: " + entry.device.appVersion);
         lines.push("Tizen Version: " + entry.device.tizenVersion);
         lines.push("Model: " + entry.device.modelName);
         lines.push("Screen: " + entry.device.screenSize);
         lines.push("User Agent: " + entry.device.userAgent);
      }

      if (entry.context && Object.keys(entry.context).length > 0) {
         lines.push("");
         lines.push("=== Context ===");
         for (var key in entry.context) {
            if (entry.context.hasOwnProperty(key)) {
               var value = entry.context[key];
               if (typeof value === "object") {
                  value = JSON.stringify(value, null, 2);
               }
               lines.push(key + ": " + value);
            }
         }
      }

      return lines.join("\n");
   }

   /**
    * Get auth from available sources
    */
   function getAuth() {
      if (
         typeof MultiServerManager !== "undefined" &&
         MultiServerManager.getAuthForPage
      ) {
         return MultiServerManager.getAuthForPage();
      }
      if (typeof JellyfinAPI !== "undefined" && JellyfinAPI.getStoredAuth) {
         return JellyfinAPI.getStoredAuth();
      }
      return null;
   }

   /**
    * Build authorization header
    */
   function buildAuthHeader(accessToken) {
      var header =
         'MediaBrowser Client="Moonfin Tizen", Device="Samsung TV", DeviceId="';
      header += getDeviceId() + '", Version="' + appVersion + '"';
      if (accessToken) {
         header += ', Token="' + accessToken + '"';
      }
      return header;
   }

   /**
    * Get or generate device ID
    */
   function getDeviceId() {
      if (typeof storage !== "undefined") {
         var deviceId = storage.getItem("moonfin_device_id");
         if (!deviceId) {
            deviceId =
               "tizen-" +
               Date.now() +
               "-" +
               Math.random().toString(36).substr(2, 9);
            storage.setItem("moonfin_device_id", deviceId);
         }
         return deviceId;
      }
      return "tizen-unknown";
   }

   // ============== Convenience Methods ==============

   /**
    * Log a playback error
    */
   function logPlaybackError(message, context) {
      log(LOG_LEVELS.ERROR, LOG_CATEGORIES.PLAYBACK, message, context, true);
   }

   /**
    * Log a playback warning
    */
   function logPlaybackWarning(message, context) {
      log(LOG_LEVELS.WARNING, LOG_CATEGORIES.PLAYBACK, message, context, false);
   }

   /**
    * Log playback info
    */
   function logPlaybackInfo(message, context) {
      log(LOG_LEVELS.INFO, LOG_CATEGORIES.PLAYBACK, message, context, false);
   }

   /**
    * Log a network error
    */
   function logNetworkError(message, context) {
      log(LOG_LEVELS.ERROR, LOG_CATEGORIES.NETWORK, message, context, true);
   }

   /**
    * Log an app error
    */
   function logAppError(message, context) {
      log(LOG_LEVELS.ERROR, LOG_CATEGORIES.APP, message, context, true);
   }

   /**
    * Log an app info message
    */
   function logAppInfo(message, context) {
      log(LOG_LEVELS.INFO, LOG_CATEGORIES.APP, message, context, true);
   }

   /**
    * Log an authentication error
    */
   function logAuthError(message, context) {
      log(
         LOG_LEVELS.ERROR,
         LOG_CATEGORIES.AUTHENTICATION,
         message,
         context,
         true
      );
   }

   /**
    * Log navigation/UI error
    */
   function logNavigationError(message, context) {
      log(LOG_LEVELS.ERROR, LOG_CATEGORIES.NAVIGATION, message, context, false);
   }

   /**
    * Send all buffered logs to server (for crash reports)
    */
   function flushLogs() {
      if (!isEnabled || logBuffer.length === 0) return;

      var auth = getAuth();
      if (!auth) return;

      var fullLog = logBuffer
         .map(function (entry) {
            return formatLogAsText(entry);
         })
         .join("\n\n---\n\n");

      var url =
         auth.serverAddress +
         "/ClientLog/Document?documentType=Log&name=moonfin-tizen-crash-log";

      var xhr = new XMLHttpRequest();
      xhr.open("POST", url, true);
      xhr.setRequestHeader("Content-Type", "text/plain");
      xhr.setRequestHeader(
         "X-Emby-Authorization",
         buildAuthHeader(auth.accessToken)
      );

      try {
         xhr.send(fullLog);
         logBuffer = []; // Clear buffer after sending
      } catch (e) {
         console.error("[ServerLogger] Error flushing logs:", e);
      }
   }

   /**
    * Create a detailed playback error report
    * @param {Object} options - Playback error details
    */
   function createPlaybackReport(options) {
      options = options || {};

      var context = {
         itemId: options.itemId || "Unknown",
         itemName: options.itemName || "Unknown",
         itemType: options.itemType || "Unknown",
         playMethod: options.playMethod || "Unknown",
         mediaSourceId: options.mediaSourceId || "Unknown",
         transcodingUrl: options.transcodingUrl ? "Present" : "None",
         directPlayUrl: options.directPlayUrl ? "Present" : "None",
         errorCode: options.errorCode || "Unknown",
         errorMessage: options.errorMessage || "Unknown error",
         playerState: options.playerState || "Unknown",
         position: options.position || 0,
         duration: options.duration || 0,
         videoCodec: options.videoCodec || "Unknown",
         audioCodec: options.audioCodec || "Unknown",
         container: options.container || "Unknown",
         bitrate: options.bitrate || "Unknown",
         isLiveTV: options.isLiveTV || false,
         isTranscoding: options.isTranscoding || false,
         timestamp: new Date().toISOString(),
      };

      var message =
         "Playback Error: " + (options.errorMessage || "Unknown error");

      if (options.itemName) {
         message += " - Item: " + options.itemName;
      }

      logPlaybackError(message, context);

      return context;
   }

   /**
    * Enable/disable server logging
    */
   function setEnabled(enabled) {
      isEnabled = enabled;
      console.log(
         "[ServerLogger] Server logging",
         enabled ? "enabled" : "disabled"
      );
   }

   /**
    * Check if server logging is enabled
    */
   function getEnabled() {
      return isEnabled;
   }

   /**
    * Get recent logs from buffer
    */
   function getRecentLogs() {
      return logBuffer.slice();
   }

   if (typeof document !== "undefined") {
      if (document.readyState === "loading") {
         document.addEventListener("DOMContentLoaded", function () {
            init();
         });
      } else {
         init();
      }
   }

   return {
      init: init,
      log: log,
      logPlaybackError: logPlaybackError,
      logPlaybackWarning: logPlaybackWarning,
      logPlaybackInfo: logPlaybackInfo,
      logNetworkError: logNetworkError,
      logAppError: logAppError,
      logAppInfo: logAppInfo,
      logAuthError: logAuthError,
      logNavigationError: logNavigationError,
      createPlaybackReport: createPlaybackReport,
      flushLogs: flushLogs,
      setEnabled: setEnabled,
      getEnabled: getEnabled,
      getRecentLogs: getRecentLogs,
      LOG_LEVELS: LOG_LEVELS,
      LOG_CATEGORIES: LOG_CATEGORIES,
   };
})();
