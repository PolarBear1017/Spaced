import React, { useRef } from 'react';
import { Volume2, Trash2, Check, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLongPress } from 'use-long-press';
import { speak } from '../../services/speechService';
import { formatDate } from '../../utils/data';
import ProficiencyDots from '../common/ProficiencyDots';
import { usePreferencesContext } from '../../contexts/PreferencesContext';

const HighlightedText = ({ text, query }) => {
    if (!query || !text) return <>{text}</>;

    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return (
        <>
            {parts.map((part, index) =>
                part.toLowerCase() === query.toLowerCase() ? (
                    <span key={index} className="font-bold text-blue-600 bg-blue-50/50 rounded-sm px-0.5">{part}</span>
                ) : (
                    part
                )
            )}
        </>
    );
};

const WordRow = ({
    word,
    isSelectionMode,
    isSelected,
    dragHandleProps,
    onToggleSelect,
    onEnterSelectionMode,
    onOpenDetail,
    onRemoveWordFromFolder,
    activeFolder,
    searchQuery,
    hideMetadata,
    onToggleStar
}) => {
    const { t, i18n } = useTranslation();
    const { state: { preferredAccent } } = usePreferencesContext();
    const longPressTriggeredRef = useRef(false);
    const bindLongPress = useLongPress(() => {
        longPressTriggeredRef.current = true;
        onEnterSelectionMode?.(word.id);
    }, {
        onCancel: () => {
            longPressTriggeredRef.current = false;
        },
        threshold: 500,
        captureEvent: true,
        cancelOnMovement: 25,
        detect: 'pointer',
        filterEvents: () => true
    });

    const handleClick = (event) => {
        if (longPressTriggeredRef.current) {
            longPressTriggeredRef.current = false;
            event.preventDefault();
            event.stopPropagation();
            return;
        }
        if (isSelectionMode) {
            event.preventDefault();
            event.stopPropagation();
            onToggleSelect?.(word.id, event);
            return;
        }
        onOpenDetail?.(word);
        event.stopPropagation();
    };

    const selectedPreview = Array.isArray(word.selectedDefinitions) && word.selectedDefinitions.length > 0
        ? word.selectedDefinitions[0]
        : null;
    const previewText = selectedPreview?.translation
        || selectedPreview?.definition
        || (Array.isArray(word.selectedDefinitions) ? '' : (word.translation || word.definition));

    return (
        <div
            onClick={handleClick}
            className={`p-4 hover:bg-gray-50 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer group ${isSelected ? 'bg-blue-50' : ''}`}
            {...bindLongPress()}
            onContextMenu={(event) => event.preventDefault()}
            data-select-id={word.id}
            data-select-type="word"
        >
            <div>
                <div className="flex items-center gap-2 mb-1">
                    <span className="font-bold text-lg text-gray-800 group-hover:text-blue-600 transition">
                        <HighlightedText text={word.word} query={searchQuery} />
                    </span>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onToggleStar?.(word);
                        }}
                        className={`p-1 rounded-full transition-all duration-200 ${
                            word.isStarred 
                                ? 'text-amber-500 hover:text-amber-600 hover:scale-110' 
                                : 'text-gray-300 hover:text-amber-400 hover:scale-110'
                        }`}
                        title={word.isStarred ? t('library.unstar') : t('library.star')}
                    >
                        <Star className={`w-4.5 h-4.5 ${word.isStarred ? 'fill-amber-500 text-amber-500' : ''}`} />
                    </button>
                    <button onClick={(e) => {
                        e.stopPropagation();
                        // Determine preferred audio URL based on accent preference
                        const audioUrl = preferredAccent === 'uk'
                            ? (word.ukAudioUrl || word.audioUrl || word.usAudioUrl)
                            : (word.usAudioUrl || word.audioUrl || word.ukAudioUrl);
                        speak(word.word, audioUrl);
                    }} className="p-1 rounded-full hover:bg-gray-200 text-gray-400 hover:text-blue-600 transition">
                        <Volume2 className="w-4 h-4" />
                    </button>
                    <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">{word.pos}</span>
                </div>
                <p className="text-gray-600 text-sm">
                    <HighlightedText text={previewText} query={searchQuery} />
                </p>
            </div>
            <div className="flex items-center gap-4">
                {isSelectionMode ? (
                    <button
                        onClick={(event) => {
                            event.stopPropagation();
                            onToggleSelect?.(word.id, event);
                        }}
                        {...dragHandleProps}
                        className={`h-7 w-7 rounded-full border flex items-center justify-center transition ${isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-gray-300 text-transparent'
                            } hover:border-blue-400`}
                        title={t('library.selectWord')}
                    >
                        <Check className="w-4 h-4" />
                    </button>
                ) : (
                    <>
                        {!hideMetadata && (
                            <>
                                <div className="flex flex-col items-end gap-1">
                                    <span className="text-xs text-gray-400">{t('library.comprehensionDegree')}</span>
                                    <ProficiencyDots score={word.proficiencyScore} />
                                </div>
                                <div className="text-right min-w-[80px]">
                                    <div className="text-xs text-gray-400">{t('library.nextReview')}</div>
                                    <div className={`text-sm font-medium ${new Date(word.nextReview) <= new Date() ? 'text-red-500' : 'text-green-600'}`}>
                                        {formatDate(word.nextReview, i18n.language)}
                                    </div>
                                </div>
                            </>
                        )}
                        {onRemoveWordFromFolder && !hideMetadata && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (confirm(t('library.confirmRemoveWordFromFolder', { word: word.word, folder: activeFolder?.name || t('library.thisFolder') }))) {
                                        onRemoveWordFromFolder(word, activeFolder?.id);
                                    }
                                }}
                                className="text-gray-400 hover:text-red-500 p-2 rounded-full hover:bg-red-50 transition"
                                title={t('library.removeWord')}
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default WordRow;
