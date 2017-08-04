const deepmerge = require('deepmerge');

const clone = (o) => {
  if ((typeof o) === 'object') {
    return deepmerge({}, o, {clone: true});
  } else {
    return o;
  }
};

function CallbackFiller() {
    this.queues = {};
}

CallbackFiller.prototype.fill = function(key, err, data) {
    var waiting = this.queues[key];
    delete this.queues[key];

    if (waiting && waiting.length) {
        waiting.forEach(function(task, index) {
            (task.cb)(err, index > 0 ? clone(data) : data);
        });
    }
};

CallbackFiller.prototype.has = function(key) {
    return this.queues[key];
};

CallbackFiller.prototype.add = function(key, funcObj) {
    if (this.queues[key]) {
        this.queues[key].push(funcObj);
    } else {
        this.queues[key] = [funcObj];
    }
};

module.exports = CallbackFiller;
