# gulp-i18n-at-once

Perform integrated I18N processes for Polymer [i18n-behavior](https://github.com/t2ym/i18n-behavior) at once (experimental)

### Note: Currently only applicable to [Polymer CLI](https://github.com/Polymer/polymer-cli)/[polymer-build](https://github.com/Polymer/polymer-build) style projects with the project root as its source root.

## Install

```
    npm install --save-dev gulp-i18n-at-once
```

## Integrated I18N Processes

  - scan - Scan HTMLs and construct localizable attributes repository
  - basenameSort - Sort source files according to their base names; Bundle files come first.
  - dropDefaultJSON - Drop default JSON files to avoid overwriting new ones 
  - preprocess - Preprocess Polymer templates for I18N
  - tmpJSON - Store extracted JSON in the temporary folder .tmp
  - importXliff - Import XLIFF into JSON
  - leverage - Merge changes in default JSON into localized JSON
  - exportXliff - Generate bundles and export XLIFF
  - feedback - Update JSON and XLIFF in sources

## Usage

Applied to the `gulpfile.js` from [`generator-polymer-init-custom-build`](https://github.com/PolymerElements/generator-polymer-init-custom-build) for Polymer CLI

```javascript
/**
* @license
* Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
* This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
* The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
* The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
* Code distributed by Google as part of the polymer project is also
* subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
*
* Based on: https://github.com/Polymer/polymer-build/blob/master/test/test-project/gulpfile.js
*/

'use strict';

const del = require('del');
const gulp = require('gulp');
const gulpif = require('gulp-if');
const imagemin = require('gulp-imagemin');
const logging = require('plylog');
const mergeStream = require('merge-stream');

// Got problems? Try logging 'em
// logging.setVerbose();

const polymer = require('polymer-build');
const PolymerProject = polymer.PolymerProject;
const fork = polymer.forkStream;
const addServiceWorker = polymer.addServiceWorker;

const polymerJSON = require('./polymer.json');
const project = new PolymerProject(polymerJSON);

// ========================================== BEGIN
const debug = require('gulp-debug');
const i18nAtOnce = require('gulp-i18n-at-once');

let options = {
  xliffOptions: {
    xliffStates: {
      'add'    : [ 'new' ],
      'replace': [ 'needs-translation', 'needs-adaptation', 'needs-l10n', '' ],
      'review' : [ 'needs-review-translation', 'needs-review-adaptation', 'needs-review-l10n' ],
      'default': [ 'translated', 'signed-off', 'final', '[source~=nonTargets]', '[approved]' ]
    },
    patterns: {
      'nonTargets': /^({{[^{} ]*}}|\[\[[^\[\] ]*\]\]|<[-a-zA-Z]{1,}>|[0-9.]{1,}|[a-zA-Z]{1,}_[a-zA-Z_]{1,}|\/images\/.*|data:image\/jpeg;.*)$/,
      'annotationsAndTags': /^({{[^{} ]*}}|\[\[[^\[\] ]*\]\]|<[-a-zA-Z]{1,}>)$/,
      'annotations': /^({{[^{} ]*}}|\[\[[^\[\] ]*\]\])$/,
      'numbers': /^[0-9.]{1,}$/,
      'tags': /^<[-a-zA-Z]{1,}>$/
    }
  }
};
// ========================================== END

// Clean build directory
gulp.task('clean', () => {
  return del('build');
});

gulp.task('build', ['clean'], (cb) => {
  // ============================================= BEGIN
  // i18n resources
  const i18nResources = gulp.src([ 'bundle.json', 'locales/**', 'xliff/**' ], { base: '.' });
  // ============================================= END

  // process source files in the project
  const sources = mergeStream(project.sources(), i18nResources)
    .pipe(project.splitHtml())
    // add compilers or optimizers here!
    // for example, to process JS files
    // .pipe(gulpif('**/*.js', babel( // babel settings )))
    // included is an example demonstrating how to
    // compress images
    //.pipe(gulpif('**/*.{png,gif,jpg,svg}', imagemin({
    //  progressive: true, interlaced: true
    //})))
    // ============================================= BEGIN
    // I18N processes
    .pipe(i18nAtOnce(options))
    .pipe(debug({ title: 'I18N Transform' }))
    // ============================================= END
    .pipe(project.rejoinHtml());

  // ============================================= BEGIN
  // images and json resources (for the Shop App)
  const resources = gulp.src([ 'images/**', 'data/**' ], { base: '.' });
  // ============================================= END

  // process dependencies (basically the stuff coming out of bower_components)
  // you can probably ignore these steps but if you want to do something
  // specific for your installed dependencies, this is the place to do it
  const dependencies = project.dependencies()
    .pipe(project.splitHtml())
     // add code to process your installed dependencies here  
    .pipe(project.rejoinHtml());

  // ============================================= BEGIN
  // dynamically loaded step dependencies skipped in project.dependencies()
  const stepDependencies = gulp.src([ 'bower_components/intl/**', 'bower_components/region-flags/**' ], { base: '.' });
  // ============================================= END

  // ============================================= BEGIN
  // merge the source and dependencies streams to we can analyze the project
  const mergedFiles = mergeStream(sources, resources, dependencies, stepDependencies)
    .pipe(project.analyzer);
  // ============================================= END

  // this fork will vulcanize the project
  const bundledPhase = fork(mergedFiles)
    .pipe(project.bundler)
    // write to the bundled folder
    .pipe(gulp.dest('build/bundled'));

  const unbundledPhase = fork(mergedFiles)
    // write to the unbundled folder
    .pipe(gulp.dest('build/unbundled'));

  cb();
});

gulp.task('service-worker', ['build'], () => {
  const swConfig = {
    navigateFallback: '/index.html',
  };

  // Once the unbundled build stream is complete, create a service worker for the build
  const unbundledPostProcessing = addServiceWorker({
    project: project,
    buildRoot: 'build/unbundled',
    swConfig: swConfig,
    serviceWorkerPath: 'service-worker.js',
  });

  // Once the bundled build stream is complete, create a service worker for the build
  const bundledPostProcessing = addServiceWorker({
    project: project,
    buildRoot: 'build/bundled',
    swConfig: swConfig,
    bundled: true,
  });
});

gulp.task('default', ['service-worker']);
```

## API

`i18nAtOnce(options)`

### `options` object

TBD

## License

[BSD-2-Clause](https://github.com/t2ym/gulp-i18n-preprocess/blob/master/LICENSE.md)
