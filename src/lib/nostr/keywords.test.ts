import { parseKeywordInput } from './keywords';

describe('keyword input parsing', () => {
  it('accepts comma-separated, space-separated, and mixed keywords', () => {
    expect(parseKeywordInput('guns, bitcoin flowers\n#nostr\tbitcoin')).toEqual(['guns', 'bitcoin', 'flowers', '#nostr']);
  });
});
