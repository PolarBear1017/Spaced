import frequencyText from './english-frequency.txt?raw';

export const LEARNING_GOALS = ['daily', 'work', 'academic', 'custom'];
export const DEFAULT_WORD_USEFULNESS = { enabled: true, goal: 'daily', coreRank: 3000, priorityWords: '' };
export const normalizeWord = (word) => typeof word === 'string'
  ? word.trim().toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/\s+/g, ' ')
  : '';

const frequencyRanks = new Map();
frequencyText.trim().split(/\r?\n/).forEach((line, index) => {
  const word = normalizeWord(line.split(' ')[0]);
  if (!frequencyRanks.has(word)) frequencyRanks.set(word, index + 1);
});

// Editorial starter sets describe contexts, not official exam lists.
const contextWords = {
  daily: 'appointment, restaurant, breakfast, lunch, dinner, grocery, groceries, shopping, ticket, airport, station, travel, hotel, address, directions, weather, family, friend, doctor, hospital, medicine, emergency, rent, neighbor, neighbour, receipt, reservation, passport, luggage, bus, train, taxi, meal, take care, check in',
  work: 'meeting, schedule, deadline, project, colleague, manager, customer, client, invoice, budget, contract, salary, interview, resume, report, presentation, proposal, feedback, negotiate, negotiation, purchase, supplier, delivery, revenue, expense, approval, agenda, email, appointment, business, office, team, task, follow up',
  academic: 'research, analysis, analyze, analyse, evidence, hypothesis, theory, methodology, experiment, variable, data, statistics, significant, correlation, evaluate, evaluation, abstract, citation, reference, thesis, conclusion, concept, framework, literature, journal, publication, survey, sample, objective, inference, empirical, interpret'
};
const toWordSet = (text) => new Set(text.split(/[,\n;\uff0c\uff1b]+/).map(normalizeWord).filter(Boolean));
const contextSets = Object.fromEntries(Object.entries(contextWords).map(([goal, words]) => [goal, toWordSet(words)]));

export const normalizeUsefulnessSettings = (value) => {
  const data = value && typeof value === 'object' ? value : {};
  return {
    enabled: typeof data.enabled === 'boolean' ? data.enabled : true,
    goal: LEARNING_GOALS.includes(data.goal) ? data.goal : 'daily',
    coreRank: [1000, 3000, 5000].includes(data.coreRank) ? data.coreRank : 3000,
    priorityWords: typeof data.priorityWords === 'string' ? data.priorityWords.slice(0, 10000) : ''
  };
};

export const getWordUsefulness = (word, settings = DEFAULT_WORD_USEFULNESS) => {
  const preferences = normalizeUsefulnessSettings(settings);
  const normalized = normalizeWord(word);
  const rank = frequencyRanks.get(normalized) ?? null;
  return {
    rank,
    level: rank === null ? 'unknown' : rank <= preferences.coreRank ? 'core' : rank <= 10000 ? 'extended' : 'lessCommon',
    personalPriority: normalized !== '' && toWordSet(preferences.priorityWords).has(normalized),
    goalMatch: contextSets[preferences.goal]?.has(normalized) ?? false,
    goal: preferences.goal
  };
};
