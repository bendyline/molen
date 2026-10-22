import assert from 'node:assert/strict';
import test from 'node:test';
import { nativeNamedUploaderRelease } from './imagery-primary-rights.mjs';

for (const source of ['own', 'named'])
  test(`native PD-user ${source} source requires the original same photographer and item grant`, () => {
    const name = 'Photographer',
      binding = {
        kind: 'contemporaneous-named-native-photographer',
        username: name,
        revision: 123,
      },
      body =
        source === 'own'
          ? `|Source={{own}}\n|Author=[[User:${name}|${name}]]\n{{PD-user|${name}}}`
          : `|Source=Von [[:de:Benutzerin:${name}|${name}]]\n{{PD-user|${name}}}`,
      page = {
        revisions: [
          {
            revid: 123,
            parentid: 0,
            user: name,
            timestamp: '2014-11-22T12:44:16Z',
            slots: { main: { '*': body } },
          },
        ],
        imageinfo: [
          {
            user: name,
            timestamp: '2014-11-22T12:44:15Z',
            extmetadata: {
              Artist: { value: `<a>${name}</a>` },
              Copyrighted: { value: 'False' },
              AttributionRequired: { value: 'false' },
            },
          },
        ],
      };
    const inspect = () => nativeNamedUploaderRelease(page, name, binding);
    assert.equal(inspect(), true);
    page.revisions[0].slots.main['*'] = body.replace('PD-user|', 'PD-User|');
    assert.equal(inspect(), true);
    page.revisions[0].slots.main['*'] = body.replace(`PD-user|${name}`, 'PD-User|Other');
    assert.equal(inspect(), false);
    page.revisions[0].slots.main['*'] = body;
    for (const [from, to] of [
      [`PD-user|${name}`, 'PD-user|Other'],
      [source === 'own' ? '{{own}}' : `Von [[:de:Benutzerin:${name}|${name}]]`, 'found online'],
    ]) {
      page.revisions[0].slots.main['*'] = body.replace(from, to);
      assert.equal(inspect(), false);
    }
    page.revisions[0].slots.main['*'] = `${body}\n{{cc-by-sa-4.0}}`;
    assert.equal(inspect(), false);
    page.revisions[0].slots.main['*'] = body;
    page.revisions[0].user = 'Other';
    assert.equal(inspect(), false);
    page.revisions[0].user = name;
    page.revisions[0].parentid = 122;
    assert.equal(inspect(), false);
    page.revisions[0].parentid = 0;
    binding.revision = 999;
    assert.equal(inspect(), false);
    binding.revision = 123;
    page.imageinfo.push({ user: 'Other', timestamp: '2014-11-22T12:44:15Z' });
    assert.equal(inspect(), false);
    page.imageinfo.pop();
    page.revisions[0].timestamp = '2014-12-22T12:44:16Z';
    assert.equal(inspect(), false);
    page.revisions[0].timestamp = '2014-11-22T12:44:16Z';
    page.imageinfo[0].extmetadata.Restrictions = { value: 'Permission required' };
    assert.equal(inspect(), false);
    delete page.imageinfo[0].extmetadata.Restrictions;
    if (source === 'own') {
      page.revisions[0].slots.main['*'] = body.replace(`|Author=[[User:${name}|${name}]]`, '');
      assert.equal(inspect(), false);
    } else {
      page.revisions[0].slots.main['*'] = `${body}\n|Author=Unknown`;
      assert.equal(inspect(), false);
    }
  });
