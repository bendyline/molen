import { createHash } from 'node:crypto';
import { lstatSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const plateName = 'wellcome-khandesh-1880-leaf-592.jpg';
const plateHash = 'a36156cc4b0d9d5f706b048ddaffef85b8f685e6b8c6b1f0ac952bd71779bc1e';
const archive = 'https://archive.org/details/b29353397_0012/page/n592/mode/1up';

/** Match the Qualla map to the separately scanned plate between printed pages 574 and 575. */
export function printedAsirgadMapMatches(file, record, page, info, original, reference) {
  const printed = record.publicationEvidence;
  const wiki = page.revisions[0].slots.main['*'];
  if (
    page.title !== 'File:Asirgad.jpg' ||
    page.revisions[0].revid !== 1066968894 ||
    page.revisions[0].revid !== reference.nativeRevision ||
    info.sha1 !== 'f50917339a611a2c0df09522bd12498b016a743d' ||
    info.size !== original.length ||
    reference.artist !== 'Various' ||
    reference.originalReview?.rendition !== 'exact-published-native-original' ||
    !wiki.includes('{{PD-old-70-1923}}') ||
    !wiki.includes('https://www.flickr.com/photos/britishlibrary/tags/sysnum000403057') ||
    info.extmetadata?.AttributionRequired?.value !== 'false' ||
    info.extmetadata?.Restrictions?.value ||
    printed?.plate !== 'ASIRGAD' ||
    printed?.imprint !== 'Photozincographed Govt. Photo. Office, Poona, 1880' ||
    printed?.publisher !== 'Government Central Press, Bombay' ||
    printed?.volume !== 12 ||
    printed?.year !== 1880 ||
    printed?.repository !== 'Wellcome Library' ||
    printed?.source !== archive ||
    printed?.matchedPlate !== true ||
    printed?.scan?.path !== plateName ||
    printed?.scan?.sha256 !== plateHash
  )
    return false;
  try {
    const scan = join(dirname(file), plateName);
    return (
      lstatSync(scan).isFile() &&
      createHash('sha256').update(readFileSync(scan)).digest('hex') === plateHash
    );
  } catch {
    return false;
  }
}
