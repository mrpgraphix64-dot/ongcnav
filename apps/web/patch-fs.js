const fs = require('fs');

function wrapError(err, path) {
  if (err && err.code === 'EISDIR') {
    const e = new Error(`EINVAL: invalid argument, readlink '${path}'`);
    e.code = 'EINVAL';
    e.errno = -4071;
    e.syscall = 'readlink';
    e.path = path;
    return e;
  }
  return err;
}

const origReadlinkSync = fs.readlinkSync;
fs.readlinkSync = function (path, options) {
  try {
    return origReadlinkSync.call(fs, path, options);
  } catch (err) {
    throw wrapError(err, path);
  }
};

const origReadlink = fs.readlink;
fs.readlink = function (path, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = undefined;
  }
  return origReadlink.call(fs, path, options, (err, linkString) => {
    if (err) {
      return callback(wrapError(err, path));
    }
    return callback(null, linkString);
  });
};

if (fs.promises && fs.promises.readlink) {
  const origPromisesReadlink = fs.promises.readlink;
  fs.promises.readlink = async function (path, options) {
    try {
      return await origPromisesReadlink.call(fs.promises, path, options);
    } catch (err) {
      throw wrapError(err, path);
    }
  };
}
