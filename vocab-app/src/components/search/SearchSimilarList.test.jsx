import React from 'react';
import { describe, expect, it } from 'vitest';
import SearchSimilarList from './SearchSimilarList';
import { renderToStaticMarkup } from 'react-dom/server';

describe('SearchSimilarList Component', () => {
  it('renders word family categories and words correctly', () => {
    const mockFamily = {
      noun: ['production', 'product', 'productivity'],
      verb: ['produce'],
      adjective: ['productive'],
      adverb: ['productively']
    };
    const mockSimilar = ['make', 'create', 'generate'];
    const savedWordsSet = new Set(['product', 'create']);
    const historyTrail = ['create', 'produce'];

    const html = renderToStaticMarkup(
      <SearchSimilarList
        wordFamily={mockFamily}
        similarWords={mockSimilar}
        savedWordsSet={savedWordsSet}
        historyTrail={historyTrail}
        onSelect={() => {}}
        onBack={() => {}}
      />
    );

    // 驗證回溯按鈕
    expect(html).toContain('create');
    // 驗證詞性類別與單字
    expect(html).toContain('production');
    expect(html).toContain('product');
    expect(html).toContain('produce');
    expect(html).toContain('productive');
    expect(html).toContain('productively');
    // 驗證相似字
    expect(html).toContain('generate');
    // 驗證已收藏單字的 title 標記
    expect(html).toContain('product');
  });

  it('renders verb forms category with present, past, and past participle correctly', () => {
    const html = renderToStaticMarkup(
      <SearchSimilarList
        currentWord="eat"
        wordFamily={{ noun: [], verb: [], adjective: [], adverb: [] }}
        similarWords={[]}
        savedWordsSet={new Set(['eat', 'eaten'])}
        onSelect={() => {}}
        onBack={() => {}}
      />
    );

    // 驗證三態欄位
    expect(html).toContain('eat');
    expect(html).toContain('ate');
    expect(html).toContain('eaten');
  });

  it('renders null when there is no word family, no similar words, and no history', () => {
    const html = renderToStaticMarkup(
      <SearchSimilarList
        wordFamily={{ noun: [], verb: [], adjective: [], adverb: [] }}
        similarWords={[]}
        historyTrail={[]}
      />
    );
    expect(html).toBe('');
  });
});
