var os = require('os');

var async = require('async');
var graphite = require('graphite');
var log = require('log');
var measured = require('measured');
var _ = require('lodash');

var Gauge = require('./Gauge');

function Monitor(url, interval, collectionFilter) {
  this._interval = interval;
  this._collectionFilter = collectionFilter || _.identity;

  this._collections = {};
  this._graphiteClient = graphite.createClient(url);
  this._gauges = {};
  this._running = false;
  this._timeout = null;
}
module.exports = Monitor;

Monitor.prototype.collectionName = function(group) {
  return group;
};

Monitor.prototype.getCollection = function(group) {
  var name = this.collectionName(group);
  if (!this._collections[name]) {
    this._collections[name] = new measured.Collection(name);
  }
  return this._collections[name];
};

Monitor.prototype.getCollections = function() {
  return _.values(this._collections);
};

Monitor.prototype.updateTimer = function(group, name, value) {
  this.getCollection(group).timer(name).update(value);
};
Monitor.prototype.update = Monitor.prototype.updateTimer;

Monitor.prototype.updateHistogram = function(group, name, value) {
  this.getCollection(group).histogram(name).update(value);
};

Monitor.prototype.updateGauge = function(group, name, value) {
  var key = group + '.' + name;
  if (!this._gauges.hasOwnProperty(key)) {
    var gauge = new Gauge(value);
    this.gauge(group, name, function() {
      return gauge.getValue();
    });
    this._gauges[key] = gauge;
  }
  this._gauges[key].setValue(value);
};

Monitor.prototype.mark = function(group, name, value) {
  this.getCollection(group).meter(name).mark(value || 1);
};

Monitor.prototype.gauge = function(group, name, f) {
  this.getCollection(group).gauge(name, f);
};

Monitor.prototype.start = function(group, name) {
  return this.getCollection(group).timer(name).start();
};

Monitor.prototype.run = function() {
  var self = this;

  if (!self._interval) {
    return;
  }

  log.info('Graphite.interval: %s', self._interval);

  self._running = true;
  async.whilst(function() { return self._running; }, function(cb) {
    async.parallel([
      function(cb) {
        var collections = self.getCollections();
        async.mapSeries(collections, function(collection, cb) {
          var json = self._collectionFilter(collection.toJSON());
          self._graphiteClient.write(json, function(err) {
            if (err) {
              log.error('Graphite.write: %s', err);
            }

            cb(null);
          });
        }, cb);
      },
      function(cb) {
        self._timeout = setTimeout(cb, self._interval);
      },
    ], cb);
  }, function(err) {
    assert(false);
  });
};

Monitor.prototype.end = function() {
  this.getCollections().forEach(function(collection) {
    collection.end();
  });
  this._graphiteClient.end();

  self._running = false;
  clearTimeout(this._timeout);
};

Monitor.prototype.responseTimeMiddleware = function(group, key) {
  group = group || 'performance';

  if (typeof key !== 'function') {
    var prefix = key ? key + '.' : '';
    key = function(req, res) {
      var name = req.route.path.replace(/[^\w]+/g, '_');
      return prefix + name;
    };
  }

  var monitor = this;

  return function(req, res, next) {
    if (req._monitoring) {
      return next();
    }
    req._monitoring = true;

    var stopwatch = monitor.start(group, key(req, res));

    var end = res.end;
    res.end = function(chunk, encoding) {
      res.end = end;
      res.end(chunk, encoding);
      stopwatch.end();
    };

    next();
  };
};

Monitor.factory = function factory(url, interval, collectionFilter) {
  return function create(cb) {
    var monitor = new Monitor(url, interval, collectionFilter);
    monitor.run();

    cb(null, monitor);
  };
};
