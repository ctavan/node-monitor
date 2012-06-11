// Copyright 2012 mbr targeting GmbH. All Rights Reserved.

function monitorResponseTime(monitor) {
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
}
module.exports = monitorResponseTime;
