﻿(function(playease) {
	var utils = playease.utils,
		events = playease.events,
		core = playease.core,
		muxer = playease.muxer,
		renders = core.renders,
		rendermodes = renders.modes,
		css = utils.css,
		
		AMF = muxer.AMF,
		TAG = muxer.flv.TAG,
		FORMATS = muxer.flv.FORMATS,
		CODECS = muxer.flv.CODECS,
		
		RENDER_CLASS = 'pla-render',
		
		// For all api instances
		CSS_SMOOTH_EASE = 'opacity .25s ease',
		CSS_100PCT = '100%',
		CSS_ABSOLUTE = 'absolute',
		CSS_IMPORTANT = ' !important',
		CSS_HIDDEN = 'hidden',
		CSS_NONE = 'none',
		CSS_BLOCK = 'block';
	
	renders.flv = function(view, config) {
		var _this = utils.extend(this, new events.eventdispatcher('renders.def')),
			_defaults = {},
			_video,
			_loader,
			_demuxer,
			_remuxer,
			_mediainfo,
			_ms,
			_sbs,
			_segments,
			_endOfStream = false;
		
		function _init() {
			_this.name = rendermodes.DEFAULT;
			
			_this.config = utils.extend({}, _defaults, config);
			
			_sbs = { audio: null, video: null };
			_segments = { audio: [], video: [] };
			
			_video = utils.createElement('video');
			_video.width = _this.config.width;
			_video.height = _this.config.height;
			_video.controls = _this.config.controls;
			_video.autoplay = _this.config.autoplay;
			_video.poster = _this.config.poster;
			if (!_this.config.autoplay) {
				_video.addEventListener('play', _onVideoPlay);
			}
			
			_initMuxer();
			_initMSE();
		}
		
		function _initMuxer() {
			_loader = new utils.loader(config.loader);
			_loader.addEventListener(events.PLAYEASE_CONTENT_LENGTH, _onContenLength);
			_loader.addEventListener(events.PLAYEASE_PROGRESS, _onLoaderProgress);
			_loader.addEventListener(events.PLAYEASE_COMPLETE, _onLoaderComplete);
			_loader.addEventListener(events.ERROR, _onLoaderError);
			
			_demuxer = new muxer.flv();
			_demuxer.addEventListener(events.PLAYEASE_FLV_TAG, _onFLVTag);
			_demuxer.addEventListener(events.PLAYEASE_MEDIA_INFO, _onMediaInfo);
			_demuxer.addEventListener(events.PLAYEASE_AVC_CONFIG_RECORD, _onAVCConfigRecord);
			_demuxer.addEventListener(events.PLAYEASE_AVC_SAMPLE, _onAVCSample);
			_demuxer.addEventListener(events.PLAYEASE_AAC_SPECIFIC_CONFIG, _onAACSpecificConfig);
			_demuxer.addEventListener(events.PLAYEASE_AAC_SAMPLE, _onAACSample);
			_demuxer.addEventListener(events.PLAYEASE_END_OF_STREAM, _onEndOfStream);
			_demuxer.addEventListener(events.ERROR, _onDemuxerError);
			
			_remuxer = new muxer.mp4();
			_remuxer.addEventListener(events.PLAYEASE_MP4_INIT_SEGMENT, _onMP4InitSegment);
			_remuxer.addEventListener(events.PLAYEASE_MP4_SEGMENT, _onMP4Segment);
			_remuxer.addEventListener(events.ERROR, _onRemuxerError);
		}
		
		function _initMSE() {
			window.MediaSource = window.MediaSource || window.WebKitMediaSource;
			
			_ms = new MediaSource();
			_ms.addEventListener('sourceopen', _onMediaSourceOpen);
			_ms.addEventListener('sourceended', _onMediaSourceEnded);
			_ms.addEventListener('sourceclose', _onMediaSourceClose);
			_ms.addEventListener('error', _onMediaSourceError);
			
			_ms.addEventListener('webkitsourceopen', _onMediaSourceOpen);
			_ms.addEventListener('webkitsourceended', _onMediaSourceEnded);
			_ms.addEventListener('webkitsourceclose', _onMediaSourceClose);
			_ms.addEventListener('webkiterror', _onMediaSourceError);
		}
		
		_this.setup = function() {
			_video.src = window.URL.createObjectURL(_ms);
		};
		
		_this.play = function() {
			_loader.load(config.url);
		};
		
		_this.pause = function() {
			
		};
		
		_this.seek = function(time) {
			
		};
		
		_this.stop = function() {
			
		};
		
		_this.volume = function(vol) {
			
		};
		
		_this.mute = function(bool) {
			bool = !!bool;
		};
		
		_this.fullscreen = function(esc) {
			
		};
		
		function _onVideoPlay(e) {
			_video.removeEventListener('play', _onVideoPlay);
			_this.dispatchEvent(events.PLAYEASE_VIEW_PLAY);
		}
		
		/**
		 * Loader
		 */
		function _onContenLength(e) {
			utils.log('onContenLength: ' + e.length);
		}
		
		function _onLoaderProgress(e) {
			//utils.log('onLoaderProgress: ' + e.data.byteLength);
			_demuxer.parse(e.data);
		}
		
		function _onLoaderComplete(e) {
			utils.log('onLoaderComplete');
		}
		
		function _onLoaderError(e) {
			utils.log(e.message);
		}
		
		/**
		 * Demuxer
		 */
		function _onFLVTag(e) {
			//utils.log('onFlvTag { tag: ' + e.tag + ', offset: ' + e.offset + ', size: ' + e.size + ' }');
			
			switch (e.tag) {
				case TAG.AUDIO:
					if (e.format && e.format != FORMATS.AAC) {
						utils.log('Unsupported audio format(' + e.format + ').');
						break;
					}
					
					_demuxer.parseAACAudioPacket(e.data, e.offset, e.size, e.timestamp, e.rate, e.samplesize, e.sampletype);
					break;
				case TAG.VIDEO:
					if (e.codec && e.codec != CODECS.AVC) {
						utils.log('Unsupported video codec(' + e.codec + ').');
						break;
					}
					
					_demuxer.parseAVCVideoPacket(e.data, e.offset, e.size, e.timestamp, e.frametype);
					break;
				case TAG.SCRIPT:
					var data = AMF.parse(e.data, e.offset, e.size);
					utils.log(data.key + ': ' + JSON.stringify(data.value));
					
					if (data.key == 'onMetaData') {
						_demuxer.setMetaData(data.value);
					}
					break;
				default:
					utils.log('Skipping unknown tag type ' + e.tag);
			}
		}
		
		function _onMediaInfo(e) {
			_mediainfo = e.info;
		}
		
		function _onAVCConfigRecord(e) {
			_remuxer.setVideoMeta(e.data);
			_remuxer.getInitSegment(e.data);
		}
		
		function _onAVCSample(e) {
			_remuxer.getVideoSegment(e.data);
		}
		
		function _onAACSpecificConfig(e) {
			_remuxer.setAudioMeta(e.data);
			_remuxer.getInitSegment(e.data);
		}
		
		function _onAACSample(e) {
			_remuxer.getAudioSegment(e.data);
		}
		
		function _onEndOfStream(e) {
			_endOfStream = true;
		}
		
		function _onDemuxerError(e) {
			utils.log(e.message);
		}
		
		/**
		 * Remuxer
		 */
		function _onMP4InitSegment(e) {
			_this.appendInitSegment(e.tp, e.data);
		}
		
		function _onMP4Segment(e) {
			_this.appendSegment(e.tp, e.data);
		}
		
		function _onRemuxerError(e) {
			utils.log(e.message);
		}
		
		/**
		 * MSE
		 */
		_this.appendInitSegment = function(type, seg) {
			var mimetype = type + '/mp4; codecs="' + _mediainfo[type + 'Codec'] + '"';
			utils.log('Mime type: ' + mimetype + '.');
			
			var issurpported = MediaSource.isTypeSupported(mimetype);
			if (!issurpported) {
				_this.dispatchEvent(events.PLAYEASE_RENDER_ERROR, { message: 'Mime type is not surpported: ' + mimetype + '.' });
				return;
			}
			
			if (_ms.readyState == 'closed') {
				_this.dispatchEvent(events.PLAYEASE_RENDER_ERROR, { message: 'MediaSource is closed while appending init segment.' });
				return;
			}
			
			var sb = _sbs[type] = _ms.addSourceBuffer(mimetype);
			sb.type = type;
			sb.addEventListener('updateend', _onUpdateEnd);
			sb.addEventListener('error', _onSourceBufferError);
			sb.appendBuffer(seg);
		};
		
		_this.appendSegment = function(type, seg) {
			_segments[type].push(seg);
			
			var sb = _sbs[type];
			if (sb.updating) {
				return;
			}
			
			var seg = _segments[type].shift();
			sb.appendBuffer(seg);
		};
		
		function _onMediaSourceOpen(e) {
			utils.log('source open');
			
			_this.dispatchEvent(events.PLAYEASE_READY, { id: _this.config.id });
		}
		
		function _onUpdateEnd(e) {
			//utils.log('update end');
			
			var type = e.target.type;
			
			if (_endOfStream) {
				if (!_ms || _ms.readyState !== 'open') {
					return;
				}
				
				if (!_segments.audio.length && !_segments.video.length) {
					_ms.endOfStream();
					return;
				}
			}
			
			if (_segments[type].length == 0) {
				return;
			}
			
			var sb = _sbs[type];
			if (sb.updating) {
				return;
			}
			
			var seg = _segments[type].shift();
			try {
				sb.appendBuffer(seg);
			} catch (e) {
				utils.log(e);
			}
		}
		
		function _onSourceBufferError(e) {
			utils.log('source buffer error');
		}
		
		function _onMediaSourceEnded(e) {
			utils.log('source ended');
		}
		
		function _onMediaSourceClose(e) {
			utils.log('source close');
		}
		
		function _onMediaSourceError(e) {
			utils.log('media source error');
		}
		
		
		_this.element = function() {
			return _video;
		};
		
		_this.resize = function(width, height) {
			
		};
		
		_this.destroy = function() {
			
		};
		
		_init();
	};
})(playease);
