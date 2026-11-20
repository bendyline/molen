import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const witness = {
  plan: 'cb020e54263be73fea4e8d0514738c43f3682502794634a035e7c4b60c9f0052',
  journalPlate: '10330a8b4951b6759aa50062a0bd6889eb52ed05463f192a8f0cfcc473edc7de',
};
const sheet = 'reference-originals/troitskoy-as-built-1704.jpg';
const corroboratingPlate = 'reference-rights/rodina-2015-rgada-plan-plate.jpg';
const archivePage = 'https://papacoma.narod.ru/maps/taganrog_planes_petr.htm';
const attribution = 'Russian State Archive of Ancient Acts, fond 9, inventory 2, file 66, no. 34';
const scan = 'https://papacoma.narod.ru/maps/maps-images2/taganrog_planes/taganrog_petr_010_b.jpg';

function digest(dir, relative) {
  try {
    const root = fs.realpathSync(dir);
    const file = fs.realpathSync(path.join(root, relative));
    if (!file.startsWith(root + path.sep) || !fs.statSync(file).isFile()) return null;
    return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  } catch {
    return null;
  }
}

export function inspectTaganrogArchiveReference(dir, reference) {
  const review = reference.originalReview;
  const eligible =
    reference.path === sheet &&
    reference.license === 'Public domain' &&
    reference.sourceUrl === archivePage &&
    reference.downloadUrl === scan &&
    reference.archiveCitation === attribution &&
    reference.sha256 === witness.plan &&
    digest(dir, sheet) === witness.plan &&
    digest(dir, corroboratingPlate) === witness.journalPlate &&
    reference.visuallyReviewedForThisPolicy === true &&
    review?.status === 'inspected' &&
    review?.rendition === 'faithful-flat-scan-of-dated-original' &&
    review?.documentDate === '1704-12-26';
  return {
    path: reference.path,
    sourceUrl: reference.sourceUrl,
    eligible,
    blockers: eligible ? [] : ['supplemental-taganrog-original-archival-plan-unverified'],
  };
}
