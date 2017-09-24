'use strict';

var Transform = require('readable-stream/transform');
var rs = require('replacestream');
var istextorbinary = require('istextorbinary');

module.exports = function(search, _replacement, options) {
  return new Transform({
    objectMode: true,
    transform: function(file, enc, callback) {
      if (file.isNull()) {
        return callback(null, null);
      }

      var replacement = _replacement;
      if (typeof _replacement === 'function') {
        // Pass the vinyl file object as this.file
        replacement = _replacement.bind({ file: file });
      }

      function doReplace() {
        var result;

        if (file.isStream()) {
          // TODO - compare streams
          file.contents = file.contents.pipe(rs(search, replacement));
          return callback(null, file);
        }

        if (file.isBuffer()) {
          if (search instanceof RegExp) {
            result = String(file.contents).replace(search, replacement);
          }
          else {
            var chunks = String(file.contents).split(search);

            if (typeof replacement === 'function') {
              // Start with the first chunk already in the result
              // Replacements will be added thereafter
              // This is done to avoid checking the value of i in the loop
              result = [ chunks[0] ];

              // The replacement function should be called once for each match
              for (var i = 1; i < chunks.length; i++) {
                // Add the replacement value
                result.push(replacement(search));

                // Add the next chunk
                result.push(chunks[i]);
              }

              result = result.join('');
            }
            else {
              result = chunks.join(replacement);
            }
          }

          if (file.contents != result) {
            file.contents = new Buffer(result);
            return callback(null, file);
          }
        }

        callback(null, null);
      }

      if (options && options.skipBinary) {
        istextorbinary.isText(file.path, file.contents, function(err, result) {
          if (err) {
            return callback(err, null);
          }

          if (!result) {
            callback(null, null);
          } else {
            doReplace();
          }
        });

        return;
      }

      doReplace();
    }
  });
};
