# English Frequency Data

`english-frequency.txt` is the unmodified English 50,000-word list from
Hermit Dave's FrequencyWords, based on OpenSubtitles 2018.

- Source: https://github.com/hermitdave/FrequencyWords/blob/master/content/2018/en/en_50k.txt
- Retrieved: 2026-10-13
- Author: Hermit Dave; corpus: OpenSubtitles 2018
- Content license: Creative Commons Attribution-ShareAlike 4.0 International
  (https://creativecommons.org/licenses/by-sa/4.0/)
- License declaration: https://github.com/hermitdave/FrequencyWords#license

The data file remains available under CC BY-SA 4.0. Application code is separate.
Ranks include original tokens, including inflections, names and contractions.
This is subtitle frequency, not a universal usefulness score, CEFR level, Oxford
word list, or exam frequency. Lookup uses exact normalized tokens; missing words
and multiword phrases are unknown, never automatically judged unimportant.

Application bands are configurable: core up to rank 1,000 / 3,000 / 5,000;
extended up to 10,000; less common beyond 10,000 in this corpus. These cutoffs are
product choices, not source-provided proficiency levels.

Learning-context starter sets in `wordUsefulness.js` are small editorial sets
authored for this app, not exhaustive classifications or official exam lists.
User-entered priority words apply independently of corpus coverage and context.
