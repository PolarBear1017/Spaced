import i18n from '../i18n/config';

let audioContext = null;
let currentSource = null; // Track the currently playing source
let currentAudioElement = null; // Track HTML5 Audio fallback

let currentUtterance = null; // Track active utterance to prevent GC

// Event system
const listeners = new Set();

const subscribe = (callback) => {
  listeners.add(callback);
  return () => listeners.delete(callback);
};

const notifyListeners = (event, data) => {
  listeners.forEach(callback => callback(event, data));
};
const getAudioContext = () => {
  if (typeof window === 'undefined') return null;
  if (!audioContext || audioContext.state === 'closed') {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      audioContext = new AudioCtx();
    }
  }
  return audioContext;
};

// Handle visibility change to resume audio context on mobile
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    // Aggressive reset: Destroy context when backgrounded to avoid stale/interrupted states on mobile
    if (document.hidden && audioContext) {
      // Don't close if we are actively playing (to support background play)
      if (currentSource || currentAudioElement || (window.speechSynthesis && window.speechSynthesis.speaking)) {
        // do nothing, let it run
      } else {
        audioContext.close().catch(err => console.warn("Error closing AudioContext:", err));
        audioContext = null;
      }
    }
  });

  // Also try to resume on touch/click events as a backup if it exists but is suspended
  const resumeAudio = () => {
    if (audioContext && audioContext.state === 'suspended') {
      audioContext.resume().catch(() => { });
    }
  };
  document.addEventListener('touchstart', resumeAudio, { passive: true });
  document.addEventListener('click', resumeAudio, { passive: true });
}

const stopAudio = () => {
  // Stop Web Audio API source
  if (currentSource) {
    try {
      currentSource.stop();
      if (currentSource.onended) currentSource.onended = null; // Prevent callback
    } catch {
      // Ignore errors if already stopped
    }
    currentSource = null;
  }

  // Stop HTML5 Audio fallback
  if (currentAudioElement) {
    try {
      currentAudioElement.pause();
      currentAudioElement.currentTime = 0;
      currentAudioElement.onended = null; // Prevent callback
      currentAudioElement.onerror = null;
    } catch {
      // Ignore errors
    }
    currentAudioElement = null;
  }

  // Cancel speech synthesis
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }

  if (currentUtterance) {
    currentUtterance.onend = null;
    currentUtterance.onerror = null;
    currentUtterance = null;
  }
};

