var os = require('os');

var measured = require('measured');
var graphite = require('graphite');
var log = require('log');

var Gauge = require('./Gauge');

function Monitor(url) {
  this._collections = {};
  this._intervallId = null;
  this._graphiteClient = graphite.createClient(url);
  this._gauges = {};
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

Monitor.prototype.forEachCollection = function(fn) {
  var self = this;
  Object.keys(self._collections).forEach(function(name) {
    fn(self._collections[name]);
  });
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

Monitor.prototype.end = function() {
  this.forEachCollection(function(collection) {collection.end();});
  this._graphiteClient.end();
  clearInterval(this._intervalId);
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
  collectionFilter = collectionFilter || identity;
  return function create(cb) {
    var monitor = new Monitor(url);

    function push() {
      monitor.forEachCollection(function(collection) {
        var json = collectionFilter(collection.toJSON());
        monitor._graphiteClient.write(json, function(err) {
          if (err) {
            log.error('Graphite.write: %s', err);
          }
        });
      });
    }
    if (interval) {
      log.info('Graphite.interval: %s', interval);
      monitor._intervalId = setInterval(push, interval);
    }
    cb(null, monitor);
  };
};

function identity(value) {
  return value;
}
