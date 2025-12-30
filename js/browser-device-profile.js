/**
 * Browser Device Profile Generator
 * Ported from jellyfin-web's browserDeviceProfile.js with Tizen-specific enhancements
 * Generates device capabilities for the Jellyfin server to determine playback options
 * 
 * Enhanced with webOS-style device info loading for accurate HDR/DV/Atmos detection
 */
var BrowserDeviceProfile = (function () {
   "use strict";

   // Cache variables
   var _supportsTextTracks = null;
   var _canPlayHls = null;
   var videoTestElement = null;
   
   // Device info cache (loaded from Tizen APIs)
   var _deviceInfo = null;
   var _deviceInfoLoaded = false;
   var _deviceInfoCallbacks = [];
   var _capabilities = null;

   /**
    * Get or create video test element
    */
   function getVideoTestElement() {
      if (!videoTestElement) {
         videoTestElement = document.createElement("video");
      }
      return videoTestElement;
   }

   /**
    * Check if browser is Tizen
    */
   function isTizen() {
      return (
         typeof tizen !== "undefined" ||
         navigator.userAgent.toLowerCase().indexOf("tizen") !== -1
      );
   }

   /**
    * Get Tizen version
    */
   function getTizenVersion() {
      if (!isTizen()) return 0;
      var match = navigator.userAgent.match(/Tizen\s+(\d+)\.(\d+)/i);
      if (match) {
         return parseInt(match[1], 10) + parseInt(match[2], 10) / 10;
      }
      return 4.0; // Default assumption
   }

   /**
    * Check if device supports H.264
    */
   function canPlayH264() {
      var video = getVideoTestElement();
      return !!(
         video.canPlayType &&
         video.canPlayType('video/mp4; codecs="avc1.42E01E, mp4a.40.2"').replace(/no/, "")
      );
   }

   /**
    * Check if device supports HEVC
    */
   function canPlayHevc() {
      if (isTizen()) {
         return true; // Tizen TVs support HEVC
      }
      var video = getVideoTestElement();
      return !!(
         video.canPlayType &&
         (video.canPlayType('video/mp4; codecs="hvc1.1.L120"').replace(/no/, "") ||
            video.canPlayType('video/mp4; codecs="hev1.1.L120"').replace(/no/, "") ||
            video.canPlayType('video/mp4; codecs="hvc1.1.0.L120"').replace(/no/, "") ||
            video.canPlayType('video/mp4; codecs="hev1.1.0.L120"').replace(/no/, ""))
      );
   }

   /**
    * Check if device supports AV1
    * AV1 hardware decoding available on Tizen 5.5+ (2020 TVs and newer)
    */
   function canPlayAv1() {
      var tizenVersion = getTizenVersion();
      if (tizenVersion >= 5.5) {
         return true;
      }
      var video = getVideoTestElement();
      return !!(
         video.canPlayType &&
         video.canPlayType('video/mp4; codecs="av01.0.15M.08"').replace(/no/, "") &&
         video.canPlayType('video/mp4; codecs="av01.0.15M.10"').replace(/no/, "")
      );
   }

   /**
    * Check if device supports VP8
    */
   function canPlayVp8() {
      var video = getVideoTestElement();
      return !!(
         video.canPlayType &&
         video.canPlayType('video/webm; codecs="vp8"').replace(/no/, "")
      );
   }

   /**
    * Check if device supports VP9
    */
   function canPlayVp9() {
      var video = getVideoTestElement();
      return !!(
         video.canPlayType &&
         video.canPlayType('video/webm; codecs="vp9"').replace(/no/, "")
      );
   }

   /**
    * Check if device supports AC3
    */
   function supportsAc3() {
      if (isTizen()) {
         return true;
      }
      var video = getVideoTestElement();
      return !!(
         video.canPlayType &&
         video.canPlayType('audio/mp4; codecs="ac-3"').replace(/no/, "")
      );
   }

   /**
    * Check if device supports EAC3
    */
   function supportsEac3() {
      if (isTizen()) {
         return true;
      }
      var video = getVideoTestElement();
      return !!(
         video.canPlayType &&
         video.canPlayType('audio/mp4; codecs="ec-3"').replace(/no/, "")
      );
   }

   /**
    * Check if device supports DTS
    * Note: DTS is NOT supported on Tizen 4.0+
    */
   function canPlayDts() {
      var tizenVersion = getTizenVersion();
      if (tizenVersion >= 4) {
         return false; // Samsung TV 2018+ don't support DTS
      }
      var video = getVideoTestElement();
      return !!(
         video.canPlayType &&
         (video.canPlayType('video/mp4; codecs="dts-"').replace(/no/, "") ||
            video.canPlayType('video/mp4; codecs="dts+"').replace(/no/, ""))
      );
   }

   /**
    * Check native HLS support
    */
   function canPlayNativeHls() {
      if (isTizen()) {
         return true;
      }
      var video = getVideoTestElement();
      return !!(
         video.canPlayType &&
         (video.canPlayType("application/x-mpegURL").replace(/no/, "") ||
            video.canPlayType("application/vnd.apple.mpegURL").replace(/no/, ""))
      );
   }

   /**
    * Check if HLS can be played with MSE (Media Source Extensions)
    */
   function canPlayHlsWithMSE() {
      return window.MediaSource != null;
   }

   /**
    * Check overall HLS support
    */
   function canPlayHls() {
      if (_canPlayHls == null) {
         _canPlayHls = canPlayNativeHls() || canPlayHlsWithMSE();
      }
      return _canPlayHls;
   }

   /**
    * Check if native HLS supports fMP4 container
    */
   function canPlayNativeHlsInFmp4() {
      var tizenVersion = getTizenVersion();
      return tizenVersion >= 5;
   }

   /**
    * Check if device supports HDR10
    */
   function supportsHdr10() {
      return isTizen(); // Tizen TVs support HDR10
   }

   /**
    * Check if device supports HLG
    */
   function supportsHlg() {
      return supportsHdr10();
   }

   /**
    * Check if device supports Dolby Vision
    * Note: Tizen doesn't truly support DV but can play the HDR fallback
    */
   function supportsDolbyVision() {
      return false; // Tizen doesn't support true Dolby Vision
   }

   /**
    * Check if MKV container is supported
    */
   function canPlayMkv() {
      if (isTizen()) {
         return true;
      }
      var video = getVideoTestElement();
      return !!(
         video.canPlayType &&
         (video.canPlayType("video/x-matroska").replace(/no/, "") ||
            video.canPlayType("video/mkv").replace(/no/, ""))
      );
   }

   /**
    * Check if TS container is supported
    */
   function canPlayTs() {
      return isTizen();
   }

   /**
    * Check audio format support
    */
   function canPlayAudioFormat(format) {
      if (isTizen()) {
         if (format === "flac" || format === "asf" || format === "wma") {
            return true;
         }
      }

      var typeString;
      if (format === "opus") {
         typeString = 'audio/ogg; codecs="opus"';
      } else if (format === "webma") {
         typeString = "audio/webm";
      } else if (format === "mp3") {
         typeString = "audio/mpeg";
      } else if (format === "aac") {
         typeString = 'audio/mp4; codecs="mp4a.40.2"';
      } else if (format === "flac") {
         typeString = "audio/flac";
      } else if (format === "wav") {
         typeString = "audio/wav";
      } else if (format === "ogg") {
         typeString = "audio/ogg";
      }

      if (typeString) {
         var audio = document.createElement("audio");
         return !!(audio.canPlayType && audio.canPlayType(typeString).replace(/no/, ""));
      }

      return false;
   }

   /**
    * Get maximum H.264 level supported
    */
   function getMaxH264Level() {
      var video = getVideoTestElement();
      var tizenVersion = getTizenVersion();

      // Tizen 5+ supports level 5.2
      if (tizenVersion >= 5) {
         return 52;
      }

      // Tizen supports level 5.1
      if (isTizen()) {
         return 51;
      }

      // Test for level 5.1
      if (
         video.canPlayType &&
         video.canPlayType('video/mp4; codecs="avc1.640833"').replace(/no/, "")
      ) {
         return 51;
      }

      return 42; // Default to 4.2
   }

   /**
    * Get maximum HEVC level supported
    */
   function getMaxHevcLevel() {
      var video = getVideoTestElement();

      // Test for level 6.2 (main10)
      if (
         video.canPlayType &&
         video.canPlayType('video/mp4; codecs="hvc1.2.4.L186"').replace(/no/, "")
      ) {
         return 186;
      }

      // Test for level 6.1 (main10)
      if (
         video.canPlayType &&
         video.canPlayType('video/mp4; codecs="hvc1.2.4.L183"').replace(/no/, "")
      ) {
         return 183;
      }

      // Test for level 5.1 (main10)
      if (
         video.canPlayType &&
         video.canPlayType('video/mp4; codecs="hvc1.2.4.L153"').replace(/no/, "")
      ) {
         return 153;
      }

      // Tizen default
      if (isTizen()) {
         return 153; // Level 5.1 for most Tizen TVs
      }

      return 120; // Default to level 4.0
   }

   /**
    * Get HEVC profiles supported
    */
   function getHevcProfiles() {
      var video = getVideoTestElement();

      // Check for Main 10 support
      if (
         video.canPlayType &&
         (video.canPlayType('video/mp4; codecs="hvc1.2.4.L123"').replace(/no/, "") ||
            video.canPlayType('video/mp4; codecs="hev1.2.4.L123"').replace(/no/, ""))
      ) {
         return "main|main 10";
      }

      // Tizen supports Main 10
      if (isTizen()) {
         return "main|main 10";
      }

      return "main";
   }

   /**
    * Get physical audio channels (speaker count)
    */
   function getPhysicalAudioChannels() {
      // Tizen TVs typically support up to 6 channels (5.1)
      // Some support 8 channels with passthrough
      if (isTizen()) {
         return 6;
      }
      return 2;
   }

   /**
    * Get global max video bitrate for device
    */
   function getGlobalMaxVideoBitrate() {
      if (isTizen()) {
         try {
            if (typeof webapis !== "undefined" && webapis.productinfo) {
               var isUhd = webapis.productinfo.isUdPanelSupported();
               if (!isUhd) {
                  // FHD panel - limit bitrate
                  return 20000000;
               }
            }
         } catch (e) {
            console.log("[BrowserDeviceProfile] Could not detect panel type:", e);
         }
      }
      return null; // No limit for UHD panels
   }

   /**
    * Build the complete device profile
    */
   function getDeviceProfile(options) {
      options = options || {};

      var tizenVersion = getTizenVersion();
      var physicalAudioChannels = getPhysicalAudioChannels();
      var globalMaxVideoBitrate = getGlobalMaxVideoBitrate();

      var profile = {
         MaxStreamingBitrate: 120000000,
         MaxStaticBitrate: 100000000,
         MusicStreamingTranscodingBitrate: 384000,
         DirectPlayProfiles: [],
         TranscodingProfiles: [],
         ContainerProfiles: [],
         CodecProfiles: [],
         SubtitleProfiles: [],
         ResponseProfiles: [],
      };

      // ============== Direct Play Profiles ==============

      var videoAudioCodecs = ["aac", "mp3"];

      if (supportsAc3()) {
         videoAudioCodecs.push("ac3");
      }
      if (supportsEac3()) {
         videoAudioCodecs.push("eac3");
      }
      if (canPlayDts()) {
         videoAudioCodecs.push("dca", "dts");
      }
      if (isTizen()) {
         videoAudioCodecs.push("pcm_s16le", "pcm_s24le", "aac_latm");
         // FLAC in video has delay issues on Tizen, exclude it
      }
      if (canPlayAudioFormat("opus")) {
         videoAudioCodecs.push("opus");
      }
      if (canPlayAudioFormat("flac") && !isTizen()) {
         videoAudioCodecs.push("flac");
      }

      var mp4VideoCodecs = [];
      var mkvVideoCodecs = [];
      var hlsVideoCodecs = [];
      var hlsAudioCodecs = ["aac", "mp3"];

      if (canPlayH264()) {
         mp4VideoCodecs.push("h264");
         mkvVideoCodecs.push("h264");
         hlsVideoCodecs.push("h264");
      }

      if (canPlayHevc()) {
         mp4VideoCodecs.push("hevc");
         mkvVideoCodecs.push("hevc");
         if (isTizen()) {
            hlsVideoCodecs.push("hevc");
         }
      }

      if (canPlayAv1()) {
         mp4VideoCodecs.push("av1");
         mkvVideoCodecs.push("av1");
      }

      if (supportsAc3()) {
         hlsAudioCodecs.push("ac3");
      }
      if (supportsEac3()) {
         hlsAudioCodecs.push("eac3");
      }

      // MP4 container
      if (mp4VideoCodecs.length) {
         profile.DirectPlayProfiles.push({
            Container: "mp4,m4v",
            Type: "Video",
            VideoCodec: mp4VideoCodecs.join(","),
            AudioCodec: videoAudioCodecs.join(","),
         });
      }

      // MKV container
      if (canPlayMkv() && mkvVideoCodecs.length) {
         profile.DirectPlayProfiles.push({
            Container: "mkv",
            Type: "Video",
            VideoCodec: mkvVideoCodecs.join(","),
            AudioCodec: videoAudioCodecs.join(","),
         });
      }

      // TS container (Tizen only)
      if (canPlayTs()) {
         var tsVideoCodecs = ["h264"];
         if (canPlayHevc()) {
            tsVideoCodecs.push("hevc");
         }
         profile.DirectPlayProfiles.push({
            Container: "ts,mpegts",
            Type: "Video",
            VideoCodec: tsVideoCodecs.join(","),
            AudioCodec: videoAudioCodecs.join(","),
         });
      }

      // HLS direct play (for live TV primarily)
      if (canPlayHls() && hlsVideoCodecs.length) {
         profile.DirectPlayProfiles.push({
            Container: "hls",
            Type: "Video",
            VideoCodec: hlsVideoCodecs.join(","),
            AudioCodec: hlsAudioCodecs.join(","),
         });
      }

      // Audio direct play
      ["mp3", "aac", "flac", "wav", "ogg", "opus"].forEach(function (format) {
         if (canPlayAudioFormat(format)) {
            profile.DirectPlayProfiles.push({
               Container: format,
               Type: "Audio",
            });
         }
      });

      // ============== Transcoding Profiles ==============

      // Prefer fMP4 HLS on newer Tizen
      if (canPlayHls() && hlsVideoCodecs.length) {
         var hlsContainer = canPlayNativeHlsInFmp4() ? "mp4" : "ts";

         profile.TranscodingProfiles.push({
            Container: hlsContainer,
            Type: "Video",
            AudioCodec: hlsAudioCodecs.join(","),
            VideoCodec: hlsVideoCodecs.join(","),
            Context: "Streaming",
            Protocol: "hls",
            MaxAudioChannels: physicalAudioChannels.toString(),
            MinSegments: "1",
            BreakOnNonKeyFrames: false,
         });
      }

      // Audio transcoding
      ["aac", "mp3", "opus", "wav"].forEach(function (format) {
         if (canPlayAudioFormat(format)) {
            profile.TranscodingProfiles.push({
               Container: format,
               Type: "Audio",
               AudioCodec: format,
               Context: "Streaming",
               Protocol: "http",
               MaxAudioChannels: physicalAudioChannels.toString(),
            });
         }
      });

      // ============== Container Profiles ==============

      // Tizen doesn't support more than 32 streams in a single file
      if (tizenVersion < 6.5) {
         profile.ContainerProfiles.push({
            Type: "Video",
            Conditions: [
               {
                  Condition: "LessThanEqual",
                  Property: "NumStreams",
                  Value: "32",
                  IsRequired: false,
               },
            ],
         });
      }

      // ============== Codec Profiles ==============

      var maxH264Level = getMaxH264Level();
      var maxHevcLevel = getMaxHevcLevel();
      var hevcProfiles = getHevcProfiles();

      // H.264 codec profile
      var h264Conditions = [
         {
            Condition: "EqualsAny",
            Property: "VideoProfile",
            Value: "high|main|baseline|constrained baseline",
            IsRequired: false,
         },
         {
            Condition: "EqualsAny",
            Property: "VideoRangeType",
            Value: "SDR",
            IsRequired: false,
         },
         {
            Condition: "LessThanEqual",
            Property: "VideoLevel",
            Value: maxH264Level.toString(),
            IsRequired: false,
         },
      ];

      if (globalMaxVideoBitrate) {
         h264Conditions.push({
            Condition: "LessThanEqual",
            Property: "VideoBitrate",
            Value: globalMaxVideoBitrate.toString(),
            IsRequired: true,
         });
      }

      profile.CodecProfiles.push({
         Type: "Video",
         Codec: "h264",
         Conditions: h264Conditions,
      });

      // HEVC codec profile
      var hevcVideoRangeTypes = "SDR";
      if (supportsHdr10()) {
         hevcVideoRangeTypes += "|HDR10|HDR10Plus";
      }
      if (supportsHlg()) {
         hevcVideoRangeTypes += "|HLG";
      }
      // Tizen can play DV fallback even without true DV support (from jellyfin-web)
      // Tizen TV does not support Dolby Vision at all, but it can safely play the HDR fallback.
      // Advertising the support so that the server doesn't have to remux.
      if (tizenVersion >= 3) {
         hevcVideoRangeTypes += "|DOVIWithHDR10|DOVIWithHDR10Plus|DOVIWithSDR|DOVIWithHLG";
         hevcVideoRangeTypes += "|DOVIWithEL|DOVIWithELHDR10Plus|DOVIInvalid";
      }

      var hevcConditions = [
         {
            Condition: "EqualsAny",
            Property: "VideoProfile",
            Value: hevcProfiles,
            IsRequired: false,
         },
         {
            Condition: "EqualsAny",
            Property: "VideoRangeType",
            Value: hevcVideoRangeTypes,
            IsRequired: false,
         },
         {
            Condition: "LessThanEqual",
            Property: "VideoLevel",
            Value: maxHevcLevel.toString(),
            IsRequired: false,
         },
      ];

      if (globalMaxVideoBitrate) {
         hevcConditions.push({
            Condition: "LessThanEqual",
            Property: "VideoBitrate",
            Value: globalMaxVideoBitrate.toString(),
            IsRequired: true,
         });
      }

      profile.CodecProfiles.push({
         Type: "Video",
         Codec: "hevc",
         Conditions: hevcConditions,
      });

      // AV1 codec profile (Tizen 5.5+ / 2021 TVs)
      if (canPlayAv1()) {
         var av1VideoRangeTypes = "SDR";
         if (supportsHdr10()) {
            av1VideoRangeTypes += "|HDR10|HDR10Plus";
         }
         if (supportsHlg()) {
            av1VideoRangeTypes += "|HLG";
         }
         // Tizen can play DV fallback for AV1 as well (from jellyfin-web)
         if (tizenVersion >= 3) {
            av1VideoRangeTypes += "|DOVIWithHDR10|DOVIWithHDR10Plus|DOVIWithEL|DOVIWithELHDR10Plus|DOVIInvalid";
         }

         var av1Conditions = [
            {
               Condition: "EqualsAny",
               Property: "VideoProfile",
               Value: "main",
               IsRequired: false,
            },
            {
               Condition: "EqualsAny",
               Property: "VideoRangeType",
               Value: av1VideoRangeTypes,
               IsRequired: false,
            },
            {
               Condition: "LessThanEqual",
               Property: "VideoLevel",
               Value: "15", // Level 5.3
               IsRequired: false,
            },
         ];

         if (globalMaxVideoBitrate) {
            av1Conditions.push({
               Condition: "LessThanEqual",
               Property: "VideoBitrate",
               Value: globalMaxVideoBitrate.toString(),
               IsRequired: true,
            });
         }

         profile.CodecProfiles.push({
            Type: "Video",
            Codec: "av1",
            Conditions: av1Conditions,
         });
      }

      // Global video conditions
      if (globalMaxVideoBitrate) {
         profile.CodecProfiles.push({
            Type: "Video",
            Conditions: [
               {
                  Condition: "LessThanEqual",
                  Property: "VideoBitrate",
                  Value: globalMaxVideoBitrate.toString(),
               },
            ],
         });
      }

      // Audio channel limit
      profile.CodecProfiles.push({
         Type: "VideoAudio",
         Conditions: [
            {
               Condition: "LessThanEqual",
               Property: "AudioChannels",
               Value: physicalAudioChannels.toString(),
               IsRequired: false,
            },
         ],
      });

      // ============== Subtitle Profiles ==============

      profile.SubtitleProfiles.push({
         Format: "vtt",
         Method: "External",
      });
      profile.SubtitleProfiles.push({
         Format: "srt",
         Method: "External",
      });
      profile.SubtitleProfiles.push({
         Format: "ass",
         Method: "External",
      });
      profile.SubtitleProfiles.push({
         Format: "ssa",
         Method: "External",
      });
      // Burn in for complex formats
      profile.SubtitleProfiles.push({
         Format: "pgssub",
         Method: "Encode",
      });
      profile.SubtitleProfiles.push({
         Format: "dvdsub",
         Method: "Encode",
      });
      profile.SubtitleProfiles.push({
         Format: "dvbsub",
         Method: "Encode",
      });
      profile.SubtitleProfiles.push({
         Format: "sub",
         Method: "Encode",
      });

      // ============== Response Profiles ==============

      profile.ResponseProfiles.push({
         Type: "Video",
         Container: "m4v",
         MimeType: "video/mp4",
      });

      return profile;
   }

   /**
    * Check if HLS.js should be used instead of native HLS
    * Based on jellyfin-web logic
    */
   function shouldUseHlsJs() {
      // Tizen's native HLS is generally good, but HLS.js gives better control
      // For transcoding, native HLS on Tizen works well
      // The native players on Tizen support seeking live streams
      if (isTizen()) {
         return false; // Use native HLS on Tizen
      }

      // Use HLS.js if MediaSource is available and native HLS isn't perfect
      if (window.MediaSource != null && !canPlayNativeHls()) {
         return true;
      }

      return false;
   }

   /**
    * Get cross-origin value for video element
    */
   function getCrossOriginValue(mediaSource) {
      if (mediaSource && mediaSource.IsRemote) {
         return null;
      }
      return "anonymous";
   }

   // Public API
   return {
      getDeviceProfile: getDeviceProfile,
      isTizen: isTizen,
      getTizenVersion: getTizenVersion,
      canPlayH264: canPlayH264,
      canPlayHevc: canPlayHevc,
      canPlayAv1: canPlayAv1,
      canPlayHls: canPlayHls,
      canPlayNativeHls: canPlayNativeHls,
      canPlayMkv: canPlayMkv,
      supportsHdr10: supportsHdr10,
      supportsDolbyVision: supportsDolbyVision,
      shouldUseHlsJs: shouldUseHlsJs,
      getCrossOriginValue: getCrossOriginValue,
      getPhysicalAudioChannels: getPhysicalAudioChannels,
   };
})();

// Export for use in other modules
if (typeof window !== "undefined") {
   window.BrowserDeviceProfile = BrowserDeviceProfile;
}
