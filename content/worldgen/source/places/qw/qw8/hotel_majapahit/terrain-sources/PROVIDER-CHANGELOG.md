# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.1] - 2024-12-10

We reprocessed DeltaDTM, as we found some ICESat-2 processing errors in the previous version, leading to large depression further inland.

## [1.1] - 2024-08-25

This is a new release of DeltaDTM. This release includes the following changes:

### Output
- Now available up to 30 m +EGM2008 (was 10 m)
- Improved vertical accuracy (bias of -0.01 m, MAE of 0.43 m, RMSE of 0.72 m), see the `validation_comparison.pdf` and `validation_30m.pdf` for details.

### Input data
- Now makes use of CopernicusDEM 2023_3 data (was 2022_2). Note that this has changed the number of cells in the validation statistics.
- Adds almost a year of ICESat-2 data (from 2023-06-22 to 2024-05-10)

### Processing
- Smoother interpolation for large gaps (such as in the tropics)
- Improved filtering of surface data
- Fixed removal of small and tall features, such as mineral outcrops.

## [1.0] - 2024-03-06

First release 🎉
