var os = require('os');

var measured = require('measured');
var graphite = require('graphite');
var log = require('log');

function Monitor(url) {
  this._hostname = os.hostname().replace(/\./g, '_');
  this._collections = {};
  this._intervallId = null;
  this._graphiteClient = graphite.createClient(url);
}

Monitor.prototype.collectionName = function(group) {
  return group + '.' + this._hostname;
};

Monitor.prototype.getCollection = function(group) {
  var name = this.collectionName(group);
  if (!this._collections[name]) {
    this._collections[name] = new measured.Collection(name);
  }
  return this._collections[name];
};

Monitor.prototype.forEachCollection = function(fn) {
  var self = this;
  Object.keys(self._collections).forEach(function(name) {
    fn(self._collections[name]);
  });
};

Monitor.prototype.update = function(group, name, value) {
  this.getCollection(group).histogram(name).update(value);
};

Monitor.prototype.start = function(group, name) {
  return this.getCollection(group).timer(name).start();
};

Monitor.prototype.end = function() {
  this.forEachCollection(function(collection) {collection.end();});
  this._graphiteClient.end();
  clearInterval(this._intervalId);
};

Monitor.prototype.responseTimeMiddleware = function() {
  var monitor = this;

  return function(req, res, next) {
    if (req._monitoring) {
      return next();
    }
    req._monitoring = true;

    var name = req.route.path.replace(/[^\w]+/g, '_');
    var stopwatch = monitor.start('performance', name);

    var end = res.end;
    res.end = function(chunk, encoding) {
      res.end = end;
      res.end(chunk, encoding);
      stopwatch.end();
    };

    next();
  };
};

exports.connect = function connect(url, interval, cb) {
  var monitor = new Monitor(url);

  function push() {
    monitor.forEachCollection(function(collection) {
      monitor._graphiteClient.write(collection.toJSON(), function(err) {
        if (err) {
          log.error('Graphite.write: %s', err);
        }
      });
      log.debug('Graphite.push: %s - %j', collection.name, collection.toJSON());
    });
  }
  if (interval) {
    monitor._intervalId = setInterval(push, interval);
  }
  cb(null, monitor);
};
