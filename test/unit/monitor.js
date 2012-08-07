var monitor = require('../../lib/monitor');

var url = 'plaintext://localhost:2003/';
var interval = 500;

exports['monitor.update()'] = function(test) {
  var connect = monitor.factory(url, interval);
  connect(function(err, monitor) {
    monitor.gauge('group', 'gauge.name.' + 'test', function() {
      return Date.now();
    });

    monitor.update('group', 'name.' + 'test', Math.random() * 10);
    monitor.update('group', 'name.' + 'test', Math.random() * 10);
    monitor.update('group', 'name.' + 'test', Math.random() * 10);
    monitor.update('group', 'name.' + 'test', Math.random() * 10);

    monitor.updateTimer('group', 'timer.name.' + 'test', Math.random() * 10);
    monitor.updateHistogram('group', 'histogram.name.' + 'test',
                            Math.random() * 10);
    monitor.mark('group', 'meter.name.' + 'test');
    monitor.mark('group', 'meter.name.' + 'test', Math.random() * 10);

    setTimeout(function() {
      monitor.end();
      test.done();
    }, 2 * interval);
  });
};