const playAudioWithContext = async (url, options = {}) => {
  // Stop any currently playing audio first
  stopAudio();

  const { onEnd, onPlaybackFailed, source: audioSource, rate = 1.0 } = options;

  // Notify that playback is starting
  notifyListeners('play', { source: audioSource });

  // Use Web Audio API for everything to prevent pausing background music (e.g., Spotify) on mobile devices.
  try {
    // Determine if we need to proxy the request
    let playUrl = url;
    if (url.startsWith('http')) {
      playUrl = `/api/proxy-audio?url=${encodeURIComponent(url)}`;
    }

    // Resume AudioContext if suspended (for mobile rules)
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      await ctx.resume().catch(() => { });
    }

    // Fetch and decode audio
    const response = await fetch(playUrl);
    if (!response.ok) {
      throw new Error(`Network response was not ok: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const originalBuffer = await ctx.decodeAudioData(arrayBuffer);

    let audioBufferToPlay = originalBuffer;

    // Pitch-preserving Time-Stretching
    // If rate is not 1.0, we manually process the buffer to stretch time without affecting pitch using soundtouchjs.
    if (rate !== 1.0) {
      try {
        // Import SoundTouch dynamically
        const { SoundTouch, SimpleFilter, WebAudioBufferSource } = await import('soundtouchjs');

        const soundTouch = new SoundTouch(ctx.sampleRate);
        soundTouch.tempo = rate;
        // Do NOT set rate or pitch here, letting it default to 1.0 internally

        // Use the library's official WebAudioBufferSource which natively handles stereo extraction correctly
        const source = new WebAudioBufferSource(originalBuffer);
        const filter = new SimpleFilter(source, soundTouch);

        // Pre-calculate the exact needed length for the new buffer
        const expectedDuration = originalBuffer.duration / rate;
        const expectedFrames = Math.ceil(expectedDuration * ctx.sampleRate);

        // Create a new buffer to hold the stretched audio
        let stretchedBuffer = ctx.createBuffer(
          originalBuffer.numberOfChannels,
          expectedFrames,
          ctx.sampleRate
        );

        // We process the audio in chunks until it's fully stretched into the new buffer
        const chunkSize = 8192;
        let framesExtracted = 0;
        let totalExtracted = 0;
        const channels = originalBuffer.numberOfChannels;
        const outputData = new Float32Array(chunkSize * 2); // SoundTouch JS filter.extract expects interleaved L/R (always length*2 array)

        // Safety limit to prevent infinite loops 
        const MAX_ITERATIONS = Math.ceil(expectedFrames / chunkSize) * 3;
        let iterations = 0;

        while (totalExtracted < expectedFrames && iterations < MAX_ITERATIONS) {
          iterations++;
          const framesToExtract = Math.min(chunkSize, expectedFrames - totalExtracted);

          // SoundTouch JS extract puts stereo interleaved data into outputData even if it's mono
          framesExtracted = filter.extract(outputData, framesToExtract);

          if (framesExtracted === 0) {
            break;
          }

          // De-interleave and copy to output buffer
          if (channels === 2) {
            const leftData = stretchedBuffer.getChannelData(0);
            const rightData = stretchedBuffer.getChannelData(1);
            for (let i = 0; i < framesExtracted; i++) {
              leftData[totalExtracted + i] = outputData[i * 2];
              rightData[totalExtracted + i] = outputData[i * 2 + 1];
            }
          } else {
            const channelData = stretchedBuffer.getChannelData(0);
            for (let i = 0; i < framesExtracted; i++) {
              channelData[totalExtracted + i] = outputData[i * 2]; // For mono, it still acts like stereo under the hood, so grab first channel
            }
          }

          totalExtracted += framesExtracted;
        }

        // Validate extraction
        if (totalExtracted > 0) {
          if (totalExtracted < expectedFrames) {
            const slicedBuffer = ctx.createBuffer(channels, totalExtracted, ctx.sampleRate);
            for (let c = 0; c < channels; c++) {
              slicedBuffer.getChannelData(c).set(stretchedBuffer.getChannelData(c).subarray(0, totalExtracted));
            }
            audioBufferToPlay = slicedBuffer;
          } else {
            audioBufferToPlay = stretchedBuffer;
          }
        } else {
          console.warn("SoundTouchJS extracted 0 frames. Falling back to original audio.");
          // Keep audioBufferToPlay as originalBuffer, fallback to modifying playbackRate natively
          const sourceNode = ctx.createBufferSource();
          sourceNode.buffer = originalBuffer;
          sourceNode.playbackRate.value = rate;
          currentSource = sourceNode;

          const durationMs = (originalBuffer.duration * 1000) / rate;
          const safetyTimeout = setTimeout(() => {
            if (currentSource === sourceNode) {
              currentSource = null;
              if (onEnd) onEnd();
            }
          }, durationMs + 2000);

          sourceNode.onended = () => {
            clearTimeout(safetyTimeout);
            if (currentSource === sourceNode) {
              currentSource = null;
              if (onEnd) onEnd();
            }
          };

          sourceNode.connect(ctx.destination);
          sourceNode.start(0);
          return; // Exit early since we handled fallback playback natively
        }
      } catch (err) {
        console.error("SoundTouchJS Time-Stretching Failed:", err);
        // Fallback to original buffer with native playback rate if stretching fails entirely
        const sourceNode = ctx.createBufferSource();
        sourceNode.buffer = originalBuffer;
        sourceNode.playbackRate.value = rate;
        currentSource = sourceNode;

        const durationMs = (originalBuffer.duration * 1000) / rate;
        const safetyTimeout = setTimeout(() => {
          if (currentSource === sourceNode) {
            currentSource = null;
            if (onEnd) onEnd();
          }
        }, durationMs + 2000);

        sourceNode.onended = () => {
          clearTimeout(safetyTimeout);
          if (currentSource === sourceNode) {
            currentSource = null;
            if (onEnd) onEnd();
          }
        };

        sourceNode.connect(ctx.destination);
        sourceNode.start(0);
        return; // Exit early
      }
    }

    const sourceNode = ctx.createBufferSource();
    sourceNode.buffer = audioBufferToPlay;

    // We already stretched the audio buffer itself, so playbackRate remains 1.0
    sourceNode.playbackRate.value = 1.0;

    currentSource = sourceNode;

    // Safety timeout: calculate duration based on buffer (it's already adjusted if stretched)
    const durationMs = audioBufferToPlay.duration * 1000;
    const safetyTimeout = setTimeout(() => {
      console.warn("Audio playback timed out, forcing onEnd");
      if (currentSource === sourceNode) {
        currentSource = null;
        if (onEnd) onEnd();
      }
    }, durationMs + 2000); // 2 second buffer

    sourceNode.onended = () => {
      clearTimeout(safetyTimeout);
      if (currentSource === sourceNode) {
        currentSource = null;
        if (onEnd) onEnd();
      }
    };

    sourceNode.connect(ctx.destination);
    sourceNode.start(0);
  } catch (err) {
    console.error("Playback error:", err);
    if (onPlaybackFailed) {
      onPlaybackFailed();
    } else {
      if (onEnd) onEnd();
    }
  }
};

const speak = (text, audioUrl = null, options = {}) => {
  if (!text && !audioUrl) return;

  const rawText = (text || '').trim();
  const containsChinese = /[\u4e00-\u9fa5]/.test(rawText);

  // Smart language resolution: auto-detect language based on script content
  let resolvedLang = options.lang;
  if (!resolvedLang) {
    resolvedLang = containsChinese ? 'zh-TW' : 'en-US';
  } else if (resolvedLang.startsWith('zh') && !containsChinese) {
    resolvedLang = 'en-US';
  }

  const lang = resolvedLang;
  const { rate = 1.0, onEnd, source } = options;

  if (audioUrl) {
    playAudioWithContext(audioUrl, {
      onEnd,
      source,
      rate,
      onPlaybackFailed: () => {
        if (options.onPlaybackFailed) {
          options.onPlaybackFailed();
        } else if (text) {
          console.warn("Audio URL playback failed, falling back to TTS for:", text);
          speak(text, null, options);
        }
      }
    });
    return;
  }

  // Try to use Google TTS for short sentences first
  // Limit is usually around 200 chars for this unofficial API
  const canUseGoogleTTS = text && text.length < 200;

  if (canUseGoogleTTS) {
    // Generate Google Translate TTS URL
    let googleLang = 'en';
    if (lang.startsWith('zh')) {
      googleLang = 'zh-TW';
    } else if (lang.startsWith('en')) {
      googleLang = 'en';
    }

    const googleUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${googleLang}&client=tw-ob`;

    // Play with Google TTS, fallback to browser synthesis on failure
    playAudioWithContext(googleUrl, {
      onEnd,
      onPlaybackFailed: () => {
        console.warn("Google TTS failed, falling back to browser synthesis");
        speakWithBrowser(text, lang, rate, onEnd, source);
      },
      source,
      rate
    });
    return;
  }

  // Fallback or long text: use browser synthesis
  speakWithBrowser(text, lang, rate, onEnd, source);
};

const speakWithBrowser = (text, lang, rate, onEnd, source) => {
  // Stop previous audio before synthesis
  stopAudio();

  // Notify that playback is starting
  notifyListeners('play', { source });

  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = rate;

    // Store reference to prevent Garbage Collection
    currentUtterance = utterance;

    // Safety timeout: browser TTS can sometimes hang indefinitely
    // Estimate duration: 200 words/min approx, plus buffer.
    // Minimum 3 seconds, max 20 seconds.
    const approximateDuration = Math.min(Math.max(text.length * 200, 3000), 20000);

    const safetyTimeout = setTimeout(() => {
      console.warn("Speech synthesis timed out, forcing onEnd");
      if (currentUtterance === utterance) {
        currentUtterance = null;
        if (onEnd) onEnd();
      }
    }, approximateDuration);

    utterance.onend = () => {
      clearTimeout(safetyTimeout);
      if (currentUtterance === utterance) {
        currentUtterance = null;
        if (onEnd) onEnd();
      }
    };

    utterance.onerror = (err) => {
      clearTimeout(safetyTimeout);
      console.error("Speech synthesis error", err);
      if (currentUtterance === utterance) {
        currentUtterance = null;
        if (onEnd) onEnd(); // Ensure loop continues
      }
    };

    // iOS Safari background playback hack/fix
    // Ensure the audio session is active
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }

    try {
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.error("Speech synthesis failed to start", e);
      clearTimeout(safetyTimeout);
      currentUtterance = null;
      if (onEnd) onEnd();
    }
  } else {
    console.warn("Browser does not support speech synthesis");
    if (typeof window !== 'undefined' && typeof window.alert === 'function') {
      alert(i18n.t('settings.speechNotSupported', '瀏覽器不支援語音功能'));
    }
    if (onEnd) onEnd();
  }
};

const getAudioUrl = (word, priorityList = ['us', 'uk', 'google', 'general']) => {
  if (!word) return null;

  for (const source of priorityList) {
    switch (source) {
      case 'us':
        if (word.usAudioUrl || word.us_audio_url) return word.usAudioUrl || word.us_audio_url;
        break;
      case 'uk':
        if (word.ukAudioUrl || word.uk_audio_url) return word.ukAudioUrl || word.uk_audio_url;
        break;
      case 'general':
        if (word.audioUrl || word.audio_url) return word.audioUrl || word.audio_url;
        break;
      case 'google':
        // Generate Google Translate TTS URL
        // Using the public API endpoint often used by third-party tools
        // client=tw-ob is a common parameter for this unofficial usage
        if (word.word) {
          return `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(word.word)}&tl=en&client=tw-ob`;
        }
        break;
      case 'yahoo':
        // Yahoo audio might be in audioUrl if source was Yahoo.
        // Ignore old 'dreye' urls since they are likely broken 403s.
        if (word.source === 'Yahoo' && word.audioUrl && !word.audioUrl.includes('dreye/live')) {
          return word.audioUrl;
        }
        break;
      default:
        break;
    }
  }

  return null;
};

export { speak, stopAudio, getAudioUrl, subscribe };
