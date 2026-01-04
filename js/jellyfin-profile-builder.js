/**
 * Jellyfin Device Profile Builder
 * Extracted from jellyfin-web for standalone Tizen use
 * Source: https://github.com/jellyfin/jellyfin-web
 * 
 * This module provides browser detection and device profile building
 * for the Jellyfin PlaybackInfo API.
 */

(function() {
   'use strict';

   console.log('[JellyfinProfile] Loading profile builder...');

   function isTv(userAgent) {
      if (userAgent.indexOf('oculusbrowser') !== -1) return false;
      if (userAgent.indexOf('tv') !== -1) return true;
      if (userAgent.indexOf('samsungbrowser') !== -1) return true;
      if (userAgent.indexOf('viera') !== -1) return true;
      if (userAgent.indexOf('titanos') !== -1) return true;
      return isWeb0s(userAgent);
   }

   function isWeb0s(userAgent) {
      return userAgent.indexOf('netcast') !== -1 || userAgent.indexOf('web0s') !== -1;
   }

   function isMobile(userAgent) {
      var terms = ['mobi', 'ipad', 'iphone', 'ipod', 'silk', 'gt-p1000', 'nexus 7', 'kindle fire', 'opera mini'];
      for (var i = 0; i < terms.length; i++) {
         if (userAgent.indexOf(terms[i]) !== -1) return true;
      }
      return false;
   }

   function hasKeyboard(browser) {
      if (browser.touch) return true;
      if (browser.xboxOne) return true;
      if (browser.ps4) return true;
      if (browser.edgeUwp) return true;
      return !!browser.tv;
   }

   var uaMatch = function(ua) {
      ua = ua.replace(/(motorola edge)/, '').trim();

      var match = /(edg)[ /]([\w.]+)/.exec(ua)
         || /(edga)[ /]([\w.]+)/.exec(ua)
         || /(edgios)[ /]([\w.]+)/.exec(ua)
         || /(edge)[ /]([\w.]+)/.exec(ua)
         || /(titanos)[ /]([\w.]+)/.exec(ua)
         || /(opera)[ /]([\w.]+)/.exec(ua)
         || /(opr)[ /]([\w.]+)/.exec(ua)
         || /(chrome)[ /]([\w.]+)/.exec(ua)
         || /(safari)[ /]([\w.]+)/.exec(ua)
         || /(firefox)[ /]([\w.]+)/.exec(ua)
         || (ua.indexOf('compatible') === -1 && /(mozilla)(?:.*? rv:([\w.]+)|)/.exec(ua))
         || [];

      var versionMatch = /(version)[ /]([\w.]+)/.exec(ua);
      var platformMatch = /(ipad)/.exec(ua)
         || /(iphone)/.exec(ua)
         || /(windows)/.exec(ua)
         || /(android)/.exec(ua)
         || /(titanos)/.exec(ua)
         || [];

      var browser = match[1] || '';
      if (browser === 'edge') platformMatch = [''];
      if (browser === 'opr') browser = 'opera';

      var version;
      if (versionMatch && versionMatch.length > 2) version = versionMatch[2];
      version = version || match[2] || '0';

      var versionMajor = parseInt(version.split('.')[0], 10);
      if (isNaN(versionMajor)) versionMajor = 0;

      return {
         browser: browser,
         version: version,
         platform: platformMatch[0] || '',
         versionMajor: versionMajor
      };
   };

   function detectBrowser(userAgent) {
      userAgent = userAgent || navigator.userAgent;
      var normalizedUA = userAgent.toLowerCase();
      var matched = uaMatch(normalizedUA);
      var browser = {};

      if (matched.browser) {
         browser[matched.browser] = true;
         browser.version = matched.version;
         browser.versionMajor = matched.versionMajor;
      }

      if (matched.platform) {
         browser[matched.platform] = true;
      }

      browser.edgeChromium = browser.edg || browser.edga || browser.edgios;

      if (!browser.chrome && !browser.edgeChromium && !browser.edge && !browser.opera && normalizedUA.indexOf('webkit') !== -1) {
         browser.safari = true;
      }

      browser.osx = normalizedUA.indexOf('mac os x') !== -1;

      if (browser.osx && !browser.iphone && !browser.ipod && !browser.ipad && navigator.maxTouchPoints > 1) {
         browser.ipad = true;
      }

      if (isMobile(normalizedUA)) {
         browser.mobile = true;
      }

      browser.ps4 = normalizedUA.indexOf('playstation 4') !== -1;
      browser.xboxOne = normalizedUA.indexOf('xbox') !== -1;
      browser.animate = typeof document !== 'undefined' && document.documentElement.animate != null;
      browser.hisense = normalizedUA.indexOf('hisense') !== -1;
      browser.tizen = normalizedUA.indexOf('tizen') !== -1 || window.tizen != null;
      browser.vidaa = normalizedUA.indexOf('vidaa') !== -1;
      browser.web0s = isWeb0s(normalizedUA);
      browser.tv = browser.ps4 || browser.xboxOne || isTv(normalizedUA);
      browser.operaTv = browser.tv && normalizedUA.indexOf('opr/') !== -1;
      browser.edgeUwp = (browser.edge || browser.edgeChromium) && (normalizedUA.indexOf('msapphost') !== -1 || normalizedUA.indexOf('webview') !== -1);

      if (browser.web0s) {
         browser.web0sVersion = web0sVersion(browser);
         delete browser.chrome;
         delete browser.safari;
      } else if (browser.tizen) {
         var v = /Tizen (\d+)\.(\d+)/.exec(userAgent);
         if (v) {
            browser.tizenVersion = parseInt(v[1], 10) + parseInt(v[2], 10) / 10;
         }
         delete browser.chrome;
         delete browser.safari;
      } else if (browser.titanos) {
         delete browser.operaTv;
         delete browser.safari;
      } else {
         browser.orsay = normalizedUA.indexOf('smarthub') !== -1;
      }

      if (browser.mobile || browser.tv) {
         browser.slow = true;
      }

      if (typeof document !== 'undefined' && (('ontouchstart' in window) || (navigator.maxTouchPoints > 0))) {
         browser.touch = true;
      }

      browser.keyboard = hasKeyboard(browser);
      browser.iOS = browser.ipad || browser.iphone || browser.ipod;

      return browser;
   }

   function web0sVersion(browser) {
      if (browser.chrome) {
         if (browser.versionMajor >= 94) return 23;
         if (browser.versionMajor >= 87) return 22;
         if (browser.versionMajor >= 79) return 6;
         if (browser.versionMajor >= 68) return 5;
         if (browser.versionMajor >= 53) return 4;
         if (browser.versionMajor >= 38) return 3;
         if (browser.versionMajor >= 34) return 2;
         if (browser.versionMajor >= 26) return 1;
      }
      return undefined;
   }

   var browser = detectBrowser();
   console.log('[JellyfinProfile] Browser detection:', browser);

   function canPlayH264(videoTestElement) {
      return !!(videoTestElement.canPlayType && videoTestElement.canPlayType('video/mp4; codecs="avc1.42E01E, mp4a.40.2"').replace(/no/, ''));
   }

   function canPlayHevc(videoTestElement, options) {
      options = options || {};
      if (browser.tizen || browser.xboxOne || browser.web0s || options.supportsHevc) {
         return true;
      }
      if (browser.ps4) return false;
      
      return !!videoTestElement.canPlayType
         && (videoTestElement.canPlayType('video/mp4; codecs="hvc1.1.L120"').replace(/no/, '')
         || videoTestElement.canPlayType('video/mp4; codecs="hev1.1.L120"').replace(/no/, '')
         || videoTestElement.canPlayType('video/mp4; codecs="hvc1.1.0.L120"').replace(/no/, '')
         || videoTestElement.canPlayType('video/mp4; codecs="hev1.1.0.L120"').replace(/no/, ''));
   }

   function canPlayAv1(videoTestElement) {
      if (browser.tizenVersion >= 5.5 || browser.web0sVersion >= 5) {
         return true;
      }
      return !!videoTestElement.canPlayType
         && (videoTestElement.canPlayType('video/mp4; codecs="av01.0.15M.08"').replace(/no/, '')
         && videoTestElement.canPlayType('video/mp4; codecs="av01.0.15M.10"').replace(/no/, ''));
   }

   function canPlayHls() {
      if (browser.tizen) return true;
      var media = document.createElement('video');
      return !!(media.canPlayType('application/x-mpegURL').replace(/no/, '')
         || media.canPlayType('application/vnd.apple.mpegURL').replace(/no/, ''));
   }

   function canPlayNativeHlsInFmp4() {
      if (browser.tizenVersion >= 5 || browser.web0sVersion >= 3.5) {
         return true;
      }
      return browser.iOS || browser.osx;
   }

   function supportsAc3(videoTestElement) {
      if (browser.edgeUwp || browser.tizen || browser.web0s) return true;
      return videoTestElement.canPlayType('audio/mp4; codecs="ac-3"').replace(/no/, '') 
         || videoTestElement.canPlayType('audio/ac3"').replace(/no/, '');
   }

   function supportsEac3(videoTestElement) {
      if (browser.tizen || browser.web0s) return true;
      return !!videoTestElement.canPlayType('audio/mp4; codecs="ec-3"').replace(/no/, '');
   }

   function canPlayDts(videoTestElement) {
      return browser.tizen;
   }

   function canPlayAudioFormat(format) {
      var typeString;
      if (format === 'flac') {
         if (browser.tizen) return true;
         typeString = 'audio/flac';
      } else if (format === 'opus') {
         typeString = 'audio/ogg; codecs="opus"';
      } else if (format === 'alac') {
         typeString = 'audio/mp4; codecs="alac"';
      } else if (format === 'mp3') {
         typeString = 'audio/mpeg';
      } else if (format === 'aac') {
         typeString = 'audio/mp4; codecs="mp4a.40.2"';
      } else if (format === 'wav') {
         typeString = 'audio/wav';
      } else if (format === 'ogg' || format === 'oga') {
         typeString = 'audio/ogg';
      } else if (format === 'webma') {
         typeString = 'audio/webm';
      } else if (format === 'wma') {
         typeString = 'audio/x-ms-wma';
      } else {
         typeString = 'audio/' + format;
      }
      
      var audioElement = document.createElement('audio');
      return !!audioElement.canPlayType(typeString).replace(/no/, '');
   }

   function testCanPlayMkv(videoTestElement) {
      if (browser.tizen) return true;
      if (videoTestElement.canPlayType('video/x-matroska').replace(/no/, '') 
          || videoTestElement.canPlayType('video/mkv').replace(/no/, '')) {
         return true;
      }
      return browser.edgeChromium || browser.chrome;
   }

   function getPhysicalAudioChannels() {
      try {
         if (typeof webapis !== 'undefined' && webapis.avinfo && 
             webapis.avinfo.isAtmosSupported && webapis.avinfo.isAtmosSupported()) {
            return 8;
         }
      } catch (e) {}
      
      if (browser.tizen || browser.web0s) return 6;
      return 2;
   }

   function getMaxBitrate() {
      return 120000000;
   }

   function buildDeviceProfile(options) {
      options = options || {};
      console.log('[JellyfinProfile] Building device profile with options:', options);

      var videoTestElement = document.createElement('video');
      var physicalAudioChannels = getPhysicalAudioChannels();
      var bitrateSetting = getMaxBitrate();
      var canPlayMkv = testCanPlayMkv(videoTestElement);

      var profile = {
         MaxStreamingBitrate: bitrateSetting,
         MaxStaticBitrate: 100000000,
         MusicStreamingTranscodingBitrate: Math.min(bitrateSetting, 384000),
         DirectPlayProfiles: [],
         TranscodingProfiles: [],
         ContainerProfiles: [],
         CodecProfiles: [],
         SubtitleProfiles: [],
         ResponseProfiles: []
      };

      var videoAudioCodecs = [];
      var hlsInTsVideoAudioCodecs = [];
      var hlsInFmp4VideoAudioCodecs = [];

      if (videoTestElement.canPlayType('video/mp4; codecs="avc1.640029, mp4a.40.2"').replace(/no/, '')) {
         videoAudioCodecs.push('aac');
         hlsInTsVideoAudioCodecs.push('aac');
         hlsInFmp4VideoAudioCodecs.push('aac');
      }

      if (videoTestElement.canPlayType('video/mp4; codecs="avc1.640029, mp4a.69"').replace(/no/, '')
          || videoTestElement.canPlayType('video/mp4; codecs="avc1.640029, mp4a.6B"').replace(/no/, '')
          || videoTestElement.canPlayType('video/mp4; codecs="avc1.640029, mp3"').replace(/no/, '')) {
         videoAudioCodecs.push('mp3');
         hlsInTsVideoAudioCodecs.push('mp3');
      }

      if (supportsAc3(videoTestElement)) {
         videoAudioCodecs.push('ac3');
         hlsInTsVideoAudioCodecs.push('ac3');
         hlsInFmp4VideoAudioCodecs.push('ac3');
         
         if (supportsEac3(videoTestElement)) {
            videoAudioCodecs.push('eac3');
            hlsInTsVideoAudioCodecs.push('eac3');
            hlsInFmp4VideoAudioCodecs.push('eac3');
         }
      }

      if (canPlayDts(videoTestElement)) {
         videoAudioCodecs.push('dca');
         videoAudioCodecs.push('dts');
      }

      if (browser.tizen || browser.web0s) {
         videoAudioCodecs.push('pcm_s16le');
         videoAudioCodecs.push('pcm_s24le');
      }

      if (options.supportsTrueHd) {
         videoAudioCodecs.push('truehd');
      }

      if (browser.tizen) {
         videoAudioCodecs.push('aac_latm');
      }

      if (canPlayAudioFormat('opus')) {
         videoAudioCodecs.push('opus');
         hlsInFmp4VideoAudioCodecs.push('opus');
         if (browser.tizen) {
            hlsInTsVideoAudioCodecs.push('opus');
         }
      }

      if (canPlayAudioFormat('flac') && !browser.tizen) {
         videoAudioCodecs.push('flac');
         hlsInFmp4VideoAudioCodecs.push('flac');
      }

      if (canPlayAudioFormat('alac')) {
         videoAudioCodecs.push('alac');
         hlsInFmp4VideoAudioCodecs.push('alac');
      }

      if (browser.tizen) {
         videoAudioCodecs.push('vorbis');
      }

      var mp4VideoCodecs = [];
      var hlsInTsVideoCodecs = [];
      var hlsInFmp4VideoCodecs = [];

      if (canPlayH264(videoTestElement)) {
         mp4VideoCodecs.push('h264');
         hlsInTsVideoCodecs.push('h264');
         hlsInFmp4VideoCodecs.push('h264');
      }

      if (canPlayHevc(videoTestElement, options)) {
         mp4VideoCodecs.push('hevc');
         hlsInFmp4VideoCodecs.push('hevc');
         if (browser.tizen || browser.web0s || browser.vidaa) {
            hlsInTsVideoCodecs.push('hevc');
         }
      }

      if (canPlayAv1(videoTestElement)) {
         mp4VideoCodecs.push('av1');
         hlsInFmp4VideoCodecs.push('av1');
      }

      var canPlayVp8 = videoTestElement.canPlayType('video/webm; codecs="vp8"').replace(/no/, '');
      var canPlayVp9 = videoTestElement.canPlayType('video/webm; codecs="vp9"').replace(/no/, '');

      if (canPlayVp9) {
         mp4VideoCodecs.push('vp9');
         hlsInFmp4VideoCodecs.push('vp9');
      }

      if (browser.tizen) {
         mp4VideoCodecs.push('mpeg2video');
         mp4VideoCodecs.push('msmpeg4v2');
         mp4VideoCodecs.push('vc1');
      }

      if (canPlayVp8 || canPlayVp9) {
         var webmVideoCodecs = [];
         var webmAudioCodecs = ['vorbis'];
         if (canPlayVp8) webmVideoCodecs.push('vp8');
         if (canPlayVp9) webmVideoCodecs.push('vp9');
         if (canPlayAudioFormat('opus')) webmAudioCodecs.push('opus');
         
         profile.DirectPlayProfiles.push({
            Container: 'webm',
            Type: 'Video',
            VideoCodec: webmVideoCodecs.join(','),
            AudioCodec: webmAudioCodecs.join(',')
         });
      }

      if (mp4VideoCodecs.length) {
         profile.DirectPlayProfiles.push({
            Container: 'mp4,m4v',
            Type: 'Video',
            VideoCodec: mp4VideoCodecs.join(','),
            AudioCodec: videoAudioCodecs.join(',')
         });
      }

      if (canPlayMkv && mp4VideoCodecs.length) {
         profile.DirectPlayProfiles.push({
            Container: 'mkv',
            Type: 'Video',
            VideoCodec: mp4VideoCodecs.join(','),
            AudioCodec: videoAudioCodecs.join(',')
         });
      }

      profile.DirectPlayProfiles.push({
         Container: 'ts,m2ts,mpegts',
         Type: 'Video',
         VideoCodec: 'h264,hevc,mpeg2video',
         AudioCodec: videoAudioCodecs.join(',')
      });

      profile.DirectPlayProfiles.push({
         Container: 'avi',
         Type: 'Video',
         VideoCodec: 'h264,mpeg4,msmpeg4v3,vc1',
         AudioCodec: 'aac,ac3,mp3,pcm_s16le'
      });

      profile.DirectPlayProfiles.push({
         Container: 'mov',
         Type: 'Video',
         VideoCodec: 'h264,hevc',
         AudioCodec: videoAudioCodecs.join(',')
      });

      if (canPlayHls() && canPlayNativeHlsInFmp4() && hlsInFmp4VideoCodecs.length) {
         profile.DirectPlayProfiles.push({
            Container: 'hls',
            Type: 'Video',
            VideoCodec: hlsInFmp4VideoCodecs.join(','),
            AudioCodec: hlsInFmp4VideoAudioCodecs.join(',')
         });
      }

      var audioFormats = ['mp3', 'aac', 'flac', 'alac', 'wav', 'ogg', 'opus'];
      audioFormats.forEach(function(format) {
         if (canPlayAudioFormat(format)) {
            profile.DirectPlayProfiles.push({
               Container: format,
               Type: 'Audio'
            });
         }
      });


      if (canPlayAudioFormat('aac')) {
         profile.DirectPlayProfiles.push({ Container: 'm4a', AudioCodec: 'aac', Type: 'Audio' });
         profile.DirectPlayProfiles.push({ Container: 'm4b', AudioCodec: 'aac', Type: 'Audio' });
      }

      var enableFmp4Hls = canPlayNativeHlsInFmp4();

      if (canPlayHls() && enableFmp4Hls && hlsInFmp4VideoCodecs.length) {
         profile.TranscodingProfiles.push({
            Container: 'mp4',
            Type: 'Video',
            AudioCodec: hlsInFmp4VideoAudioCodecs.join(','),
            VideoCodec: hlsInFmp4VideoCodecs.join(','),
            Context: 'Streaming',
            Protocol: 'hls',
            MaxAudioChannels: String(physicalAudioChannels),
            MinSegments: '2',
            BreakOnNonKeyFrames: true
         });
      }

      if (canPlayHls() && hlsInTsVideoCodecs.length) {
         profile.TranscodingProfiles.push({
            Container: 'ts',
            Type: 'Video',
            AudioCodec: hlsInTsVideoAudioCodecs.join(','),
            VideoCodec: hlsInTsVideoCodecs.join(','),
            Context: 'Streaming',
            Protocol: 'hls',
            MaxAudioChannels: String(physicalAudioChannels),
            MinSegments: '2',
            BreakOnNonKeyFrames: true
         });
      }

      profile.TranscodingProfiles.push({
         Container: 'aac',
         Type: 'Audio',
         AudioCodec: 'aac',
         Context: 'Streaming',
         Protocol: 'http',
         MaxAudioChannels: String(physicalAudioChannels)
      });

      profile.TranscodingProfiles.push({
         Container: 'mp3',
         Type: 'Audio',
         AudioCodec: 'mp3',
         Context: 'Streaming',
         Protocol: 'http',
         MaxAudioChannels: '2'
      });

      var maxWidth = 3840;
      var maxHeight = 2160;
      try {
         if (typeof webapis !== 'undefined' && webapis.productinfo) {
            if (webapis.productinfo.is8KPanelSupported && webapis.productinfo.is8KPanelSupported()) {
               maxWidth = 7680;
               maxHeight = 4320;
            }
         }
      } catch (e) {}

      profile.CodecProfiles.push({
         Type: 'Video',
         Codec: 'h264',
         Conditions: [
            { Condition: 'NotEquals', Property: 'IsAnamorphic', Value: 'true', IsRequired: false },
            { Condition: 'EqualsAny', Property: 'VideoProfile', Value: 'high|main|baseline|constrained baseline', IsRequired: false },
            { Condition: 'LessThanEqual', Property: 'VideoLevel', Value: '52', IsRequired: false },
            { Condition: 'LessThanEqual', Property: 'Width', Value: String(maxWidth), IsRequired: false },
            { Condition: 'LessThanEqual', Property: 'Height', Value: String(maxHeight), IsRequired: false }
         ]
      });

      profile.CodecProfiles.push({
         Type: 'Video',
         Codec: 'hevc',
         Conditions: [
            { Condition: 'NotEquals', Property: 'IsAnamorphic', Value: 'true', IsRequired: false },
            { Condition: 'EqualsAny', Property: 'VideoProfile', Value: 'main|main 10', IsRequired: false },
            { Condition: 'LessThanEqual', Property: 'VideoLevel', Value: '183', IsRequired: false },
            { Condition: 'LessThanEqual', Property: 'Width', Value: String(maxWidth), IsRequired: false },
            { Condition: 'LessThanEqual', Property: 'Height', Value: String(maxHeight), IsRequired: false }
         ]
      });

      profile.CodecProfiles.push({
         Type: 'VideoAudio',
         Codec: 'aac,ac3,eac3,mp3,opus',
         Conditions: [
            { Condition: 'LessThanEqual', Property: 'AudioChannels', Value: '8', IsRequired: false }
         ]
      });

      profile.SubtitleProfiles = [
         { Format: 'srt', Method: 'External' },
         { Format: 'srt', Method: 'Embed' },
         { Format: 'ass', Method: 'External' },
         { Format: 'ass', Method: 'Embed' },
         { Format: 'ssa', Method: 'External' },
         { Format: 'ssa', Method: 'Embed' },
         { Format: 'sub', Method: 'Embed' },
         { Format: 'sub', Method: 'External' },
         { Format: 'vtt', Method: 'External' },
         { Format: 'vtt', Method: 'Embed' },
         { Format: 'pgs', Method: 'Embed' },
         { Format: 'pgssub', Method: 'Embed' },
         { Format: 'dvdsub', Method: 'Embed' },
         { Format: 'dvbsub', Method: 'Embed' }
      ];

      console.log('[JellyfinProfile] Built profile:', profile);
      return profile;
   }

   window.JellyfinBrowser = browser;
   window.JellyfinProfileBuilder = buildDeviceProfile;

   console.log('[JellyfinProfile] Profile builder loaded successfully');
   console.log('[JellyfinProfile] Browser: tizen=' + browser.tizen + ' tizenVersion=' + browser.tizenVersion);

})();
