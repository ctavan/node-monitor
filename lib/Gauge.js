function Gauge() {
  this.value = null;
}
module.exports = Gauge;

Gauge.prototype.setValue = function(value) {
  this.value = value;
};

Gauge.prototype.getValue = function() {
  return this.value;
};
