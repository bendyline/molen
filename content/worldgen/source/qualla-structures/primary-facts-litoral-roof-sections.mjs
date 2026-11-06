/** Complete intrinsic numerical roof complements; source interfaces remain explicit estimates. */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const clip = createRequire(
    new URL('../../../../packages/worldgen-earth/package.json', import.meta.url),
  )('polygon-clipping'),
  hash = (b) => `sha256:${createHash('sha256').update(b).digest('hex')}`;
export const litoralRoofSectionCases = {
  'litoral-original-osm-3765-complete-numeric-roof-2023':
    'litoral_western_block_13_outer_roof_sections',
  'litoral-original-VVCM-complete-small-numeric-roof-2023': 'litoral_southeastern_inner_small_roof',
  'litoral-original-9J27-complete-small-numeric-roof-2023': 'litoral_central_eastern_small_roof',
  'litoral-original-8PV4-complete-small-numeric-roof-2023': 'litoral_east_central_inner_small_roof',
  'litoral-original-WR5R-complete-small-numeric-roof-2023':
    'litoral_southeastern_inner_joined_small_roof',
  'litoral-original-ms-e19b-complete-numeric-roof-2023':
    'litoral_central_block_1_eastern_roof_sections',
  'litoral-original-WHH9-complete-unmeasured-numeric-roof-2023':
    'litoral_pavilion_7_inner_low_roof_sections',
  'litoral-original-RMQ4-complete-unmeasured-numeric-roof-2023':
    'litoral_pavilion_7_southeastern_low_roof_sections',
  'litoral-original-9RC7-complete-unmeasured-numeric-roof-2023':
    'litoral_west_central_outer_south_low_building',
  'litoral-original-9R67-complete-unmeasured-numeric-roof-2023':
    'litoral_west_central_outer_south_low_annex',
  'litoral-original-3G56-complete-unmeasured-numeric-roof-2023':
    'litoral_northern_inner_low_building',
  'litoral-original-QVM9-complete-unmeasured-numeric-roof-2023':
    'litoral_pavilion_1_western_low_annex',
  'litoral-original-9RR5-complete-unmeasured-numeric-roof-2023':
    'litoral_west_central_outer_north_low_annex',
  'litoral-original-WWM5-complete-unmeasured-numeric-roof-2023':
    'litoral_northern_western_east_low_annex',
  'litoral-original-WWM2-complete-unmeasured-numeric-roof-2023':
    'litoral_northern_western_west_low_annex',
  'litoral-original-G268-complete-unmeasured-numeric-roof-2023': 'litoral_southern_inner_low_annex',
  'litoral-original-XG6M-complete-unmeasured-numeric-roof-2023':
    'litoral_northwest_boundary_low_building',
  'litoral-original-2CFH-complete-unmeasured-numeric-roof-2023':
    'litoral_northern_central_west_low_annex',
  'litoral-original-8XVR-complete-unmeasured-numeric-roof-2023':
    'litoral_west_central_southern_inner_low_annex',
  'litoral-original-2CGQ-complete-unmeasured-numeric-roof-2023':
    'litoral_northern_central_east_low_annex',
  'litoral-original-CV6G-complete-unmeasured-numeric-roof-2023':
    'litoral_southwest_boundary_low_building',
  'litoral-original-3PJ7-complete-unmeasured-numeric-roof-2023': 'litoral_east_central_low_annex',
  'litoral-original-VV2Q-complete-unmeasured-numeric-roof-2023':
    'litoral_southeastern_inner_low_annex',
  'litoral-original-5Q34-complete-unmeasured-numeric-roof-2023':
    'litoral_eastern_central_north_low_annex',
  'litoral-original-RQP8-complete-unmeasured-numeric-roof-2023':
    'litoral_northwest_western_low_annex',
  'litoral-original-WF9J-complete-unmeasured-numeric-roof-2023':
    'litoral_northern_east_central_low_annex',
  'litoral-original-XW5X-complete-unmeasured-numeric-roof-2023': 'litoral_western_inner_low_annex',
  'litoral-original-HXJ8-complete-unmeasured-numeric-roof-2023':
    'litoral_southwest_inner_low_annex',
  'litoral-original-83RP-complete-unmeasured-numeric-roof-2023':
    'litoral_southern_boundary_roof_edge_sections',
  'litoral-original-MX38-complete-unmeasured-numeric-roof-2023':
    'litoral_pavilion_2_western_low_building',
  'litoral-original-FV36-complete-unmeasured-numeric-roof-2023':
    'litoral_west_central_outer_low_building',
  'litoral-original-CW4G-complete-unmeasured-numeric-roof-2023':
    'litoral_west_central_inner_low_building',
  'litoral-original-HW3G-complete-unmeasured-numeric-roof-2023':
    'litoral_southwest_service_roof_sections',
  'litoral-original-R6FM-complete-lower-score-numeric-roof-2023':
    'litoral_pavilion_6_southern_roof_sections',
  'litoral-original-MXRJ-complete-lower-score-numeric-roof-2023':
    'litoral_pavilion_1_western_roof_extension',
  'litoral-original-V67P-complete-lower-score-numeric-roof-2023':
    'litoral_pavilion_5_western_roof_extension',
  'litoral-original-J3CW-complete-lower-score-numeric-roof-2023':
    'litoral_northwest_inner_building',
  'litoral-original-HP2P-complete-lower-score-numeric-roof-2023':
    'litoral_southeast_inner_building',
  'litoral-original-P7C6-complete-lower-score-numeric-roof-2023':
    'litoral_pavilion_6_western_roof_sections',
  'litoral-original-VMFQ-complete-lower-score-numeric-roof-2023':
    'litoral_pavilion_7_eastern_roof_sections',
  'litoral-original-C5XM-complete-lower-score-numeric-roof-2023':
    'litoral_north_central_inner_building',
  'litoral-original-MR7C-complete-lower-score-numeric-roof-2023': 'litoral_northwest_west_building',
  'litoral-original-2458-complete-lower-score-numeric-roof-2023':
    'litoral_pavilion_4_southwestern_roof_sections',
  'litoral-original-PV2X-complete-lower-score-numeric-roof-2023': 'litoral_northwest_inner_annex',
  'litoral-original-P296-complete-lower-score-numeric-roof-2023':
    'litoral_pavilion_1_eastern_roof_extension',
  'litoral-original-FFM9-complete-lower-score-numeric-roof-2023':
    'litoral_south_inner_small_building',
  'litoral-original-C4P6-complete-lower-score-numeric-roof-2023':
    'litoral_central_west_small_annex',
  'litoral-original-VWG8-complete-lower-score-numeric-roof-2023':
    'litoral_southwest_inner_small_building',
  'litoral-original-RPQ4-complete-lower-score-numeric-roof-2023':
    'litoral_northwestern_inner_small_building',
  'litoral-original-GF8M-complete-lower-score-numeric-roof-2023':
    'litoral_pavilion_10_southern_roof_edge_joins',
  'litoral-original-JX4C-complete-lower-score-numeric-roof-2023':
    'litoral_northwest_central_building',
  'litoral-original-F264-complete-lower-score-numeric-roof-2023': 'litoral_west_central_building',
  'litoral-original-RGR7-complete-lower-score-numeric-roof-2023': 'litoral_south_central_building',
  'litoral-original-4CGQ-complete-lower-score-numeric-roof-2023':
    'litoral_southeast_central_building',
  'litoral-original-FPVP-complete-southern-boundary-roof-2023':
    'litoral_southeastern_boundary_building',
  'litoral-original-CGXF-complete-southern-boundary-roof-2023':
    'litoral_southern_boundary_building',
  'litoral-original-9X54-complete-southern-boundary-roof-2023':
    'litoral_southwestern_boundary_roof_sections',
  'litoral-original-4MQ9-complete-small-roof-body-2023': 'litoral_west_central_small_building',
  'litoral-original-4MPH-complete-small-roof-body-2023': 'litoral_east_central_small_building',
  'litoral-original-6M87-complete-small-roof-body-2023':
    'litoral_west_central_north_small_building',
  'litoral-original-QP98-complete-small-roof-body-2023': 'litoral_northwest_small_building',
  'litoral-original-HX3G-complete-small-roof-body-2023': 'litoral_southwest_small_building',
  'litoral-original-2QCM-complete-small-roof-body-2023': 'litoral_northern_small_building',
  'litoral-original-J36W-complete-small-roof-body-2023': 'litoral_southwest_north_small_building',
  'litoral-original-VV2G-complete-small-roof-body-2023': 'litoral_southwest_small_roof_extension',
  'litoral-original-VW7M-complete-small-roof-body-2023': 'litoral_southwest_east_small_building',
  'litoral-original-P2P6-complete-small-roof-body-2023': 'litoral_southeast_east_small_building',
  'litoral-original-W22P-complete-small-roof-body-2023': 'litoral_southwest_central_small_building',
  'litoral-original-GG6F-complete-small-roof-body-2023': 'litoral_southern_central_small_building',
  'litoral-original-4427-complete-derived-northwest-roof-sections-2023':
    'litoral_pavilion_4_northwest_roof_extension',
  'litoral-original-VH57-complete-derived-east-roof-section-2023':
    'litoral_pavilion_7_east_roof_extension',
  'litoral-original-47WJ-complete-derived-northeast-roof-section-2023':
    'litoral_pavilion_4_northeast_roof_sections',
  'litoral-original-P9Q8-complete-derived-north-central-roof-sections-2023':
    'litoral_north_central_roof_sections',
  'litoral-original-H9H4-complete-derived-central-link-roof-sections-2023':
    'litoral_central_link_roof_sections',
  'litoral-original-HFPR-complete-derived-eastern-roof-section-2023':
    'litoral_pavilion_10_eastern_roof_extension',
  'litoral-original-M945-complete-derived-three-roof-sections-2023':
    'litoral_pavilion_11_connecting_roof_sections',
};
const cfgs = {
  litoral_western_block_13_outer_roof_sections: {
    code: 'be102b6e-8933-4737-b95a-616a5694536c',
    overture: true,
    sourceDataset: 'OpenStreetMap',
    osmWayId: '1235043765',
    osmWayHash: 'sha256:84c6d7f96e530b0f88767a4ea630ce351448713f6a4bd24475b291d2370a1917',
    score: null,
    sourceUrl:
      'https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com/release/2026-10-21.0/theme=buildings/type=building/part-00003-cc865024-4c8e-5276-b51f-e8d81cd96612-c000.zstd.parquet',
    sourceDatasetHash: 'sha256:b9904a109847a10cd182c3464919a664152b8720dd1bca65fcfea5851a9b2bf2',
    originalRecordHash: 'sha256:d1ec7161d219ba668368621a0562125a6e4ce7676e5f1777179402d416b654c0',
    corners: [8],
    counts: [11],
    medians: [5],
    joinParts: [],
    allowOwnPlinth: true,
    nominalAbsentHeight: 3.5,
    lowScore: false,
    floorPolicy: 'material-neighbor-atleast-one-percent-v1',
    boundaryFraction: 1,
    boundarySnapshotHash: 'sha256:3a6136ee675f2b93c9718ec7a976cf96b05aa15b6fc23273282ddb945d5385f7',
    boundaryResponseHash: 'sha256:552d04e94ab444ffc05f5381368361eb416a5db4b8ebdc8e4a5cb493ad549e07',
  },
  litoral_southeastern_inner_small_roof: {
    fullOriginalSmallSource: true,
    code: '6792W3W4+VVCM',
    // biome-ignore lint/suspicious/noApproximativeNumericConstant: Original source rank, not a mathematical constant.
    score: 0.707,
    corners: [4],
    counts: [0],
    medians: [null],
    joinParts: [],
    allowOwnPlinth: true,
    nominalAbsentHeight: 3.5,
    explicitUnmeasuredHeight: true,
    lowScore: true,
    floorPolicy: 'material-neighbor-atleast-one-percent-v1',
    boundaryFraction: 1,
    boundarySnapshotHash: 'sha256:3a6136ee675f2b93c9718ec7a976cf96b05aa15b6fc23273282ddb945d5385f7',
    boundaryResponseHash: 'sha256:552d04e94ab444ffc05f5381368361eb416a5db4b8ebdc8e4a5cb493ad549e07',
  },
  litoral_central_eastern_small_roof: {
    fullOriginalSmallSource: true,
    code: '6792W3X4+9J27',
    score: 0.7051,
    corners: [4],
    counts: [0],
    medians: [null],
    joinParts: [],
    allowOwnPlinth: true,
    nominalAbsentHeight: 3.5,
    explicitUnmeasuredHeight: true,
    lowScore: true,
    floorPolicy: 'material-neighbor-atleast-one-percent-v1',
    boundaryFraction: 1,
    boundarySnapshotHash: 'sha256:3a6136ee675f2b93c9718ec7a976cf96b05aa15b6fc23273282ddb945d5385f7',
    boundaryResponseHash: 'sha256:552d04e94ab444ffc05f5381368361eb416a5db4b8ebdc8e4a5cb493ad549e07',
  },
  litoral_east_central_inner_small_roof: {
    fullOriginalSmallSource: true,
    code: '6792W3X4+8PV4',
    score: 0.6943,
    corners: [4],
    counts: [0],
    medians: [null],
    joinParts: [],
    allowOwnPlinth: true,
    nominalAbsentHeight: 3.5,
    explicitUnmeasuredHeight: true,
    lowScore: true,
    floorPolicy: 'material-neighbor-atleast-one-percent-v1',
    boundaryFraction: 1,
    boundarySnapshotHash: 'sha256:3a6136ee675f2b93c9718ec7a976cf96b05aa15b6fc23273282ddb945d5385f7',
    boundaryResponseHash: 'sha256:552d04e94ab444ffc05f5381368361eb416a5db4b8ebdc8e4a5cb493ad549e07',
  },
  litoral_southeastern_inner_joined_small_roof: {
    fullOriginalSmallSource: true,
    code: '6792W3W4+WR8H~6792W3W4+WR5R',
    score: null,
    corners: [8],
    counts: [0],
    medians: [null],
    joinParts: [],
    allowOwnPlinth: true,
    nominalAbsentHeight: 3.5,
    explicitUnmeasuredHeight: true,
    lowScore: true,
    floorPolicy: 'material-neighbor-atleast-one-percent-v1',
    boundaryFraction: 1,
    boundarySnapshotHash: 'sha256:3a6136ee675f2b93c9718ec7a976cf96b05aa15b6fc23273282ddb945d5385f7',
    boundaryResponseHash: 'sha256:552d04e94ab444ffc05f5381368361eb416a5db4b8ebdc8e4a5cb493ad549e07',
    googleUnion: true,
    scores: [0.6782, 0.6571],
    originalCsvRowsHash: 'sha256:9e91b3a49e5611bbfc941cf78e8b97bcc1487072259f624d347d400c2f0ad853',
  },
  litoral_central_block_1_eastern_roof_sections: {
    code: 'e19b21b0-ca0a-4125-8e30-74f249ad8258',
    overture: true,
    score: null,
    sourceUrl:
      'https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com/release/2026-10-21.0/theme=buildings/type=building/part-00003-cc865024-4c8e-5276-b51f-e8d81cd96612-c000.zstd.parquet',
    sourceDatasetHash: 'sha256:b9904a109847a10cd182c3464919a664152b8720dd1bca65fcfea5851a9b2bf2',
    originalRecordHash: 'sha256:d475609957b593a9c22270d5eb950d90a4e125f49c999f6f270e958ef28cfc9f',
    corners: [7],
    counts: [8],
    medians: [4.5],
    joinParts: [],
    allowOwnPlinth: true,
    nominalAbsentHeight: 3.5,
    lowScore: false,
    floorPolicy: 'material-neighbor-atleast-one-percent-v1',
    boundaryFraction: 0.9999999999999997,
    boundarySnapshotHash: 'sha256:3a6136ee675f2b93c9718ec7a976cf96b05aa15b6fc23273282ddb945d5385f7',
    boundaryResponseHash: 'sha256:552d04e94ab444ffc05f5381368361eb416a5db4b8ebdc8e4a5cb493ad549e07',
  },
  litoral_pavilion_7_inner_low_roof_sections: {
    code: '6792W3W4+WHH9',
    score: 0.7,
    corners: [6],
    counts: [0],
    medians: [null],
    joinParts: [],
    minimumBoundaryFraction: 0.8,
    boundaryCrossingEstimate: false,
    allowOwnPlinth: true,
    nominalAbsentHeight: 3.5,
    explicitUnmeasuredHeight: true,
    lowScore: true,
    floorPolicy: 'material-neighbor-atleast-one-percent-v1',
    boundaryFraction: 1,
    boundarySnapshotHash: 'sha256:3a6136ee675f2b93c9718ec7a976cf96b05aa15b6fc23273282ddb945d5385f7',
    boundaryResponseHash: 'sha256:552d04e94ab444ffc05f5381368361eb416a5db4b8ebdc8e4a5cb493ad549e07',
  },
  litoral_pavilion_7_southeastern_low_roof_sections: {
    code: '6792W3W4+RMQ4',
    score: 0.7468,
    corners: [8, 3],
    counts: [0, 0],
    medians: [null, null],
    joinParts: [1],
    minimumBoundaryFraction: 0.8,
    boundaryCrossingEstimate: false,
    allowOwnPlinth: true,
    nominalAbsentHeight: 3.5,
    explicitUnmeasuredHeight: true,
    lowScore: true,
    floorPolicy: 'material-neighbor-atleast-one-percent-v1',
    boundaryFraction: 1,
    boundarySnapshotHash: 'sha256:3a6136ee675f2b93c9718ec7a976cf96b05aa15b6fc23273282ddb945d5385f7',
    boundaryResponseHash: 'sha256:552d04e94ab444ffc05f5381368361eb416a5db4b8ebdc8e4a5cb493ad549e07',
  },
  litoral_west_central_outer_south_low_building: {
    code: '6792W3X3+9RC7',
    score: 0.6831,
    corners: [4],
    counts: [0],
    medians: [null],
    joinParts: [],
    minimumBoundaryFraction: 0.8,
    boundaryCrossingEstimate: false,
    allowOwnPlinth: true,
    nominalAbsentHeight: 3.5,
    explicitUnmeasuredHeight: true,
    lowScore: true,
    floorPolicy: 'material-neighbor-atleast-one-percent-v1',
    boundaryFraction: 1,
    boundarySnapshotHash: 'sha256:3a6136ee675f2b93c9718ec7a976cf96b05aa15b6fc23273282ddb945d5385f7',
    boundaryResponseHash: 'sha256:552d04e94ab444ffc05f5381368361eb416a5db4b8ebdc8e4a5cb493ad549e07',
  },
  litoral_west_central_outer_south_low_annex: {
    code: '6792W3X3+9R67',
    score: 0.6919,
    corners: [4],
    counts: [0],
    medians: [null],
    joinParts: [],
    minimumBoundaryFraction: 0.8,
    boundaryCrossingEstimate: false,
    allowOwnPlinth: true,
    nominalAbsentHeight: 3.5,
    explicitUnmeasuredHeight: true,
    lowScore: true,
    floorPolicy: 'material-neighbor-atleast-one-percent-v1',
    boundaryFraction: 1,
    boundarySnapshotHash: 'sha256:3a6136ee675f2b93c9718ec7a976cf96b05aa15b6fc23273282ddb945d5385f7',
    boundaryResponseHash: 'sha256:552d04e94ab444ffc05f5381368361eb416a5db4b8ebdc8e4a5cb493ad549e07',
  },
  litoral_northern_inner_low_building: {
    code: '6792X324+3G56',
    score: 0.727,
    corners: [4],
    counts: [0],
    medians: [null],
    joinParts: [],
    minimumBoundaryFraction: 0.8,
    boundaryCrossingEstimate: false,
    allowOwnPlinth: true,
    nominalAbsentHeight: 3.5,
    explicitUnmeasuredHeight: true,
    lowScore: true,
    floorPolicy: 'material-neighbor-atleast-one-percent-v1',
    boundaryFraction: 1.0000000000000053,
    boundarySnapshotHash: 'sha256:3a6136ee675f2b93c9718ec7a976cf96b05aa15b6fc23273282ddb945d5385f7',
    boundaryResponseHash: 'sha256:552d04e94ab444ffc05f5381368361eb416a5db4b8ebdc8e4a5cb493ad549e07',
  },
  litoral_pavilion_1_western_low_annex: {
    code: '6792W3X3+QVM9',
    score: 0.6966,
    corners: [4],
    counts: [0],
    medians: [null],
    joinParts: [],
    minimumBoundaryFraction: 0.8,
    boundaryCrossingEstimate: false,
    allowOwnPlinth: true,
    nominalAbsentHeight: 3.5,
    explicitUnmeasuredHeight: true,
    lowScore: true,
    floorPolicy: 'material-neighbor-atleast-one-percent-v1',
    boundaryFraction: 1,
    boundarySnapshotHash: 'sha256:3a6136ee675f2b93c9718ec7a976cf96b05aa15b6fc23273282ddb945d5385f7',
    boundaryResponseHash: 'sha256:552d04e94ab444ffc05f5381368361eb416a5db4b8ebdc8e4a5cb493ad549e07',
  },
  litoral_west_central_outer_north_low_annex: {
    code: '6792W3X3+9RR5',
    score: 0.6813,
    corners: [4],
    counts: [0],
    medians: [null],
    joinParts: [],
    minimumBoundaryFraction: 0.8,
    boundaryCrossingEstimate: false,
    allowOwnPlinth: true,
    nominalAbsentHeight: 3.5,
    explicitUnmeasuredHeight: true,
    lowScore: true,
    floorPolicy: 'material-neighbor-atleast-one-percent-v1',
    boundaryFraction: 1,
    boundarySnapshotHash: 'sha256:3a6136ee675f2b93c9718ec7a976cf96b05aa15b6fc23273282ddb945d5385f7',
    boundaryResponseHash: 'sha256:552d04e94ab444ffc05f5381368361eb416a5db4b8ebdc8e4a5cb493ad549e07',
  },
  litoral_northern_western_east_low_annex: {
    code: '6792W3X3+WWM5',
    score: 0.6906,
    corners: [4],
    counts: [0],
    medians: [null],
    joinParts: [],
    minimumBoundaryFraction: 0.8,
    boundaryCrossingEstimate: false,
    allowOwnPlinth: true,
    nominalAbsentHeight: 3.5,
    explicitUnmeasuredHeight: true,
    lowScore: true,
    floorPolicy: 'material-neighbor-atleast-one-percent-v1',
    boundaryFraction: 1,
    boundarySnapshotHash: 'sha256:3a6136ee675f2b93c9718ec7a976cf96b05aa15b6fc23273282ddb945d5385f7',
    boundaryResponseHash: 'sha256:552d04e94ab444ffc05f5381368361eb416a5db4b8ebdc8e4a5cb493ad549e07',
  },
  litoral_northern_western_west_low_annex: {
    code: '6792W3X3+WWM2',
    score: 0.7432,
    corners: [4],
    counts: [0],
    medians: [null],
    joinParts: [],
    minimumBoundaryFraction: 0.8,
    boundaryCrossingEstimate: false,
    allowOwnPlinth: true,
    nominalAbsentHeight: 3.5,
    explicitUnmeasuredHeight: true,
    lowScore: true,
    floorPolicy: 'material-neighbor-atleast-one-percent-v1',
    boundaryFraction: 1,
    boundarySnapshotHash: 'sha256:3a6136ee675f2b93c9718ec7a976cf96b05aa15b6fc23273282ddb945d5385f7',
    boundaryResponseHash: 'sha256:552d04e94ab444ffc05f5381368361eb416a5db4b8ebdc8e4a5cb493ad549e07',
  },
  litoral_southern_inner_low_annex: {
    code: '6792W3W4+G268',
    score: 0.7251,
    corners: [4],
    counts: [0],
    medians: [null],
    joinParts: [],
    minimumBoundaryFraction: 0.8,
    boundaryCrossingEstimate: false,
    allowOwnPlinth: true,
    nominalAbsentHeight: 3.5,
    explicitUnmeasuredHeight: true,
    lowScore: true,
    floorPolicy: 'material-neighbor-atleast-one-percent-v1',
    boundaryFraction: 1,
    boundarySnapshotHash: 'sha256:3a6136ee675f2b93c9718ec7a976cf96b05aa15b6fc23273282ddb945d5385f7',
    boundaryResponseHash: 'sha256:552d04e94ab444ffc05f5381368361eb416a5db4b8ebdc8e4a5cb493ad549e07',
  },
  litoral_northwest_boundary_low_building: {
    code: '6792W3X3+XG6M',
    score: 0.7526,
    corners: [4],
    counts: [0],
    medians: [null],
    joinParts: [],
    minimumBoundaryFraction: 0.8,
    boundaryCrossingEstimate: false,
    allowOwnPlinth: true,
    nominalAbsentHeight: 3.5,
    explicitUnmeasuredHeight: true,
    lowScore: true,
    floorPolicy: 'material-neighbor-atleast-one-percent-v1',
    boundaryFraction: 1,
    boundarySnapshotHash: 'sha256:3a6136ee675f2b93c9718ec7a976cf96b05aa15b6fc23273282ddb945d5385f7',
    boundaryResponseHash: 'sha256:552d04e94ab444ffc05f5381368361eb416a5db4b8ebdc8e4a5cb493ad549e07',
  },
  litoral_northern_central_west_low_annex: {
    code: '6792X324+2CFH',
    score: 0.7092,
    corners: [4],
    counts: [0],
    medians: [null],
    joinParts: [],
    minimumBoundaryFraction: 0.8,
    boundaryCrossingEstimate: false,
    allowOwnPlinth: true,
    nominalAbsentHeight: 3.5,
    explicitUnmeasuredHeight: true,
    lowScore: true,
    floorPolicy: 'material-neighbor-atleast-one-percent-v1',
    boundaryFraction: 1,
    boundarySnapshotHash: 'sha256:3a6136ee675f2b93c9718ec7a976cf96b05aa15b6fc23273282ddb945d5385f7',
    boundaryResponseHash: 'sha256:552d04e94ab444ffc05f5381368361eb416a5db4b8ebdc8e4a5cb493ad549e07',
  },
  litoral_west_central_southern_inner_low_annex: {
    code: '6792W3X3+8XVR',
    score: 0.6683,
    corners: [6],
    counts: [0],
    medians: [null],
    joinParts: [],
    minimumBoundaryFraction: 0.8,
    boundaryCrossingEstimate: false,
    allowOwnPlinth: true,
    nominalAbsentHeight: 3.5,
    explicitUnmeasuredHeight: true,
    lowScore: true,
    floorPolicy: 'material-neighbor-atleast-one-percent-v1',
    boundaryFraction: 1,
    boundarySnapshotHash: 'sha256:3a6136ee675f2b93c9718ec7a976cf96b05aa15b6fc23273282ddb945d5385f7',
    boundaryResponseHash: 'sha256:552d04e94ab444ffc05f5381368361eb416a5db4b8ebdc8e4a5cb493ad549e07',
  },
  litoral_northern_central_east_low_annex: {
    code: '6792X324+2CGQ',
    score: 0.7235,
    corners: [4],
    counts: [0],
    medians: [null],
    joinParts: [],
    minimumBoundaryFraction: 0.8,
    boundaryCrossingEstimate: false,
    allowOwnPlinth: true,
    nominalAbsentHeight: 3.5,
    explicitUnmeasuredHeight: true,
    lowScore: true,
    floorPolicy: 'material-neighbor-atleast-one-percent-v1',
    boundaryFraction: 1,
    boundarySnapshotHash: 'sha256:3a6136ee675f2b93c9718ec7a976cf96b05aa15b6fc23273282ddb945d5385f7',
    boundaryResponseHash: 'sha256:552d04e94ab444ffc05f5381368361eb416a5db4b8ebdc8e4a5cb493ad549e07',
  },
  litoral_southwest_boundary_low_building: {
    code: '6792W3W3+CV6G',
    score: 0.7161,
    corners: [4],
    counts: [0],
    medians: [null],
    joinParts: [],
    minimumBoundaryFraction: 0.65,
    boundaryCrossingEstimate: true,
    allowOwnPlinth: true,
    nominalAbsentHeight: 3.5,
    explicitUnmeasuredHeight: true,
    lowScore: true,
    floorPolicy: 'material-neighbor-atleast-one-percent-v1',
    boundaryFraction: 0.6996048226356693,
    boundarySnapshotHash: 'sha256:3a6136ee675f2b93c9718ec7a976cf96b05aa15b6fc23273282ddb945d5385f7',
    boundaryResponseHash: 'sha256:552d04e94ab444ffc05f5381368361eb416a5db4b8ebdc8e4a5cb493ad549e07',
  },
  litoral_east_central_low_annex: {
    code: '6792W3X4+3PJ7',
    score: 0.683,
    corners: [4],
    counts: [0],
    medians: [null],
    joinParts: [],
    minimumBoundaryFraction: 0.8,
    boundaryCrossingEstimate: false,
    allowOwnPlinth: true,
    nominalAbsentHeight: 3.5,
    explicitUnmeasuredHeight: true,
    lowScore: true,
    floorPolicy: 'material-neighbor-atleast-one-percent-v1',
    boundaryFraction: 1,
    boundarySnapshotHash: 'sha256:3a6136ee675f2b93c9718ec7a976cf96b05aa15b6fc23273282ddb945d5385f7',
    boundaryResponseHash: 'sha256:552d04e94ab444ffc05f5381368361eb416a5db4b8ebdc8e4a5cb493ad549e07',
  },
  litoral_southeastern_inner_low_annex: {
    code: '6792W3W4+VV2Q',
    score: 0.6881,
    corners: [4],
    counts: [0],
    medians: [null],
    joinParts: [],
    minimumBoundaryFraction: 0.8,
    boundaryCrossingEstimate: false,
    allowOwnPlinth: true,
    nominalAbsentHeight: 3.5,
    explicitUnmeasuredHeight: true,
    lowScore: true,
    floorPolicy: 'material-neighbor-atleast-one-percent-v1',
    boundaryFraction: 1,
    boundarySnapshotHash: 'sha256:3a6136ee675f2b93c9718ec7a976cf96b05aa15b6fc23273282ddb945d5385f7',
    boundaryResponseHash: 'sha256:552d04e94ab444ffc05f5381368361eb416a5db4b8ebdc8e4a5cb493ad549e07',
  },
  litoral_eastern_central_north_low_annex: {
    code: '6792W3X4+5Q34',
    score: 0.6664,
    corners: [4],
    counts: [0],
    medians: [null],
    joinParts: [],
    minimumBoundaryFraction: 0.8,
    boundaryCrossingEstimate: false,
    allowOwnPlinth: true,
    nominalAbsentHeight: 3.5,
    explicitUnmeasuredHeight: true,
    lowScore: true,
    floorPolicy: 'material-neighbor-atleast-one-percent-v1',
    boundaryFraction: 1,
    boundarySnapshotHash: 'sha256:3a6136ee675f2b93c9718ec7a976cf96b05aa15b6fc23273282ddb945d5385f7',
    boundaryResponseHash: 'sha256:552d04e94ab444ffc05f5381368361eb416a5db4b8ebdc8e4a5cb493ad549e07',
  },
  litoral_northwest_western_low_annex: {
    code: '6792W3X3+RQP8',
    score: 0.6667,
    corners: [4],
    counts: [0],
    medians: [null],
    joinParts: [],
    minimumBoundaryFraction: 0.8,
    boundaryCrossingEstimate: false,
    allowOwnPlinth: true,
    nominalAbsentHeight: 3.5,
    explicitUnmeasuredHeight: true,
    lowScore: true,
    floorPolicy: 'material-neighbor-atleast-one-percent-v1',
    boundaryFraction: 1,
    boundarySnapshotHash: 'sha256:3a6136ee675f2b93c9718ec7a976cf96b05aa15b6fc23273282ddb945d5385f7',
    boundaryResponseHash: 'sha256:552d04e94ab444ffc05f5381368361eb416a5db4b8ebdc8e4a5cb493ad549e07',
  },
  litoral_northern_east_central_low_annex: {
    code: '6792W3X4+WF9J',
    score: 0.687,
    corners: [4],
    counts: [0],
    medians: [null],
    joinParts: [],
    minimumBoundaryFraction: 0.8,
    boundaryCrossingEstimate: false,
    allowOwnPlinth: true,
    nominalAbsentHeight: 3.5,
    explicitUnmeasuredHeight: true,
    lowScore: true,
    floorPolicy: 'material-neighbor-atleast-one-percent-v1',
    boundaryFraction: 1.0000000000000056,
    boundarySnapshotHash: 'sha256:3a6136ee675f2b93c9718ec7a976cf96b05aa15b6fc23273282ddb945d5385f7',
    boundaryResponseHash: 'sha256:552d04e94ab444ffc05f5381368361eb416a5db4b8ebdc8e4a5cb493ad549e07',
  },
  litoral_western_inner_low_annex: {
    code: '6792W3W3+XW5X',
    score: 0.6836,
    corners: [4],
    counts: [0],
    medians: [null],
    joinParts: [],
    onlyRoofJoin: false,
    allowOwnPlinth: true,
    nominalAbsentHeight: 3.5,
    explicitUnmeasuredHeight: true,
    lowScore: true,
    floorPolicy: 'material-neighbor-atleast-one-percent-v1',
    boundaryFraction: 1,
    boundarySnapshotHash: 'sha256:3a6136ee675f2b93c9718ec7a976cf96b05aa15b6fc23273282ddb945d5385f7',
    boundaryResponseHash: 'sha256:552d04e94ab444ffc05f5381368361eb416a5db4b8ebdc8e4a5cb493ad549e07',
  },
  litoral_southwest_inner_low_annex: {
    code: '6792W3W3+HXJ8',
    score: 0.765,
    corners: [6],
    counts: [0],
    medians: [null],
    joinParts: [],
    onlyRoofJoin: false,
    allowOwnPlinth: true,
    nominalAbsentHeight: 3.5,
    explicitUnmeasuredHeight: true,
    lowScore: true,
    floorPolicy: 'material-neighbor-atleast-one-percent-v1',
    boundaryFraction: 1,
    boundarySnapshotHash: 'sha256:3a6136ee675f2b93c9718ec7a976cf96b05aa15b6fc23273282ddb945d5385f7',
    boundaryResponseHash: 'sha256:552d04e94ab444ffc05f5381368361eb416a5db4b8ebdc8e4a5cb493ad549e07',
  },
  litoral_southern_boundary_roof_edge_sections: {
    code: '6792W3W4+83RP',
    score: 0.6651,
    corners: [8],
    counts: [0],
    medians: [null],
    joinParts: [0],
    onlyRoofJoin: true,
    allowOwnPlinth: true,
    nominalAbsentHeight: 3.5,
    explicitUnmeasuredHeight: true,
    lowScore: true,
    floorPolicy: 'material-neighbor-atleast-one-percent-v1',
    boundaryFraction: 1,
    boundarySnapshotHash: 'sha256:3a6136ee675f2b93c9718ec7a976cf96b05aa15b6fc23273282ddb945d5385f7',
    boundaryResponseHash: 'sha256:552d04e94ab444ffc05f5381368361eb416a5db4b8ebdc8e4a5cb493ad549e07',
  },
  litoral_pavilion_2_western_low_building: {
    code: '6792W3X3+MX38',
    score: 0.7654,
    corners: [4],
    counts: [0],
    medians: [null],
    joinParts: [],
    allowOwnPlinth: true,
    nominalAbsentHeight: 3.5,
    explicitUnmeasuredHeight: true,
    lowScore: true,
    floorPolicy: 'material-neighbor-atleast-one-percent-v1',
    boundaryFraction: 0.9999999999999993,
    boundarySnapshotHash: 'sha256:3a6136ee675f2b93c9718ec7a976cf96b05aa15b6fc23273282ddb945d5385f7',
    boundaryResponseHash: 'sha256:552d04e94ab444ffc05f5381368361eb416a5db4b8ebdc8e4a5cb493ad549e07',
  },
  litoral_west_central_outer_low_building: {
    code: '6792W3X3+FV36',
    score: 0.6901,
    corners: [6],
    counts: [0],
    medians: [null],
    joinParts: [],
    allowOwnPlinth: true,
    nominalAbsentHeight: 3.5,
    explicitUnmeasuredHeight: true,
    lowScore: true,
    floorPolicy: 'material-neighbor-atleast-one-percent-v1',
    boundaryFraction: 1,
    boundarySnapshotHash: 'sha256:3a6136ee675f2b93c9718ec7a976cf96b05aa15b6fc23273282ddb945d5385f7',
    boundaryResponseHash: 'sha256:552d04e94ab444ffc05f5381368361eb416a5db4b8ebdc8e4a5cb493ad549e07',
  },
  litoral_west_central_inner_low_building: {
    code: '6792W3X3+CW4G',
    score: 0.6506,
    corners: [4],
    counts: [0],
    medians: [null],
    joinParts: [],
    allowOwnPlinth: true,
    nominalAbsentHeight: 3.5,
    explicitUnmeasuredHeight: true,
    lowScore: true,
    floorPolicy: 'material-neighbor-atleast-one-percent-v1',
    boundaryFraction: 1,
    boundarySnapshotHash: 'sha256:3a6136ee675f2b93c9718ec7a976cf96b05aa15b6fc23273282ddb945d5385f7',
    boundaryResponseHash: 'sha256:552d04e94ab444ffc05f5381368361eb416a5db4b8ebdc8e4a5cb493ad549e07',
  },
  litoral_southwest_service_roof_sections: {
    code: '6792W3W3+HW3G',
    score: 0.7264,
    corners: [6],
    counts: [0],
    medians: [null],
    joinParts: [],
    allowOwnPlinth: true,
    nominalAbsentHeight: 3.5,
    explicitUnmeasuredHeight: true,
    lowScore: true,
    floorPolicy: 'material-neighbor-atleast-one-percent-v1',
    boundaryFraction: 1,
    boundarySnapshotHash: 'sha256:3a6136ee675f2b93c9718ec7a976cf96b05aa15b6fc23273282ddb945d5385f7',
    boundaryResponseHash: 'sha256:552d04e94ab444ffc05f5381368361eb416a5db4b8ebdc8e4a5cb493ad549e07',
  },
  litoral_pavilion_6_southern_roof_sections: {
    code: '6792W3W4+R6FM',
    score: 0.769,
    corners: [5, 10],
    counts: [1, 1],
    medians: [5, 5],
    joinParts: [],
    allowOwnPlinth: true,
    lowScore: true,
    floorPolicy: 'material-neighbor-atleast-one-percent-v1',
    boundaryFraction: 0.9999999999999983,
    boundarySnapshotHash: 'sha256:3a6136ee675f2b93c9718ec7a976cf96b05aa15b6fc23273282ddb945d5385f7',
    boundaryResponseHash: 'sha256:552d04e94ab444ffc05f5381368361eb416a5db4b8ebdc8e4a5cb493ad549e07',
  },
  litoral_pavilion_1_western_roof_extension: {
    code: '6792W3X3+MXRJ',
    score: 0.7638,
    corners: [6],
    counts: [9],
    medians: [4.5],
    joinParts: [],
    allowOwnPlinth: true,
    lowScore: true,
    floorPolicy: 'material-neighbor-atleast-one-percent-v1',
    boundaryFraction: 0.9999999999999976,
    boundarySnapshotHash: 'sha256:3a6136ee675f2b93c9718ec7a976cf96b05aa15b6fc23273282ddb945d5385f7',
    boundaryResponseHash: 'sha256:552d04e94ab444ffc05f5381368361eb416a5db4b8ebdc8e4a5cb493ad549e07',
  },
  litoral_pavilion_5_western_roof_extension: {
    code: '6792W3W4+V67P',
    score: 0.6891,
    corners: [8],
    counts: [4],
    medians: [4],
    joinParts: [],
    allowOwnPlinth: true,
    lowScore: true,
    floorPolicy: 'material-neighbor-atleast-one-percent-v1',
    boundaryFraction: 0.9999999999999971,
    boundarySnapshotHash: 'sha256:3a6136ee675f2b93c9718ec7a976cf96b05aa15b6fc23273282ddb945d5385f7',
    boundaryResponseHash: 'sha256:552d04e94ab444ffc05f5381368361eb416a5db4b8ebdc8e4a5cb493ad549e07',
  },
  litoral_northwest_inner_building: {
    code: '6792W3X4+J3CW',
    score: 0.6678,
    corners: [4],
    counts: [15],
    medians: [5.5],
    joinParts: [],
    allowOwnPlinth: true,
    lowScore: true,
    floorPolicy: 'material-neighbor-atleast-one-percent-v1',
    boundaryFraction: 1,
    boundarySnapshotHash: 'sha256:3a6136ee675f2b93c9718ec7a976cf96b05aa15b6fc23273282ddb945d5385f7',
    boundaryResponseHash: 'sha256:552d04e94ab444ffc05f5381368361eb416a5db4b8ebdc8e4a5cb493ad549e07',
  },
  litoral_southeast_inner_building: {
    code: '6792W3W4+HP2P',
    score: 0.7533,
    corners: [4],
    counts: [14],
    medians: [5],
    joinParts: [],
    allowOwnPlinth: true,
    lowScore: true,
    floorPolicy: 'material-neighbor-atleast-one-percent-v1',
    boundaryFraction: 0.9999999999999964,
    boundarySnapshotHash: 'sha256:3a6136ee675f2b93c9718ec7a976cf96b05aa15b6fc23273282ddb945d5385f7',
    boundaryResponseHash: 'sha256:552d04e94ab444ffc05f5381368361eb416a5db4b8ebdc8e4a5cb493ad549e07',
  },
  litoral_pavilion_6_western_roof_sections: {
    code: '6792W3W4+P7C6',
    score: 0.6749,
    corners: [7],
    counts: [10],
    medians: [3],
    joinParts: [],
    allowOwnPlinth: true,
    lowScore: true,
    floorPolicy: 'material-neighbor-atleast-one-percent-v1',
    boundaryFraction: 1.0000000000000075,
    boundarySnapshotHash: 'sha256:3a6136ee675f2b93c9718ec7a976cf96b05aa15b6fc23273282ddb945d5385f7',
    boundaryResponseHash: 'sha256:552d04e94ab444ffc05f5381368361eb416a5db4b8ebdc8e4a5cb493ad549e07',
  },
  litoral_pavilion_7_eastern_roof_sections: {
    code: '6792W3W4+VMFQ',
    score: 0.7618,
    corners: [14],
    counts: [1],
    medians: [5],
    joinParts: [],
    allowOwnPlinth: true,
    lowScore: true,
    floorPolicy: 'material-neighbor-atleast-one-percent-v1',
    boundaryFraction: 1,
    boundarySnapshotHash: 'sha256:3a6136ee675f2b93c9718ec7a976cf96b05aa15b6fc23273282ddb945d5385f7',
    boundaryResponseHash: 'sha256:552d04e94ab444ffc05f5381368361eb416a5db4b8ebdc8e4a5cb493ad549e07',
  },
  litoral_north_central_inner_building: {
    code: '6792W3X4+C5XM',
    score: 0.7729,
    corners: [4],
    counts: [9],
    medians: [4],
    joinParts: [],
    allowOwnPlinth: true,
    lowScore: true,
    floorPolicy: 'material-neighbor-atleast-one-percent-v1',
    boundaryFraction: 1,
    boundarySnapshotHash: 'sha256:3a6136ee675f2b93c9718ec7a976cf96b05aa15b6fc23273282ddb945d5385f7',
    boundaryResponseHash: 'sha256:552d04e94ab444ffc05f5381368361eb416a5db4b8ebdc8e4a5cb493ad549e07',
  },
  litoral_northwest_west_building: {
    code: '6792W3X3+MR7C',
    score: 0.7207,
    corners: [4],
    counts: [7],
    medians: [3],
    joinParts: [],
    allowOwnPlinth: true,
    lowScore: true,
    floorPolicy: 'material-neighbor-atleast-one-percent-v1',
    boundaryFraction: 1.0000000000000049,
    boundarySnapshotHash: 'sha256:3a6136ee675f2b93c9718ec7a976cf96b05aa15b6fc23273282ddb945d5385f7',
    boundaryResponseHash: 'sha256:552d04e94ab444ffc05f5381368361eb416a5db4b8ebdc8e4a5cb493ad549e07',
  },
  litoral_pavilion_4_southwestern_roof_sections: {
    code: '6792W3X4+2458',
    score: 0.7574,
    corners: [4, 6],
    counts: [1, 5],
    medians: [5, 5],
    joinParts: [],
    allowOwnPlinth: true,
    lowScore: true,
    floorPolicy: 'material-neighbor-atleast-one-percent-v1',
    boundaryFraction: 1.0000000000000062,
    boundarySnapshotHash: 'sha256:3a6136ee675f2b93c9718ec7a976cf96b05aa15b6fc23273282ddb945d5385f7',
    boundaryResponseHash: 'sha256:552d04e94ab444ffc05f5381368361eb416a5db4b8ebdc8e4a5cb493ad549e07',
  },
  litoral_northwest_inner_annex: {
    code: '6792W3X3+PV2X',
    score: 0.6674,
    corners: [4],
    counts: [2],
    medians: [3],
    joinParts: [],
    allowOwnPlinth: true,
    lowScore: true,
    floorPolicy: 'material-neighbor-atleast-one-percent-v1',
    boundaryFraction: 1.0000000000000029,
    boundarySnapshotHash: 'sha256:3a6136ee675f2b93c9718ec7a976cf96b05aa15b6fc23273282ddb945d5385f7',
    boundaryResponseHash: 'sha256:552d04e94ab444ffc05f5381368361eb416a5db4b8ebdc8e4a5cb493ad549e07',
  },
  litoral_pavilion_1_eastern_roof_extension: {
    code: '6792W3X4+P296',
    score: 0.6894,
    corners: [4],
    counts: [3],
    medians: [4.5],
    joinParts: [],
    allowOwnPlinth: true,
    lowScore: true,
    floorPolicy: 'material-neighbor-atleast-one-percent-v1',
    boundaryFraction: 0.9999999999999958,
    boundarySnapshotHash: 'sha256:3a6136ee675f2b93c9718ec7a976cf96b05aa15b6fc23273282ddb945d5385f7',
    boundaryResponseHash: 'sha256:552d04e94ab444ffc05f5381368361eb416a5db4b8ebdc8e4a5cb493ad549e07',
  },
  litoral_south_inner_small_building: {
    code: '6792W3W4+FFM9',
    score: 0.6661,
    corners: [4],
    counts: [1],
    medians: [9],
    joinParts: [],
    allowOwnPlinth: true,
    lowScore: true,
    floorPolicy: 'material-neighbor-atleast-one-percent-v1',
    boundaryFraction: 0.9999999999999946,
    boundarySnapshotHash: 'sha256:3a6136ee675f2b93c9718ec7a976cf96b05aa15b6fc23273282ddb945d5385f7',
    boundaryResponseHash: 'sha256:552d04e94ab444ffc05f5381368361eb416a5db4b8ebdc8e4a5cb493ad549e07',
  },
  litoral_central_west_small_annex: {
    code: '6792W3X4+C4P6',
    score: 0.6684,
    corners: [4],
    counts: [1],
    medians: [3],
    joinParts: [],
    allowOwnPlinth: true,
    lowScore: true,
    floorPolicy: 'material-neighbor-atleast-one-percent-v1',
    boundaryFraction: 0.9999999999999946,
    boundarySnapshotHash: 'sha256:3a6136ee675f2b93c9718ec7a976cf96b05aa15b6fc23273282ddb945d5385f7',
    boundaryResponseHash: 'sha256:552d04e94ab444ffc05f5381368361eb416a5db4b8ebdc8e4a5cb493ad549e07',
  },
  litoral_southwest_inner_small_building: {
    code: '6792W3W3+VWG8',
    score: 0.7706,
    corners: [5],
    counts: [1],
    medians: [3.5],
    joinParts: [],
    allowOwnPlinth: true,
    lowScore: true,
    floorPolicy: 'material-neighbor-atleast-one-percent-v1',
    boundaryFraction: 1,
    boundarySnapshotHash: 'sha256:3a6136ee675f2b93c9718ec7a976cf96b05aa15b6fc23273282ddb945d5385f7',
    boundaryResponseHash: 'sha256:552d04e94ab444ffc05f5381368361eb416a5db4b8ebdc8e4a5cb493ad549e07',
  },
  litoral_northwestern_inner_small_building: {
    code: '6792W3X3+RPQ4',
    score: 0.6537,
    corners: [4],
    counts: [1],
    medians: [3.5],
    joinParts: [],
    allowOwnPlinth: true,
    lowScore: true,
    floorPolicy: 'material-neighbor-atleast-one-percent-v1',
    boundaryFraction: 1,
    boundarySnapshotHash: 'sha256:3a6136ee675f2b93c9718ec7a976cf96b05aa15b6fc23273282ddb945d5385f7',
    boundaryResponseHash: 'sha256:552d04e94ab444ffc05f5381368361eb416a5db4b8ebdc8e4a5cb493ad549e07',
  },
  litoral_pavilion_10_southern_roof_edge_joins: {
    code: '6792W3X4+GF8M',
    score: 0.7309,
    corners: [4, 5],
    counts: [0, 0],
    medians: [null, null],
    joinParts: [0, 1],
    allowOwnPlinth: true,
    lowScore: true,
    floorPolicy: 'material-neighbor-atleast-one-percent-v1',
    boundaryFraction: 1,
    boundarySnapshotHash: 'sha256:3a6136ee675f2b93c9718ec7a976cf96b05aa15b6fc23273282ddb945d5385f7',
    boundaryResponseHash: 'sha256:552d04e94ab444ffc05f5381368361eb416a5db4b8ebdc8e4a5cb493ad549e07',
  },
  litoral_northwest_central_building: {
    code: '6792W3X3+JX4C',
    score: 0.7721,
    corners: [4],
    counts: [16],
    medians: [4.5],
    joinParts: [],
    allowOwnPlinth: true,
    boundaryFraction: 1.0000000000000004,
    boundarySnapshotHash: 'sha256:3a6136ee675f2b93c9718ec7a976cf96b05aa15b6fc23273282ddb945d5385f7',
    boundaryResponseHash: 'sha256:552d04e94ab444ffc05f5381368361eb416a5db4b8ebdc8e4a5cb493ad549e07',
    lowScore: true,
  },
  litoral_west_central_building: {
    code: '6792W3X4+F264',
    score: 0.7246,
    corners: [6],
    counts: [30],
    medians: [6.5],
    joinParts: [],
    allowOwnPlinth: true,
    boundaryFraction: 1,
    boundarySnapshotHash: 'sha256:3a6136ee675f2b93c9718ec7a976cf96b05aa15b6fc23273282ddb945d5385f7',
    boundaryResponseHash: 'sha256:552d04e94ab444ffc05f5381368361eb416a5db4b8ebdc8e4a5cb493ad549e07',
    lowScore: true,
  },
  litoral_south_central_building: {
    code: '6792W3W4+RGR7',
    score: 0.7503,
    corners: [8],
    counts: [23],
    medians: [4.5],
    joinParts: [],
    allowOwnPlinth: true,
    boundaryFraction: 1,
    boundarySnapshotHash: 'sha256:3a6136ee675f2b93c9718ec7a976cf96b05aa15b6fc23273282ddb945d5385f7',
    boundaryResponseHash: 'sha256:552d04e94ab444ffc05f5381368361eb416a5db4b8ebdc8e4a5cb493ad549e07',
    lowScore: true,
    unprovenGrazingFloorInterface: true,
  },
  litoral_southeast_central_building: {
    code: '6792W3X4+4CGQ',
    score: 0.7798,
    corners: [5],
    counts: [22],
    medians: [7.5],
    joinParts: [],
    allowOwnPlinth: true,
    boundaryFraction: 0.9999999999999998,
    boundarySnapshotHash: 'sha256:3a6136ee675f2b93c9718ec7a976cf96b05aa15b6fc23273282ddb945d5385f7',
    boundaryResponseHash: 'sha256:552d04e94ab444ffc05f5381368361eb416a5db4b8ebdc8e4a5cb493ad549e07',
    lowScore: true,
    unprovenGrazingFloorInterface: true,
  },
  litoral_southeastern_boundary_building: {
    code: '6792W3W4+FPVP',
    score: 0.795,
    corners: [6],
    counts: [20],
    medians: [5.5],
    joinParts: [],
    allowOwnPlinth: true,
    boundaryFraction: 0.9830666365039524,
    boundarySnapshotHash: 'sha256:3a6136ee675f2b93c9718ec7a976cf96b05aa15b6fc23273282ddb945d5385f7',
    boundaryResponseHash: 'sha256:552d04e94ab444ffc05f5381368361eb416a5db4b8ebdc8e4a5cb493ad549e07',
  },
  litoral_southern_boundary_building: {
    code: '6792W3W4+CGXF',
    score: 0.9254,
    corners: [6],
    counts: [8],
    medians: [7],
    joinParts: [],
    allowOwnPlinth: true,
    boundaryFraction: 0.9472404697724205,
    boundarySnapshotHash: 'sha256:3a6136ee675f2b93c9718ec7a976cf96b05aa15b6fc23273282ddb945d5385f7',
    boundaryResponseHash: 'sha256:552d04e94ab444ffc05f5381368361eb416a5db4b8ebdc8e4a5cb493ad549e07',
  },
  litoral_southwestern_boundary_roof_sections: {
    code: '6792W3W3+9X54',
    score: 0.8315,
    corners: [24],
    counts: [34],
    medians: [7.5],
    joinParts: [],
    allowOwnPlinth: false,
    boundaryFraction: 0.8047783643541381,
    boundarySnapshotHash: 'sha256:3a6136ee675f2b93c9718ec7a976cf96b05aa15b6fc23273282ddb945d5385f7',
    boundaryResponseHash: 'sha256:552d04e94ab444ffc05f5381368361eb416a5db4b8ebdc8e4a5cb493ad549e07',
  },
  litoral_west_central_small_building: {
    code: '6792W3X3+4MQ9',
    score: 0.7836,
    corners: [4],
    counts: [1],
    medians: [5.5],
    joinParts: [],
    nominalAbsentHeight: 3.5,
    allowOwnPlinth: true,
  },
  litoral_east_central_small_building: {
    code: '6792W3X4+4MPH',
    score: 0.864,
    corners: [4],
    counts: [0],
    medians: [null],
    joinParts: [],
    nominalAbsentHeight: 3.5,
    allowOwnPlinth: true,
  },
  litoral_west_central_north_small_building: {
    code: '6792W3X3+6M87',
    score: 0.7968,
    corners: [4],
    counts: [0],
    medians: [null],
    joinParts: [],
    nominalAbsentHeight: 3.5,
    allowOwnPlinth: true,
  },
  litoral_northwest_small_building: {
    code: '6792W3X3+QP98',
    score: 0.78,
    corners: [4],
    counts: [0],
    medians: [null],
    joinParts: [],
    nominalAbsentHeight: 3.5,
    allowOwnPlinth: true,
  },
  litoral_southwest_small_building: {
    code: '6792W3W3+HX3G',
    score: 0.8132,
    corners: [4],
    counts: [0],
    medians: [null],
    joinParts: [],
    nominalAbsentHeight: 3.5,
    allowOwnPlinth: true,
  },
  litoral_northern_small_building: {
    code: '6792X323+2QCM',
    score: 0.8581,
    corners: [4],
    counts: [0],
    medians: [null],
    joinParts: [],
    nominalAbsentHeight: 3.5,
    allowOwnPlinth: true,
  },
  litoral_southwest_north_small_building: {
    code: '6792W3W4+J36W',
    score: 0.8106,
    corners: [4],
    counts: [0],
    medians: [null],
    joinParts: [],
    nominalAbsentHeight: 3.5,
    allowOwnPlinth: true,
  },
  litoral_southwest_small_roof_extension: {
    code: '6792W3W3+VV2G',
    score: 0.8415,
    corners: [6],
    counts: [0],
    medians: [null],
    joinParts: [],
    nominalAbsentHeight: 3.5,
    allowOwnPlinth: false,
  },
  litoral_southwest_east_small_building: {
    code: '6792W3W3+VW7M',
    score: 0.8226,
    corners: [4],
    counts: [0],
    medians: [null],
    joinParts: [],
    nominalAbsentHeight: 3.5,
    allowOwnPlinth: true,
  },
  litoral_southeast_east_small_building: {
    code: '6792W3W5+P2P6',
    score: 0.8072,
    corners: [4],
    counts: [0],
    medians: [null],
    joinParts: [],
    nominalAbsentHeight: 3.5,
    allowOwnPlinth: true,
  },
  litoral_southwest_central_small_building: {
    code: '6792W3W4+W22P',
    score: 0.7849,
    corners: [4],
    counts: [0],
    medians: [null],
    joinParts: [],
    nominalAbsentHeight: 3.5,
    allowOwnPlinth: true,
  },
  litoral_southern_central_small_building: {
    code: '6792W3W4+GG6F',
    score: 0.8041,
    corners: [4],
    counts: [1],
    medians: [4],
    joinParts: [],
    nominalAbsentHeight: 3.5,
    allowOwnPlinth: true,
  },
  litoral_pavilion_4_northwest_roof_extension: {
    code: '6792W3X4+4427',
    score: 0.8233,
    corners: [5, 5],
    counts: [1, 2],
    medians: [4, 7],
    joinParts: [],
  },
  litoral_pavilion_7_east_roof_extension: {
    code: '6792W3W4+VH57',
    score: 0.847,
    corners: [6],
    counts: [3],
    medians: [5],
    joinParts: [],
  },
  litoral_pavilion_4_northeast_roof_sections: {
    code: '6792W3X4+47WJ',
    score: 0.8446,
    corners: [11],
    counts: [3],
    medians: [5.5],
    joinParts: [],
  },
  litoral_north_central_roof_sections: {
    code: '6792W3X4+P9Q8',
    score: 0.8668,
    corners: [17, 3],
    counts: [55, 0],
    medians: [6, null],
    joinParts: [1],
  },
  litoral_central_link_roof_sections: {
    code: '6792W3X4+H9H4',
    score: 0.847,
    corners: [13, 6],
    counts: [3, 1],
    medians: [4.5, 5.5],
    joinParts: [],
  },
  litoral_pavilion_10_eastern_roof_extension: {
    code: '6792W3X4+HFPR',
    score: 0.8572,
    corners: [10],
    counts: [23],
    medians: [6.5],
    joinParts: [],
  },
  litoral_pavilion_11_connecting_roof_sections: {
    code: '6792W3X4+M945',
    score: 0.841,
    corners: [4, 11, 3],
    counts: [2, 21, 0],
    medians: [6, 5.5, null],
    joinParts: [2],
  },
};
function inside(p, r) {
  let hit = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const a = r[i],
      b = r[j];
    if (
      a[1] > p[1] !== b[1] > p[1] &&
      p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]
    )
      hit = !hit;
  }
  return hit;
}
function originalWkbRing(hex) {
  const b = Buffer.from(hex, 'hex');
  if (b[0] !== 1 || b.readUInt32LE(1) !== 3 || b.readUInt32LE(5) !== 1)
    throw Error('single original polygon expected');
  const count = b.readUInt32LE(9);
  if (b.length !== 13 + count * 16) throw Error('original polygon bytes');
  return Array.from({ length: count }, (_, i) => [
    b.readDoubleLE(13 + i * 16),
    b.readDoubleLE(21 + i * 16),
  ]);
}
export function inspectLitoralRoofSectionPrimaryFacts({ dir, proof, controls: P, frame: f }) {
  const fail = (reason) => ({ status: 'needs-review', reason });
  try {
    const read = (s) => {
        if (
          typeof s?.path !== 'string' ||
          path.isAbsolute(s.path) ||
          s.path.split(/[\\/]/).includes('..')
        )
          throw Error('path');
        const b = fs.readFileSync(path.join(dir, s.path));
        if (hash(b) !== s.sha256) throw Error('hash');
        return b;
      },
      n = JSON.parse(read(proof.nativeIdentity)),
      sources = Object.fromEntries(proof.primarySources.map((s) => [s.key, s])),
      text = read(sources.roof).toString('utf8'),
      h = JSON.parse(read(sources.height)),
      c = cfgs[P.model],
      original = n.originalSource,
      frame = n.coordinateFrame;
    if (
      !c ||
      litoralRoofSectionCases[proof.case] !== P.model ||
      P.parentModelIdentity !== 'litoral_penitentiary' ||
      P.kind !== 'litoral-complete-derived-roof-sections' ||
      P.sourceCode !== c.code ||
      P.nativeSourceId !== `derived-roof-section:${c.code}` ||
      proof.nativeIdentity.featureId !== P.nativeSourceId ||
      P.numericalRecordHash !== proof.nativeIdentity.sha256 ||
      (c.overture
        ? n.sourceUrl !== c.sourceUrl ||
          n.sourceDatasetHash !== c.sourceDatasetHash ||
          original.originalRecord?.id !== c.code ||
          hash(JSON.stringify(original.originalRecord)) !== c.originalRecordHash ||
          original.originalRecordHash !== c.originalRecordHash ||
          !original.originalRecord.sources.some(
            (s) =>
              s.dataset === (c.sourceDataset ?? 'Microsoft ML Buildings') &&
              s.license === 'ODbL-1.0',
          )
        : n.sourceUrl !==
            'https://storage.googleapis.com/open-buildings-data/v3/polygons_s2_level_4_gzip/903_buildings.csv.gz' ||
          n.sourceDatasetHash !==
            'sha256:a3a20d797f23abf9159ecef10b2355be9f8f87aa3b7b67f96ad1537f8529e400' ||
          (c.googleUnion
            ? original.originalCsvRows.map((r) => r.full_plus_code).join('~') !== c.code ||
              hash(JSON.stringify(original.originalCsvRows)) !== c.originalCsvRowsHash ||
              JSON.stringify(original.originalCsvRows.map((r) => Number(r.confidence))) !==
                JSON.stringify(c.scores) ||
              JSON.stringify(P.sourceFootprintScores) !== JSON.stringify(c.scores) ||
              original.wholeOverlappingSourceUnion !== true
            : original.originalCsvRow.full_plus_code !== c.code ||
              Number(original.originalCsvRow.confidence) !== c.score)) ||
      sources.roof.url !== n.sourceUrl ||
      sources.roof.use !== 'factual-text-only' ||
      sources.height.use !== 'factual-text-only' ||
      P.sourceFootprintConfidence !== c.score ||
      P.allSectionsEstimated !== true ||
      P.heightMeasured !== false ||
      P.footprintMeasured !== false ||
      P.allowancesAreMeasuredErrorBounds !== false ||
      P.estimatedHorizontalUncertaintyMeters < (c.lowScore ? 15 : 10) ||
      P.estimatedComponentUncertaintyMeters < 3 ||
      !text.includes('Entire complete source-set difference') ||
      !text.includes('not survey') ||
      (c.lowScore &&
        (c.score >= 0.78 ||
          P.sourceFootprintBelowTileRankingThreshold !== true ||
          !text.includes('below0.780tile ranking threshold')))
    )
      return fail('litoral-complete-roof-source-or-estimates-unbound');
    if (
      c.sourceDataset === 'OpenStreetMap' &&
      (original.originalOsmWay?.id !== c.osmWayId ||
        original.originalOsmWay.version !== '1' ||
        original.originalOsmWay.timestamp !== '2023-12-28T22:19:12Z' ||
        original.originalOsmWay.tags.building !== 'yes' ||
        hash(JSON.stringify(original.originalOsmWay)) !== c.osmWayHash ||
        !original.originalRecord.sources.some(
          (s) => s.record_id === 'w1235043765@1' && s.update_time === '2023-12-28T22:19:12.000Z',
        ))
    )
      return fail('litoral-original-osm-building-way-unbound');
    if (
      c.explicitUnmeasuredHeight &&
      (P.heightSourceAbsent !== true ||
        P.sourcePresence2023Verified !== false ||
        P.nominalAbsentHeightMeters !== (c.onlyRoofJoin ? null : 3.5) ||
        P.estimatedComponentUncertaintyMeters < 5 ||
        n.originalHeightControls.wholeSourcePassing !== 0 ||
        !text.includes('not observations'))
    )
      return fail('litoral-unmeasured-height-overstated');
    const geo = c.overture
      ? originalWkbRing(original.originalRecord.geometry_wkb)
      : c.googleUnion
        ? clip.union(
            ...original.originalCsvRows.map((r) => [
              r.geometry
                .match(/^POLYGON\s*\(\((.*)\)\)$/)[1]
                .split(',')
                .map((s) => s.trim().split(/\s+/).map(Number)),
            ]),
          )[0][0]
        : original.originalCsvRow.geometry
            .match(/^POLYGON\s*\(\((.*)\)\)$/)?.[1]
            .split(',')
            .map((s) => s.trim().split(/\s+/).map(Number));
    if (!geo || JSON.stringify(geo) !== JSON.stringify(original.originalGeographicRing))
      return fail('litoral-roof-original-WKT-changed');
    const D = frame.metersPerDegree,
      A = frame.anchor,
      co = frame.eastCosine,
      ring = geo.map((p) => [(p[0] - A[0]) * D * co, -(p[1] - A[1]) * D]);
    if (JSON.stringify(ring) !== JSON.stringify(original.originalRing))
      return fail('litoral-roof-source-frame-changed');
    const difference = clip.difference([ring], ...original.maskModels.map((m) => [m.coordinates]));
    const declaredDifference = c.fullOriginalSmallSource
      ? clip.union(...original.outsidePolygons.map((p) => p.rings))
      : original.outsidePolygons.map((p) => p.rings);
    if (
      JSON.stringify(difference) !== JSON.stringify(declaredDifference) ||
      (c.fullOriginalSmallSource && (original.maskModels.length !== 0 || difference.length !== 1))
    )
      return fail('litoral-roof-complete-source-difference-changed');
    if (
      difference.length !== c.corners.length ||
      P.parts.length !== c.corners.length ||
      n.adjacency.length !== original.maskModels.length ||
      P.completeDerivedAreaSquareMeters !== original.outsideAreaSquareMeters
    )
      return fail('litoral-roof-pieces-or-adjacency-missing');
    if (
      c.boundaryCrossingEstimate &&
      (P.sourceBoundaryCrossingEstimate !== true ||
        P.preciseOwnershipSurveyed !== false ||
        P.sourceBoundaryInsideFraction !== c.boundaryFraction)
    )
      return fail('litoral-crossing-boundary-estimate-unbound');
    if (c.onlyRoofJoin) {
      const r = difference[0]?.[0],
        perimeter = r
          ?.slice(0, -1)
          .reduce((s, a, i) => s + Math.hypot(a[0] - r[i + 1][0], a[1] - r[i + 1][1]), 0);
      if (
        difference.length !== 1 ||
        1 - original.outsideAreaSquareMeters / original.sourceAreaSquareMeters < 0.8 ||
        (2 * original.outsideAreaSquareMeters) / perimeter > 1 ||
        P.roofOnlyModel !== true ||
        P.foundationBottom !== null ||
        P.parts.some(
          (p) =>
            p.noNewRoomOrFloor !== true ||
            p.foundationBottom !== null ||
            p.nominalHeightAboveFloor !== null,
        )
      )
        return fail('litoral-narrow-boundary-join-invented-room');
    }
    if (c.boundaryFraction !== undefined) {
      const boundary = original.siteBoundaryControl,
        site = boundary?.record;
      if (
        !boundary ||
        site?.id !== '46012320' ||
        site.tags?.wikidata !== 'Q108830348' ||
        site.tags?.amenity !== 'prison' ||
        boundary.originalSnapshotHash !== c.boundarySnapshotHash ||
        boundary.sourceResponseHash !== c.boundaryResponseHash ||
        boundary.roofClippedToPerimeter !== false ||
        boundary.wholeOriginalSourceRetained !== true ||
        boundary.ownershipSurveyed !== false ||
        boundary.insideFraction !== c.boundaryFraction ||
        boundary.insideFraction < (c.minimumBoundaryFraction ?? 0.8)
      )
        return fail('litoral-boundary-source-relation-unbound');
      const siteRing = site.coordinates.map((p) => [(p[0] - A[0]) * D * co, -(p[1] - A[1]) * D]),
        signed = (r) =>
          r.reduce((s, a, i) => {
            const b = r[(i + 1) % r.length];
            return s + a[0] * b[1] - a[1] * b[0];
          }, 0) / 2,
        area = (p) =>
          Math.abs(signed(p[0])) - p.slice(1).reduce((s, r) => s + Math.abs(signed(r)), 0),
        insideArea = clip.intersection([ring], [siteRing]).reduce((s, p) => s + area(p), 0);
      if (
        JSON.stringify(siteRing) !== JSON.stringify(boundary.commonLocalRing) ||
        Math.abs(insideArea - boundary.insideAreaSquareMeters) > 1e-7 ||
        Math.abs(insideArea / original.sourceAreaSquareMeters - boundary.insideFraction) > 1e-10
      )
        return fail('litoral-boundary-original-shape-or-relation-changed');
    }
    for (const mask of original.maskModels) {
      const a = n.adjacency.find(
        (a) => a.model === mask.model && (a.sourcePartIndex ?? 0) === (mask.partIndex ?? 0),
      );
      if (
        !a ||
        a.sourceFrameHash !== mask.sourceFrameHash ||
        Math.abs(a.absoluteFloor - a.sourceDatum - a.sourceFloor) > 1e-8 ||
        Math.abs(a.absoluteRoof - a.sourceDatum - a.sourceRoof) > 1e-8 ||
        a.model === 'litoral_perimeter_wall'
      )
        return fail('litoral-roof-adjacency-unbound');
    }
    if (
      c.unprovenGrazingFloorInterface &&
      (original.maskModels.reduce((sum, m) => sum + m.overlapSquareMeters, 0) /
        original.sourceAreaSquareMeters >=
        0.01 ||
        P.footprintOverlapEstablishesPhysicalInterface !== false)
    )
      return fail('litoral-grazing-footprint-is-not-a-vertical-interface');
    const datum = JSON.parse(
        fs.readFileSync(path.join(dir, 'terrain-grid.json')),
      ).modelDatumElevationMeters,
      floorControls = c.floorPolicy
        ? n.adjacency.filter((a) =>
            original.maskModels.some(
              (m) =>
                m.model === a.model &&
                (m.partIndex ?? 0) === (a.sourcePartIndex ?? 0) &&
                m.overlapSquareMeters / original.sourceAreaSquareMeters >= 0.01,
            ),
          )
        : n.adjacency,
      floors = floorControls.map((a) => a.absoluteFloor).sort((a, b) => a - b),
      floor =
        c.allowOwnPlinth && (floors.length === 0 || c.unprovenGrazingFloorInterface)
          ? 0.25
          : floors[Math.floor(floors.length / 2)] - datum,
      absoluteFloor =
        c.allowOwnPlinth && (floors.length === 0 || c.unprovenGrazingFloorInterface)
          ? datum + 0.25
          : floors[Math.floor(floors.length / 2)],
      floorSelection =
        c.allowOwnPlinth && (floors.length === 0 || c.unprovenGrazingFloorInterface)
          ? 'own-original-field-initial-plinth-before-geometry'
          : c.floorPolicy
            ? 'median-material-neighbor-absolute-floors-before-geometry'
            : 'median-accepted-neighbor-absolute-floors-before-geometry';
    if (
      c.floorPolicy &&
      (P.floorPolicy !== c.floorPolicy ||
        JSON.stringify(P.floorControlSourceModels) !==
          JSON.stringify(
            floorControls.map((a) => ({ model: a.model, part: a.sourcePartIndex ?? 0 })),
          ))
    )
      return fail('litoral-material-floor-controls-unbound');
    if (
      Math.abs(P.floor - floor) > 1e-7 ||
      P.initialAbsoluteFloor !== absoluteFloor ||
      P.interfaceFloorSelection !== floorSelection
    )
      return fail('litoral-roof-initial-interface-floor-changed');
    if (
      h.sourceId !== original.sourceId ||
      h.heightSourceYear !== 2023 ||
      h.heightBand !== 1 ||
      h.presenceBand !== 2 ||
      sources.height.url !== h.heightSource ||
      n.originalHeightControls.sourceId !== h.sourceId ||
      JSON.stringify(P.parts.map((p) => p.ring)) !== JSON.stringify(n.modelPolygons) ||
      JSON.stringify(n.modelPolygons) !== JSON.stringify(f.geometry.polygons)
    )
      return fail('litoral-roof-height-or-local-controls-unbound');
    const cs = Math.cos(f.heading),
      sn = Math.sin(f.heading),
      sourceValues = h.samples.filter(
        (s) => s.values[2] > 0.7 && Number.isFinite(s.values[1]) && s.values[1] > 0,
      );
    if (sourceValues.length !== n.originalHeightControls.wholeSourcePassing)
      return fail('litoral-roof-full-source-height-count-changed');
    for (let i = 0; i < P.parts.length; i++) {
      const p = P.parts[i],
        d = c.fullOriginalSmallSource ? original.outsidePolygons[i].rings : difference[i],
        hc = n.originalHeightControls.parts[i];
      if (
        d.length !== 1 ||
        p.ring.length !== c.corners[i] ||
        p.sourceSamples !== c.counts[i] ||
        hc.observations.length !== c.counts[i] ||
        p.numericalHeightMedian !== c.medians[i] ||
        p.areaSquareMeters !== original.outsidePolygons[i].areaSquareMeters ||
        p.floor !== P.floor ||
        p.heightMeasured !== false
      )
        return fail('litoral-roof-piece-census-or-height-changed');
      for (let j = 0; j < p.ring.length; j++) {
        const [x, z] = p.ring[j],
          lon = f.anchor[0] + (cs * x + sn * z) / D / Math.cos((f.anchor[1] * Math.PI) / 180),
          lat = f.anchor[1] - (-sn * x + cs * z) / D,
          common = [(lon - A[0]) * D * co, -(lat - A[1]) * D];
        if (common.some((v, k) => Math.abs(v - d[0][j][k]) > 1e-6))
          return fail('litoral-roof-complete-derived-corner-changed');
      }
      const values = [];
      for (const obs of hc.observations) {
        const originalSample = sourceValues.find(
          (s) => JSON.stringify(s.pixel) === JSON.stringify(obs.pixel),
        );
        if (
          !originalSample ||
          JSON.stringify(originalSample.utm) !== JSON.stringify(obs.utm) ||
          JSON.stringify(originalSample.values) !== JSON.stringify(obs.values) ||
          !inside(obs.commonLocal, d[0])
        )
          return fail('litoral-roof-original-outside-sample-changed');
        values.push(obs.values[1]);
      }
      values.sort((a, b) => a - b);
      if (values.length && values[Math.floor(values.length / 2)] !== p.numericalHeightMedian)
        return fail('litoral-roof-outside-median-changed');
      if (c.joinParts.includes(i)) {
        const a = n.adjacency.find(
          (a) =>
            a.model === p.roofJoinBasedOnAcceptedModel &&
            (a.sourcePartIndex ?? 0) === (p.roofJoinBasedOnAcceptedPart ?? 0),
        );
        if (
          !a ||
          p.kind !== 'roof-edge-join' ||
          p.sourceSamples !== 0 ||
          p.numericalHeightMedian !== null ||
          p.entryEdge !== -1 ||
          p.windowCensus !== 0 ||
          p.roofJoinBasedOnAcceptedModel !== a.model ||
          Math.abs(p.roofTop - (a.absoluteRoof - datum + 0.16)) > 1e-8 ||
          Math.abs(p.roofBottom - (p.roofTop - 0.12)) > 1e-8
        )
          return fail('litoral-roof-edge-join-invented-room-or-height');
      } else if (
        p.kind !== 'complete-uncovered-roof-section' ||
        Math.abs(p.roofTop - p.floor - (p.numericalHeightMedian ?? c.nominalAbsentHeight)) > 1e-8 ||
        p.heightUncertaintyMeters < (p.sourceSamples >= 3 ? 3 : 5)
      )
        return fail('litoral-roof-section-height-overstated');
    }
    return {
      status: 'passed',
      method: 'primary-facts-only',
      imageryUsed: false,
      evidenceHash: hash(Buffer.from(JSON.stringify(proof))),
      notes:
        'Complete original numeric roof complements, exact source difference and retained outside sample values. Initial neighboring-floor interface transfer and all roof/facade/current-condition estimates explicit. Tiny uncertain roof join has no invented room or source height. No accepted geometry/QA changed; whole prison unfinished.',
    };
  } catch {
    return fail('litoral-complete-roof-section-evidence-unreadable');
  }
}
