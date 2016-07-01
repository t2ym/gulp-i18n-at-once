/*
@license https://github.com/t2ym/gulp-i18n-at-once/blob/master/LICENSE.md
Copyright (c) 2016, Tetsuya Mori <t2y3141592@gmail.com>. All rights reserved.
*/
var gulp = require('gulp');
var gutil = require('gulp-util');
var gulpif = require('gulp-if');
var gulpignore = require('gulp-ignore');
var gulpmatch = require('gulp-match');
var multipipe = require('multipipe');
var sort = require('gulp-sort');
var merge = require('gulp-merge');
var through = require('through2');
var path = require('path');
var stripBom = require('strip-bom');
var JSONstringify = require('json-stringify-safe');
var i18nPreprocess = require('gulp-i18n-preprocess');
var i18nLeverage = require('gulp-i18n-leverage');
var XliffConv = require('xliff-conv');

/**
 * Gulp plugin to perform all I18N processes for Polymer i18n-behavior at once
 *
 * @namespace i18n-at-once
 */
module.exports = function(options) {
  options = options || {};
  // Global object to store localizable attributes repository
  var attributesRepository = {};

  // Bundles object
  var prevBundles = {};
  var bundles = {};

  var srcPath = options.srcPath || '.';
  var nulledSrcPath = srcPath === '.' ? '' : srcPath;
  var joinableSrcPath = nulledSrcPath ? nulledSrcPath + path.sep : nulledSrcPath;
  var tmpDir = options.tmpDir || '.tmp';
  var xliffOptions = options.xliffOptions || {};
  var scanOptions = Object.assign({
    constructAttributesRepository: true, // construct attributes repository
    attributesRepository: attributesRepository, // output object
    srcPath: srcPath, // path to source root
    attributesRepositoryPath: 'bower_components/i18n-behavior/i18n-attr-repo.html', // path to i18n-attr-repo.html
    dropHtml: false // do not drop HTMLs
  }, options.scanOptions);
  var elementsSrcPath = options.elementsSrcPath || 'src';
  var srcLanguage = options.srcLanguage || 'en';

  // Scan HTMLs and construct localizable attributes repository
  var scan = gulpif('*.html', i18nPreprocess(scanOptions));

  var basenameSort = sort({
    comparator: function(file1, file2) {
      var base1 = path.basename(file1.path).replace(/^bundle[.]/, ' bundle.');
      var base2 = path.basename(file2.path).replace(/^bundle[.]/, ' bundle.');
      return base1.localeCompare(base2);
    }
  });

  var dropDefaultJSON = gulpignore([ elementsSrcPath + '/**/*.json', '!**/locales/*.json' ]);

  var preprocess = gulpif('*.html', i18nPreprocess({
    replacingText: true, // replace UI texts with {{annotations}}
    jsonSpace: 2, // JSON format with 2 spaces
    srcPath: srcPath, // path to source root
    attributesRepository: attributesRepository // input attributes repository
  }));

  var tmpJSON = gulpif([ elementsSrcPath + '/**/*.json', '!' + elementsSrcPath + 'src/**/locales/*' ], gulp.dest(tmpDir));

  var unbundleFiles = [];
  var importXliff = through.obj(function (file, enc, callback) {
    // bundle files must come earlier
    unbundleFiles.push(file);
    callback();
  }, function (callback) {
    var match;
    var file;
    var bundleFileMap = {};
    var xliffConv = new XliffConv(xliffOptions);
    while (unbundleFiles.length > 0) {
      file = unbundleFiles.shift();
      if (path.basename(file.path).match(/^bundle[.]json$/)) {
        prevBundles[''] = JSON.parse(stripBom(String(file.contents)));
        bundleFileMap[''] = file;
      }
      else if (match = path.basename(file.path).match(/^bundle[.]([^.\/]*)[.]json$/)) {
        prevBundles[match[1]] = JSON.parse(stripBom(String(file.contents)));
        bundleFileMap[match[1]] = file;
      }
      else if (match = path.basename(file.path).match(/^bundle[.]([^.\/]*)[.]xlf$/)) {
        xliffConv.parseXliff(String(file.contents), { bundle: prevBundles[match[1]] }, function (output) {
          if (bundleFileMap[match[1]]) {
            bundleFileMap[match[1]].contents = new Buffer(JSONstringify(output, null, 2));
          }
        });
      }
      else if (gulpmatch(file, joinableSrcPath + '**/locales/*.json') &&
               (match = path.basename(file.path, '.json').match(/^([^.]*)[.]([^.]*)/))) {
        if (prevBundles[match[2]] && prevBundles[match[2]][match[1]]) {
          file.contents = new Buffer(JSONstringify(prevBundles[match[2]][match[1]], null, 2));
        }
      }
      this.push(file);
    }
    callback();
  });

  var leverage = gulpif([ elementsSrcPath + '/**/locales/*.json', '!**/locales/bundle.*.json' ], i18nLeverage({
    jsonSpace: 2, // JSON format with 2 spaces
    srcPath: nulledSrcPath, // path to source root
    distPath: '/' + tmpDir, // path to dist root to fetch next default JSON files
    bundles: bundles // output bundles object
  }));

  var bundleFiles = [];
  var exportXliff = through.obj(function (file, enc, callback) {
    bundleFiles.push(file);
    callback();
  }, function (callback) {
    var file;
    var cwd = bundleFiles[0].cwd;
    var base = bundleFiles[0].base;
    var xliffConv = new XliffConv(xliffOptions);
    var promises = [];
    var self = this;
    var lang;
    while (bundleFiles.length > 0) {
      file = bundleFiles.shift();
      if (!gulpmatch(file, [
            joinableSrcPath + '**/bundle.json',
            joinableSrcPath + '**/locales/bundle.*.json',
            joinableSrcPath + '**/xliff/bundle.*.xlf'
          ])) {
        this.push(file);
      }
    }
    for (lang in bundles) {
      bundles[lang].bundle = true;
      this.push(new gutil.File({
        cwd: cwd,
        base: base,
        path: lang ? path.join(cwd, 'locales', 'bundle.' + lang + '.json')
                   : path.join(cwd, 'bundle.json'),
        contents: new Buffer(JSONstringify(bundles[lang], null, 2))
      }));
    }
    for (lang in bundles) {
      if (lang) {
        (function (destLanguage) {
          promises.push(new Promise(function (resolve, reject) {
            xliffConv.parseJSON(bundles, {
              srcLanguage: srcLanguage,
              destLanguage: destLanguage
            }, function (output) {
              self.push(new gutil.File({
                cwd: cwd,
                base: base,
                path: path.join(cwd, 'xliff', 'bundle.' + destLanguage + '.xlf'),
                contents: new Buffer(output)
              }));
              resolve();
            });
          }));
        })(lang);
      }
    }
    Promise.all(promises).then(function (outputs) {
      callback();
    });
  });

  var feedback = gulpif([
    '**/bundle.json',
    '**/locales/*.json',
    '**/' + elementsSrcPath + '/**/*.json',
    '**/xliff/bundle.*.xlf'
  ], gulp.dest(srcPath));

  return multipipe(
    scan,
    basenameSort,
    dropDefaultJSON,
    preprocess,
    tmpJSON,
    importXliff,
    leverage,
    exportXliff,
    feedback
  );
};
