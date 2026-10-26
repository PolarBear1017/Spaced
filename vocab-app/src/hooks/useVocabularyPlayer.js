import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { speak, stopAudio, getAudioUrl, subscribe } from '../services/speechService';
import { normalizeEntries } from '../utils/data';
import { useSettingsContext } from '../contexts/SettingsContext';

export const useVocabularyPlayer = (words = [], options = {}) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentWordIndex, setCurrentWordIndex] = useState(-1);
    const [playbackState, setPlaybackState] = useState('idle'); // idle, playing_word, playing_def, waiting
    const { state: { audioSourcePriority, audioSpeed, chineseAudioSpeed, definitionLanguage } } = useSettingsContext();

    // Default priority or from settings
    const audioPriority = useMemo(
        () => audioSourcePriority || options.audioPriority || ['us', 'uk', 'google', 'yahoo', 'general'],
        [audioSourcePriority, options.audioPriority]
    );

    const timeoutRef = useRef(null);
    const currentWordRef = useRef(null);
    const isPlayingRef = useRef(false);

    // Keep refs synced
    useEffect(() => {
        isPlayingRef.current = isPlaying;
    }, [isPlaying]);

    const currentWord = currentWordIndex >= 0 && currentWordIndex < words.length
        ? words[currentWordIndex]
        : null;

    useEffect(() => {
        currentWordRef.current = currentWord;
    }, [currentWord]);

    const playNext = useCallback(() => {
        if (!isPlayingRef.current) return;

        setCurrentWordIndex(prev => {
            const nextIndex = prev + 1;
            if (nextIndex >= words.length) {
                setIsPlaying(false);
                setPlaybackState('idle');
                return -1; // Reset or stop
            }
            return nextIndex;
        });
    }, [words.length]);

    const playPrevious = useCallback(() => {
        setCurrentWordIndex(prev => {
            const newIndex = prev - 1;
            return newIndex < 0 ? 0 : newIndex;
        });
        setIsPlaying(true);
    }, []);

    const speakDefinition = useCallback((word) => {
        if (!isPlayingRef.current) return;
        setPlaybackState('playing_def');

        // Get the first definition or translation
        const entries = normalizeEntries(word);

        // Prefer selected definition if available
        const selectedDef = Array.isArray(word.selectedDefinitions) && word.selectedDefinitions.length > 0
            ? word.selectedDefinitions[0]
            : null;

        const isEnDef = definitionLanguage === 'en';
        if (Array.isArray(word.selectedDefinitions) && word.selectedDefinitions.length === 0) {
            timeoutRef.current = setTimeout(playNext, 1000);
            return;
        }
        let textToSpeak = "";

        if (isEnDef) {
            textToSpeak = selectedDef?.definition || word.definition || (entries.length > 0 ? entries[0].definition : "");
        } else {
            textToSpeak = selectedDef?.translation || word.translation || (entries.length > 0 ? entries[0].translation || entries[0].definition : "");
        }

        if (!textToSpeak) {
            // Skip if no definition found
            timeoutRef.current = setTimeout(playNext, 1000);
            return;
        }

        const speakLang = isEnDef ? 'en-US' : 'zh-TW';
        const speakRate = isEnDef ? (audioSpeed || 1.0) : (chineseAudioSpeed || 1.0);

        // Speak Definition with matching language and speed
        speak(textToSpeak, null, {
            lang: speakLang,
            rate: speakRate,
            source: 'vocabulary-player',
            onEnd: () => {
                setPlaybackState('waiting');
                timeoutRef.current = setTimeout(playNext, 1500); // Pause between words
            }
        });
    }, [playNext, definitionLanguage, audioSpeed, chineseAudioSpeed]);

    const speakWord = useCallback((word) => {
        if (!isPlayingRef.current) return;
        setPlaybackState('playing_word');

        // Determine audio source
        const audioUrl = getAudioUrl(word, audioPriority);

        // Speak English Word
        speak(word.word, audioUrl, {
            lang: 'en-US',
            rate: audioSpeed || 1.0,
            source: 'vocabulary-player',
            onEnd: () => {
                // Add a small delay between word and definition
                timeoutRef.current = setTimeout(() => speakDefinition(word), 500);
            }
        });
    }, [speakDefinition, audioPriority, audioSpeed]);

    // Effect to trigger playback when index changes
    useEffect(() => {
        if (isPlaying && currentWord) {
            // Clear any pending timeouts
            if (timeoutRef.current) clearTimeout(timeoutRef.current);

            // Start sequence for this word
            speakWord(currentWord);
        }
    // Playback intentionally advances by index. Word object refreshes must not restart audio.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentWordIndex, isPlaying]);

    const startPlayback = (startIndex = 0) => {
        setIsPlaying(true);
        setCurrentWordIndex(startIndex);
    };

    const stopPlayback = () => {
        setIsPlaying(false);
        setPlaybackState('idle');
        stopAudio();
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };

    const closePlayer = () => {
        stopPlayback();
        setCurrentWordIndex(-1);
    };

    const togglePlayback = () => {
        if (isPlaying) {
            stopPlayback();
        } else {
            startPlayback(currentWordIndex >= 0 ? currentWordIndex : 0);
        }
    };

    // Listen for external audio events (e.g. user clicking an example sentence)
    useEffect(() => {
        const unsubscribe = subscribe((event, data) => {
            if (event === 'play' && data?.source !== 'vocabulary-player') {
                // Another audio source started playing, pause our player
                if (isPlayingRef.current) {
                    setIsPlaying(false);
                    setPlaybackState('idle');
                    if (timeoutRef.current) clearTimeout(timeoutRef.current);
                }
            }
        });
        return unsubscribe;
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopAudio();
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    return {
        isPlaying,
        currentWord,
        currentWordIndex,
        playbackState,
        startPlayback,
        stopPlayback,
        closePlayer,
        togglePlayback,
        playNext,
        playPrevious
    };
};
