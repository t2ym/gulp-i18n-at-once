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

```javascript
    'use strict';

    const gulp = require('gulp');
    const i18nAtOnce = require('gulp-i18n-at-once');
    const mergeStream = require('merge-stream');

    const polymer = require('polymer-build');
    const PolymerProject = polymer.PolymerProject;
    const fork = polymer.forkStream;
    const polymerConfig = require('./polymer.json');

    let options = {};

    let project = new PolymerProject({
      root: process.cwd(),
      entrypoint: polymerConfig.entrypoint,
      shell: polymerConfig.shell
    });

    gulp.task('default', () => {
      // process source files in the project
      let sources = project.sources()
        .pipe(project.splitHtml())
        // I18N processes
        .pipe(i18nAtOnce(options))
        // add compilers or optimizers here!
        .pipe(project.rejoinHtml());

      // process dependencies
      let dependencies = project.dependencies()
        .pipe(project.splitHtml())
        .pipe(project.rejoinHtml());

      // merge the source and dependencies streams to we can analyze the project
      let allFiles = mergeStream(sources, dependencies)
        .pipe(project.analyze);

      // fork the stream in case downstream transformers mutate the files
      // this fork will vulcanize the project
      let bundled = fork(allFiles)
        .pipe(project.bundle)
        .pipe(gulp.dest('build/bundled'));

      let unbundled = fork(allFiles)
        .pipe(gulp.dest('build/unbundled'));

      return mergeStream(bundled, unbundled);
    });
```

## API

`i18nAtOnce(options)`

### `options` object

TBD

## License

[BSD-2-Clause](https://github.com/t2ym/gulp-i18n-preprocess/blob/master/LICENSE.md)
