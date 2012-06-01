var monitor = require('../../lib/monitor');

var url = 'plaintext://localhost:2003/';
var interval = 500;

exports['monitor.update()'] = function(test) {
  monitor.connect(url, interval, function(err, monitor) {
    monitor.update('group', 'name.' + 'test', Math.random() * 10);
    monitor.update('group', 'name.' + 'test', Math.random() * 10);
    monitor.update('group', 'name.' + 'test', Math.random() * 10);
    monitor.update('group', 'name.' + 'test', Math.random() * 10);
    setTimeout(function() {
      monitor.end();
      test.done();
    }, 2 * interval);
  });
};
