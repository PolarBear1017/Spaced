import React, { useState, useEffect } from 'react';
import { ArrowUp, ArrowDown, Info, GripVertical, Volume2, RotateCcw, Gauge } from 'lucide-react';
import { useSettingsContext } from '../../contexts/SettingsContext';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    TouchSensor,
    MouseSensor
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { useTranslation } from 'react-i18next';

const SortableItem = ({ id, index, source, moveUp, moveDown, totalCount }) => {
    const { t } = useTranslation();
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 1 : 0,
        position: 'relative',
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={`flex items-center justify-between p-4 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors ${index === 0 ? 'bg-amber-50/30' : ''
                } ${isDragging ? 'opacity-50 bg-gray-100 shadow-lg' : ''}`}
        >
            <div className="flex items-center gap-3">
                <div
                    {...attributes}
                    {...listeners}
                    className="cursor-grab active:cursor-grabbing touch-none p-1 -ml-1 hover:bg-gray-100 rounded"
                >
                    <GripVertical className="w-4 h-4 text-gray-400" />
                </div>
                <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium ${index === 0 ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-500'
                    }`}>
                    {index + 1}
                </span>
                <span className="font-medium text-gray-700">
                    {t(`settings.audioSources.${source}`, { defaultValue: source })}
                </span>
            </div>
            <div className="flex items-center gap-1 opacity-50 hover:opacity-100 transition-opacity">
                <button
                    onClick={() => moveUp(index)}
                    disabled={index === 0}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 disabled:opacity-30 disabled:cursor-not-allowed"
                    title={t('settings.moveUp')}
                >
                    <ArrowUp className="w-4 h-4" />
                </button>
                <button
                    onClick={() => moveDown(index)}
                    disabled={index === totalCount - 1}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 disabled:opacity-30 disabled:cursor-not-allowed"
                    title={t('settings.moveDown')}
                >
                    <ArrowDown className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

const SettingsAudio = () => {
    const { t } = useTranslation();
    const context = useSettingsContext();
    const state = context?.state || {};
    const actions = context?.actions || {};

    const [priority, setPriority] = useState(state.audioSourcePriority || []);
    const [audioSpeed, setAudioSpeed] = useState(state.audioSpeed || 1.0);
    const [chineseAudioSpeed, setChineseAudioSpeed] = useState(state.chineseAudioSpeed || 1.0);
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        // Reset unsaved controls if settings are refreshed outside this panel.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPriority(state.audioSourcePriority || []);
        setAudioSpeed(state.audioSpeed || 1.0);
        setChineseAudioSpeed(state.chineseAudioSpeed || 1.0);
    }, [state.audioSourcePriority, state.audioSpeed, state.chineseAudioSpeed]);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        }),
        useSensor(TouchSensor),
        useSensor(MouseSensor)
    );

    const handleDragEnd = (event) => {
        const { active, over } = event;

        if (active.id !== over.id) {
            setPriority((items) => {
                const oldIndex = items.indexOf(active.id);
                const newIndex = items.indexOf(over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
            setHasChanges(true);
        }
    };

    const moveUp = (index) => {
        if (index === 0) return;
        const newPriority = [...priority];
        [newPriority[index - 1], newPriority[index]] = [newPriority[index], newPriority[index - 1]];
        setPriority(newPriority);
        setHasChanges(true);
    };

    const moveDown = (index) => {
        if (index === priority.length - 1) return;
        const newPriority = [...priority];
        [newPriority[index + 1], newPriority[index]] = [newPriority[index], newPriority[index + 1]];
        setPriority(newPriority);
        setHasChanges(true);
    };

    const handleSave = () => {
        if (actions.setAudioSourcePriority) {
            actions.setAudioSourcePriority(priority);
            actions.setAudioSpeed(audioSpeed);
            actions.setChineseAudioSpeed(chineseAudioSpeed);
            setHasChanges(false);
            alert(t('settings.saved'));
        } else {
            console.error("setAudioSourcePriority action missing");
        }
    };

    const handleReset = () => {
        const defaultSources = ['us', 'uk', 'google', 'yahoo', 'general'];
        setPriority(defaultSources);
        setAudioSpeed(1.0);
        setChineseAudioSpeed(1.0);
        setHasChanges(true);
    };

    return (
        <div className="space-y-6">
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex items-start gap-3">
                <Volume2 className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-sm text-amber-900">
                    <p className="font-medium mb-1">{t('settings.audioPriorityTitle')}</p>
                    <p>{t('settings.audioPriorityDesc')}</p>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext
                        items={priority}
                        strategy={verticalListSortingStrategy}
                    >
                        {priority.map((source, index) => (
                            <SortableItem
                                key={source}
                                id={source}
                                index={index}
                                source={source}
                                moveUp={moveUp}
                                moveDown={moveDown}
                                totalCount={priority.length}
                            />
                        ))}
                    </SortableContext>
                </DndContext>
            </div>

            <div className="space-y-4">
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 flex items-start gap-3">
                    <Gauge className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                    <div className="text-sm text-amber-900">
                        <p className="font-medium mb-1">{t('settings.speechSpeedTitle')}</p>
                        <p>{t('settings.speechSpeedDesc')}</p>
                    </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-sm font-medium text-gray-700">{t('settings.enSpeed')}</label>
                            <span className="text-sm font-bold text-amber-600">{audioSpeed.toFixed(1)}x</span>
                        </div>
                        <input
                            type="range"
                            min="0.5"
                            max="2.0"
                            step="0.1"
                            value={audioSpeed}
                            onChange={(e) => {
                                setAudioSpeed(parseFloat(e.target.value));
                                setHasChanges(true);
                            }}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
                        />
                        <div className="relative w-full h-4 text-xs text-gray-400 mt-2">
                            <span className="absolute left-0">0.5x ({t('settings.speedSlow')})</span>
                            <span className="absolute left-1/3 -translate-x-1/2">1.0x ({t('settings.speedNormal')})</span>
                            <span className="absolute right-0">2.0x ({t('settings.speedFast')})</span>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-gray-100">
                        <div className="flex justify-between items-center mb-2">
                            <label className="text-sm font-medium text-gray-700">{t('settings.zhSpeed')}</label>
                            <span className="text-sm font-bold text-amber-600">{chineseAudioSpeed.toFixed(1)}x</span>
                        </div>
                        <input
                            type="range"
                            min="0.5"
                            max="2.0"
                            step="0.1"
                            value={chineseAudioSpeed}
                            onChange={(e) => {
                                setChineseAudioSpeed(parseFloat(e.target.value));
                                setHasChanges(true);
                            }}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
                        />
                        <div className="relative w-full h-4 text-xs text-gray-400 mt-2">
                            <span className="absolute left-0">0.5x ({t('settings.speedSlow')})</span>
                            <span className="absolute left-1/3 -translate-x-1/2">1.0x ({t('settings.speedNormal')})</span>
                            <span className="absolute right-0">2.0x ({t('settings.speedFast')})</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex justify-between pt-2">
                <button
                    onClick={handleReset}
                    className="px-4 py-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl font-medium transition flex items-center gap-2"
                    title={t('settings.resetDefaultTitle')}
                >
                    <RotateCcw className="w-4 h-4" />
                    {t('settings.resetDefault')}
                </button>
                <button
                    onClick={handleSave}
                    disabled={!hasChanges}
                    className="px-6 py-2 bg-amber-500 text-white rounded-xl font-medium shadow-sm hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                    {t('settings.saveChanges')}
                </button>
            </div>
        </div>
    );
};

export default SettingsAudio;
